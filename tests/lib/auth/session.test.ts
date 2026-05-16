import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-that-is-long-enough-1234567890";

describe("session", () => {
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = SECRET;
    vi.resetModules();
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prev;
    vi.resetModules();
  });

  it("sign + verify round-trip", async () => {
    const { signSession, verifySession } = await import("@/lib/auth/session");
    const token = await signSession();
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
    expect(await verifySession(token)).toBe(true);
  });

  it("rejects tampered signature", async () => {
    const { signSession, verifySession } = await import("@/lib/auth/session");
    const token = await signSession();
    const tampered = token.slice(0, -2) + "XX";
    expect(await verifySession(tampered)).toBe(false);
  });

  it("rejects undefined and empty", async () => {
    const { verifySession } = await import("@/lib/auth/session");
    expect(await verifySession(undefined)).toBe(false);
    expect(await verifySession("")).toBe(false);
  });

  it("rejects token signed with different secret", async () => {
    const { signSession } = await import("@/lib/auth/session");
    const token = await signSession();
    process.env.SESSION_SECRET = "OTHER-secret-that-is-long-enough-987654321";
    vi.resetModules();
    const { verifySession } = await import("@/lib/auth/session");
    expect(await verifySession(token)).toBe(false);
  });

  it("throws on missing or too-short SESSION_SECRET", async () => {
    delete process.env.SESSION_SECRET;
    vi.resetModules();
    const { signSession } = await import("@/lib/auth/session");
    await expect(signSession()).rejects.toThrow(/SESSION_SECRET/);
  });
});
