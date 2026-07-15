import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveMovie,
  resolveMovies,
  primeMovieCache,
  getCachedMovie,
  __clearMovieResolverCache,
} from "./movieResolver";
import { interstellar, darkKnight, godfather } from "../test/fixtures/movies";

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

describe("movieResolver", () => {
  beforeEach(() => {
    __clearMovieResolverCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("primeMovieCache makes a movie resolvable with zero network calls", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    primeMovieCache([interstellar]);
    const resolved = await resolveMovie(interstellar.id);

    expect(resolved).toEqual(interstellar);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("getCachedMovie is a synchronous, no-network peek", () => {
    expect(getCachedMovie(interstellar.id)).toBeUndefined();
    primeMovieCache([interstellar]);
    expect(getCachedMovie(interstellar.id)).toEqual(interstellar);
  });

  it("resolveMovie('') resolves to null without hitting the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(resolveMovie("")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("batches concurrent resolve calls into a single /api/movies/batch request", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse([interstellar, darkKnight]));
    vi.stubGlobal("fetch", fetchSpy);

    const p1 = resolveMovie(interstellar.id);
    const p2 = resolveMovie(darkKnight.id);
    // Both calls happen on the same tick — the resolver micro-batches them
    // into one request on the next tick rather than firing two.
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toEqual(interstellar);
    expect(r2).toEqual(darkKnight);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const requestedUrl = fetchSpy.mock.calls[0][0] as string;
    expect(requestedUrl).toContain("/api/movies/batch?ids=");
    expect(requestedUrl).toContain(interstellar.id);
    expect(requestedUrl).toContain(darkKnight.id);
  });

  it("resolveMovies preserves request order, dedupes ids, and drops ids that don't resolve", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse([darkKnight, interstellar]));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resolveMovies([darkKnight.id, "does-not-exist", interstellar.id, darkKnight.id]);

    expect(result.map((m) => m.id)).toEqual([darkKnight.id, interstellar.id]);
  });

  it("caches a resolved movie so a second resolve for the same id never re-fetches", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse([godfather]));
    vi.stubGlobal("fetch", fetchSpy);

    await resolveMovie(godfather.id);
    const second = await resolveMovie(godfather.id);

    expect(second).toEqual(godfather);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("resolves to null (not a throw) for an aborted request", async () => {
    const controller = new AbortController();
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse([interstellar]));
    vi.stubGlobal("fetch", fetchSpy);

    const promise = resolveMovie(interstellar.id, { signal: controller.signal });
    controller.abort();

    await expect(promise).resolves.toBeNull();
  });

  it("rejects all pending waiters if the batch request itself fails", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(null, false));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(resolveMovie(interstellar.id)).rejects.toThrow();
  });
});