# MVP PRD — Notion 견적서 웹 뷰어

## 1. 제품 개요

Notion 데이터베이스에 입력된 견적서를 토큰 링크로 클라이언트에게 공유하여
웹에서 열람하고 PDF로 다운로드받게 하는 도구다. 발행자는 익숙한 Notion
에서 견적을 작성하고, 수신자는 회원가입 없이 받은 URL 하나로 즉시 견적을
확인·보관할 수 있다. MVP는 단일 견적서의 열람과 PDF 다운로드만 다루며,
다중 사용자 관리·결제·이메일 자동 발송은 포함하지 않는다.

## 2. 타깃 사용자 & 핵심 시나리오

### (A) 발행자 — 1인 사업자 / 소규모 에이전시 대표

- **사용자가** Notion 견적서 DB에 새 row를 작성하고 상태를 `sent`로 바꿀
  때 **→ 시스템이** 해당 row에 채워진 `access_token`을 포함한 공유
  URL(`https://<도메인>/invoice/<id>?token=<token>`)을 안정적으로 제공할
  수 있어야 한다.
- **사용자가** Notion에서 견적서 row의 항목·금액을 수정할 때 **→
  시스템이** 같은 URL을 새로고침했을 때 최신 데이터를 반영하여 보여준다.

### (B) 수신자(클라이언트) — 견적을 받아보는 의사결정자

- **사용자가** 받은 링크를 열 때 **→ 시스템이** 토큰을 검증하고 견적서
  내용(클라이언트명, 항목, 합계, 만료일, 메모)을 가독성 높은 화면으로
  보여준다.
- **사용자가** 화면의 "PDF 다운로드" 버튼을 클릭할 때 **→ 시스템이**
  동일한 내용을 한글이 깨지지 않는 PDF 파일로 즉시 다운로드시킨다.
- **사용자가** 토큰이 잘못되었거나 누락된 URL을 열 때 **→ 시스템이**
  민감한 정보 노출 없이 접근 거부 화면을 보여준다.

## 3. MVP 범위 (In / Out)

| 포함 (In) | 제외 (Out) |
|---|---|
| Notion DB에 정의된 단일 견적서 row 조회 | 견적서 발행자의 회원가입·로그인 |
| 토큰 검증 후 견적서 웹 렌더링 | 수신자의 회원가입·로그인 |
| 견적서 항목·합계·부가세·총합계 표시 | 결제 연동 (Stripe, 토스 등) |
| 클라이언트명·발행일·만료일·메모 표시 | 견적서 작성 UI (Notion이 대체) |
| PDF 다운로드 (서버 사이드 생성, 한글 OK) | 견적서 수정/삭제 화면 |
| 잘못된 토큰 / Notion 404 / API 장애 에러 화면 | 이메일 자동 발송·알림 |
| `Cache-Control: no-store`, `X-Robots-Tag: noindex` 응답 헤더 | 다국어(한국어 외) |
| Notion 수정 시 새로고침으로 변경분 반영 | 견적서 상태 변경 워크플로 자동화 |
| 다크모드 (기존 `next-themes` 활용) | 첨부파일 / 이미지 업로드 |
| `npm run build` SSG/SSR 정상 통과 | 견적서 버전 히스토리·diff 보기 |
| 만료일 경과 시 "만료됨" 배지 표시 | 견적서 검색·필터·대시보드 |
|  | 수신자의 견적서 승인·서명 기능 |

## 4. 확정 아키텍처 결정

