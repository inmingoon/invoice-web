import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildInvoiceLink } from "@/lib/utils/link-generator";

describe("buildInvoiceLink", () => {
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.NEXT_PUBLIC_SITE_URL;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prev;
  });

  it("returns absolute URL when NEXT_PUBLIC_SITE_URL is set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://invoice.example.com";
    expect(
      buildInvoiceLink({ id: "abc-123", accessToken: "TOKEN_ABCDEF" }),
    ).toBe("https://invoice.example.com/invoice/abc-123?token=TOKEN_ABCDEF");
  });

  it("strips trailing slash from base URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://invoice.example.com/";
    expect(buildInvoiceLink({ id: "abc", accessToken: "T" })).toBe(
      "https://invoice.example.com/invoice/abc?token=T",
    );
  });

  it("returns path-only when NEXT_PUBLIC_SITE_URL missing", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(buildInvoiceLink({ id: "abc", accessToken: "T" })).toBe(
      "/invoice/abc?token=T",
    );
  });

  it("url-encodes id and token", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(
      buildInvoiceLink({ id: "with space", accessToken: "to/ken+/=" }),
    ).toBe("/invoice/with%20space?token=to%2Fken%2B%2F%3D");
  });

  it("throws on missing id or token", () => {
    expect(() => buildInvoiceLink({ id: "", accessToken: "T" })).toThrow(
      /invoice id/,
    );
    expect(() => buildInvoiceLink({ id: "abc", accessToken: "" })).toThrow(
      /accessToken/,
    );
  });
});
