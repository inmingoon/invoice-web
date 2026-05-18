import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * updateInvoiceToken 단위 테스트 (mocked SDK + mocked cache).
 *
 * 토큰 재발급 → Notion pages.update → cache.invalidate("invoice-stats")의
 * 두 부수효과를 정확히 검증한다. cache 무효화 누락 회귀 안전망.
 */

const invalidate = vi.fn();
const memoize = vi.fn(async (_k: string, _ttl: number, fn: () => unknown) =>
  fn(),
);

describe("updateInvoiceToken (unit, mocked SDK + mocked cache)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NOTION_TOKEN", "dummy");
    invalidate.mockClear();
    memoize.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@notionhq/client");
    vi.doUnmock("@/lib/cache");
  });

  function setupMocks() {
    const pagesUpdate = vi.fn(async () => ({}));
    vi.doMock("@notionhq/client", () => ({
      Client: class {
        pages = { update: pagesUpdate };
      },
      APIErrorCode: { ObjectNotFound: "object_not_found" },
      isFullPage: () => true,
    }));
    vi.doMock("@/lib/cache", () => ({
      memoize,
      invalidate,
    }));
    return pagesUpdate;
  }

  it("(a) pages.update에 정확한 page_id와 access_token rich_text 인자 전달", async () => {
    const pagesUpdate = setupMocks();
    const { updateInvoiceToken } = await import("@/lib/notion");
    await updateInvoiceToken("inv-123", "new-token-xyz");

    expect(pagesUpdate).toHaveBeenCalledTimes(1);
    expect(pagesUpdate).toHaveBeenCalledWith({
      page_id: "inv-123",
      properties: {
        access_token: {
          rich_text: [{ text: { content: "new-token-xyz" } }],
        },
      },
    });
  });

  it("(b) invalidate('invoice-stats') 정확히 1회 호출 (cache stale 회귀 안전망)", async () => {
    setupMocks();
    const { updateInvoiceToken } = await import("@/lib/notion");
    await updateInvoiceToken("inv-id", "tok");

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith("invoice-stats");
  });
});