| # | 영역 | 결정 | 근거 |
|---|---|---|---|
| 1 | Notion 연동 | **Notion API + Database** (`@notionhq/client`로 서버 컴포넌트에서 fetch) | 구조화된 필드 안정성. Notion 페이지 임베드·스크랩 대비 PDF 변환 품질이 우월. |
| 2 | PDF 생성 | **서버 사이드 렌더링** (`@react-pdf/renderer` 또는 print-to-PDF 스트리밍, Route Handler) | 폰트·페이지 분할·여백 제어 가능. 클라이언트 부담 0. 한글·이모지 안정성. |
| 3 | 접근 제어 | **비밀 토큰 링크** — `/invoice/[id]?token=...`. 로그인 불요. | 발송 UX와 자연스럽게 맞고 수신자의 회원가입 마찰이 없음. |
| 4 | 언어 | 출력 PRD 및 UI 텍스트는 **한국어** | 사용자/팀의 기본 언어. |

보충: 결정 1은 견적서 row의 변경이 즉시 반영되어야 하므로 fetch에
`{ cache: 'no-store' }`를 명시한다. 결정 2의 두 후보(`@react-pdf/renderer`
vs print-to-PDF) 중 어느 것을 쓸지는 구현 단계의 실험으로 좁히되, MVP는
한글 폰트 임베드와 페이지 분할이 안정된 쪽을 택한다. 결정 3의 토큰은
URL 쿼리스트링으로 전달되므로 서버 로그·리퍼러로의 누출 방지를 위해
응답 헤더에서 캐싱·인덱싱을 차단한다(섹션 7 참조).

## 5. 데이터 모델

### Notion DB 스키마

| 필드명 | Notion 타입 | 예시값 | 필수 |
|---|---|---|---|
| `invoice_no` | Title | `INV-2026-0001` | ✅ |
| `client_name` | Rich text | `(주)예시` | ✅ |
| `issued_at` | Date | `2026-05-11` | ✅ |
| `expires_at` | Date | `2026-06-10` | ✅ |
| `items` | Rich text (JSON 직렬화) | `[{"name":"디자인","qty":1,"unit_price":1000000}]` | ✅ |
| `subtotal` | Number | `1000000` | ✅ |
| `vat` | Number | `100000` | ✅ |
| `total` | Number | `1100000` | ✅ |
| `memo` | Rich text | `송금 계좌: 우리은행 ...` | ❌ |
| `access_token` | Rich text | `kJ9-Hh_2...` (URL-safe base64 32B) | ✅ |
| `status` | Select | `draft` / `sent` / `viewed` | ✅ |

`items`는 Notion의 한 필드 안에 JSON 문자열로 보관한다(Notion DB에서 중첩
배열을 1급으로 다룰 수 없으므로 MVP는 직렬화 전략으로 단순화). 파싱은
서버에서 수행하며, 형식 오류는 에러 화면으로 처리한다.

### 앱 내부 타입 (시그니처만)

```ts
type InvoiceStatus = 'draft' | 'sent' | 'viewed';

interface InvoiceItem {
  name: string;
  qty: number;
  unitPrice: number;
}

interface Invoice {
  id: string;             // Notion page id
  invoiceNo: string;
  clientName: string;
  issuedAt: string;       // ISO date
  expiresAt: string;      // ISO date
  items: InvoiceItem[];
  subtotal: number;
  vat: number;
  total: number;
  memo: string | null;
  accessToken: string;
  status: InvoiceStatus;
}
```

## 6. 라우팅 & 화면

### `app/invoice/[id]/page.tsx` — Server Component

견적서 열람 페이지. `params`·`searchParams` 모두 `Promise`이므로 `async`
함수로 선언하고 `await`한다. 흐름: `params.id`로 Notion page를 조회하고,
`searchParams.token`을 row의 `access_token`과 상수 시간 비교한다. 일치
시 견적서 본문(요약 카드 + 항목 테이블 + 합계 + 메모 + PDF 다운로드
버튼)을 렌더하고, 불일치 시 `notFound()`를 호출해 404로 떨어뜨린다.
UI는 shadcn `Card`, `Table`, `Badge`, `Button`을 우선 재사용한다.

시그니처(타입만):

```ts
export default async function InvoicePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}): Promise<JSX.Element>;
```

### `app/api/invoice/[id]/pdf/route.ts` — Route Handler

