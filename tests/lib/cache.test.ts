import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _clearForTests, invalidate, memoize } from "@/lib/cache";

describe("memoize", () => {
  beforeEach(() => {
    _clearForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached value within ttl", async () => {
    const fn = vi.fn(async () => Math.random());
    const a = await memoize("k", 1000, fn);
    const b = await memoize("k", 1000, fn);
    expect(a).toBe(b);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("re-runs fn after ttl expires", async () => {
    const fn = vi.fn(async () => Date.now());
    const a = await memoize("k", 500, fn);
    vi.advanceTimersByTime(600);
    const b = await memoize("k", 500, fn);
    expect(a).not.toBe(b);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("isolates by key", async () => {
    const fn = vi.fn(async (n: number) => n);
    await memoize("a", 1000, () => fn(1));
    await memoize("b", 1000, () => fn(2));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("invalidate(prefix) clears matching keys", async () => {
    let count = 0;
    const fn = async () => ++count;
    await memoize("invoice-stats", 5000, fn);
    await memoize("invoice-stats:2", 5000, fn);
    await memoize("other", 5000, fn);
    invalidate("invoice-stats");
    expect(await memoize("invoice-stats", 5000, fn)).toBe(4);
    expect(await memoize("other", 5000, fn)).toBe(3); // unchanged
  });
});
