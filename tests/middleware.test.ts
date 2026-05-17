import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";

describe("middleware admin gate", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "x".repeat(32));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 for /admin when production and ENABLE_ADMIN unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_ADMIN", "");
    const req = new NextRequest(new URL("http://localhost/admin"));
    const res = await middleware(req);
    expect(res.status).toBe(404);
  });

  it("returns 404 for /admin-login when production and ENABLE_ADMIN unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_ADMIN", "");
    const req = new NextRequest(new URL("http://localhost/admin-login"));
    const res = await middleware(req);
    expect(res.status).toBe(404);
  });

  it("passes /admin-login through (no redirect, no 404) when ENABLE_ADMIN=1 even in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_ADMIN", "1");
    const req = new NextRequest(new URL("http://localhost/admin-login"));
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("redirects /admin to /admin-login when ENABLE_ADMIN=1, no session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_ADMIN", "1");
    const req = new NextRequest(new URL("http://localhost/admin"));
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin-login");
  });

  it("passes /admin-login through in development without ENABLE_ADMIN", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_ADMIN", "");
    const req = new NextRequest(new URL("http://localhost/admin-login"));
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });
});
