import { describe, it, expect } from "vitest";
import {
  migrateRecentlyViewedEntries,
  addRecentlyViewedEntry,
  resolveRecentlyViewedMovies,
  MAX_RECENTLY_VIEWED,
  type RecentlyViewedEntry,
} from "./recentlyViewed";
import { interstellar, darkKnight, godfather } from "../test/fixtures/movies";

describe("migrateRecentlyViewedEntries", () => {
  it("returns an empty array for non-array input", () => {
    expect(migrateRecentlyViewedEntries(null)).toEqual([]);
    expect(migrateRecentlyViewedEntries(undefined)).toEqual([]);
    expect(migrateRecentlyViewedEntries("not an array")).toEqual([]);
  });

  it("passes already-migrated { id, viewedAt } entries through unchanged", () => {
    const input: RecentlyViewedEntry[] = [
      { id: "1", viewedAt: 100 },
      { id: "2", viewedAt: 50 },
    ];
    expect(migrateRecentlyViewedEntries(input)).toEqual(input);
  });

  it("converts legacy full-Movie-object entries to { id, viewedAt } while preserving order", () => {
    const legacy = [interstellar, darkKnight];
    const migrated = migrateRecentlyViewedEntries(legacy);

    expect(migrated).toHaveLength(2);
    expect(migrated[0].id).toBe(interstellar.id);
    expect(migrated[1].id).toBe(darkKnight.id);
    // Order (= recency) preserved via strictly-descending synthetic timestamps
    expect(migrated[0].viewedAt).toBeGreaterThan(migrated[1].viewedAt);
  });

  it("dedupes by id, keeping the first occurrence", () => {
    const migrated = migrateRecentlyViewedEntries([
      { id: "1", viewedAt: 100 },
      { id: "1", viewedAt: 50 },
    ]);
    expect(migrated).toHaveLength(1);
    expect(migrated[0].viewedAt).toBe(100);
  });

  it("silently drops unrecognizable entries instead of throwing", () => {
    const migrated = migrateRecentlyViewedEntries([{ foo: "bar" }, 42, "nonsense", null]);
    expect(migrated).toEqual([]);
  });

  it("caps the result at MAX_RECENTLY_VIEWED", () => {
    const many = Array.from({ length: MAX_RECENTLY_VIEWED + 5 }, (_, i) => ({
      id: `movie-${i}`,
      viewedAt: i,
    }));
    expect(migrateRecentlyViewedEntries(many)).toHaveLength(MAX_RECENTLY_VIEWED);
  });
});

describe("addRecentlyViewedEntry", () => {
  it("adds a new id to the front of the list", () => {
    const prev: RecentlyViewedEntry[] = [{ id: "1", viewedAt: 1 }];
    const result = addRecentlyViewedEntry(prev, "2");
    expect(result[0].id).toBe("2");
    expect(result[1].id).toBe("1");
  });

  it("bumps an already-present id to the front instead of duplicating it", () => {
    const prev: RecentlyViewedEntry[] = [
      { id: "1", viewedAt: 1 },
      { id: "2", viewedAt: 2 },
    ];
    const result = addRecentlyViewedEntry(prev, "1");
    expect(result.map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("caps the list at MAX_RECENTLY_VIEWED", () => {
    const prev: RecentlyViewedEntry[] = Array.from({ length: MAX_RECENTLY_VIEWED }, (_, i) => ({
      id: `movie-${i}`,
      viewedAt: i,
    }));
    const result = addRecentlyViewedEntry(prev, "new-movie");
    expect(result).toHaveLength(MAX_RECENTLY_VIEWED);
    expect(result[0].id).toBe("new-movie");
  });
});

describe("resolveRecentlyViewedMovies", () => {
  it("resolves entries against a live movie map, in order", () => {
    const moviesById = new Map([
      [interstellar.id, interstellar],
      [darkKnight.id, darkKnight],
    ]);
    const entries: RecentlyViewedEntry[] = [
      { id: darkKnight.id, viewedAt: 2 },
      { id: interstellar.id, viewedAt: 1 },
    ];
    expect(resolveRecentlyViewedMovies(entries, moviesById)).toEqual([darkKnight, interstellar]);
  });

  it("omits (rather than errors on) an entry whose movie can't currently be resolved", () => {
    const moviesById = new Map([[interstellar.id, interstellar]]);
    const entries: RecentlyViewedEntry[] = [
      { id: interstellar.id, viewedAt: 1 },
      { id: godfather.id, viewedAt: 2 }, // not in moviesById
    ];
    expect(resolveRecentlyViewedMovies(entries, moviesById)).toEqual([interstellar]);
  });

  it("returns an empty array for an empty entry list", () => {
    expect(resolveRecentlyViewedMovies([], new Map())).toEqual([]);
  });
});