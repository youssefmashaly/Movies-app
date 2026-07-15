import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadMovieCatalog, getCachedCatalog, isCatalogLoaded, __clearMovieCatalogCache } from "./movieCatalog";
import { __clearMovieResolverCache, getCachedMovie } from "./movieResolver";
import { movieFixtures, interstellar } from "../test/fixtures/movies";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    clone() {
      return this;
    },
  } as unknown as Response;
}

describe("movieCatalog loader", () => {
  beforeEach(() => {
    __clearMovieCatalogCache();
    __clearMovieResolverCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is empty/not-loaded before the first successful load", () => {
    expect(getCachedCatalog()).toEqual([]);
    expect(isCatalogLoaded()).toBe(false);
  });

  it("fetches the catalog from /api/movies/trending exactly once for concurrent callers", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(movieFixtures));
    vi.stubGlobal("fetch", fetchSpy);

    const [a, b, c] = await Promise.all([loadMovieCatalog(), loadMovieCatalog(), loadMovieCatalog()]);

    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toEqual(movieFixtures);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("/api/movies/trending", undefined);
  });

  it("does not re-fetch on a second call once already loaded", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(movieFixtures));
    vi.stubGlobal("fetch", fetchSpy);

    await loadMovieCatalog();
    await loadMovieCatalog();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(isCatalogLoaded()).toBe(true);
    expect(getCachedCatalog()).toEqual(movieFixtures);
  });

  it("primes the movieResolver's per-id cache so individual ids resolve without another fetch", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(movieFixtures));
    vi.stubGlobal("fetch", fetchSpy);

    await loadMovieCatalog();

    expect(getCachedMovie(interstellar.id)).toEqual(interstellar);
  });

  it("throws (and doesn't cache) when the backend responds with an error", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(null, false));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(loadMovieCatalog()).rejects.toThrow();
    expect(isCatalogLoaded()).toBe(false);
  });

  it("allows a fresh retry after a prior failure", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(null, false))
      .mockResolvedValueOnce(jsonResponse(movieFixtures));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(loadMovieCatalog()).rejects.toThrow();
    const result = await loadMovieCatalog();

    expect(result).toEqual(movieFixtures);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});