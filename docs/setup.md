# Setup — Notion 견적서 웹 뷰어

> 새 환경에 클론·배포할 때 운영자가 따라야 하는 절차. 시크릿 생성·환경변수 주입·검증 명령을 한 곳에 모아 두었다.

## 0. 사전 준비

- Node.js 20+
- Notion Internal Integration (DB에 share 처리)
- Vercel 또는 자체 Node 호스트 (HTTPS 필수 — `navigator.clipboard` 동작 조건)

## 1. 의존성 설치

```powershell
npm install
```

## 2. `.env.local` 작성

`.env.local.example`을 복사해 채운다.

```powershell
Copy-Item .env.local.example .env.local
```

각 키 설명은 `.env.local.example` 주석 참고. 본 문서에서는 **시크릿 생성이 필요한 3종**의 절차만 다룬다.

### 2.1 `SESSION_SECRET` 생성 (JWT 서명 키, 32자+)

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

stdout으로 base64url 43자가 출력된다. `.env.local`의 `SESSION_SECRET=` 우측에 그대로 붙여넣는다.

> 회전 정책: 시크릿을 변경하면 기존 세션이 모두 무효화된다 (재로그인 필요). 정기 회전은 Vercel 환경변수 페이지에서 새 값으로 덮어쓰면 된다.

### 2.2 `ADMIN_PASSWORD_HASH` 생성 (관리자 비밀번호 scrypt 해시)

```powershell
node scripts/hash-password.mjs
```

stderr로 `비밀번호 입력:` 프롬프트가 뜬다. 평문 비밀번호를 입력하고 Enter — stdout으로 `scrypt$16384$8$1$<salt>$<hash>` 한 줄이 출력된다.

이 한 줄 전체를 `.env.local`의 `ADMIN_PASSWORD_HASH=` 우측에 붙여넣는다. **평문 비밀번호는 어디에도 저장하지 않는다** (브라우저 password manager 또는 1Password 등에만).

> 비밀번호 변경 절차: 같은 명령을 다시 돌려 새 해시로 환경변수 덮어쓰기 → Vercel 재배포. 기존 세션은 만료 시각(24h)까지 유효하다.

### 2.3 `ENABLE_ADMIN` 설정

| 환경                     | 값                           | 효과                                        |
| ------------------------ | ---------------------------- | ------------------------------------------- |
| 로컬 dev (`npm run dev`) | 무관                         | `/admin*` 항상 열림 (NODE_ENV ≠ production) |
| Vercel preview           | `1` 권장                     | preview에서 admin 검증 가능                 |
| Vercel production        | 출시 전 미설정 → 출시 시 `1` | `1` 외 값은 모두 404 (즉시 봉인 안전망)     |

### 2.4 Notion 환경변수

`NOTION_TOKEN`, `NOTION_DATABASE_ID`, (선택) `NOTION_DATA_SOURCE_ID`. v1.0 셋업 그대로. 자세한 절차는 PRD §7과 `.env.local.example` 주석 참고.

### 2.5 `NEXT_PUBLIC_SITE_URL`

배포 도메인 (예: `https://invoice-web-opal.vercel.app`). admin 목록의 "링크 복사" 버튼이 사용. 미설정 시 클라이언트 `window.location.origin` fallback.

## 3. 검증

```powershell
npm run test       # 단위 테스트 — middleware/session/password 등 15+ 케이스
npm run lint       # 경고 0
npm run build      # production 빌드, /admin·/admin-login·/admin/invoices가 ƒ (Dynamic)
```

회귀 스크립트 (배포 후 수행):

```powershell
$env:BASE_URL="https://<domain>"
$env:ROW_A_ID="<id>"; $env:ROW_A_TOKEN="<token>"
$env:ROW_B_ID="<id>"; $env:ROW_B_TOKEN="<token>"
node scripts/regression-v1-v7.mjs
```

V1·V2·V3·V4·V6 + HEADER + ADMIN-404를 자동 검증. V5(Notion 수정 반영)·V7(다크/모바일)은 수동.

## 4. 트러블슈팅

- `SESSION_SECRET missing or < 32 chars` throw → 2.1 절차 다시 확인
- 로그인 시 `관리자 환경 변수가 설정되지 않았습니다.` → `ADMIN_PASSWORD_HASH` 누락
- `npm run dev` 시 `/admin`에서 redirect 루프 → 쿠키 도메인/secure 설정 충돌. 브라우저 쿠키 초기화 후 재시도
- production 배포 후 `/admin` 404 → `ENABLE_ADMIN=1` 환경변수 누락 (의도된 봉인 동작)
- 운영 환경에서 Edge runtime 에러 (`scrypt is not a function`) → `lib/auth/password.ts`를 middleware에서 import하지 말 것. `"server-only"` 가드로 차단되어 있으니 정상 코드라면 발생하지 않음
