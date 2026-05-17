# Vercel 실배포 마무리 — 설계 (viewer-only 출시 게이트)

> 작성일: 2026-05-17
> 기준 ROADMAP: [`docs/ROADMAP.md`](../../ROADMAP.md) Phase 5
> 기준 PRD: [`docs/PRD.md`](../../PRD.md)
> Approach: **B — Solid (출시 게이트 강화)**
> 예상 소요: **1 영업일**

---

## 1. 배경

ROADMAP Phase 5의 완료 기준은 모두 `[x]`로 표기되어 있으나 실 검증 환경은 **production local boot** (Invoke-WebRequest)이었다. Vercel 외부 호스트에 배포해 다음 두 가지를 마지막 게이트로 박는다:

1. Vercel serverless edge + Node runtime 경로에서도 헤더 3종·PDF 응답이 동일하게 유지되는가
2. Hobby plan 10초 함수 timeout 안에서 PDF cold start가 안정적으로 완료되는가

main 브랜치에는 ROADMAP 본문(견적서 뷰어 Phase 1~5) 외에 admin Phase A~E 결과물이 합쳐져 있다. 본 배포는 **viewer-only 스코프**로 한정하고 admin 라우트는 production에서 단언적으로 404 차단한다.

---

## 2. 확정 결정사항

| #   | 항목                 | 결정                                                                                                  |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------- |
| D1  | 배포 스코프          | viewer-only (`/invoice/[id]`, `/api/invoice/[id]/pdf`)                                                |
| D2  | admin 차단 방식      | production middleware에서 `/admin/*`·`/admin-login` 단언적 404. `ENABLE_ADMIN=1`로 staging에서 재활성 |
| D3  | 도메인               | vercel.app 서브도메인 (커스텀 도메인은 후속 별건)                                                     |
| D4  | Vercel 플랜          | Hobby (함수 timeout 10초 고정)                                                                        |
| D5  | 미커밋 변경 처리     | diff 검토 후 1개 커밋으로 정리 + 출시 게이트 커밋과 분리                                              |
| D6  | 헤더 권위 소스       | `vercel.json` 단일화 (`next.config.ts` headers 제거)                                                  |
| D7  | 배포 흐름            | main push → Preview 자동 생성 → V1~V7 + cold start 검증 → Promote                                     |
| D8  | 모니터링             | Vercel Logs + email 알람. Sentry/Logtail은 out of scope                                               |
| D9  | NEXT_PUBLIC_SITE_URL | 미설정. viewer-only에서 link-generator(admin 전용) 비활성                                             |
| D10 | 60-row 측정          | 현재 production data 최대 row로 대체. 임시 fixture row는 만들지 않음                                  |

---

## 3. 코드 변경 (3개 파일)

### 3.1 `middleware.ts` — admin·admin-login production 404 차단

기존: `/admin/:path*`만 matcher, 세션 검증 후 redirect to `/admin-login`.

변경: matcher에 `/admin-login` 추가. 진입 시 production이고 `ENABLE_ADMIN` env가 미설정이면 즉시 `404` 응답. 기존 admin 세션 검증 로직은 ENABLE_ADMIN=1 (staging) 분기에서만 동작.

```ts
// 의사 코드 — 실제 구현은 plan 단계에서
export const config = {
  matcher: ["/admin/:path*", "/admin-login"],
};

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const adminEnabled = process.env.NODE_ENV !== "production"
    || process.env.ENABLE_ADMIN === "1";
  if (!adminEnabled) {
    return new NextResponse(null, { status: 404 });
  }
  // 기존 /admin/* 세션 검증 로직 — /admin-login은 통과시키되 /admin/*만 검증
  ...
}
```

핵심: `/admin-login`까지 matcher에 포함하지 않으면 production에서 폼만 노출되어 사용자가 혼란. 차단해야 admin 진입 경로가 완전 봉인됨.

### 3.2 `app/api/invoice/[id]/pdf/route.ts` — Node.js runtime 명시

추가: 파일 최상단에 `export const runtime = "nodejs";`

