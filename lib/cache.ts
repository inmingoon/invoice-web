/**
 * 단순 in-memory TTL 캐시. 단일 인스턴스 가정 — Vercel serverless에서는 각 람다가 별도 캐시.
 * Phase D에서 dashboard KPI(60초 staleness 허용) 같은 read-heavy·idempotent 응답에만 사용.
 *
 * 다음 단계로 Upstash KV 또는 Vercel KV 어댑터로 교체하려면 memoize 시그니처를 그대로 둔 채
 * 내부 Map만 외부 store로 갈아끼우면 된다.
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

/** key에 대한 값을 캐시. miss/expired면 fn()을 실행해 ttlMs 동안 저장. */
export async function memoize<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;
  const value = await fn();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** prefix로 시작하는 모든 키를 무효화. mutation(예: 토큰 회수) 후 호출. */
export function invalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function _clearForTests(): void {
  store.clear();
}
