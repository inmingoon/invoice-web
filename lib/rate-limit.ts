import { headers } from "next/headers";

/**
 * Token bucket rate limiter. 단일 인스턴스 in-memory.
 *
 * - capacity: 버킷이 가질 수 있는 최대 토큰 수
 * - windowMs: capacity를 0에서 가득 채우는 시간
 *
 * 호출 시 cost(기본 1)만큼 차감. 부족하면 ok:false + retryAfterMs.
 * Vercel serverless에서는 각 람다가 별도 버킷 — 동일 IP가 여러 람다로 분산되면 약해짐.
 * Phase D 후속 (Upstash 등 외부 store)에서 강화 예정.
 */

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

export interface Limit {
  capacity: number;
  windowMs: number;
}

export interface ConsumeResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function tryConsume(key: string, limit: Limit, cost = 1): ConsumeResult {
  const now = Date.now();
  const ratePerMs = limit.capacity / limit.windowMs;
  const prev = buckets.get(key) ?? { tokens: limit.capacity, updatedAt: now };
  const elapsed = Math.max(0, now - prev.updatedAt);
  const refilled = Math.min(limit.capacity, prev.tokens + elapsed * ratePerMs);
  if (refilled < cost) {
    buckets.set(key, { tokens: refilled, updatedAt: now });
    const deficit = cost - refilled;
    const retryAfterMs = Math.ceil(deficit / ratePerMs);
    return { ok: false, remaining: 0, retryAfterMs };
  }
  const next = refilled - cost;
  buckets.set(key, { tokens: next, updatedAt: now });
  return { ok: true, remaining: Math.floor(next), retryAfterMs: 0 };
}

/** Server Action / Route Handler에서 호출자 IP 추출. x-forwarded-for 우선, fallback x-real-ip → "unknown". */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}

export const LOGIN_LIMIT: Limit = { capacity: 5, windowMs: 60_000 };
export const REGEN_LIMIT: Limit = { capacity: 10, windowMs: 60_000 };
export const PDF_LIMIT: Limit = { capacity: 30, windowMs: 60_000 };

export function _clearForTests(): void {
  buckets.clear();
}
