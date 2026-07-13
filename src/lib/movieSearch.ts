// src/lib/movieSearch.ts
//
// Phase 21 — Intelligent Movie Search.
//
// A pure, synchronous, multi-field ranked search over a Movie[] pool (the
// existing trending/latest catalog — no network calls of its own). Runs
// entirely client-side so results appear instantly once the caller's own
// debounce settles, and so "director"/"cast"/"year"/"genre" queries never
// need a bespoke backend endpoint.
//
// Ranking tiers (lower = higher priority), per the product spec:
//   0. exact release year match (query is a bare 4-digit year)
//   1. exact title match
//   2. title starts-with
//   3. title partial (substring)
//   4. director
//   5. cast
//   6. genre
//   7. typo-tolerant fallback (only reached when nothing above matched)
import { Movie } from "../types";

export type MatchField =
  | "year"
  | "title-exact"
  | "title-starts"
  | "title-partial"
  | "director"
  | "cast"
  | "genre"
  | "fuzzy";

export interface MovieSearchResult {
  movie: Movie;
  tier: number;
  matchedField: MatchField;
  /** Lower is a closer match. Only meaningful within the "fuzzy" tier —
   *  every other tier is an exact/substring match and scores 0. */
  score: number;
}

const TIER: Record<MatchField, number> = {
  year: 0,
  "title-exact": 1,
  "title-starts": 2,
  "title-partial": 3,
  director: 4,
  cast: 5,
  genre: 6,
  fuzzy: 7,
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2); // drop initials/single letters (e.g. "T.J." -> "t","j") — too
    // short to be a meaningful fuzzy-match target, and prone to false positives
    // via the substring shortcut below.
}

/**
 * Classic DP Levenshtein edit distance. Only ever run against short strings
 * (single words / cast names), so the O(n*m) cost is trivial in practice.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[b.length];
}

/**
 * Typo tolerance for a single word pair — tolerates ~30% of the longer
 * word's length as edit distance (minimum 1), so short words still forgive
 * one typo while long words scale gracefully. The substring shortcut only
 * applies once both words are long enough (>=4 chars) to be meaningful —
 * otherwise short tokens (e.g. "the", "of") would substring-match almost
 * anything.
 */
function wordsFuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) return true;
  const tolerance = Math.max(1, Math.ceil(Math.max(a.length, b.length) * 0.3));
  return levenshtein(a, b) <= tolerance;
}

/**
 * True if every token in `queryTokens` fuzzily matches at least one token in
 * `targetTokens` — e.g. "Dark Knigt" -> "The Dark Knight", "Godfatr" ->
 * "The Godfather", "Interstelar" -> "Interstellar".
 */
function fuzzyTokensMatch(queryTokens: string[], targetTokens: string[]): boolean {
  if (queryTokens.length === 0 || targetTokens.length === 0) return false;
  return queryTokens.every((qt) => targetTokens.some((tt) => wordsFuzzyMatch(qt, tt)));
}

/**
 * Total edit distance between each query token and its single closest match
 * across every candidate token set (title + director + cast, flattened) —
 * used purely to rank fuzzy-tier results by how close the typo actually is,
 * so "Godfatr" surfaces "The Godfather" ahead of any other loose fuzzy hit.
 */
function fuzzyScore(queryTokens: string[], candidateTokenSets: string[][]): number {
  const pool = candidateTokenSets.flat();
  let total = 0;
  for (const qt of queryTokens) {
    let best = Infinity;
    for (const tt of pool) {
      const d = levenshtein(qt, tt);
      if (d < best) best = d;
    }
    total += Number.isFinite(best) ? best : 99;
  }
  return total;
}

const YEAR_PATTERN = /^\d{4}$/;

/**
 * Ranks `pool` against `rawQuery` across title (exact / starts-with /
 * partial), release year, director, cast, and genre, with a typo-tolerant
 * fallback pass. Each movie appears at most once, at its single
 * best-matching tier. Pure and synchronous — callers are expected to
 * debounce for UX, not correctness.
 */
export function searchMovies(pool: Movie[], rawQuery: string, limit = 40): MovieSearchResult[] {
  const query = normalize(rawQuery);
  if (!query) return [];

  const queryTokens = tokenize(query);
  const isYearQuery = YEAR_PATTERN.test(query);

  const results: MovieSearchResult[] = [];

  for (const movie of pool) {
    const title = normalize(movie.title);
    const director = movie.director ? normalize(movie.director) : "";
    const castNames = (movie.cast ?? []).map((c) => normalize(c.name));
    const genres = (movie.genres ?? []).map((g) => normalize(g));
    const year = movie.releaseDate?.slice(0, 4) ?? "";

    let matchedField: MatchField | null = null;
    let score = 0;

    if (isYearQuery && year === query) {
      matchedField = "year";
    } else if (title === query) {
      matchedField = "title-exact";
    } else if (title.startsWith(query)) {
      matchedField = "title-starts";
    } else if (title.includes(query)) {
      matchedField = "title-partial";
    } else if (director && director.includes(query)) {
      matchedField = "director";
    } else if (castNames.some((name) => name.includes(query))) {
      matchedField = "cast";
    } else if (genres.some((g) => g.includes(query))) {
      matchedField = "genre";
    } else {
      // Typo-tolerant fallback — only reached when no field matched the
      // query as an exact/substring, so a real match elsewhere always
      // outranks a fuzzy one.
      const titleTokens = tokenize(title);
      const directorTokens = director ? tokenize(director) : [];
      const castTokens = castNames.map((n) => tokenize(n));

      const fuzzyTitle = fuzzyTokensMatch(queryTokens, titleTokens);
      const fuzzyDirector = directorTokens.length > 0 && fuzzyTokensMatch(queryTokens, directorTokens);
      const fuzzyCast = castTokens.some((tokens) => fuzzyTokensMatch(queryTokens, tokens));

      if (fuzzyTitle || fuzzyDirector || fuzzyCast) {
        matchedField = "fuzzy";
        score = fuzzyScore(queryTokens, [titleTokens, directorTokens, ...castTokens]);
      }
    }

    if (matchedField) {
      results.push({ movie, tier: TIER[matchedField], matchedField, score });
    }
  }

  results.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.score !== b.score) return a.score - b.score;
    // Within the same tier/score, prefer more-established titles first.
    return (b.movie.voteCount ?? 0) - (a.movie.voteCount ?? 0);
  });

  return results.slice(0, limit);
}

export interface HighlightSpan {
  before: string;
  match: string;
  after: string;
}

/**
 * Splits `text` around the first case-insensitive occurrence of `query` so
 * callers can render a highlighted <mark> without altering casing. Returns
 * `null` when there's no direct substring match (e.g. a typo-tolerant
 * result) — highlighting an approximate match would be misleading.
 */
export function highlightMatch(text: string, query: string): HighlightSpan | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const idx = text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (idx === -1) return null;
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + trimmed.length),
    after: text.slice(idx + trimmed.length),
  };
}