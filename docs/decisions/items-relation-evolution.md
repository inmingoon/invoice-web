# Items 데이터 모델 진화 — rich_text JSON → Relation DB

> Status: Accepted
> Date: 2026-05-17
> Phase: v2 / Phase 2 audit
> Author: 운영자 + Claude Code

## Context

PRD §5(`docs/PRD.md`)는 견적서 line item을 Notion 단일 row 안에 **rich_text JSON 직렬화**로 저장한다고 명시했다.

| 필드명  | Notion 타입             | 예시값                                             |
| ------- | ----------------------- | -------------------------------------------------- |
| `items` | Rich text (JSON 직렬화) | `[{"name":"디자인","qty":1,"unit_price":1000000}]` |

명시된 이유: "Notion DB에서 중첩 배열을 1급으로 다룰 수 없으므로 MVP는 직렬화 전략으로 단순화."

## Decision

v2 구현에서 Items는 **별도 Notion DB + Relation 매핑**으로 진화했다. 구현 위치: `lib/notion.ts:240-306` (`ITEMS_*` 상수 + `fetchItemsForInvoice` + `getItemsDataSourceId`).

### 새 스키마

- **Items DB**: `항목명`(title), `수량`(number), `단가`(number), `Invoices`(back-relation)
- **Invoices DB**의 `items` 컬럼은 Relation → Items DB
- 견적서 단일 row 조회 시 Items DB query(`Invoices` back-relation contains `invoiceId`)로 line item 행들을 별도 로드

### 호출 사슬 (`fetchItemsForInvoice`)

1. `getDataSourceId()` — Invoices DS id (env `NOTION_DATA_SOURCE_ID` 우선 + 모듈 캐시)
2. `getItemsDataSourceId()` — Invoices DS의 `items` relation에서 target DB id 추출 → 해당 DB의 첫 data source id 반환 (cold start 2회 추가 API, 이후 `cachedItemsDsId` 모듈 캐시)
3. `dataSources.query`로 Items DS에서 `Invoices` back-relation `contains: invoiceId` 필터로 line item 행 fetch

## Consequences

### Positive

- Notion UI에서 line item을 1급 row로 편집 가능 — JSON 문자열을 손으로 다듬을 필요 없음
- Notion의 Rollup으로 `subtotal = Sum of 단가 × 수량` 자동 계산 — 사람이 계산해서 채울 필요 없음
- 한 행만 수정 시 전체 JSON 재작성 불필요 → 견적서 수정 마찰 ↓
- `InvoiceParseError`(`types/invoice.ts:25-33`)가 더 이상 trigger되지 않음. 타입 정의는 호환성을 위해 보존, 미래 재도입 가능성 고려

### Negative

- **한국어 컬럼명 의존**: `ITEMS_NAME_PROP="항목명"`, `ITEMS_QTY_PROP="수량"`, `ITEMS_UNIT_PRICE_PROP="단가"`, `ITEMS_BACK_RELATION="Invoices"` (`lib/notion.ts:242-245`). Notion DB 컬럼명을 영어로 바꾸면 코드가 깨진다. 운영자 인수인계 시 명심
- **Cold start API 2회 추가**: invoices DS retrieve + items DB retrieve → items DS id 확보. 이후 `cachedItemsDsId` 캐시로 0회. Vercel serverless 콜드 스타트마다 비용
- **Items DB 자체 share 필요**: Notion Integration이 Invoices DB뿐 아니라 Items DB에도 share되어야 함. 셋업 절차 1단계 추가

## PRD 본문 보존 이유

PRD는 MVP 시점의 계약이고, v1.0 회귀의 기준이다. 본문을 사후 수정하면:

- v1.0 회귀 스크립트(`scripts/regression-v1-v7.mjs`)의 검증 의도가 흐려진다
- 새로 합류한 개발자가 "처음부터 Relation이었나?"로 오해할 수 있다
- 의사결정 히스토리가 사라져 다음 마이그레이션 시 트레이드오프 재논의 비용 ↑

본 ADR이 진화 시점·이유·새 매핑을 보존하는 역할을 맡는다.

## 검증

- `tests/lib/notion.test.ts:57-149` (unit, mocked SDK) — Relation 매핑 호출 사슬을 mock SDK로 검증 (`databases.retrieve` + `dataSources.retrieve` + `dataSources.query` 4종)
- `tests/lib/notion-list.test.ts` 케이스 (f) — `getInvoiceByNo` → `getInvoiceById` → `fetchItemsForInvoice` 사슬 mock으로 위임 흐름 검증
- 운영 검증은 `npm run dev` + V1 회귀(정상 토큰 → `/invoice/<id>?token=...` 200 + items 행 가시)

## 마이그레이션 노트 (참고)

- 진화 시점은 `lib/notion.ts`의 `fetchItemsForInvoice`/`ITEMS_*` 상수 도입 커밋에서 확인 (`git log -p lib/notion.ts`)
- PRD §5의 `items` 필드 정의는 v1 시점 그대로 보존

## 다음 단계 후보 (본 ADR 범위 밖)

- **한국어 컬럼명을 환경변수로 추출**: `ITEMS_NAME_PROP_NAME` 등 — 운영자가 다국어 환경에서 컬럼명을 바꿔도 코드 변경 0건
- **`cachedItemsDsId`를 외부 store로 이전**: Upstash KV 등으로 옮기면 Vercel serverless 콜드 스타트 2 API 호출 제거
- **Items DB 스키마 검증 헬퍼**: 운영자가 컬럼명을 잘못 만들면 첫 호출에서 의미 있는 에러 메시지로 실패하도록 (`getItemsDataSourceId` 시작점에 1회 검증)