이유: `@react-pdf/renderer.renderToBuffer`는 Node API(`Buffer`, fs 의존성 일부) 사용. Next 15 Route Handler 기본은 Node지만 향후 Vercel·Next 정책 변화로 Edge auto-promote 시 비호환. 명시 = R2 보호.

### 3.3 `next.config.ts` — headers() 제거

기존: `headers()` 함수가 vercel.json과 동일 패턴/값 이중 선언.

변경: 함수 통째로 제거. `NextConfig` 자체는 빈 객체로 export.

이유: 단일 권위 소스. 변경 시 두 곳을 동기화하지 않으면 R7과 동급 누락 사고. Vercel headers는 CDN edge 단에서 적용되어 framework 레벨보다 1번 빠른 우선순위 → 사실상 vercel.json이 권위.

---

## 4. Vercel 프로젝트 구성

### 4.1 프로젝트 설정 (대시보드)

- Framework Preset: Next.js (자동)
- Root Directory: `./`
- Build Command: `next build` (기본)
- Output Directory: `.next` (기본)
- Install Command: `npm install` (기본)
- Production Branch: `main`
- GitHub Integration: enable (push 시 preview 자동 생성)

### 4.2 환경 변수 (Production scope)

| 키                      | 값                                      | 비고                                                     |
| ----------------------- | --------------------------------------- | -------------------------------------------------------- |
| `NOTION_TOKEN`          | `ntn_...` (Internal Integration secret) | NEXT*PUBLIC* 금지                                        |
| `NOTION_DATABASE_ID`    | 32자 hyphen 포함 page id                | DB URL 마지막 segment                                    |
| `NOTION_DATA_SOURCE_ID` | (선택)                                  | 미설정 시 `lib/notion.ts:getDataSourceId`로 자동 resolve |
| `LOG_LEVEL`             | `info`                                  | `lib/logger.ts`의 ORDER threshold 기준                   |

**의도적 누락**:

- `SESSION_SECRET`, `ADMIN_PASSWORD_HASH` — admin 차단 상태 (D2)
- `ENABLE_ADMIN` — staging에서 admin 테스트 시 `1`로 set
- `NEXT_PUBLIC_SITE_URL` — admin link-generator 전용이고 admin 비활성 (D9)

### 4.3 `vercel.json` 추가 항목

```jsonc
{
  // 기존 headers 유지 — D6에 따라 단일 권위 소스
  "functions": {
    "app/api/invoice/[id]/pdf/route.ts": {
      "maxDuration": 10,
    },
  },
}
```

Hobby plan 한계를 코드로 명시. Pro 전환 시 한 곳만 30/60으로 수정.

---

## 5. 배포 흐름

```
Local main
  │
  ├── Step 1: 미커밋 7파일 diff 검토 → 의도 파악 (Items 마이그레이션 후속)
  ├── Step 2: 커밋 A "fix(invoice): Items relational 마이그레이션 후속 정렬"
  ├── Step 3: 코드 변경 3개 적용 (middleware/pdf-route/next.config)
  │            + vercel.json functions.maxDuration: 10
  ├── Step 4: npm run check-all (lint + typecheck + format:check + test)
  └── Step 5: 커밋 B "feat(deploy): Vercel viewer-only 출시 게이트"

git push origin main
  │
  └── Vercel: GitHub push 감지 → Preview Deployment 자동 생성
        │
        └── Preview URL: invoice-web-git-main-<user>.vercel.app

Preview 검증 (Section 6)
  │
  ├── V1~V7 회귀 7/7 통과
  ├── Cold start V4 < 10s 확인
  ├── ADMIN-404 검증
  └── Headers 3종 + Content-Disposition 매치

Vercel Dashboard → Promote to Production
  │
  └── Production URL: <project>.vercel.app
        │
        └── 정상 토큰 1회 수동 다운로드 (P5-T7 완료 기준 충족)
```

**핵심 디자인**: Promote는 **동일 빌드 산출물의 alias 전환**이라 재빌드 회귀 위험 0. 롤백도 직전 deployment를 다시 promote.

