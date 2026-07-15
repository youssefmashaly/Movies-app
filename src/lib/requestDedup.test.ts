import { describe, it, expect, vi, afterEach } from "vitest";
import { dedupedFetch, getDedupStats } from "./requestDedup";

function deferredJsonResponse(body: unknown) {
  let resolveFn!: (value: Response) => void;
  const promise = new Promise<Response>((resolve) => {
    resolveFn = resolve;
  });
  const response = {
    ok: true,
    status: 200,
    json: async () => body,
    clone() {
      return this;
    },
  } as unknown as Response;
  return { promise, resolve: () => resolveFn(response) };
}

describe("dedupedFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares a single in-flight request across concurrent callers to the same URL", async () => {
    const deferred = deferredJsonResponse({ ok: true });
    const fetchSpy = vi.fn().mockReturnValue(deferred.promise);
    vi.stubGlobal("fetch", fetchSpy);

    const p1 = dedupedFetch("/api/movies/trending");
    const p2 = dedupedFetch("/api/movies/trending");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    deferred.resolve();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(await r1.json()).toEqual({ ok: true });
    expect(await r2.json()).toEqual({ ok: true });
  });

  it("issues a fresh request once the previous one has settled", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      clone() {
        return this;
      },
    });
    vi.stubGlobal("fetch", fetchSpy);

    await dedupedFetch("/api/movies/latest");
    await dedupedFetch("/api/movies/latest");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("treats different URLs as independent requests", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      clone() {
        return this;
      },
    });
    vi.stubGlobal("fetch", fetchSpy);

    await Promise.all([dedupedFetch("/api/movies/trending"), dedupedFetch("/api/movies/latest")]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("treats different HTTP methods on the same URL as independent requests", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      clone() {
        return this;
      },
    });
    vi.stubGlobal("fetch", fetchSpy);

    await Promise.all([
      dedupedFetch("/api/movies/search"),
      dedupedFetch("/api/movies/search", { method: "POST" }),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("tracks hit/miss stats", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      clone() {
        return this;
      },
    });
    vi.stubGlobal("fetch", fetchSpy);

    const before = getDedupStats();
    const [p1, p2] = [dedupedFetch("/api/movies/trending"), dedupedFetch("/api/movies/trending")];
    await Promise.all([p1, p2]);
    const after = getDedupStats();

    expect(after.misses).toBe(before.misses + 1);
    expect(after.hits).toBe(before.hits + 1);
  });
});