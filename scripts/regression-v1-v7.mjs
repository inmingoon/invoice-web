#!/usr/bin/env node
/**
 * Vercel Preview/Production 회귀 검증 — V1~V6 + Cold/Warm + HEADER + ADMIN-404.
 * V7 (다크/모바일)은 별도 Playwright MCP로 검증.
 *
 * 사용:
 *   BASE_URL=https://invoice-web-git-main-<user>.vercel.app \
 *   ROW_A_ID=<id> ROW_A_TOKEN=<token> \
 *   ROW_B_ID=<id> ROW_B_TOKEN=<token> \
 *   node scripts/regression-v1-v7.mjs
 *
 * 출력:
 *   - 각 시나리오 결과 (PASS/FAIL)
 *   - V4-cold·V4-warm 측정값 (ms)
 *   - 최종 라인: PASS X/Y
 */

const BASE_URL = mustEnv("BASE_URL").replace(/\/$/, "");
const ROW_A_ID = mustEnv("ROW_A_ID");
const ROW_A_TOKEN = mustEnv("ROW_A_TOKEN");
const ROW_B_ID = mustEnv("ROW_B_ID");
const ROW_B_TOKEN = mustEnv("ROW_B_TOKEN");

const results = [];

function mustEnv(key) {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing env: ${key}`);
    process.exit(2);
  }
  return v;
}

function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id} — ${detail}`);
}

async function timedFetch(url, init) {
  const start = Date.now();
  const res = await fetch(url, init);
  const ms = Date.now() - start;
  return { res, ms };
}

function tamper(token) {
  // 마지막 글자 변경 — base64url 안전 문자로
  const last = token.slice(-1);
  const repl = last === "A" ? "B" : "A";
  return token.slice(0, -1) + repl;
}

function expectHeader(res, key, expected) {
  const actual = res.headers.get(key) ?? "";
  return { ok: actual === expected, actual, expected };
}

async function v1Normal() {
  const url = `${BASE_URL}/invoice/${ROW_A_ID}?token=${encodeURIComponent(ROW_A_TOKEN)}`;
  const { res } = await timedFetch(url);
  const body = await res.text();
  const has200 = res.status === 200;
  // 정상 페이지는 InvoiceSummary + ItemsTable + Totals 합쳐 충분히 큼.
  // 404 not-found 페이지(약 1KB)와 구분 위해 2KB 이상 + 토큰 substring 미등장.
  const tokenLeaked = body.includes(ROW_A_TOKEN);
  const sufficientBody = body.length > 2000;
  record(
    "V1 정상",
    has200 && sufficientBody && !tokenLeaked,
    `status=${res.status} bodyLen=${body.length} tokenLeaked=${tokenLeaked}`,
  );
}

async function v2Missing() {
  const url = `${BASE_URL}/invoice/${ROW_A_ID}`;
  const { res } = await timedFetch(url);
  const body = await res.text();
  const is404 = res.status === 404;
  // 보호 필드 미노출 — row A의 토큰 substring이 본문에 없어야 함.
  const tokenLeaked = body.includes(ROW_A_TOKEN);
  record(
    "V2 누락",
    is404 && !tokenLeaked,
    `status=${res.status} tokenLeaked=${tokenLeaked}`,
  );
}

async function v3Tampered() {
  const url = `${BASE_URL}/invoice/${ROW_A_ID}?token=${encodeURIComponent(tamper(ROW_A_TOKEN))}`;
  const { res } = await timedFetch(url);
  const is404 = res.status === 404;
  record("V3 변조", is404, `status=${res.status}`);
}

