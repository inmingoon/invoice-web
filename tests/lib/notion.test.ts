import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const HAS_NOTION =
  !!process.env.NOTION_TOKEN && !!process.env.NOTION_DATA_SOURCE_ID;

describe("getInvoiceById (integration)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("@notionhq/client");
  });

  it.skipIf(!HAS_NOTION)(
    "row INV-2025-001 매핑 + Items Relation 로드",
    async () => {
      const { Client } = await import("@notionhq/client");
      const c = new Client({ auth: process.env.NOTION_TOKEN });
      const q = await c.dataSources.query({
        data_source_id: process.env.NOTION_DATA_SOURCE_ID as string,
        filter: { property: "invoice_no", title: { equals: "INV-2025-001" } },
      });
      const rowAId = q.results[0]?.id;
      expect(rowAId).toBeDefined();

      const { getInvoiceById } = await import("@/lib/notion");
      const inv = await getInvoiceById(rowAId as string);
      expect(inv).not.toBeNull();
      expect(inv!.invoiceNo).toBe("INV-2025-001");

      // items는 Relation으로 옴 — 길이·shape만 검증 (값은 사용자가 자유롭게 수정 가능).
      expect(inv!.items.length).toBeGreaterThan(0);
      for (const it of inv!.items) {
        expect(typeof it.name).toBe("string");
        expect(typeof it.qty).toBe("number");
        expect(typeof it.unitPrice).toBe("number");
      }

      // subtotal은 Rollup(Sum of Items.금액). items × 단가 합과 일치해야 함.
      const itemsSum = inv!.items.reduce(
        (s, it) => s + it.qty * it.unitPrice,
        0,
      );
      expect(inv!.subtotal).toBe(itemsSum);
      expect(inv!.total).toBeGreaterThanOrEqual(inv!.subtotal);

      expect(inv!.status).toMatch(/^(draft|sent|viewed)$/);
      expect(inv!.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    },
  );

  it.skipIf(!HAS_NOTION)("존재하지 않는 id → null", async () => {
    const { getInvoiceById } = await import("@/lib/notion");
    const inv = await getInvoiceById("00000000-0000-0000-0000-000000000000");
    expect(inv).toBeNull();
  });
});

describe("getInvoiceById (unit, mocked SDK)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@notionhq/client");
  });

  it("Rollup/Formula 합계 + Relation items 매핑", async () => {
    const pagesRetrieve = vi.fn(async () => ({
      object: "page",
      id: "inv-1",
      properties: {
        invoice_no: { type: "title", title: [{ plain_text: "INV-001" }] },
        client_name: {
          type: "rich_text",
          rich_text: [{ plain_text: "테스트" }],
        },
        issued_at: { type: "date", date: { start: "2026-05-01" } },
        expires_at: { type: "date", date: { start: "2026-06-01" } },
        items: { type: "relation", relation: [{ id: "item-1" }] },
        subtotal: {
          type: "rollup",
          rollup: { type: "number", number: 3000000, function: "sum" },
        },
        vat: {
          type: "formula",
          formula: { type: "number", number: 300000 },
        },
        Total: {
          type: "formula",
          formula: { type: "number", number: 3300000 },
        },
        memo: { type: "rich_text", rich_text: [] },
        access_token: {
          type: "rich_text",
          rich_text: [{ plain_text: "tok" }],
        },
        status: { type: "select", select: { name: "draft" } },
      },
    }));
    const databasesRetrieve = vi.fn(async () => ({
      data_sources: [{ id: "ds-id" }],
    }));
    const dataSourcesRetrieve = vi.fn(async () => ({
      properties: {
        items: {
          type: "relation",
          relation: { database_id: "items-db-id" },
        },
      },
    }));
    const dataSourcesQuery = vi.fn(async () => ({
      results: [
        {
          object: "page",
          id: "item-1",
          properties: {
            항목명: { type: "title", title: [{ plain_text: "디자인" }] },
            수량: { type: "number", number: 2 },
            단가: { type: "number", number: 1500000 },
          },
        },
      ],
    }));

    vi.doMock("@notionhq/client", () => ({
      Client: class {
        pages = { retrieve: pagesRetrieve };
        databases = { retrieve: databasesRetrieve };
        dataSources = {
          retrieve: dataSourcesRetrieve,
          query: dataSourcesQuery,
        };
      },
      APIErrorCode: { ObjectNotFound: "object_not_found" },
      isFullPage: () => true,
    }));

    const { getInvoiceById } = await import("@/lib/notion");
    const inv = await getInvoiceById("inv-1");
    expect(inv).not.toBeNull();
    expect(inv!.invoiceNo).toBe("INV-001");
    expect(inv!.items).toEqual([
      { name: "디자인", qty: 2, unitPrice: 1500000 },
    ]);
    expect(inv!.subtotal).toBe(3000000);
    expect(inv!.vat).toBe(300000);
    expect(inv!.total).toBe(3300000);
    expect(inv!.status).toBe("draft");
  });
});
