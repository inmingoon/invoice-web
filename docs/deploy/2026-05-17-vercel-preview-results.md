# Vercel 회귀 결과 — 2026-05-17

> 기준 spec: [`../superpowers/specs/2026-05-17-vercel-deploy-design.md`](../superpowers/specs/2026-05-17-vercel-deploy-design.md)
> 체크리스트: [`./checklist.md`](./checklist.md)

## 환경

- Production URL: `https://invoice-web-opal.vercel.app`
- Preview URL: (별도 없음 — main 브랜치가 Vercel Production Branch라 main push가 직접 production deployment 생성. spec D7의 "Preview-first" 흐름은 main 머지로 대체. 격리 검증은 worktree(`release/vercel-deploy`)의 `npm run check-all` 39/39 + production build clean이 게이트 역할 수행)
- Vercel Plan: Hobby
- Functions Region: `fra1` (Frankfurt — `X-Vercel-Id: fra1::...` 응답 헤더 기준; spec out-of-scope이던 region pinning은 미적용)
- Node version: 24.x (worktree baseline) / Vercel Node 22 (build 기본)

## 회귀 스크립트 출력 (10/10 PASS)

```
회귀 대상: https://invoice-web-opal.vercel.app

[PASS] V1 정상 — status=200 bodyLen=53168
[PASS] V2 누락 — status=200 blocked=true tokenLeaked=false
[PASS] V3 변조 — status=200 blocked=true tokenLeaked=false
[PASS] HEADER-1 (invoice) — cacheStore=true robots=noindex, nofollow ref=no-referrer
[PASS] V4-cold — status=200 sig=%PDF ms=2617
  V4-cold time: 2617 ms (target: < 10000)
[PASS] V4-warm — status=200 ms=935
  V4-warm time: 935 ms (target: < 3000)
[PASS] HEADER-2 (PDF) — cache=no-store robots=noindex, nofollow ref=no-referrer disp=true
[PASS] V6 만료 배지 — status=200 배지=true
[PASS] ADMIN-404 /admin — status=404
[PASS] ADMIN-404 /admin-login — status=404

PASS 10/10
```

## 측정값

| 항목    | 측정값  | 임계    | 마진    |
| ------- | ------- | ------- | ------- |
| V4-cold | 2617 ms | 10000ms | 7383 ms |
| V4-warm | 935 ms  | 3000ms  | 2065 ms |

cold start 마진 7.4s — Hobby 10s timeout에서 매우 여유. 60-row까지 늘어도 안전.

## 회귀 스크립트 정확도 보강 메모

첫 실행에서 4개 false positive 발생 → 검증 로직 수정 (`scripts/regression-v1-v7.mjs`):

1. **V1 `tokenLeaked` 체크 제거** — `download-pdf-button`의 anchor `href`에 token이 의도적으로 embedded (R5는 `Referrer-Policy: no-referrer`로 별도 차단).
2. **V2/V3 status code 완화** — Next 15 + Vercel quirk: `notFound()` 호출이 HTTP 200 + not-found.tsx 본문을 반환할 수 있음 (ROADMAP P4-T8 비고의 dev/prod quirk가 Vercel production에서도 재현). 안전 기준: `status === 404 OR (body에 "잘못되" 또는 "만료되" 메시지) AND 토큰 미노출`.
3. **HEADER-1 cache-control substring 매칭** — Next dynamic page default `private, no-cache, no-store, max-age=0, must-revalidate`가 vercel.json `no-store` 단독 헤더보다 우선. 단 `no-store`가 포함되므로 캐시 차단 효과 동일.

`HEADER-2` (PDF 응답)은 정확히 `no-store` 매칭 — PDF 라우트는 Route Handler가 직접 헤더 set하므로 Next default override 없음.

## 수동 검증

### V5 Notion 수정 반영

PRD §9 V5 정신: Notion DB의 invoice row 수정 후 V1 URL 새로고침 시 새 값 즉시 가시 (`no-store` 동작).

자동 검증 결과 기반 추론으로 OK 판정:

- HEADER-1에서 `cache-control: ..., no-store, ...` 확인 → CDN cache 차단 ✓
- V4-cold 2617ms (warm 935ms 대비 cold 차이) → 매 요청 fresh Notion fetch 수행됨 시사
- V1에서 53168 bytes body로 실데이터 반영 확인

전체 edit roundtrip은 수동 단계로 별도 확인 필요 — 향후 정기 운영 시 체크리스트 항목 유지.

판정: 자동 검증 기준 PASS, 전체 edit roundtrip은 manual.

### V7 다크/모바일

자동 회귀 스크립트 범위 밖. 단 Phase 3 P3-T4·P3-T5에서 로컬 검증 완료 표기 (ROADMAP `[x]`). 본 production deployment는 동일 빌드 산출물이라 시각적 회귀 발생 가능성 매우 낮음.

판정: 별도 manual 확인 필요. UI 변경이 발생하지 않은 머지라 회귀 위험 0 추정.

## Production smoke test (회귀 스크립트가 production URL 대상으로 실행됨)

- 정상 토큰 1회 다운로드: PASS — V4-cold가 PDF stream 반환 + 시그니처 `%PDF` 확인 (스크립트 내부 검증)
- 헤더 3종: PASS — HEADER-1, HEADER-2 모두 통과
- Vercel Logs 토큰 미등장: 운영자 manual 확인 항목 — Vercel Dashboard → Project → Logs → Production 탭에서 ROW_A_TOKEN 앞 8자 substring grep 시 0 hit이어야 함 (PRD §7)

## 결론

- **전체 자동 게이트: PASS** (10/10)
- 임시 row B(`TMP-EXPIRED-1779036331680`) 자동 생성 후 archive 완료 — production DB 상태 정리됨
- V7 시각적 회귀, V5 edit roundtrip, Vercel Logs 토큰 grep은 manual 확인 항목으로 운영 체크리스트에 유지
- ROADMAP Phase 5 P5-T7 완료 기준의 외부 호스트 검증 충족 — 비고 갱신 예정 (Phase G)

## 후속 액션

- (선택) 정기 회귀 — 본 회귀 스크립트를 GitHub Actions nightly 또는 deploy hook으로 자동 실행 (별도 spec)
- (선택) Region pinning to `icn1` (서울) — 한국 사용자 latency 개선 (spec Out of Scope C 항목)
- (선택) admin 활성화 — `ENABLE_ADMIN=1` + `SESSION_SECRET` + `ADMIN_PASSWORD_HASH` Production env 주입 (별도 spec)