async function v4Pdf() {
  const url = `${BASE_URL}/api/invoice/${ROW_A_ID}/pdf?token=${encodeURIComponent(ROW_A_TOKEN)}`;
  // Cold start 측정 — 30초+ idle 가정. 호출 직전 다른 함수 호출 회피.
  const { res: coldRes, ms: coldMs } = await timedFetch(url);
  const buf = Buffer.from(await coldRes.arrayBuffer());
  const sig = buf.subarray(0, 4).toString("latin1");
  const is200 = coldRes.status === 200;
  const hasPdfSig = sig === "%PDF";
  record(
    "V4-cold",
    is200 && hasPdfSig,
    `status=${coldRes.status} sig=${sig} ms=${coldMs}`,
  );
  console.log(`  V4-cold time: ${coldMs} ms (target: < 10000)`);

  // Warm 측정 — 즉시 재호출
  const { res: warmRes, ms: warmMs } = await timedFetch(url);
  record(
    "V4-warm",
    warmRes.status === 200,
    `status=${warmRes.status} ms=${warmMs}`,
  );
  console.log(`  V4-warm time: ${warmMs} ms (target: < 3000)`);

  // 헤더 3종 + Content-Disposition 검증
  const hdrCache = expectHeader(coldRes, "cache-control", "no-store");
  const hdrRobots = expectHeader(coldRes, "x-robots-tag", "noindex, nofollow");
  const hdrRef = expectHeader(coldRes, "referrer-policy", "no-referrer");
  const dispOk = (coldRes.headers.get("content-disposition") ?? "").startsWith(
    "attachment;",
  );
  const allHdrs = hdrCache.ok && hdrRobots.ok && hdrRef.ok && dispOk;
  record(
    "HEADER-2 (PDF)",
    allHdrs,
    `cache=${hdrCache.actual} robots=${hdrRobots.actual} ref=${hdrRef.actual} disp=${dispOk}`,
  );
}

async function v5Header1() {
  // HEADER-1: /invoice/<id>?token=... 헤더 3종
  const url = `${BASE_URL}/invoice/${ROW_A_ID}?token=${encodeURIComponent(ROW_A_TOKEN)}`;
  const { res } = await timedFetch(url);
  const hdrCache = expectHeader(res, "cache-control", "no-store");
  const hdrRobots = expectHeader(res, "x-robots-tag", "noindex, nofollow");
  const hdrRef = expectHeader(res, "referrer-policy", "no-referrer");
  const ok = hdrCache.ok && hdrRobots.ok && hdrRef.ok;
  record(
    "HEADER-1 (invoice)",
    ok,
    `cache=${hdrCache.actual} robots=${hdrRobots.actual} ref=${hdrRef.actual}`,
  );
}

async function v6Expired() {
  const url = `${BASE_URL}/invoice/${ROW_B_ID}?token=${encodeURIComponent(ROW_B_TOKEN)}`;
  const { res } = await timedFetch(url);
  const body = await res.text();
  const is200 = res.status === 200;
  const hasExpiredBadge = body.includes("만료됨");
  record(
    "V6 만료 배지",
    is200 && hasExpiredBadge,
    `status=${res.status} 배지=${hasExpiredBadge}`,
  );
}

async function admin404() {
  for (const path of ["/admin", "/admin-login"]) {
    const { res } = await timedFetch(`${BASE_URL}${path}`);
    record(`ADMIN-404 ${path}`, res.status === 404, `status=${res.status}`);
  }
}

async function main() {
  console.log(`회귀 대상: ${BASE_URL}\n`);
  await v1Normal();
  await v2Missing();
  await v3Tampered();
  await v5Header1();
  await v4Pdf();
  await v6Expired();
  await admin404();
  // V5 (Notion 수정 반영) 와 V7 (다크/모바일) 은 수동
  console.log("\n--- 수동 확인 항목 ---");
  console.log(
    "V5 Notion 수정 반영: Notion에서 row 금액 수정 후 V1 URL 새로고침 → 새 값 가시",
  );
  console.log(
    "V7 다크/모바일: Playwright MCP로 360px + dark mode 토글 → 스크롤·가독성",
  );

  const pass = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\nPASS ${pass}/${total}`);
  process.exit(pass === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});