---

## 6. 회귀 검증 시나리오 (Preview 단계)

`scripts/regression-v1-v7.mjs`에 박제. 측정값은 `docs/deploy/2026-05-17-vercel-preview-results.md`에 기록.

### 6.1 PRD §9 V1~V7

| 시나리오            | 입력                                                     | 기대 응답                         |
| ------------------- | -------------------------------------------------------- | --------------------------------- |
| V1 정상 토큰        | `/invoice/<idA>?token=<tokenA>`                          | 200 + invoice_no, items 가시      |
| V2 토큰 누락        | `/invoice/<idA>`                                         | 404, 보호 필드 미노출             |
| V3 토큰 변조        | `/invoice/<idA>?token=<tokenA의 1자 변조>`               | 404, 보호 필드 미노출             |
| V4 PDF              | `/api/invoice/<idA>/pdf?token=<tokenA>`                  | 200, `%PDF` 시그니처, 헤더 3종    |
| V5 Notion 수정 반영 | row 금액 수정 후 V1 재요청                               | 새 값 가시 (no-store 동작 확인)   |
| V6 만료 배지        | `/invoice/<idB>?token=<tokenB>` (rowB는 expires_at 과거) | "만료됨" 배지                     |
| V7 다크/모바일      | 360px viewport + dark mode toggle                        | 가로 스크롤 0, 카드/테이블 가독성 |

### 6.2 Approach B 고유 측정

| 측정 ID   | 입력                                          | 기대                                                                               |
| --------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| V4-cold   | Preview 첫 호출 (30분+ idle 후)               | total < 10s, 측정값 기록                                                           |
| V4-warm   | V4-cold 30초 내 재호출                        | total < 3s, 측정값 기록                                                            |
| V4-max    | (대체) 현재 production 최대 items row로 측정  | total < 10s. 임시 60-row fixture는 만들지 않음 (D10)                               |
| HEADER-1  | curl -I `/invoice/<idA>?token=...`            | Cache-Control no-store, X-Robots-Tag noindex/nofollow, Referrer-Policy no-referrer |
| HEADER-2  | curl -I `/api/invoice/<idA>/pdf?token=...`    | 위 3종 + `Content-Disposition: attachment; filename="..."`                         |
| ADMIN-404 | curl -I `/admin`, `/admin-login` (production) | 둘 다 404                                                                          |

### 6.3 실패 처리

- V4-cold timeout 관찰 시: 본 설계는 Hobby로 출발하나, 측정값이 9초+를 보이면 plan에 "Pro 전환" 의사결정 항목을 즉시 추가하고 promote 보류.
- ADMIN-404 미응답 시: middleware matcher/분기 로직 점검. 보안 회귀이므로 promote 차단.

---

## 7. 수동 체크리스트 문서 (`docs/deploy/checklist.md`)

신규 작성. 운영자가 다음 배포 때도 동일 절차 재현 가능하도록 박제.

```
사전 조건
□ Vercel 프로젝트 연결 완료 (GitHub Integration)
□ Production env 4종 주입 완료
□ origin/main에 출시 게이트 커밋이 push 됨
□ Preview deployment URL 확보

Preview 검증
□ V1~V7 시나리오 7/7 통과
□ V4-cold < 10s (마진 ≥2s 확보)
□ V4-warm < 3s
□ HEADER-1·HEADER-2 헤더 매치
□ ADMIN-404: /admin, /admin-login 모두 404

Promote
□ Vercel Dashboard → Preview build → Promote to Production
□ Production URL alias 확인

Production 수동 검증
□ 정상 토큰 1회 다운로드 성공 (P5-T7 완료 기준)
□ 응답 헤더 3종 prod에서도 일치
□ Vercel Logs에서 token substring 미등장 확인

사후
□ docs/deploy/2026-05-17-vercel-preview-results.md 측정값 기록
□ ROADMAP P5-T7 비고 갱신
```

---

## 8. 롤백 & 모니터링

