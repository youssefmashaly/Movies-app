const inFlight = new Map<string, Promise<Response>>();

export function dedupedFetch(url: string, options?: RequestInit): Promise<Response> {
  const key = `${options?.method ?? "GET"}:${url}`;
  const existing = inFlight.get(key);
  if (existing) return existing.then((r) => r.clone());

  const promise = fetch(url, options).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise.then((r) => r.clone());
}