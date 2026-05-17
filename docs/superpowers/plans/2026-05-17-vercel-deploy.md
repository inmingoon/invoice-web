# Vercel viewer-only 출시 게이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vercel(Hobby plan, vercel.app 서브도메인)에 견적서 뷰어를 viewer-only 스코프로 배포하고 Preview에서 V1~V7 + cold start + ADMIN-404를 검증한 뒤 Production으로 promote, ROADMAP Phase 5 P5-T7 완료 기준의 마지막 게이트(외부 호스트 배포 + 수동 다운로드)를 충족한다.

**Architecture:** main 브랜치를 GitHub-Vercel Integration으로 자동 Preview 배포 → 회귀 스크립트로 검증 → 동일 빌드 산출물을 Dashboard에서 Production으로 alias 전환(Promote). admin 라우트는 production middleware에서 단언적으로 404 차단(`ENABLE_ADMIN=1`로 staging 재활성). 헤더는 `vercel.json` 단일 권위 소스로 통합.

**Tech Stack:** Next.js 15 App Router · @react-pdf/renderer · @notionhq/client · vitest · jose · Vercel Hobby

**Spec:** [`docs/superpowers/specs/2026-05-17-vercel-deploy-design.md`](../specs/2026-05-17-vercel-deploy-design.md)

---

## File Structure

```
변경 (코드)
├ middleware.ts                                 — admin·admin-login production 404 분기
├ app/api/invoice/[id]/pdf/route.ts             — runtime "nodejs" 명시
├ next.config.ts                                — headers() 함수 제거 (vercel.json 단일화)
└ vercel.json                                   — functions.maxDuration: 10 추가

신규 (테스트)
└ tests/middleware.test.ts                      — production 404 + ENABLE_ADMIN 분기 단위 테스트

신규 (스크립트·문서)
├ scripts/regression-v1-v7.mjs                  — V1~V6 + cold/warm + HEADER + ADMIN-404
├ docs/deploy/checklist.md                      — 운영자 수동 체크리스트
└ docs/deploy/2026-05-17-vercel-preview-results.md — 측정값 기록 템플릿

변경 (문서)
└ docs/ROADMAP.md                               — Phase 5 P5-T7 비고 갱신

선행 정리 (코드 — 본 계획 외 변경)
└ M 7파일 (app/invoice/[id]/page.tsx, components/invoice/*, lib/invoice/load-verified.ts, lib/notion.ts)
   — Items DB relational 마이그레이션 후속분으로 가설. 단일 커밋으로 정리 후 본 계획 시작.
```

---

## Phase A — 미커밋 변경 정리 (선행)

### Task A1: 7파일 diff 검토 → 단일 커밋

**Files:**

- Review (M, 7파일): `app/invoice/[id]/page.tsx`, `components/invoice/invoice-items-table.tsx`, `components/invoice/invoice-skeleton.tsx`, `components/invoice/invoice-summary.tsx`, `components/invoice/invoice-totals.tsx`, `lib/invoice/load-verified.ts`, `lib/notion.ts`

- [ ] **Step 1: diff 전수 검토**

```bash
git diff app/invoice/[id]/page.tsx components/invoice/invoice-items-table.tsx components/invoice/invoice-skeleton.tsx components/invoice/invoice-summary.tsx components/invoice/invoice-totals.tsx lib/invoice/load-verified.ts lib/notion.ts
```

Expected: 가설 — "Items DB relational 마이그레이션(가장 최근 커밋 44c99ec) 후속 정렬". 가설 불일치 시 다음 step 보류하고 사용자에게 보고.

- [ ] **Step 2: check-all 통과 확인 (커밋 전 사전 점검)**

```bash
npm run check-all
```

Expected: lint 0 warn + typecheck 0 error + format:check OK + vitest pass

- [ ] **Step 3: 단일 커밋 생성 (.claude/\* 제외)**

