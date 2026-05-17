import "server-only";

import { APIErrorCode, Client, isFullPage } from "@notionhq/client";

import { InvoiceParseError } from "@/types/invoice";
import type {
  ExpiredFilter,
  Invoice,
  InvoiceItem,
  InvoiceListFilter,
  InvoiceListItem,
  InvoiceListResult,
  InvoiceListSort,
  InvoiceStats,
  InvoiceStatus,
  SortDirection,
} from "@/types/invoice";

const token = process.env.NOTION_TOKEN;
if (!token) {
  throw new Error("NOTION_TOKEN missing");
}

const notion = new Client({ auth: token });

type RichTextItem = { plain_text: string };
type Properties = Record<string, { type: string } & Record<string, unknown>>;

function concatRichText(items: RichTextItem[]): string {
  return items.map((i) => i.plain_text).join("");
}

function getTitle(props: Properties, key: string): string {
  const p = props[key];
  if (!p || p.type !== "title") return "";
  return concatRichText((p as unknown as { title: RichTextItem[] }).title);
}

function getRichText(props: Properties, key: string): string {
  const p = props[key];
  if (!p || p.type !== "rich_text") return "";
  return concatRichText(
    (p as unknown as { rich_text: RichTextItem[] }).rich_text,
  );
}

function getNumber(props: Properties, key: string): number | null {
  const p = props[key];
  if (!p || p.type !== "number") return null;
  return (p as unknown as { number: number | null }).number;
}

function getDate(props: Properties, key: string): string {
  const p = props[key];
  if (!p || p.type !== "date") return "";
  const d = (p as unknown as { date: { start: string } | null }).date;
  return d?.start ?? "";
}

function getSelect(props: Properties, key: string): string {
  const p = props[key];
  if (!p || p.type !== "select") return "";
  const s = (p as unknown as { select: { name: string } | null }).select;
  return s?.name ?? "";
}

function isInvoiceStatus(v: string): v is InvoiceStatus {
  return v === "draft" || v === "sent" || v === "viewed";
}

/** Notion page(견적서 row)를 도메인 Invoice로 매핑. 404/40x → null, 5xx만 throw. items JSON 파싱 실패 시 InvoiceParseError throw. */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  let page: Awaited<ReturnType<typeof notion.pages.retrieve>>;
  try {
    page = await notion.pages.retrieve({ page_id: id });
  } catch (e: unknown) {
    const err = e as { code?: string; status?: number };
    if (err.code === APIErrorCode.ObjectNotFound) return null;
    if (
      typeof err.status === "number" &&
      err.status >= 400 &&
      err.status < 500
    ) {
      return null;
    }
    throw e;
  }

  if (!isFullPage(page)) return null;

  const props = page.properties as unknown as Properties;

  const rawItems = getRichText(props, "items");
  let items: InvoiceItem[];
  try {
    const parsed: unknown = JSON.parse(rawItems);
    if (!Array.isArray(parsed)) throw new Error("items is not an array");
    items = parsed.map((x): InvoiceItem => {
      if (!x || typeof x !== "object") throw new Error("item is not an object");
      const o = x as Record<string, unknown>;
      if (
        typeof o.name !== "string" ||
        typeof o.qty !== "number" ||
        typeof o.unit_price !== "number"
      ) {
        throw new Error("item shape mismatch");
      }
      return { name: o.name, qty: o.qty, unitPrice: o.unit_price };
    });
  } catch (cause) {
    throw new InvoiceParseError(id, cause);
  }

  const statusRaw = getSelect(props, "status");
  const status: InvoiceStatus = isInvoiceStatus(statusRaw)
    ? statusRaw
    : "draft";

  return {
    id,
    invoiceNo: getTitle(props, "invoice_no"),
    clientName: getRichText(props, "client_name"),
    issuedAt: getDate(props, "issued_at"),
    expiresAt: getDate(props, "expires_at"),
    items,
    subtotal: getNumber(props, "subtotal") ?? 0,
    vat: getNumber(props, "vat") ?? 0,
    total: getNumber(props, "total") ?? 0,
    memo: getRichText(props, "memo") || null,
    accessToken: getRichText(props, "access_token"),
    status,
  };
}

// ----- 목록/통계 (Phase B) -----

let cachedDataSourceId: string | null = null;

/**
 * Notion data source id를 lazy 캐시. NOTION_DATA_SOURCE_ID env가 있으면 우선 사용,
 * 없으면 NOTION_DATABASE_ID로 databases.retrieve()해서 첫 data source id를 추출.
 * v5 Notion API의 multi-source DB도 지원하나 본 프로젝트는 single-source만 가정.
 */
async function getDataSourceId(): Promise<string> {
  if (cachedDataSourceId) return cachedDataSourceId;
  const fromEnv = process.env.NOTION_DATA_SOURCE_ID;
  if (fromEnv) {
    cachedDataSourceId = fromEnv;
    return fromEnv;
  }
  const dbId = process.env.NOTION_DATABASE_ID;
  if (!dbId) {
    throw new Error(
      "Neither NOTION_DATA_SOURCE_ID nor NOTION_DATABASE_ID is set",
    );
  }
  const db = (await notion.databases.retrieve({
    database_id: dbId,
  })) as unknown as { data_sources?: Array<{ id: string }> };
  const ds = db.data_sources?.[0]?.id;
  if (!ds) {
    throw new Error(`Notion DB ${dbId} has no data sources`);
  }
  cachedDataSourceId = ds;
  return ds;
}

