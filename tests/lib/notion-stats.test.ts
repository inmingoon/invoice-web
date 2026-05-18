import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getInvoiceStats 단위 테스트 (mocked SDK + 실제 cache 모듈).
 *
 * - cache 격리: vi.resetModules로 매 케이스 새 모듈 instance(새 Map store) 강제.
 * - horizon 코드(lib/notion.ts:474)는 expDate < horizon → today..today+6d 포함, today+7d 미포함.
 * - 5페이지 캡: pageIndex < 5 루프 → has_more=true가 5+회 반환되어도 SDK 호출은 정확히 5번.
 */

type Props = Record<string, unknown>;

function makeRow(id: string, overrides: Props = {}) {
  return {
    object: "page",
    id,
    properties: {
      expires_at: { type: "date", date: { start: "2026-06-01" } },
      status: { type: "select", select: { name: "sent" } },
      ...overrides,
    },
  };
}

describe("getInvoiceStats (unit, mocked SDK + real cache)", () => {
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

  type QueryResponse = {
    results: unknown[];
    has_more: boolean;
    next_cursor: string | null;
  };

  function mockQuery(responses: QueryResponse[]) {
    const dataSourcesQuery = vi.fn();
    for (const r of responses) dataSourcesQuery.mockResolvedValueOnce(r);
    vi.doMock("@notionhq/client", () => ({
      Client: class {
        dataSources = { query: dataSourcesQuery };
      },
      APIErrorCode: { ObjectNotFound: "object_not_found" },
      isFullPage: () => true,
    }));
    return dataSourcesQuery;
  }

  it("(a) miss → SDK 1회 호출, 같은 컨텍스트 hit → SDK 추가 호출 0", async () => {
    const query = mockQuery([
      {
        results: [makeRow("1"), makeRow("2")],
        has_more: false,
        next_cursor: null,
      },
    ]);
    const { getInvoiceStats } = await import("@/lib/notion");

    const first = await getInvoiceStats();
    expect(query).toHaveBeenCalledTimes(1);
    expect(first.total).toBe(2);

    const second = await getInvoiceStats();
    expect(query).toHaveBeenCalledTimes(1); // cache hit
    expect(second).toEqual(first);
  });

  it("(b) 7일 horizon — today+0d/+6d 포함, today+7d 미포함 (expDate < horizon)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T00:00:00Z"));
    const rows = [
      makeRow("yesterday", {
        expires_at: { type: "date", date: { start: "2026-05-16" } },
      }),
      makeRow("today", {
        expires_at: { type: "date", date: { start: "2026-05-17" } },
      }),
      makeRow("d6", {
        expires_at: { type: "date", date: { start: "2026-05-23" } },
      }),
      makeRow("d7", {
        expires_at: { type: "date", date: { start: "2026-05-24" } },
      }),
    ];
    mockQuery([{ results: rows, has_more: false, next_cursor: null }]);
    const { getInvoiceStats } = await import("@/lib/notion");
    const s = await getInvoiceStats();
    expect(s.total).toBe(4);
    expect(s.expiringSoon).toBe(2); // today, d6 only
  });

  it("(c) unviewed — status=viewed인 row만 unviewed 카운트에서 제외", async () => {
    const rows = [
      makeRow("1", { status: { type: "select", select: { name: "draft" } } }),
      makeRow("2", { status: { type: "select", select: { name: "sent" } } }),
      makeRow("3", { status: { type: "select", select: { name: "viewed" } } }),
      makeRow("4", { status: { type: "select", select: { name: "viewed" } } }),
      makeRow("5", { status: { type: "select", select: { name: "sent" } } }),
    ];
    mockQuery([{ results: rows, has_more: false, next_cursor: null }]);
    const { getInvoiceStats } = await import("@/lib/notion");
    const s = await getInvoiceStats();
    expect(s.total).toBe(5);
    expect(s.unviewed).toBe(3); // draft + sent*2 = 3
  });

  it("(d) 5페이지 캡 — has_more=true가 7회 가능해도 SDK 호출은 정확히 5번", async () => {
    const responses = Array.from({ length: 7 }, (_, i) => ({
      results: [makeRow(`p${i}`)],
      has_more: true,
      next_cursor: `c${i + 1}`,
    }));
    const query = mockQuery(responses);
    const { getInvoiceStats } = await import("@/lib/notion");
    const s = await getInvoiceStats();

    expect(query).toHaveBeenCalledTimes(5);
    expect(s.total).toBe(5);
  });
});
