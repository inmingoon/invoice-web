import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * listInvoices / getInvoiceByNo 단위 테스트 (mocked SDK).
 *
 * - lib/notion.ts:19-22의 NOTION_TOKEN top-level throw 우회: vi.stubEnv 강제.
 * - lib/notion.ts:197-219 getDataSourceId는 NOTION_DATA_SOURCE_ID env가 있으면
 *   databases.retrieve 없이 즉시 반환 → mock 단순화.
 * - cachedDataSourceId/cachedItemsDsId 모듈 캐시 누수 방지: 매 케이스 vi.resetModules.
 */

type Props = Record<string, unknown>;

function makePage(id: string, overrides: Props = {}) {
  return {
    object: "page",
    id,
    properties: {
      invoice_no: { type: "title", title: [{ plain_text: "INV-001" }] },
      client_name: {
        type: "rich_text",
        rich_text: [{ plain_text: "Client A" }],
      },
      issued_at: { type: "date", date: { start: "2026-05-01" } },
      expires_at: { type: "date", date: { start: "2026-06-01" } },
      total: { type: "number", number: 1100000 },
      subtotal: {
        type: "rollup",
        rollup: { type: "number", number: 1000000 },
      },
      vat: { type: "formula", formula: { type: "number", number: 100000 } },
      status: { type: "select", select: { name: "sent" } },
      access_token: {
        type: "rich_text",
        rich_text: [{ plain_text: "tok-xyz" }],
      },
      ...overrides,
    },
  };
}