function pageToListItem(pageId: string, props: Properties): InvoiceListItem {
  const statusRaw = getSelect(props, "status");
  const status: InvoiceStatus = isInvoiceStatus(statusRaw)
    ? statusRaw
    : "draft";
  return {
    id: pageId,
    invoiceNo: getTitle(props, "invoice_no"),
    clientName: getRichText(props, "client_name"),
    issuedAt: getDate(props, "issued_at"),
    expiresAt: getDate(props, "expires_at"),
    total: getNumber(props, "total") ?? 0,
    status,
  };
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const SORT_PROPERTY: Record<InvoiceListSort["by"], string> = {
  issuedAt: "issued_at",
  expiresAt: "expires_at",
  total: "total",
};

function direction(d: SortDirection): "ascending" | "descending" {
  return d === "asc" ? "ascending" : "descending";
}

type NotionFilter = Record<string, unknown>;

function buildExpiredFilter(
  mode: ExpiredFilter | undefined,
): NotionFilter | null {
  if (!mode || mode === "all") return null;
  const today = todayIso();
  if (mode === "expired") {
    return { property: "expires_at", date: { before: today } };
  }
  return { property: "expires_at", date: { on_or_after: today } };
}

function buildFilter(f: InvoiceListFilter): NotionFilter | undefined {
  const clauses: NotionFilter[] = [];
  if (f.q && f.q.trim()) {
    clauses.push({
      property: "client_name",
      rich_text: { contains: f.q.trim() },
    });
  }
  if (f.status && f.status.length > 0) {
    if (f.status.length === 1) {
      clauses.push({
        property: "status",
        select: { equals: f.status[0] },
      });
    } else {
      clauses.push({
        or: f.status.map((s) => ({
          property: "status",
          select: { equals: s },
        })),
      });
    }
  }
  const expired = buildExpiredFilter(f.expired);
  if (expired) clauses.push(expired);

  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return { and: clauses };
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * 견적서 목록 조회. 필터·정렬·cursor 페이지네이션 지원.
 * - q: client_name 부분 일치
 * - status: 다중 select (or)
 * - expired: active | expired | all (issued_at 기준 vs 오늘 UTC)
 * - sort: issuedAt | expiresAt | total × asc | desc
 * - cursor: Notion next_cursor
 *
 * 호출자가 fetch에 cache: 'no-store' 의도를 코드로 박는 패턴 유지.
 */
export async function listInvoices(
  filter: InvoiceListFilter = {},
  sort: InvoiceListSort = { by: "issuedAt", direction: "desc" },
  page: { cursor?: string; pageSize?: number } = {},
): Promise<InvoiceListResult> {
  const dataSourceId = await getDataSourceId();
  const built = buildFilter(filter);
  const res = await notion.dataSources.query({
    data_source_id: dataSourceId,
    page_size: page.pageSize ?? DEFAULT_PAGE_SIZE,
    start_cursor: page.cursor,
    filter: built as Parameters<typeof notion.dataSources.query>[0]["filter"],
    sorts: [
      {
        property: SORT_PROPERTY[sort.by],
        direction: direction(sort.direction),
      },
    ],
  });

  const items: InvoiceListItem[] = [];
  for (const row of res.results) {
    if (!isFullPage(row)) continue;
    const props = row.properties as unknown as Properties;
    items.push(pageToListItem(row.id, props));
  }

  return {
    items,
    nextCursor: res.has_more ? (res.next_cursor ?? null) : null,
    hasMore: res.has_more,
  };
}

/**
 * 대시보드 KPI 통계. 작은 DB(<500)를 가정해 전체 페이지를 순회한다.
 * - total: 전체 견적서 수
 * - expiringSoon: 오늘 기준 7일 이내 만료 (만료 안 됨 + 7일 이내)
 * - unviewed: status != 'viewed'
 *
 * 안전 캡: 5페이지 × page_size 100 = 500. 초과 시 결과는 절단 — 큰 DB는 Phase D 캐시·집계 도입 필요.
 */
export async function getInvoiceStats(): Promise<InvoiceStats> {
  const dataSourceId = await getDataSourceId();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + 7);

  let total = 0;
  let expiringSoon = 0;
  let unviewed = 0;
  let cursor: string | undefined;

  for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
    });
    for (const row of res.results) {
      if (!isFullPage(row)) continue;
      total++;
      const props = row.properties as unknown as Properties;
      const statusRaw = getSelect(props, "status");
      if (statusRaw !== "viewed") unviewed++;
      const exp = getDate(props, "expires_at");
      if (exp) {
        const expDate = new Date(exp);
        if (
          !Number.isNaN(expDate.getTime()) &&
          expDate >= today &&
          expDate < horizon
        ) {
          expiringSoon++;
        }
      }
    }
    if (!res.has_more) break;
    cursor = res.next_cursor ?? undefined;
  }

  return { total, expiringSoon, unviewed };
}
