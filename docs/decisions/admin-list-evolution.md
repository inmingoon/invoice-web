# 관리자 목록 UI · 링크 복사 진화 — Phase 3 audit 결정 4종

> Status: Accepted
> Date: 2026-05-17
> Phase: v2 / Phase 3 audit
> Author: 운영자 + Claude Code

## Context

`docs/ROADMAP.md` §Phase 3은 v2 초안 작성 시점에 다음 6개 작업을 명시했다.

1. `app/admin/invoices/page.tsx` — `await listInvoices()` 단순 호출 + shadcn Table
2. 상태/만료 배지 — `components/admin/invoice-status-cell.tsx` + v1 `expired-badge.tsx` 재사용 + `Badge variant="destructive"` "만료됨"
3. 링크 복사 — `components/admin/copy-share-link-button.tsx` 단일 컴포넌트
4. siteUrl 주입 — Server Component에서 `process.env.NEXT_PUBLIC_SITE_URL` prop 전달 + client fallback `window.location.origin`
5. 반응형 — `overflow-x-auto` 명시
6. Playwright V8(401→200) / V9(복사 풀체인)

실제 구현은 코드 진행 중 ROADMAP과 다른 4가지 결정을 채택했다. 본 ADR이 진화 시점·이유·새 구조를 기록한다. ROADMAP §Phase 3은 본 ADR을 참조하도록 별도 갱신(P3-T2).

---

<a id="copy-share-split"></a>

## §2 결정 1 — copy/share 분리 (CopyButton + ShareButton)

### Context

ROADMAP은 단일 컴포넌트 `components/admin/copy-share-link-button.tsx`로 클립보드 복사 + (선택) 외부 공유를 합쳐 처리하려 했다. 컴포넌트 1개로 단순화.

### Decision

`components/admin/copy-button.tsx`(범용 클립보드 복사) + `components/admin/share-button.tsx`(이메일 mailto + 텔레그램 t.me/share/url DropdownMenu) **2 컴포넌트로 분리**. `components/admin/invoice-actions-cell.tsx:13-22`가 둘을 `RegenerateButton`과 함께 조립.

코드 위치:

- `components/admin/copy-button.tsx:12-60` — `<CopyButton value={url} />`. `navigator.clipboard.writeText` + `sonner.toast.success/error` + 1500ms 후 icon `Check ↔ Copy` swap
- `components/admin/share-button.tsx:16-57` — `<ShareButton url invoiceNo clientName />`. shadcn `DropdownMenu`로 mailto·텔레그램 2 채널 노출
- `components/admin/invoice-actions-cell.tsx:7-23` — 셀에서 두 컴포넌트 + `RegenerateButton` 조립, `buildInvoiceLink`로 url 합성

### Consequences

**Positive**

- `CopyButton`은 토큰 링크뿐 아니라 다른 임의 값(예: 토큰 자체, 송금 계좌)에도 재사용 가능 — props가 `value` 단일로 단순
- `ShareButton`은 외부 공유 채널이 늘어나도(카카오톡, LINE, X 등) 한 컴포넌트만 확장. CopyButton과 분리되어 클립보드 동작에 영향 0
- 클립보드 권한 거부 시(secure context 미충족) `ShareButton`은 영향 없이 동작 — 운영자는 외부 공유 채널로 우회 가능

**Negative**

- 셀 너비가 3 컴포넌트(`Copy / 공유 / 토큰 회수`) 가로 배치 — 모바일 360px에서 `gap-1` 좁은 간격 유지, 검증 필요
- `aria-label`이 컴포넌트마다 정의 — 접근성 라벨 일관성을 위해 컨벤션 노트 필요

---

<a id="expired-display"></a>

## §3 결정 2 — 만료 표시 인라인 텍스트 (text-destructive)

### Context

ROADMAP은 v1 `components/invoice/expired-badge.tsx`를 admin 목록에서 재사용하고 `Badge variant="destructive"`로 "만료됨" 표시를 명시했다. v1 뷰어와 admin이 같은 시각 언어 공유.

### Decision

admin 목록은 **별도 Badge 없이 인라인 "(만료)" 텍스트 + `text-destructive` 색상**으로 만료 표시(`components/admin/invoice-table.tsx:180-188`).

