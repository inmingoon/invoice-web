import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _clearForTests, tryConsume } from "@/lib/rate-limit";

const LIMIT = { capacity: 3, windowMs: 1000 };

describe("tryConsume (token bucket)", () => {
  beforeEach(() => {
    _clearForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to capacity, then denies", () => {
    expect(tryConsume("k", LIMIT).ok).toBe(true);
    expect(tryConsume("k", LIMIT).ok).toBe(true);
    expect(tryConsume("k", LIMIT).ok).toBe(true);
    const denied = tryConsume("k", LIMIT);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it("refills over time", () => {
    for (let i = 0; i < 3; i++) tryConsume("k", LIMIT);
    expect(tryConsume("k", LIMIT).ok).toBe(false);
    // 1초 후 capacity 만큼 refill
    vi.advanceTimersByTime(1100);
    expect(tryConsume("k", LIMIT).ok).toBe(true);
  });

  it("isolates by key", () => {
    for (let i = 0; i < 3; i++) tryConsume("a", LIMIT);
    expect(tryConsume("a", LIMIT).ok).toBe(false);
    expect(tryConsume("b", LIMIT).ok).toBe(true);
  });

  it("partial refill within window", () => {
    for (let i = 0; i < 3; i++) tryConsume("k", LIMIT);
    // 333ms = 1 token refill (capacity/windowMs = 3/1000, *333 = 0.999)
    vi.advanceTimersByTime(334);
    const r = tryConsume("k", LIMIT);
    expect(r.ok).toBe(true);
    expect(tryConsume("k", LIMIT).ok).toBe(false);
  });

  it("denies negative cost overshoot but reports retryAfter", () => {
    for (let i = 0; i < 3; i++) tryConsume("k", LIMIT);
    const r = tryConsume("k", LIMIT, 2);
    expect(r.ok).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });
});