```bash
git add app/invoice/[id]/page.tsx components/invoice/invoice-items-table.tsx components/invoice/invoice-skeleton.tsx components/invoice/invoice-summary.tsx components/invoice/invoice-totals.tsx lib/invoice/load-verified.ts lib/notion.ts
git commit -m "$(cat <<'EOF'
fix(invoice): Items relational 마이그레이션 후속 정렬 — viewer UI/notion lib

44c99ec(Items DB relational 마이그레이션)의 연장선. 뷰 컴포넌트와
loadVerified·notion 매핑을 새 스키마에 맞춰 정렬.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: `[main <sha>] fix(invoice): ...` 출력, 7 files changed.

- [ ] **Step 4: 상태 확인**

```bash
git status --short
```

Expected: tracked M/A 없음, `.claude/agents/`, `.claude/commands/`만 untracked로 남음.

---

## Phase B — 출시 게이트 코드 변경

### Task B1: middleware.ts — production admin 404 분기

**Files:**

- Modify: `middleware.ts`
- Test: `tests/middleware.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/middleware.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";

describe("middleware admin gate", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnableAdmin = process.env.ENABLE_ADMIN;

  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "x".repeat(32));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENABLE_ADMIN = originalEnableAdmin;
  });

  it("returns 404 for /admin when production and ENABLE_ADMIN unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_ADMIN", "");
    const req = new NextRequest(new URL("http://localhost/admin"));
    const res = await middleware(req);
    expect(res.status).toBe(404);
  });

  it("returns 404 for /admin-login when production and ENABLE_ADMIN unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_ADMIN", "");
    const req = new NextRequest(new URL("http://localhost/admin-login"));
    const res = await middleware(req);
    expect(res.status).toBe(404);
  });

  it("passes /admin-login through (no redirect, no 404) when ENABLE_ADMIN=1 even in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_ADMIN", "1");
    const req = new NextRequest(new URL("http://localhost/admin-login"));
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("redirects /admin to /admin-login when ENABLE_ADMIN=1, no session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_ADMIN", "1");
    const req = new NextRequest(new URL("http://localhost/admin"));
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin-login");
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run tests/middleware.test.ts`

Expected: FAIL — 모든 케이스가 redirect(307) 응답이라 첫 두 케이스(404 기대)가 실패.

- [ ] **Step 3: middleware.ts 변경 적용**

Overwrite `middleware.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * /admin/* + /admin-login 보호.
 * - production && !ENABLE_ADMIN: 단언적 404 (viewer-only 배포 스코프)
 * - 그 외: /admin-login은 통과, /admin/*는 세션 검증 후 통과 또는 /admin-login 리다이렉트
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const adminEnabled =
    process.env.NODE_ENV !== "production" || process.env.ENABLE_ADMIN === "1";
  if (!adminEnabled) {
    return new NextResponse(null, { status: 404 });
  }

  if (req.nextUrl.pathname.startsWith("/admin-login")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(token)) {
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin-login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/admin-login"],
};
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx vitest run tests/middleware.test.ts`

Expected: 4 passed.

- [ ] **Step 5: 회귀 스모크 (전체 테스트)**

Run: `npm run test`

Expected: 모든 기존 테스트 통과 + 신규 middleware 4 케이스 통과.

---

### Task B2: PDF route — runtime "nodejs" 명시

**Files:**

- Modify: `app/api/invoice/[id]/pdf/route.ts:1`

- [ ] **Step 1: 파일 최상단에 runtime 선언 추가**

Edit `app/api/invoice/[id]/pdf/route.ts` — 기존 첫 줄(`import { createElement } from "react";`) 위에 다음 두 줄 추가:

```ts
export const runtime = "nodejs";
```

전체 파일 첫 5줄이 다음과 같이 되도록:

```ts
export const runtime = "nodejs";

import { createElement } from "react";

import { renderToBuffer } from "@react-pdf/renderer";
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`

Expected: 0 error.

---

### Task B3: next.config.ts — headers() 제거 (vercel.json 단일화)

**Files:**

- Modify: `next.config.ts` (전체 대체)

- [ ] **Step 1: 전체 파일 대체**

Overwrite `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 2: 빌드 검증**

Run: `npm run build`

Expected: 빌드 성공, 경고 0. `/invoice/[id]`와 `/api/invoice/[id]/pdf`는 여전히 `ƒ (Dynamic)` 표기. 헤더는 vercel.json이 적용하므로 dev 응답에서는 안 보일 수 있음(Vercel 배포 후 검증).

---

### Task B4: vercel.json — functions.maxDuration 추가

**Files:**

- Modify: `vercel.json`

- [ ] **Step 1: functions 블록 추가**

기존 `vercel.json`의 `headers` 배열 뒤에 `functions` 객체 추가. 전체 파일이 다음과 같이 되도록:

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "headers": [
    {
      "source": "/invoice/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" },
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
      ],
    },
    {
      "source": "/api/invoice/(.*)/pdf",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" },
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
      ],
    },
    {
      "source": "/admin/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" },
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
      ],
    },
    {
      "source": "/admin-login",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" },
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
      ],
    },
  ],
  "functions": {
    "app/api/invoice/[id]/pdf/route.ts": {
      "maxDuration": 10,
    },
  },
}
```

- [ ] **Step 2: JSON 파싱 검증**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'));console.log('OK')"`

Expected: `OK` 출력. (JSONC 주석은 없지만 parser는 strict JSON로 검증.)

---

### Task B5: check-all 통과 + 단일 커밋

**Files:** (no new files; commit B1~B4)

- [ ] **Step 1: 전체 검증 실행**

Run: `npm run check-all`

Expected: lint 0 warn + typecheck 0 error + format:check OK + vitest pass (middleware 4 신규 포함).

- [ ] **Step 2: 빌드 회귀 확인**

Run: `npm run build`

Expected: 빌드 성공, `/invoice/[id]`와 `/api/invoice/[id]/pdf`가 `ƒ (Dynamic)` 표기.

- [ ] **Step 3: 출시 게이트 커밋 생성**

```bash
git add middleware.ts tests/middleware.test.ts app/api/invoice/[id]/pdf/route.ts next.config.ts vercel.json
git commit -m "$(cat <<'EOF'
feat(deploy): Vercel viewer-only 출시 게이트

- middleware.ts: production && !ENABLE_ADMIN 시 /admin·/admin-login 404
- pdf/route.ts: export const runtime = "nodejs" (R2 보호)
- next.config.ts: headers() 제거, vercel.json 단일 권위 소스 (R7 보호)
- vercel.json: functions.maxDuration: 10 (Hobby 한계 코드화)
- tests/middleware.test.ts: 404 + ENABLE_ADMIN=1 분기 4 케이스

Spec: docs/superpowers/specs/2026-05-17-vercel-deploy-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: 5 files changed.

---

## Phase C — 회귀 스크립트 + 체크리스트 문서

### Task C1: scripts/regression-v1-v7.mjs 작성

**Files:**

- Create: `scripts/regression-v1-v7.mjs`

- [ ] **Step 1: 회귀 스크립트 작성**

Create `scripts/regression-v1-v7.mjs`:

```js
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
```

- [ ] **Step 2: 스크립트 syntax 검증**

Run: `node --check scripts/regression-v1-v7.mjs`

Expected: 출력 없음, exit 0.

---

### Task C2: 운영자 체크리스트 문서

**Files:**

- Create: `docs/deploy/checklist.md`

- [ ] **Step 1: 체크리스트 작성**

Create `docs/deploy/checklist.md`:

````markdown
# Vercel 배포 체크리스트 (viewer-only)

> 기준 spec: [`../superpowers/specs/2026-05-17-vercel-deploy-design.md`](../superpowers/specs/2026-05-17-vercel-deploy-design.md)

각 배포마다 본 체크리스트를 복사해 일자별 결과 파일에 첨부한다.

## 사전 조건

- [ ] Vercel 프로젝트 연결 완료 (GitHub Integration, Production Branch = main)
- [ ] Production env 4종 주입 완료
  - [ ] `NOTION_TOKEN`
  - [ ] `NOTION_DATABASE_ID`
  - [ ] `NOTION_DATA_SOURCE_ID` (선택)
  - [ ] `LOG_LEVEL=info`
- [ ] origin/main에 출시 게이트 커밋이 push 됨
- [ ] Preview deployment URL 확보

## Preview 검증

회귀 스크립트 실행:

```bash
BASE_URL=https://invoice-web-git-main-<user>.vercel.app \
ROW_A_ID=<id> ROW_A_TOKEN=<token> \
ROW_B_ID=<id> ROW_B_TOKEN=<token> \
node scripts/regression-v1-v7.mjs
```
````

- [ ] V1 정상 PASS
- [ ] V2 누락 PASS (404)
- [ ] V3 변조 PASS (404)
- [ ] V4-cold PASS (status 200 + %PDF), 소요 시간 < 10s (마진 ≥ 2s)
- [ ] V4-warm PASS, 소요 시간 < 3s
- [ ] HEADER-1 PASS (invoice 헤더 3종)
- [ ] HEADER-2 PASS (PDF 헤더 3종 + Content-Disposition: attachment)
- [ ] V6 만료 배지 PASS
- [ ] ADMIN-404 /admin PASS (404)
- [ ] ADMIN-404 /admin-login PASS (404)

수동:

- [ ] V5 Notion 수정 반영: row 금액 수정 후 V1 새로고침 → 새 값 가시
- [ ] V7 다크/모바일: Playwright MCP로 360px + dark mode toggle → 가로 스크롤 0, 가독성 유지

## Promote

- [ ] Vercel Dashboard → Deployments → 검증한 Preview build → "Promote to Production"
- [ ] Production URL alias 확인

## Production 수동 검증

- [ ] 정상 토큰으로 PDF 1회 다운로드 성공
- [ ] 응답 헤더 3종 prod에서도 일치 (`curl -I` 또는 DevTools)
- [ ] Vercel Logs에서 토큰 substring 미등장 확인

## 사후

- [ ] `docs/deploy/<YYYY-MM-DD>-vercel-preview-results.md` 측정값 기록
- [ ] `docs/ROADMAP.md` P5-T7 비고 갱신

## 실패 시

- V4-cold ≥ 9s: plan 재검토 — Pro 전환 또는 폰트/페이지 최적화 검토
- ADMIN-404 미응답: middleware matcher/분기 로직 점검, promote 차단
- HEADER 미일치: `vercel.json` headers 패턴 확인, promote 차단

````

---

### Task C3: 측정값 기록 템플릿

**Files:**
- Create: `docs/deploy/2026-05-17-vercel-preview-results.md`

- [ ] **Step 1: 결과 템플릿 작성**

Create `docs/deploy/2026-05-17-vercel-preview-results.md`:

```markdown
# Vercel Preview 회귀 결과 — 2026-05-17

> 기준 spec: [`../superpowers/specs/2026-05-17-vercel-deploy-design.md`](../superpowers/specs/2026-05-17-vercel-deploy-design.md)
> 체크리스트: [`./checklist.md`](./checklist.md)

## 환경

- Preview URL: `<채울 것>`
- Production URL (after promote): `<채울 것>`
- Vercel Plan: Hobby
- Functions Region: 자동 (Vercel 기본)
- Node version: `<vercel.json/package.json 기준>`

## 회귀 스크립트 출력

````

<scripts/regression-v1-v7.mjs 실행 결과 stdout 통째로 붙여넣기>

```

## 측정값

| 항목      | 측정값 | 임계  | 마진 |
| --------- | ------ | ----- | ---- |
| V4-cold   | ____ms | 10000 | ____ |
| V4-warm   | ____ms |  3000 | ____ |

## 수동 검증

- V5 Notion 수정 반영: PASS / FAIL — 메모: ____
- V7 다크/모바일: PASS / FAIL — 스크린샷: ____

## Production smoke test

- 정상 토큰 1회 다운로드: PASS / FAIL — 파일명: ____
- 헤더 3종: PASS / FAIL — curl -I 출력 캡처: ____
- Vercel Logs 토큰 미등장: PASS / FAIL — 검색어: ____

## 결론

- 전체 게이트: PASS / FAIL
- 후속 액션: ____
```

---

### Task C4: Phase C 커밋

- [ ] **Step 1: 스크립트·체크리스트·템플릿 커밋**

```bash
git add scripts/regression-v1-v7.mjs docs/deploy/checklist.md docs/deploy/2026-05-17-vercel-preview-results.md
git commit -m "$(cat <<'EOF'
chore(deploy): V1~V7 회귀 스크립트 + 운영자 체크리스트

- scripts/regression-v1-v7.mjs: HTTP 레이어 V1~V6 + Cold/Warm + HEADER + ADMIN-404
- docs/deploy/checklist.md: 운영자 재현 가능 체크리스트
- docs/deploy/2026-05-17-vercel-preview-results.md: 측정값 기록 템플릿

V5/V7은 별도 수동 + Playwright MCP.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: push**

```bash
git push origin main
```

Expected: GitHub origin/main 갱신.

---

## Phase D — Vercel 프로젝트 셋업 (수동)

> 본 Phase는 Vercel Dashboard 수동 작업이다. 코드 변경 없음. 단계마다 완료 표시.

### Task D1: 프로젝트 import + 환경변수 주입

- [ ] **Step 1: Vercel Dashboard에서 새 프로젝트 import**

브라우저 절차:

1. https://vercel.com/new
2. "Import Git Repository" → invoice-web 선택
3. Framework Preset: Next.js (자동)
4. Root Directory: `./` (기본)
5. Build/Output/Install: 기본
6. "Deploy" 누르기 전에 Environment Variables 입력 (Step 2)

- [ ] **Step 2: Production scope env 4종 입력**

Project Settings → Environment Variables → Production 선택, 다음 4개 추가:

| Key                     | Value 출처                                             |
| ----------------------- | ------------------------------------------------------ |
| `NOTION_TOKEN`          | `.env.local`의 `NOTION_TOKEN` (ntn\_...)               |
| `NOTION_DATABASE_ID`    | `.env.local`의 `NOTION_DATABASE_ID` (32자 hyphen 포함) |
| `NOTION_DATA_SOURCE_ID` | `.env.local`의 `NOTION_DATA_SOURCE_ID` (있을 경우)     |
| `LOG_LEVEL`             | `info`                                                 |

⚠️ 의도적 누락 (입력 안 함): `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, `ENABLE_ADMIN`, `NEXT_PUBLIC_SITE_URL`.

- [ ] **Step 3: Production Branch 확인**

Project Settings → Git → Production Branch = `main` 확인.

- [ ] **Step 4: 첫 배포 트리거**

"Deploy" 클릭 또는 Push 대기. 빌드 로그에서 다음 확인:

- `/invoice/[id]` 표기 `ƒ (Dynamic)`
- `/api/invoice/[id]/pdf` 표기 `ƒ (Dynamic)`
- 경고 0

### Task D2: Preview URL 확보

- [ ] **Step 1: Deployments 탭에서 최신 deployment 확인**

- [ ] **Step 2: Preview URL 복사**

형식: `https://invoice-web-git-main-<user>.vercel.app` 또는 `https://invoice-web-<hash>.vercel.app`

- [ ] **Step 3: Preview URL을 docs/deploy/2026-05-17-vercel-preview-results.md의 "Preview URL" 필드에 기록**

---

## Phase E — Preview 검증

### Task E1: 회귀 스크립트 실행

**Files:**

- Modify: `docs/deploy/2026-05-17-vercel-preview-results.md` (실행 결과 붙여넣기)

- [ ] **Step 1: env 준비 (`.env.regression` 임시 파일 또는 inline)**

`.env.local`에서 `NOTION_DATABASE_ID`로 dummy row A, row B 조회 후 `id`와 `access_token` 확보. (없으면 admin Phase B의 `app/admin/invoices/page.tsx`를 로컬에서 임시로 켜서 조회.)

`.env.regression`(gitignore, 임시) 또는 shell env:

```bash
export BASE_URL="<Preview URL from D2>"
export ROW_A_ID="<row A page id>"
export ROW_A_TOKEN="<row A access_token>"
export ROW_B_ID="<row B page id>"
export ROW_B_TOKEN="<row B access_token>"
```

- [ ] **Step 2: 회귀 스크립트 실행**

```bash
node scripts/regression-v1-v7.mjs
```

Expected: 끝줄 `PASS N/N` (모두 통과).

- [ ] **Step 3: 출력 결과를 results 파일에 붙여넣기**

`docs/deploy/2026-05-17-vercel-preview-results.md`의 "회귀 스크립트 출력" 섹션에 stdout 전체 복사.

- [ ] **Step 4: 측정값 표 채우기**

V4-cold·V4-warm 값을 "측정값" 표에 입력. 마진 계산:

- V4-cold 마진 = 10000 - 측정값
- V4-warm 마진 = 3000 - 측정값

V4-cold 마진 ≥ 1000ms (1초) 충족 확인. 미충족 시 Phase E 정지 + spec RB-1 대응 의사결정.

---

### Task E2: V5 Notion 수정 반영 수동 검증

- [ ] **Step 1: Notion에서 row A의 임의 항목 단가 수정**

예: items 첫 항목의 unit_price를 1000원 증감.

- [ ] **Step 2: Preview URL의 V1 페이지 새로고침**

```
https://<preview>/invoice/<ROW_A_ID>?token=<ROW_A_TOKEN>
```

Expected: 즉시 새 단가가 보임 (no-store 동작).

- [ ] **Step 3: Notion에서 원복**

수정한 단가를 원래 값으로 돌려놓기.

- [ ] **Step 4: results 파일 V5 항목 PASS 표시**

---

### Task E3: V7 다크/모바일 Playwright MCP 검증

- [ ] **Step 1: mcp**playwright**browser_resize 360x800**

- [ ] **Step 2: mcp**playwright**browser_navigate** to Preview V1 URL

- [ ] **Step 3: mcp**playwright**browser_take_screenshot** — 라이트 모드, 360px

- [ ] **Step 4: mcp**playwright**browser_evaluate** — `document.documentElement.scrollWidth <= 360`

Expected: true.

- [ ] **Step 5: 다크 모드 토글** — site-header의 ThemeToggle 클릭

- [ ] **Step 6: mcp**playwright**browser_take_screenshot** — 다크 모드, 360px

- [ ] **Step 7: 두 스크린샷 파일 경로를 results 파일 "수동 검증" 섹션에 기록**

---

## Phase F — Production Promote + 검증

### Task F1: Promote to Production

- [ ] **Step 1: Vercel Dashboard → Deployments**

검증 완료한 Preview deployment 우클릭 → "Promote to Production" 선택.

- [ ] **Step 2: Production URL 확인**

형식: `https://invoice-web.vercel.app` 또는 사용자 프로젝트명 기준 vercel.app 도메인.

- [ ] **Step 3: results 파일 Production URL 기록**

---

### Task F2: Production smoke test

- [ ] **Step 1: 정상 토큰으로 PDF 1회 다운로드**

```bash
curl -L -o /tmp/smoke.pdf "<PROD_URL>/api/invoice/<ROW_A_ID>/pdf?token=<ROW_A_TOKEN>"
head -c 4 /tmp/smoke.pdf  # %PDF 확인
ls -la /tmp/smoke.pdf      # 크기 < 400KB
```

Expected: 첫 4바이트 `%PDF`, 파일 크기 100~400KB 범위.

- [ ] **Step 2: 헤더 3종 검증**

```bash
curl -sI "<PROD_URL>/invoice/<ROW_A_ID>?token=<ROW_A_TOKEN>" | grep -iE "cache-control|x-robots-tag|referrer-policy"
curl -sI "<PROD_URL>/api/invoice/<ROW_A_ID>/pdf?token=<ROW_A_TOKEN>" | grep -iE "cache-control|x-robots-tag|referrer-policy|content-disposition"
```

Expected:

- `cache-control: no-store`
- `x-robots-tag: noindex, nofollow`
- `referrer-policy: no-referrer`
- (PDF only) `content-disposition: attachment; filename="..."`

- [ ] **Step 3: ADMIN-404 prod 검증**

```bash
curl -sI "<PROD_URL>/admin" | head -1
curl -sI "<PROD_URL>/admin-login" | head -1
```

Expected: 둘 다 `HTTP/2 404`.

- [ ] **Step 4: results 파일 production smoke 섹션 갱신**

---

### Task F3: Vercel Logs 토큰 미등장 검증

- [ ] **Step 1: Vercel Dashboard → Logs → Production**

- [ ] **Step 2: 최근 1시간 로그에서 token substring 검색**

검색어: ROW_A_TOKEN의 앞 8자 (예: `kJ9-Hh_2`).

Expected: 0 hit.

- [ ] **Step 3: results 파일 PASS 표시**

---

## Phase G — 마무리 (ROADMAP 갱신)

### Task G1: ROADMAP P5-T7 비고 갱신 + 커밋

**Files:**

- Modify: `docs/ROADMAP.md` (Phase 5 마지막 완료 기준 라인)
- Modify: `docs/deploy/2026-05-17-vercel-preview-results.md` (결론 채우기)

- [ ] **Step 1: ROADMAP Phase 5의 P5-T7 비고 갱신**

Edit `docs/ROADMAP.md` — 다음 라인을 찾아:

```markdown
- [x] 프로덕션 환경에서 정상 토큰으로 1회 수동 다운로드 성공 (production local boot 헤더 라이브 검증 완료; 외부 호스트 배포 + 수동 다운로드는 사용자 액션 단계 — 별도 가이드 제시)
```

다음으로 대체:

```markdown
- [x] 프로덕션 환경에서 정상 토큰으로 1회 수동 다운로드 성공 — Vercel <PROD_URL>에서 2026-05-17 검증 완료. 측정값: `docs/deploy/2026-05-17-vercel-preview-results.md`. Spec: `docs/superpowers/specs/2026-05-17-vercel-deploy-design.md`.
```

(`<PROD_URL>`은 F1에서 확정한 실제 도메인으로 치환.)

- [ ] **Step 2: results 파일 "결론" 섹션 채우기**

전체 게이트 PASS/FAIL 결정, 후속 액션 명시.

- [ ] **Step 3: 마무리 커밋**

```bash
git add docs/ROADMAP.md docs/deploy/2026-05-17-vercel-preview-results.md
git commit -m "$(cat <<'EOF'
docs(deploy): Vercel viewer-only 배포 완료 — Phase 5 P5-T7 게이트 충족

- ROADMAP Phase 5 마지막 완료 기준 비고 갱신 (외부 호스트 검증 완료)
- docs/deploy/2026-05-17-vercel-preview-results.md 측정값·결론 기록

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

Expected: Vercel가 push를 감지 — 단, 문서 변경뿐이라 promote된 prod 빌드와 다른 새 preview 생성. 의도된 동작(추가 promote 불필요).

---

## Out of Scope (본 plan 범위 외)

본 plan 실행 후 다음은 별도 spec/plan으로 추진:

- Vercel 커스텀 도메인 연결 (spec D3 후속)
- admin 활성화 (`ENABLE_ADMIN=1` + SESSION_SECRET + ADMIN_PASSWORD_HASH 주입)
- Sentry/Logtail/Better Stack 외부 모니터링 도입
- Upstash/Vercel KV로 rate-limit·cache 외부 store 전환 (PRD §10)
- Region pinning (`icn1`), 폰트 서브셋 추가 최적화 (Approach C 항목)
- `npm run check-all`의 vitest에 middleware integration test 추가 (NextRequest cookies 시뮬레이션 등)

---

## 리스크 핸드오프

본 plan 실행 중 다음이 관찰되면 즉시 중단 + 사용자 협의:

| 관찰                                             | 즉시 조치                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| V4-cold ≥ 9s (마진 < 1s)                         | Phase E2 종료, plan에 "Pro 전환" 또는 "폰트/페이지 최적화" 의사결정 항목 추가 |
| HEADER-1 / HEADER-2 미일치                       | vercel.json 패턴/순서 점검. Vercel routing 우선순위 차이 가능성               |
| ADMIN-404 미응답                                 | middleware matcher 또는 NODE_ENV 분기 버그. promote 차단                      |
| Vercel Logs에서 토큰 substring 등장              | logger 호출 지점 점검 (PRD §7 위반). 즉시 patch + redeploy                    |
| 미커밋 7파일 diff가 가설(Items 후속)과 다른 의도 | Phase A 중단, 사용자에게 보고                                                 |
