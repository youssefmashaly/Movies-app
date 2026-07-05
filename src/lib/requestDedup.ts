const inFlight = new Map<string, Promise<Response>>();

// Dev-only counters — read by the diagnostics utility (src/lib/diagnostics.ts).
const stats = { hits: 0, misses: 0 };

export function dedupedFetch(url: string, options?: RequestInit): Promise<Response> {
  const key = `${options?.method ?? "GET"}:${url}`;
  const existing = inFlight.get(key);
  if (existing) {
    stats.hits++;
    return existing.then((r) => r.clone());
  }

  stats.misses++;
  const promise = fetch(url, options).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise.then((r) => r.clone());
}

export function getDedupStats() {
  return { ...stats, inFlightCount: inFlight.size };
}