PDF 스트리밍 엔드포인트. 페이지와 동일한 토큰 검증을 거친 뒤, 동일한
`Invoice` 데이터로 PDF를 생성해 스트림 응답한다. 응답 헤더:
`Content-Type: application/pdf`,
`Content-Disposition: attachment; filename="<invoice_no>.pdf"`,
`Cache-Control: no-store`. 한글 폰트는 빌드 시 PDF 라이브러리에 사전
등록(서브셋 임베드)한다.

시그니처:

```ts
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response>;
```

### `app/invoice/[id]/error.tsx` — Client Component

`"use client"` 필수. `{ error, reset }` 시그니처를 받는다. 표시 분기:
- 토큰 오류 (`InvoiceTokenError`) → "이 링크는 만료되었거나 잘못되었습니다."
- Notion 404 (`InvoiceNotFoundError`) → "견적서를 찾을 수 없습니다."
- 그 외 → 일반 장애 메시지 + `reset()`로 재시도 버튼.

에러 원인은 메시지 문자열로 노출하지 않고, 코드 상수(`error.name` 또는
커스텀 에러 클래스의 `tag` 필드)로 분기한다.

## 7. 보안 모델

- **토큰 생성**: 발행자가 Notion row를 만들 때 32바이트
  URL-safe base64로 생성(`crypto.randomBytes(32).toString('base64url')`).
  생성 도구는 별도 사내 스크립트 또는 Notion 자동화로 채워 넣는다.
- **토큰 저장 위치**: Notion DB의 `access_token` 필드. 별도 store를
  두지 않는다 — MVP에서 Notion이 단일 소스이고, 발행자가 동일 도구로
  관리할 수 있어 동기화 복잡도가 0이다. 다음 단계에서 토큰 회수/만료를
  도입할 때 별도 store를 검토한다.
- **토큰 비교**: `crypto.timingSafeEqual`로 상수 시간 비교. 길이가 다르면
  바로 거부.
- **환경 변수** (서버 전용, `NEXT_PUBLIC_` 접두사 금지):
  - `NOTION_TOKEN` — Notion integration secret
  - `NOTION_DATABASE_ID` — 견적서 DB id
- **응답 헤더**:
  - 견적서 페이지 / PDF 라우트 모두 `Cache-Control: no-store`
  - 페이지에 `X-Robots-Tag: noindex, nofollow` 추가
  - PDF는 `Content-Disposition: attachment`로 강제 다운로드
- **로깅 정책**: 토큰 값은 절대 로깅하지 않는다. 토큰 검증 실패 시
  `invoiceId`와 `result: 'denied'`만 남긴다.
- **fetch 옵션**: Notion 호출은 `{ cache: 'no-store' }` 명시. Next 15
  기본값과 동일하나 의도를 코드로 못박는다.

## 8. 마일스톤 & 작업 분해

### M1. Notion DB 스키마 정의 + 더미 row 생성
섹션 5의 필드 목록 그대로 Notion에서 DB를 생성하고, 더미 row 2개(정상·
만료됨)를 채워 토큰까지 부여한다.
- **Done =** Notion DB id 확보, 더미 row 2개에 `access_token`이 채워짐.

### M2. Notion 클라이언트 유틸 (`lib/notion.ts`)
`@notionhq/client` 설치. `getInvoiceById(id: string): Promise<Invoice | null>`
시그니처의 서버 전용 유틸을 만들고 `items` JSON 파싱·필드 매핑을 캡슐화.
- **Done =** 더미 id로 호출 시 `Invoice` 객체가 반환됨.
- **Done =** 잘못된 id에 대해 `null`을 반환하고 에러는 throw하지 않음.

### M3. 견적서 라우트 + 토큰 검증
`app/invoice/[id]/page.tsx`를 Server Component로 추가. `await params` /
`await searchParams` 적용. 토큰 비교는 `lib/auth/verify-token.ts`로 분리.
- **Done =** 정상 토큰 URL이 200, 잘못된 토큰이 404로 응답.
- **Done =** `next-themes` 다크모드에서 깨짐 없음.

