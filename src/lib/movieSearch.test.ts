import { describe, it, expect } from "vitest";
import { searchMovies, highlightMatch } from "./movieSearch";
import { movieFixtures } from "../test/fixtures/movies";

describe("searchMovies", () => {
  it("returns nothing for an empty or whitespace-only query", () => {
    expect(searchMovies(movieFixtures, "")).toEqual([]);
    expect(searchMovies(movieFixtures, "   ")).toEqual([]);
  });

  it("ranks an exact title match above everything else", () => {
    const results = searchMovies(movieFixtures, "The Godfather");
    expect(results[0].movie.title).toBe("The Godfather");
    expect(results[0].matchedField).toBe("title-exact");
  });

  it("matches a starts-with query", () => {
    const results = searchMovies(movieFixtures, "The Dark");
    expect(results[0].movie.title).toBe("The Dark Knight");
    expect(results[0].matchedField).toBe("title-starts");
  });

  it("matches a partial (substring) title query", () => {
    const results = searchMovies(movieFixtures, "night");
    expect(results.some((r) => r.movie.title === "The Dark Knight")).toBe(true);
    expect(results[0].matchedField).toBe("title-partial");
  });

  it("finds every film by a given director (e.g. 'Nolan')", () => {
    const results = searchMovies(movieFixtures, "Nolan");
    const titles = results.map((r) => r.movie.title).sort();
    expect(titles).toEqual(["Interstellar", "The Dark Knight"]);
    expect(results.every((r) => r.matchedField === "director")).toBe(true);
  });

  it("finds a film by a cast member's full name (e.g. 'Tom Hanks')", () => {
    const results = searchMovies(movieFixtures, "Tom Hanks");
    expect(results).toHaveLength(1);
    expect(results[0].movie.title).toBe("Forrest Gump");
    expect(results[0].matchedField).toBe("cast");
  });

  it("finds every film released in a given year (e.g. '1994')", () => {
    const results = searchMovies(movieFixtures, "1994");
    const titles = results.map((r) => r.movie.title).sort();
    expect(titles).toEqual(["Forrest Gump", "Pulp Fiction"]);
    expect(results.every((r) => r.matchedField === "year")).toBe(true);
  });

  it("finds every film in a given genre (e.g. 'Crime')", () => {
    const results = searchMovies(movieFixtures, "Crime");
    const titles = results.map((r) => r.movie.title).sort();
    expect(titles).toEqual(["Pulp Fiction", "The Dark Knight", "The Godfather"]);
    expect(results.every((r) => r.matchedField === "genre")).toBe(true);
  });

  describe("typo tolerance", () => {
    it("finds 'Interstellar' from 'Interstelar' (missing letter)", () => {
      const results = searchMovies(movieFixtures, "Interstelar");
      expect(results[0].movie.title).toBe("Interstellar");
      expect(results[0].matchedField).toBe("fuzzy");
    });

    it("finds 'The Dark Knight' from 'Dark Knigt' (transposed letters)", () => {
      const results = searchMovies(movieFixtures, "Dark Knigt");
      expect(results[0].movie.title).toBe("The Dark Knight");
    });

    it("finds 'The Godfather' from 'Godfatr' (missing letters)", () => {
      const results = searchMovies(movieFixtures, "Godfatr");
      expect(results[0].movie.title).toBe("The Godfather");
    });

    it("does not fuzzy-match against short cast-name fragments (e.g. initials)", () => {
      // Regression test for a real bug found during Phase 21 development:
      // tokenizing "T.J. Miller" used to produce single-letter tokens like
      // "t", which then substring-matched almost any query.
      const withInitials: typeof movieFixtures[number] = {
        ...movieFixtures[1],
        id: "99",
        title: "Some Other Movie",
        cast: [{ id: "cx", name: "T.J. Miller", character: "", profilePath: "" }],
        genres: ["Comedy"],
      };
      const results = searchMovies([...movieFixtures, withInitials], "Godfatr");
      expect(results.map((r) => r.movie.id)).not.toContain("99");
    });
  });

  it("caps results at the requested limit", () => {
    const results = searchMovies(movieFixtures, "a", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("never returns the same movie twice for a single query", () => {
    // "Christopher Nolan" directed two fixtures with overlapping genre words
    // too — make sure each movie appears at most once regardless of how
    // many fields it matches on.
    const results = searchMovies(movieFixtures, "Drama");
    const ids = results.map((r) => r.movie.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("highlightMatch", () => {
  it("splits text around the matched substring, case-insensitively", () => {
    const span = highlightMatch("The Dark Knight", "dark");
    expect(span).toEqual({ before: "The ", match: "Dark", after: " Knight" });
  });

  it("returns null when there is no direct substring match", () => {
    expect(highlightMatch("Interstellar", "Interstelar")).toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(highlightMatch("Interstellar", "")).toBeNull();
  });
});