```tsx
<TableCell
  className={cn("text-muted-foreground", expired && "text-destructive")}
>
  {row.expiresAt}
  {expired ? <span className="ml-1 text-xs">(만료)</span> : null}
</TableCell>
```

`isExpired`(line 36-43)는 `today.setHours(0,0,0,0) + exp < today` UTC 미적용 로컬 자정 기준. v1 expired-badge와 동일한 boundary 동작.

### Consequences

**Positive**

- 목록의 row 밀도 ↑ — Badge가 만료일 컬럼 옆에 들어가면 row가 시각적으로 무거워지고 다른 컬럼과의 위계 흐트러짐
- 만료일과 (만료) 마커가 한 셀에 모여 의미 단위가 명확
- 색상 변경(text-destructive)이 다크모드에서도 자동 대응(`globals.css` OKLCH 토큰)

**Negative**

- v1 뷰어와 admin의 시각 언어 차이 — v1은 큰 Badge, admin은 인라인 텍스트. 일관성 trade-off
- `<span className="ml-1 text-xs">(만료)</span>` 텍스트 노드라 스크린리더 안내가 Badge의 `role="status"` 같은 시맨틱보다 약함. 향후 `aria-label="만료됨"` 추가 후보

---

<a id="status-variant"></a>

## §4 결정 3 — status variant 매핑 (시각 위계 기반)

### Context

ROADMAP은 `draft=outline`, `sent=default`, `viewed=secondary` 매핑을 임의로 명시했다. shadcn Badge의 3 variant를 어떻게 할당할지에 대한 근거는 없었다.

### Decision

`components/admin/invoice-table.tsx:27-34`에서 **시각 위계 기반 매핑**:

```ts
const statusBadge: Record<InvoiceStatus, { label: string; variant: ... }> = {
  draft:  { label: "초안",   variant: "secondary" },
  sent:   { label: "발송됨", variant: "default"   },
  viewed: { label: "열람됨", variant: "outline"   },
};
```

이유:

- `sent=default`(가장 강조) — 발송됨은 운영자가 가장 주목해야 할 상태(클라이언트 응답 대기 중)
- `draft=secondary`(중간 강조) — 진행 중이지만 아직 외부 노출 없음
- `viewed=outline`(가장 약한 강조) — 클라이언트가 본 종료 상태, 후속 액션 없음

label은 한국어(초안/발송됨/열람됨)로 표시 — UI 일관성과 운영자 가독성.

### Consequences

**Positive**

- 운영자가 목록을 훑을 때 `발송됨`이 시각적으로 가장 먼저 들어옴 → 작업 우선순위 자연스럽게 시그널링
- variant 매핑이 의미 기반이라 라벨이 다국어로 바뀌어도 시각 위계 유지

**Negative**

- shadcn Badge의 default variant가 기본 색상에 따라 다크모드에서 강조 정도가 미묘하게 다를 수 있음 — 운영 검증 필요
- 라벨이 한국어 하드코딩 — 다국어 분리 시 `i18n` 키 추출 필요 (다음 단계 §7)

---

<a id="scope-expansion"></a>

## §5 결정 4 — v2.1 후속 → v2 흡수 (검색·필터·정렬·페이지네이션)

### Context

ROADMAP §Phase 3은 검색/필터/페이지네이션을 명시적으로 제외하고 v2.1 후보로 분리했다. v2 본 범위는 "목록 + 링크 복사 + 상태/만료 배지"만으로 최소화 의도.

### Decision

코드는 4가지 기능을 모두 v2 범위에 흡수했다.

- **검색** — `components/admin/search-bar.tsx` (`q` query param, `client_name` contains 매핑)
- **필터** — `components/admin/filter-panel.tsx` (`status` 다중 select + `expired` 3 모드: all/active/expired)
- **정렬** — `components/admin/invoice-table.tsx`의 `SortableHeader`(`sort=<key>:<dir>` URL 토글, 정렬 시 `cursor` 자동 삭제)
- **페이지네이션** — `components/admin/pagination.tsx`(`cursor` query param, Notion `next_cursor` 그대로 전달, 페이지당 20건)