describe("listInvoices (unit, mocked SDK)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NOTION_TOKEN", "dummy");
    vi.stubEnv("NOTION_DATA_SOURCE_ID", "ds-test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@notionhq/client");
    vi.useRealTimers();
  });

  function mockClient(response: {
    results: unknown[];
    has_more: boolean;
    next_cursor: string | null;
  }) {
    const dataSourcesQuery = vi.fn(async () => response);
    vi.doMock("@notionhq/client", () => ({
      Client: class {
        dataSources = { query: dataSourcesQuery };
      },
      APIErrorCode: { ObjectNotFound: "object_not_found" },
      isFullPage: () => true,
    }));
    return dataSourcesQuery;
  }

  it("(a) 빈 filter + 기본 sort → page_size 20, issued_at desc, filter undefined", async () => {
    const query = mockClient({
      results: [makePage("p1")],
      has_more: false,
      next_cursor: null,
    });
    const { listInvoices } = await import("@/lib/notion");
    const res = await listInvoices();

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        data_source_id: "ds-test",
        page_size: 20,
        start_cursor: undefined,
        filter: undefined,
        sorts: [{ property: "issued_at", direction: "descending" }],
      }),
    );
    expect(res.items).toHaveLength(1);
    expect(res.items[0].invoiceNo).toBe("INV-001");
    expect(res.items[0].accessToken).toBe("tok-xyz");
    expect(res.hasMore).toBe(false);
    expect(res.nextCursor).toBeNull();
  });

  it("(b) status 단일은 select.equals, 다중은 or 분기", async () => {
    const query = mockClient({
      results: [],
      has_more: false,
      next_cursor: null,
    });
    const { listInvoices } = await import("@/lib/notion");

    await listInvoices({ status: ["sent"] });
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filter: { property: "status", select: { equals: "sent" } },
      }),
    );

    await listInvoices({ status: ["sent", "viewed"] });
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filter: {
          or: [
            { property: "status", select: { equals: "sent" } },
            { property: "status", select: { equals: "viewed" } },
          ],
        },
      }),
    );
  });

  it("(c) expired 3 분기 — expired/active/all 절 구성", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T00:00:00Z"));
    const query = mockClient({
      results: [],
      has_more: false,
      next_cursor: null,
    });
    const { listInvoices } = await import("@/lib/notion");

    await listInvoices({ expired: "expired" });
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filter: { property: "expires_at", date: { before: "2026-05-17" } },
      }),
    );

    await listInvoices({ expired: "active" });
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filter: {
          property: "expires_at",
          date: { on_or_after: "2026-05-17" },
        },
      }),
    );

    await listInvoices({ expired: "all" });
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: undefined }),
    );
  });

  it("(d) cursor 페이지네이션 — start_cursor 전달 + has_more 매핑", async () => {
    const query = vi.fn();
    query.mockResolvedValueOnce({
      results: [makePage("p1")],
      has_more: true,
      next_cursor: "next-xyz",
    });
    query.mockResolvedValueOnce({
      results: [makePage("p2")],
      has_more: false,
      next_cursor: null,
    });
    vi.doMock("@notionhq/client", () => ({
      Client: class {
        dataSources = { query };
      },
      APIErrorCode: { ObjectNotFound: "object_not_found" },
      isFullPage: () => true,
    }));
    const { listInvoices } = await import("@/lib/notion");

    const first = await listInvoices(
      {},
      { by: "issuedAt", direction: "desc" },
      { cursor: "cur-abc", pageSize: 50 },
    );
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page_size: 50,
        start_cursor: "cur-abc",
      }),
    );
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBe("next-xyz");

    const second = await listInvoices();
    expect(second.hasMore).toBe(false);
    expect(second.nextCursor).toBeNull();
  });

  it("(e) total fallback — Total/total 부재 시 subtotal+vat, Total 있으면 그 값", async () => {
    const noTotal = makePage("p-no-total");
    delete (noTotal.properties as Record<string, unknown>).total;
    const withUpperTotal = makePage("p-upper", {
      Total: { type: "formula", formula: { type: "number", number: 9999999 } },
    });
    delete (withUpperTotal.properties as Record<string, unknown>).total;

    mockClient({
      results: [noTotal, withUpperTotal],
      has_more: false,
      next_cursor: null,
    });
    const { listInvoices } = await import("@/lib/notion");
    const res = await listInvoices();
    expect(res.items).toHaveLength(2);
    expect(res.items[0].total).toBe(1100000);
    expect(res.items[1].total).toBe(9999999);
  });

  it("(f) getInvoiceByNo — invoice_no title.equals 필터로 query 후 첫 id로 위임", async () => {
    const foundPage = makePage("page-found", {
      invoice_no: {
        type: "title",
        title: [{ plain_text: "INV-2025-001" }],
      },
    });
    const dataSourcesQuery = vi.fn();
    dataSourcesQuery.mockResolvedValueOnce({
      results: [{ object: "page", id: "page-found" }],
      has_more: false,
      next_cursor: null,
    });
    dataSourcesQuery.mockResolvedValueOnce({
      results: [],
      has_more: false,
      next_cursor: null,
    });
    const pagesRetrieve = vi.fn(async () => foundPage);
    const databasesRetrieve = vi.fn(async () => ({
      data_sources: [{ id: "items-ds" }],
    }));
    const dataSourcesRetrieve = vi.fn(async () => ({
      properties: {
        items: { type: "relation", relation: { database_id: "items-db" } },
      },
    }));

    vi.doMock("@notionhq/client", () => ({
      Client: class {
        dataSources = {
          query: dataSourcesQuery,
          retrieve: dataSourcesRetrieve,
        };
        pages = { retrieve: pagesRetrieve };
        databases = { retrieve: databasesRetrieve };
      },
      APIErrorCode: { ObjectNotFound: "object_not_found" },
      isFullPage: () => true,
    }));

    const { getInvoiceByNo } = await import("@/lib/notion");
    const inv = await getInvoiceByNo("INV-2025-001");

    expect(dataSourcesQuery).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data_source_id: "ds-test",
        page_size: 1,
        filter: {
          property: "invoice_no",
          title: { equals: "INV-2025-001" },
        },
      }),
    );
    expect(pagesRetrieve).toHaveBeenCalledWith({ page_id: "page-found" });
    expect(inv).not.toBeNull();
    expect(inv!.invoiceNo).toBe("INV-2025-001");
  });
});
