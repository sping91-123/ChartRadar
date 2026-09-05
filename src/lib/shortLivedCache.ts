/** Bounded process-local cache: merge concurrent requests, never retain failures. */
export function createShortLivedCache<T>(ttlMs: number, maxEntries = 128) {
  const values = new Map<string, { value: T; expires: number }>();
  const pending = new Map<string, Promise<T>>();
  return function get(key: string, load: () => Promise<T>): Promise<T> {
    const cached = values.get(key);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value);
    const existing = pending.get(key);
    if (existing) return existing;
    const started = Date.now();
    const request = Promise.resolve().then(load).then(value => {
      if (values.size >= maxEntries) values.delete(values.keys().next().value!);
      values.set(key, { value, expires: started + ttlMs });
      return value;
    }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
    if (pending.size < maxEntries) pending.set(key, request);
    return request;
  };
}