### M4. 견적서 뷰 UI
shadcn `Card`, `Table`, `Badge`, `Separator`로 견적서 화면을 조립.
만료된 row는 `Badge variant="destructive"`로 "만료됨" 표시.
- **Done =** 항목 5개·메모 포함 row가 가독성 있게 렌더링.
- **Done =** 모바일 뷰포트(360px)에서 가로 스크롤 없음.

### M5. PDF 컴포넌트 (`@react-pdf/renderer`)
한글 폰트 1종(예: Pretendard) 서브셋을 `public/fonts/`에 두고 PDF 컴포넌트에서
등록. 화면 UI와 동일한 데이터로 1페이지 견적서를 생성.
- **Done =** 더미 row로 생성된 PDF에서 한글이 정상 렌더링.
- **Done =** 항목 행이 많을 때(20+) 페이지 분할이 자연스러움.

### M6. PDF Route Handler
`app/api/invoice/[id]/pdf/route.ts`에서 토큰 검증 + PDF 스트리밍.
`Content-Disposition` 파일명에 `invoice_no` 사용(URL 인코딩).
- **Done =** 견적서 페이지의 다운로드 버튼이 정상 다운로드를 트리거.
- **Done =** 잘못된 토큰으로 직접 호출 시 404 응답.

### M7. 에러 화면 + 보안 헤더
`app/invoice/[id]/error.tsx`(클라이언트)와 `not-found.tsx` 추가. 페이지·PDF
라우트에 `Cache-Control: no-store`·`X-Robots-Tag: noindex` 부여.
- **Done =** 토큰 누락/오류 시 친화적 화면.
- **Done =** 응답 헤더가 브라우저 DevTools에서 확인됨.

## 9. 검증 & 수용 기준

### 수동 검증 시나리오
1. 정상 발행: Notion에서 `status = sent`인 더미 row의 토큰을 URL에 넣어
   견적서 페이지가 200으로 열린다.
2. 토큰 누락: `?token=` 없이 접근 시 404 화면이 보이고 견적 내용이 노출되지
   않는다.
3. 토큰 변조: 마지막 글자를 바꾼 토큰으로 접근 시 동일하게 404.
4. PDF 다운로드: 다운로드 버튼 클릭 시 `<invoice_no>.pdf` 파일이 저장되고
   한글·금액·항목이 모두 정상.
5. Notion 수정 반영: Notion에서 금액을 수정한 후 페이지를 새로고침하면
   즉시 변경분이 반영된다 (`no-store` 동작 확인).
6. 만료 표시: `expires_at`이 오늘 이전인 row는 "만료됨" 배지가 표시된다.
7. 다크모드: 시스템 다크/라이트 전환 시 견적서 카드 가독성 유지.

### 자동 검증
- `npm run build` 성공, 타입 에러·정적 분석 경고 없음.
- `npm run lint` 무경고.
- `npm run build` 로그에서 `/invoice/[id]` 가 `ƒ (Dynamic)`으로 표기되어
  SSG가 아님을 확인.
- 빌드 산출물에 `NOTION_TOKEN`이 포함되지 않음(grep으로 확인).

## 10. 추후 고려

이번 MVP에 포함되지 않는 항목 중, 다음 단계로 자연스러운 확장:

- 이메일 자동 발송 (Resend / SES). 토큰 링크를 만들면 클라이언트 이메일로
  자동 송부.
- 견적서 상태 변경 워크플로: 수신자가 열람하면 `status`가 `viewed`로
  자동 갱신(Notion API write).
- 결제 연동(가상계좌, Stripe Checkout).
- 토큰 만료/회수: 토큰 자체에 만료 시각을 포함하거나 별도 store에 TTL
  적용.
- 다국어(영어/일본어) 및 통화 단위 전환.
