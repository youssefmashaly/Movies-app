import { describe, it, expect } from "vitest";
import { getDecadeLabel, computeFavoriteDecadeAndDirector, computeTasteMatchPct } from "./profileInsights";

describe("getDecadeLabel", () => {
  it("converts a release date to its decade label", () => {
    expect(getDecadeLabel("2014-03-28")).toBe("2010s");
    expect(getDecadeLabel("1994-07-06")).toBe("1990s");
    expect(getDecadeLabel("1972-03-24")).toBe("1970s");
    expect(getDecadeLabel("2000-01-01")).toBe("2000s");
  });

  it("returns null for missing or unparsable dates", () => {
    expect(getDecadeLabel(null)).toBeNull();
    expect(getDecadeLabel(undefined)).toBeNull();
    expect(getDecadeLabel("")).toBeNull();
    expect(getDecadeLabel("not-a-date")).toBeNull();
  });

  it("rejects implausible years (before film existed, or absurdly far future)", () => {
    expect(getDecadeLabel("1800-01-01")).toBeNull();
    expect(getDecadeLabel("2200-01-01")).toBeNull();
  });
});

describe("computeFavoriteDecadeAndDirector", () => {
  const moviesById = new Map([
    ["1", { director: "Christopher Nolan", releaseDate: "2014-11-07" }],
    ["2", { director: "Christopher Nolan", releaseDate: "2008-07-18" }],
    ["3", { director: "Francis Ford Coppola", releaseDate: "1972-03-24" }],
  ]);

  it("picks the most frequent decade and director across the given ids", () => {
    const result = computeFavoriteDecadeAndDirector(["1", "2", "3"], moviesById);
    expect(result.favoriteDirector).toBe("Christopher Nolan");
    // 2010s and 2000s each appear once, 1970s once — with a 3-way tie by
    // count of 1 each, whichever sorts first is acceptable; the important
    // guarantee is it doesn't throw and returns *a* valid decade.
    expect(["2010s", "2000s", "1970s"]).toContain(result.favoriteDecade);
  });

  it("skips ids with no matching metadata instead of throwing", () => {
    const result = computeFavoriteDecadeAndDirector(["1", "unknown-id"], moviesById);
    expect(result.favoriteDirector).toBe("Christopher Nolan");
  });

  it("returns nulls for an empty id list", () => {
    expect(computeFavoriteDecadeAndDirector([], moviesById)).toEqual({
      favoriteDecade: null,
      favoriteDirector: null,
    });
  });

  it("counts co-directors individually rather than as one combined label", () => {
    const coDirected = new Map([
      ["a", { director: "Joel Coen, Ethan Coen", releaseDate: "2007-01-01" }],
      ["b", { director: "Joel Coen", releaseDate: "1996-01-01" }],
    ]);
    const result = computeFavoriteDecadeAndDirector(["a", "b"], coDirected);
    expect(result.favoriteDirector).toBe("Joel Coen");
  });
});

describe("computeTasteMatchPct", () => {
  it("returns 100 for identical genre sets", () => {
    expect(computeTasteMatchPct(["Action", "Drama"], ["Action", "Drama"])).toBe(100);
  });

  it("returns 0 for completely disjoint genre sets", () => {
    expect(computeTasteMatchPct(["Action"], ["Romance"])).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(computeTasteMatchPct(["action"], ["ACTION"])).toBe(100);
  });

  it("computes intersection-over-union for partial overlap", () => {
    // A: {action, drama}, B: {action, comedy} -> intersection 1, union 3
    expect(computeTasteMatchPct(["Action", "Drama"], ["Action", "Comedy"])).toBe(33);
  });

  it("returns 0 when both genre lists are empty", () => {
    expect(computeTasteMatchPct([], [])).toBe(0);
  });
});