URL 동기화: `app/admin/invoices/page.tsx:65-118`에서 `searchParams` 5종(q/status/expired/sort/cursor)을 `parseSort`/`parseStatuses`/`parseExpired`/`toUrlParams` 헬퍼로 정제 후 `listInvoices(filter, sort, page)`에 전달. **필터·정렬·페이지가 모두 URL에 반영되어 공유 가능**.

### Consequences

**Positive**

- 운영 row 50건 도달 시점에 v2.1 작업이 별도로 필요 없음 — 출시 시점부터 검색·필터 가능
- 모든 상태가 URL 동기화 → 운영자 간 링크 공유로 같은 필터 화면 재현 가능
- `Notion data sources` 페이지네이션과 cursor 모델이 자연스럽게 매칭

**Negative**

- v2 코드 규모 ↑ — `SearchBar`/`FilterPanel`/`Pagination` 3 컴포넌트 추가 + searchParams 파싱 헬퍼 4개 추가. 회귀 위험 분산
- ROADMAP §Phase 4(회귀·빌드·배포)의 V8/V9 외에 검색·필터 회귀 시나리오 추가 필요 — 본 ADR 범위 밖, ROADMAP §Phase 4 갱신 시 반영

### 토큰 회수(RegenerateButton)는 별도 v2.x 부분 구현

`components/admin/regenerate-button.tsx`가 `useTransition` + `window.confirm` + `regenerateTokenAction`(Server Action) + sonner toast로 토큰 회수 풀체인을 이미 구현. PRD §10의 "토큰 만료/회수" 후보가 v2.x로 부분 흡수됨. 본 ADR §5 범위 외, 별도 ADR 또는 ROADMAP §출시 후 확장 후보 갱신으로 처리.

---

## §6 검증

- **link-generator 단위 테스트**: `tests/lib/utils/link-generator.test.ts` 5 케이스 PASS (absolute / trailing slash / path-only / url-encode / throw)
- **admin 인증 흐름**: Phase 1 V8 Playwright PASS — `/admin` → `/admin-login` 307 redirect, `/admin-login` 폼 가시 (스크린샷 `docs/audit/2026-05-17-phase1-regression/admin-login.png`)
- **빌드 검증**: Phase 2 `npm run build` PASS — `ƒ /admin/invoices` (5.11 kB) Dynamic 표기, Edge 충돌 없음
- **테스트 회귀**: Phase 2 회귀 게이트에서 `npm run test` 51/51 PASS (이 중 link-generator 5 + 기타 v1·v2 = 50, 본 Phase 신규 0)
- **운영자 수동 위임** (ROADMAP §Phase 3에 [ ] 항목으로 분리):
  - V9 복사 풀체인: dev/Vercel 로그인 → `/admin/invoices` → "링크 복사" 클릭 → 토스트 + 클립보드 확인 (1회)
  - 모바일 360px 가독성 + 다크모드 토글 검증 (1회)

---

## §7 다음 단계 후보 (본 ADR 범위 밖)

- **React 컴포넌트 단위 테스트 도입 (v3)**: `@testing-library/react` + jsdom 또는 happy-dom 환경 추가. `InvoiceTable`(sortHref/isExpired/statusBadge), `CopyButton`(clipboard mock + toast spy), `ShareButton`(mailto/telegram URL 생성)을 컴포넌트 단위로 검증. 도입 비용 ↑ (의존성 4개), 가치는 컴포넌트가 더 진화한 후 평가
- **다국어 분리 (v3+)**: status 라벨(초안/발송됨/열람됨), "(만료)", DropdownMenu 채널명(이메일/텔레그램) 등을 `i18n` 키로 추출. PRD §10의 다국어 후보와 연계
- **`SearchBar` debounce 검증**: 빠른 타이핑 시 URL 동기화 부하 측정 — 운영 row 100건+ 도달 시
- **클립보드 미지원 fallback UI**: secure context 미충족 시 `<input readOnly value={url} />` + 사용자가 직접 선택해서 복사하도록 — `CopyButton`의 toast.error만으로는 운영자에게 다음 행동이 불명확
- **`RegenerateButton` 사후 자동 메일링**: 토큰 회수 후 클라이언트에게 새 링크 자동 발송 — PRD §10의 이메일 발송 후보와 결합
- **목록 컬럼 커스터마이즈**: 운영자가 컬럼 가시 여부(예: 총액 숨기기) 토글 — 화면 너비 부담 ↓
