# Vercel Production Admin 활성화 가이드

> 기준: `docs/ROADMAP.md` §Phase 4 운영자 수동 위임 항목 + v2 결정사항 #6 (Production gate)
> 직전 단계: `docs/deploy/2026-05-17-vercel-preview-results.md` (viewer-only 출시 완료, admin은 봉인 상태)
> 로컬 dev 검증: `docs/audit/2026-05-18-admin-activation/` (V8·V9 PASS)

## 0. 사전 조건

- 로컬 dev에서 `/admin-login` 로그인 + `/admin/invoices` 목록 + "링크 복사" 풀체인 검증 완료
- Vercel Dashboard에 운영자 계정 access (Environment Variables 권한)
- Production 배포 가능한 main 브랜치 push 권한
- dev 환경의 시크릿을 production에 그대로 쓰지 않음 — **production 전용 시크릿 신규 생성**

## 1. Production 시크릿 4종 생성

### 1.1 `SESSION_SECRET` (production 전용, ≥32자)

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

stdout으로 base64url 43자 출력. 그대로 복사 — **터미널 history 즉시 clear 권장** (PowerShell `Clear-History`).

> dev에 사용한 SESSION_SECRET을 production에 재사용하지 않는다. 한쪽이 노출돼도 다른 쪽 세션이 영향 받지 않게.

### 1.2 `ADMIN_PASSWORD_HASH` (production 전용)

```powershell
node scripts/hash-password.mjs
```

`비밀번호 입력:` 프롬프트 → **production 전용 비밀번호** (dev 비밀번호와 달라야 함). stdout으로 `scrypt$16384$8$1$<saltHex>$<hashHex>` 한 줄 출력.

> 강도: 16자+ 무작위 또는 4단어+ passphrase 권장. 6자리 숫자 등 약한 비밀번호는 scrypt(N=16384)로도 GPU farm에 약하다.

### 1.3 `ENABLE_ADMIN`

값: `1`

이 환경변수가 `1`이 아니면 production의 `/admin*`·`/admin-login`은 모두 404. **즉시 봉인 안전망** — 사고 발생 시 이 값만 비우거나 삭제하면 admin 라우트 전체 봉인.

### 1.4 `NEXT_PUBLIC_SITE_URL`

값: `https://invoice-web-opal.vercel.app` (또는 실제 production 도메인, 끝에 `/` 없이)

`NEXT_PUBLIC_` prefix이므로 클라이언트 번들에 포함됨. 공개 도메인이라 노출 무관.

## 2. Vercel Dashboard 주입

1. Vercel Dashboard → 프로젝트(`invoice-web`) → **Settings** → **Environment Variables**
2. 4 키 각각 추가:
   | Key | Value | Environments |
   |-----|-------|--------------|
   | `SESSION_SECRET` | (1.1 출력) | Production |
   | `ADMIN_PASSWORD_HASH` | (1.2 출력) | Production |
   | `ENABLE_ADMIN` | `1` | Production |
   | `NEXT_PUBLIC_SITE_URL` | `https://invoice-web-opal.vercel.app` | Production (이미 있으면 그대로) |

> ⚠️ **dotenv `$` escape는 Vercel에서 적용 안 함** — Vercel Dashboard는 raw value를 그대로 환경변수에 set한다. `\$` escape 추가하면 안 됨. dotenv가 처리하는 `.env.local`과 다른 동작.
>
> 즉:
>
> - `.env.local`: `ADMIN_PASSWORD_HASH=scrypt\$16384\$...` (escape 필요)
> - Vercel Dashboard: `ADMIN_PASSWORD_HASH` 값에 `scrypt$16384$...` (raw, escape 없음)

3. **Save** → Vercel이 자동으로 redeploy 트리거 (수동 redeploy 가능: Deployments → 최신 production → Redeploy)

## 3. Redeploy 확인

- Deployments 페이지에서 새 deployment **Ready** 상태 확인
- Build logs에서 4 환경변수가 로드됐는지 (보통 안 보임 — 시크릿이라 mask)
- `npm run build` 시점에 admin 라우트가 정상 컴파일됐는지 (`ƒ /admin`·`/admin-login`·`/admin/invoices` Dynamic 표기)

## 4. V8·V9 라이브 검증

### 4.1 V8-1 — 봉인 해제 확인

```powershell
$response = Invoke-WebRequest -Uri "https://invoice-web-opal.vercel.app/admin" -MaximumRedirection 0 -ErrorAction SilentlyContinue
$response.StatusCode  # 307 expected
$response.Headers.Location  # /admin-login expected
```

`ENABLE_ADMIN=1` 적용 전이라면 status 404. 적용 후 status 307 + Location `/admin-login`.