- **롤백**: Vercel Dashboard에서 직전 deployment를 다시 promote. 10초 내 alias 전환. 환경변수 회귀는 Settings → Environment Variables 이력에서 직전 값 복원.
- **모니터링**: Vercel Logs (24h 보관) + Function Execution Failed email 알람. `lib/logger.ts`의 JSON 라인이 그대로 stdout으로 흘러감.
- **out of scope**: Sentry, Logtail, Better Stack, PagerDuty, Vercel Analytics 유료 기능. PRD §10 확장 후보로 분리.

---

## 9. 미커밋 변경 정리 절차 (선행 작업)

```
git status:
  M app/invoice/[id]/page.tsx
  M components/invoice/invoice-items-table.tsx
  M components/invoice/invoice-skeleton.tsx
  M components/invoice/invoice-summary.tsx
  M components/invoice/invoice-totals.tsx
  M lib/invoice/load-verified.ts
  M lib/notion.ts
?? .claude/agents/nextjs-ui-markup-specialist.md
?? .claude/commands/

[처리]
1. 7파일 diff 검토 (Read)
2. 의도 가설: "Items DB relational 마이그레이션 후속" — 가설 검증 후 단일 커밋 OK 판단
3. 커밋 A: "fix(invoice): Items relational 마이그레이션 후속 정렬 — viewer UI/notion lib"
4. npm run check-all 통과 확인
5. 코드 변경 3개 적용 → 커밋 B

[제외]
.claude/agents/, .claude/commands/ — 도구 메타, 본 PR 무관. 별건 처리.
```

---

## 10. 완료 기준 (Phase 5 P5-T7 확정 게이트)

본 설계 실행 후 다음이 모두 [x]가 되어야 마무리:

- [ ] vercel.app production URL에서 V1~V7 시나리오 7/7 통과 (스크린샷·로그 보관)
- [ ] PDF cold start 측정값 9초 미만 (Hobby 마진 ≥1s)
- [ ] `/admin`·`/admin-login` 404 확인
- [ ] Vercel Logs에 토큰 substring 미등장
- [ ] `docs/deploy/checklist.md` 작성 완료
- [ ] `docs/deploy/2026-05-17-vercel-preview-results.md` 측정값 기록 완료
- [ ] ROADMAP `Phase 5 → 프로덕션 환경에서 정상 토큰으로 1회 수동 다운로드 성공` 비고 갱신

---

## 11. 리스크

| ID   | 항목                                           | 대응                                                                 |
| ---- | ---------------------------------------------- | -------------------------------------------------------------------- |
| RB-1 | PDF cold start > 10s (Hobby timeout)           | Preview에서 측정 → 9초 이상이면 plan에 "Pro 전환" 항목 즉시 삽입     |
| RB-2 | admin matcher가 `/admin-login` 빠뜨림          | 회귀 ADMIN-404 검증. matcher 불일치 시 promote 차단                  |
| RB-3 | next.config headers 제거로 vercel.json 의존도↑ | vercel.json 변경 시 자동 검증할 회귀 시나리오 HEADER-1·2가 게이트    |
| RB-4 | 미커밋 7파일 변경이 viewer 회귀 유발           | npm run check-all + V1~V7 Preview 검증                               |
| RB-5 | Vercel Logs 24h 보관 한계                      | 본 MVP traffic 매우 낮음. 사고 시 즉시 캡처 절차만 체크리스트에 박음 |

---

## 12. 본 설계 범위 밖

- Vercel 커스텀 도메인 연결 (D3 후속)
- admin 활성화 (`ENABLE_ADMIN=1` + SESSION_SECRET + ADMIN_PASSWORD_HASH 주입)
- 외부 모니터링 (Sentry/Logtail)
- Upstash/Vercel KV 도입으로 in-memory rate-limit/cache 강화 (PRD §10)
- 폰트 서브셋 추가 최적화, Region pinning, items 페이지 분할 최적화 (Approach C 항목)

후속 작업 시 별도 spec 작성.