### 4.2 V8-2 — 로그인 페이지 가시

브라우저로 `https://invoice-web-opal.vercel.app/admin-login` 접근:

- "관리자 로그인" 제목 + 비밀번호 input + 로그인 button 가시
- 응답 헤더 3종: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` (DevTools → Network)

### 4.3 V8-3 — 잘못된 비밀번호

`wrong-pw` 입력 후 로그인 → "비밀번호가 일치하지 않습니다." + 1초 throttle (응답 ~1.2s)

### 4.4 V8-4 — 정상 로그인

production 비밀번호 입력 → `/admin` 대시보드 도달:

- "관리자 대시보드" 제목 + KPI 3종(전체/만료 임박/미열람)
- DevTools → Application → Cookies → `invoice_admin_session` httpOnly + Max-Age 86400 + `Secure: true` (production HTTPS)

### 4.5 V9 — 목록 + 링크 복사

`/admin/invoices` 이동:

- Table 7컬럼, row 가시 (운영 row 수만큼)
- INV-XXXX row의 "링크 복사" 클릭 → 토스트 "링크가 클립보드에 복사되었습니다" 가시 + 클립보드에 `https://invoice-web-opal.vercel.app/invoice/<id>?token=<token>` 저장
- 그 URL을 시크릿 창에 붙여넣어 v1 토큰 뷰어가 200으로 열리는지 확인 (NEXT_PUBLIC_SITE_URL 정상 적용 검증)

### 4.6 회귀 (scripts/regression-v1-v7.mjs)

ADMIN-404가 PASS → FAIL로 바뀜 (활성화 의도된 동작):

```powershell
$env:BASE_URL = "https://invoice-web-opal.vercel.app"
$env:ROW_A_ID = "<row A id>"
$env:ROW_A_TOKEN = "<row A token>"
$env:ROW_B_ID = "<row B id>"
$env:ROW_B_TOKEN = "<row B token>"
node scripts/regression-v1-v7.mjs
```

- V1~V6 + HEADER 모두 PASS 유지 (admin 활성화가 v1 토큰 라우트에 영향 0)
- ADMIN-404 2 케이스는 FAIL 정상 — `ENABLE_ADMIN=1`이라 404가 아닌 redirect/200
- 회귀 스크립트 갱신 후보: `--admin-enabled` 플래그로 ADMIN-307 expected 분기 (v2.x)

## 5. 운영 절차

### 5.1 토큰 회수

운영 row의 토큰이 외부에 노출됐을 때:

1. `/admin/invoices` 접근 → 해당 row의 "토큰 회수" 버튼
2. `window.confirm` "토큰을 회수하면 기존 링크는 즉시 404가 됩니다." → 확인
3. 새 토큰 발급 → 클라이언트에게 새 링크 재공유

### 5.2 비밀번호 변경

1. 로컬에서 `node scripts/hash-password.mjs` → 새 해시 생성
2. Vercel Dashboard → Environment Variables → `ADMIN_PASSWORD_HASH` 값 갱신
3. Save → 자동 redeploy
4. 기존 세션 쿠키는 만료 시각(24h)까지 유효 — 즉시 무효화하려면 `SESSION_SECRET`도 함께 회전

### 5.3 즉시 봉인 (사고 발생 시)

Vercel Dashboard → Environment Variables → `ENABLE_ADMIN` 값을 비우거나 키 자체 삭제 → Save → redeploy 후 `/admin*` 모두 404 봉인. **코드 변경 0, 환경변수 한 줄**.

## 6. 후속 작업 후보 (별도 spec)

- **회귀 스크립트 `--admin-enabled` 플래그** — ADMIN-307 expected 분기
- **rate-limit Vercel 람다 분산 보강** — Upstash KV 또는 Vercel KV
- **다중 관리자 계정** — Basic Auth/scrypt 단일 → NextAuth.js 전환 (v3+)
- **감사 로그** — `auth.success/fail`·`token.regenerate` 이벤트를 Vercel Logs 외에 외부 저장(LogTail, Logflare)
- **세션 회수 endpoint** — 단일 클릭으로 모든 활성 세션 무효화 (SESSION_SECRET 회전 + 즉시 적용)
- **dotenv `$` escape를 hash-password.mjs 출력에 옵션으로 추가** — `--escape` 플래그로 `\$` 적용된 값 출력, 운영자 함정 방지

## 7. 봉인 해제 후 dev 환경 정리 (선택)

production 활성화 검증이 끝나면 dev 환경의 시크릿도 정리:

```powershell
# dev 서버 종료
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# (선택) dev 토큰 회수 — 채팅 log·터미널 history에 노출됐다면 본인이 admin UI 또는 별도 script로
```
