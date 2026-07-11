#!/usr/bin/env node
/**
 * scripts/repair-tmdb-ids.mjs
 *
 * Automatically repairs incorrect `tmdbId` values in src/movies-data.ts using
 * REAL data from the TMDB Search API. Never fabricates or guesses IDs — every
 * candidate is scored against title, release year, runtime, director, and
 * cast before being accepted, and low-confidence matches are left untouched
 * and reported for manual review instead.
 *
 * This script deliberately reuses the parsing/matching helpers from
 * fetch-tmdb-artwork.mjs (extractMovieObjectSpans, extractField,
 * normalizeTitle, diceCoefficient, titlesMatch, sleep) so the two scripts
 * stay consistent and don't drift apart. It does NOT touch posterPath or
 * backdropPath — run fetch-tmdb-artwork.mjs afterward for that.
 *
 * USAGE:
 *   TMDB_API_KEY=your_key_here node scripts/repair-tmdb-ids.mjs
 *   node scripts/repair-tmdb-ids.mjs --key your_key_here
 *   node scripts/repair-tmdb-ids.mjs --key your_key_here --dry-run
 *   node scripts/repair-tmdb-ids.mjs --key your_key_here --verbose
 *   node scripts/repair-tmdb-ids.mjs --key your_key_here --limit=20
 *   node scripts/repair-tmdb-ids.mjs --key your_key_here --movie="Past Lives"
 *   node scripts/repair-tmdb-ids.mjs --file ./src/movies-data.ts --key xxxx
 *
 * Requires Node 18+ (uses global fetch).
 *
 * TMDB API docs:
 *   Search: https://developer.themoviedb.org/reference/search-movie
 *   Details+credits: https://developer.themoviedb.org/reference/movie-details
 * You need a (free) TMDB API key: https://www.themoviedb.org/settings/api
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Fallback for Node < 18 (uncomment if global fetch is unavailable) ──────
// import fetch from "node-fetch";

// ─────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { file: null, key: null, limit: null, movie: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--file") out.file = args[++i];
    else if (arg === "--key") out.key = args[++i];
    else if (arg.startsWith("--limit=")) out.limit = Number(arg.split("=")[1]);
    else if (arg === "--limit") out.limit = Number(args[++i]);
    else if (arg.startsWith("--movie=")) out.movie = arg.slice("--movie=".length).replace(/^"|"$/g, "");
    else if (arg === "--movie") out.movie = args[++i];
  }
  return out;
}

const cliArgs = parseArgs();

const CONFIG = {
  filePath: cliArgs.file || path.join(projectRoot, "src", "movies-data.ts"),
  apiKey: cliArgs.key || process.env.TMDB_API_KEY || "",
  tmdbBaseUrl: "https://api.themoviedb.org/3",
  requestDelayMs: 260,
  maxRetries: 4,
  backoffBaseMs: 600,

  // Title-only floor before we even bother scoring a search candidate.
  titleMatchThreshold: 0.55,

  // A candidate is only ACCEPTED if:
  //   (a) compositeScore >= confidenceThreshold, AND
  //   (b) titleScore     >= minAcceptTitleScore, AND
  //   (c) at least one secondary signal (director or cast) corroborates it.
  // This third rule exists specifically so we never "accept" a match based
  // on title + year alone — the whole point of this script is to avoid the
  // cross-swapped-ID failure mode from Phase 18C/18D.
  confidenceThreshold: 0.72,
  minAcceptTitleScore: 0.5,
  requireSecondarySignal: true,

  // How many top-scoring search results to fetch full details+credits for.
  candidatesToInspect: 5,

  dryRun: process.argv.includes("--dry-run"),
  verbose: process.argv.includes("--verbose"),
  limit: cliArgs.limit && cliArgs.limit > 0 ? cliArgs.limit : null,
  movieFilter: cliArgs.movie || null,

  reportJsonPath: path.join(projectRoot, "tmdb-id-repair-report.json"),
  reportTextPath: path.join(projectRoot, "tmdb-id-repair-report.txt"),
};

if (!CONFIG.apiKey) {
  console.error(
    "\n❌ No TMDB API key provided.\n" +
      "   Set it via: TMDB_API_KEY=xxxx node scripts/repair-tmdb-ids.mjs\n" +
      "   or:         node scripts/repair-tmdb-ids.mjs --key xxxx\n"
  );
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────
// SMALL UTILITIES (reused verbatim from fetch-tmdb-artwork.mjs)
// ─────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Normalize a title for comparison: lowercase, strip accents/punctuation,
 *  collapse whitespace, drop a leading "the"/"a"/"an". */
function normalizeTitle(title) {
  return (title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[:\-–—'".,!?()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|a|an)\s+/, "");
}

/** Dice coefficient over bigrams — cheap, dependency-free fuzzy match. */
function diceCoefficient(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const bigrams = (s) => {
    const map = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.substring(i, i + 2);
      map.set(bg, (map.get(bg) || 0) + 1);
    }
    return map;
  };

  const mapA = bigrams(a);
  const mapB = bigrams(b);
  let intersection = 0;
  for (const [bg, countA] of mapA) {
    if (mapB.has(bg)) intersection += Math.min(countA, mapB.get(bg));
  }
  const totalBigrams = (a.length - 1) + (b.length - 1);
  return totalBigrams === 0 ? 0 : (2 * intersection) / totalBigrams;
}

function titlesMatch(storedTitle, tmdbTitle, tmdbOriginalTitle) {
  const norm = normalizeTitle(storedTitle);
  const candidates = [tmdbTitle, tmdbOriginalTitle].filter(Boolean).map(normalizeTitle);

  let best = 0;
  let bestAgainst = candidates[0] || "";
  for (const candidate of candidates) {
    if (norm === candidate) return { match: true, score: 1, matchedAgainst: candidate };
    if (norm.includes(candidate) || candidate.includes(norm)) {
      if (0.85 > best) bestAgainst = candidate;
      best = Math.max(best, 0.85);
    }
    const dice = diceCoefficient(norm, candidate);
    if (dice > best) {
      best = dice;
      bestAgainst = candidate;
    }
  }

  return {
    match: best >= CONFIG.titleMatchThreshold,
    score: Number(best.toFixed(3)),
    matchedAgainst: bestAgainst,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// GENERIC TMDB FETCH (with retry + exponential backoff)
// ─────────────────────────────────────────────────────────────────────────

async function fetchJson(url, attempt = 1) {
  let response;
  try {
    response = await fetch(url);
  } catch (networkErr) {
    if (attempt <= CONFIG.maxRetries) {
      await sleep(CONFIG.backoffBaseMs * 2 ** (attempt - 1));
      return fetchJson(url, attempt + 1);
    }
    return { ok: false, reason: "network_error", detail: String(networkErr) };
  }

  if (response.status === 404) {
    return { ok: false, reason: "not_found", detail: "404 Not Found" };
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after")) || 1;
    if (attempt <= CONFIG.maxRetries) {
      await sleep(Math.max(retryAfter * 1000, CONFIG.backoffBaseMs * 2 ** (attempt - 1)));
      return fetchJson(url, attempt + 1);
    }
    return { ok: false, reason: "rate_limited", detail: "429 after max retries" };
  }

  if (!response.ok) {
    if (attempt <= CONFIG.maxRetries) {
      await sleep(CONFIG.backoffBaseMs * 2 ** (attempt - 1));
      return fetchJson(url, attempt + 1);
    }
    return { ok: false, reason: "http_error", detail: `${response.status} ${response.statusText}` };
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    return { ok: false, reason: "parse_error", detail: String(parseErr) };
  }

  return { ok: true, data };
}

async function searchTmdbMovies(query, year) {
  const params = new URLSearchParams({
    api_key: CONFIG.apiKey,
    language: "en-US",
    include_adult: "false",
    query,
  });
  if (year) params.set("year", String(year));

  const url = `${CONFIG.tmdbBaseUrl}/search/movie?${params.toString()}`;
  const result = await fetchJson(url);
  await sleep(CONFIG.requestDelayMs);
  if (!result.ok) return result;

  let results = result.data.results || [];

  // If a year-constrained search comes back empty, retry without the year —
  // some entries have slightly off release dates (region cuts, festival vs.
  // wide release, etc.) and we don't want that to hide the real match.
  if (results.length === 0 && year) {
    const paramsNoYear = new URLSearchParams({
      api_key: CONFIG.apiKey,
      language: "en-US",
      include_adult: "false",
      query,
    });
    const url2 = `${CONFIG.tmdbBaseUrl}/search/movie?${paramsNoYear.toString()}`;
    const result2 = await fetchJson(url2);
    await sleep(CONFIG.requestDelayMs);
    if (!result2.ok) return result2;
    results = result2.data.results || [];
  }

  return { ok: true, data: results };
}

async function fetchTmdbMovieDetails(tmdbId) {
  const url = `${CONFIG.tmdbBaseUrl}/movie/${tmdbId}?api_key=${CONFIG.apiKey}&language=en-US&append_to_response=credits`;
  const result = await fetchJson(url);
  await sleep(CONFIG.requestDelayMs);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// MOVIE OBJECT EXTRACTION (bracket-counting, safe against nested `cast`)
// Reused verbatim from fetch-tmdb-artwork.mjs.
// ─────────────────────────────────────────────────────────────────────────

function extractMovieObjectSpans(source) {
  const arrayStartMarker = "PRESET_MOVIES: Movie[] = [";
  const arrayStart = source.indexOf(arrayStartMarker);
  if (arrayStart === -1) {
    throw new Error(
      "Could not find 'PRESET_MOVIES: Movie[] = [' in the file. " +
        "Check --file path or that the export name hasn't changed."
    );
  }

  const arrayBodyStart = arrayStart + arrayStartMarker.length;

  const spans = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let stringChar = "";
  let arrayDepth = 1; // we're already inside the outer [ ]

  for (let i = arrayBodyStart; i < source.length; i++) {
    const ch = source[i];
    const prev = source[i - 1];

    if (inString) {
      if (ch === stringChar && prev !== "\\") inString = false;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === "[") arrayDepth++;
    if (ch === "]") {
      arrayDepth--;
      if (arrayDepth === 0) break; // reached the end of PRESET_MOVIES array
    }

    if (ch === "{") {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        spans.push({ start: objectStart, end: i + 1, text: source.slice(objectStart, i + 1) });
        objectStart = -1;
      }
    }
  }

  return spans;
}

function extractField(objText, fieldName) {
  // Matches:  fieldName: "value"   or   fieldName: 12345
  const stringMatch = objText.match(
    new RegExp(`\\b${fieldName}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)
  );
  if (stringMatch) return { raw: stringMatch[0], value: stringMatch[1], isString: true };

  const numberMatch = objText.match(new RegExp(`\\b${fieldName}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
  if (numberMatch) return { raw: numberMatch[0], value: Number(numberMatch[1]), isString: false };

  return null;
}

/**
 * Finds a top-level `fieldName: [ ... ]` array block inside an object's text
 * (e.g. `cast: [ { ... }, { ... } ]`) and returns its inner contents as a
 * string. Uses the same bracket-depth approach as extractMovieObjectSpans
 * so it safely handles the nested `{ }` cast-entry objects.
 */
function extractArrayBlock(objText, fieldName) {
  const marker = new RegExp(`\\b${fieldName}\\s*:\\s*\\[`);
  const markerMatch = objText.match(marker);
  if (!markerMatch) return null;

  const bracketStart = markerMatch.index + markerMatch[0].length - 1; // index of the "["
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = bracketStart; i < objText.length; i++) {
    const ch = objText[i];
    const prev = objText[i - 1];

    if (inString) {
      if (ch === stringChar && prev !== "\\") inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) {
        return objText.slice(bracketStart + 1, i);
      }
    }
  }
  return null;
}

/** Pulls every `name: "..."` out of a cast array block. */
function extractCastNames(objText) {
  const block = extractArrayBlock(objText, "cast");
  if (!block) return [];
  const names = [];
  const nameRegex = /\bname\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = nameRegex.exec(block)) !== null) {
    names.push(m[1]);
  }
  return names;
}

/** Splits a "Joel Coen, Ethan Coen" style director string into names. */
function splitDirectors(directorField) {
  if (!directorField) return [];
  return directorField
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────
// CANDIDATE SCORING
// ─────────────────────────────────────────────────────────────────────────

function scoreCandidate(stored, candidateDetails) {
  const titleRes = titlesMatch(stored.title, candidateDetails.title, candidateDetails.original_title);

  // Year score
  let yearScore = 0;
  const candidateYear = candidateDetails.release_date ? Number(candidateDetails.release_date.slice(0, 4)) : null;
  if (stored.year && candidateYear) {
    const diff = Math.abs(stored.year - candidateYear);
    yearScore = diff === 0 ? 1 : diff === 1 ? 0.5 : 0;
  }

  // Runtime score
  let runtimeScore = 0;
  if (stored.runtime && candidateDetails.runtime) {
    const diff = Math.abs(stored.runtime - candidateDetails.runtime);
    runtimeScore = diff <= 2 ? 1 : diff <= 5 ? 0.6 : diff <= 10 ? 0.3 : 0;
  }

  // Director score
  const crew = candidateDetails.credits?.crew || [];
  const candidateDirectors = crew.filter((c) => c.job === "Director").map((d) => normalizeTitle(d.name));
  const storedDirectors = stored.directors.map(normalizeTitle);
  let directorScore = 0;
  if (storedDirectors.length && candidateDirectors.length) {
    directorScore = storedDirectors.some((d) => candidateDirectors.includes(d)) ? 1 : 0;
  }

  // Cast overlap score
  const candidateCast = (candidateDetails.credits?.cast || []).slice(0, 12).map((c) => normalizeTitle(c.name));
  const storedCast = stored.castNames.map(normalizeTitle);
  let castScore = 0;
  if (storedCast.length && candidateCast.length) {
    const overlap = storedCast.filter((n) => candidateCast.includes(n)).length;
    castScore = overlap / storedCast.length;
  }

  const compositeScore =
    titleRes.score * 0.4 + yearScore * 0.2 + runtimeScore * 0.15 + directorScore * 0.15 + castScore * 0.1;

  return {
    compositeScore: Number(compositeScore.toFixed(3)),
    titleScore: titleRes.score,
    yearScore,
    runtimeScore,
    directorScore,
    castScore,
    hasSecondarySignal: directorScore > 0 || castScore > 0,
    candidateDetails,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PER-MOVIE REPAIR
// ─────────────────────────────────────────────────────────────────────────

async function repairOneMovie(stored) {
  const searchResult = await searchTmdbMovies(stored.title, stored.year);
  if (!searchResult.ok) {
    return { status: "search_failed", reason: searchResult.reason, detail: searchResult.detail };
  }

  const rawResults = searchResult.data;
  if (!rawResults || rawResults.length === 0) {
    return { status: "no_search_results" };
  }

  // Pre-score on title alone (cheap) to pick which candidates are worth the
  // extra detail+credits API call.
  const preScored = rawResults
    .map((r) => ({
      r,
      titleScore: titlesMatch(stored.title, r.title, r.original_title).score,
    }))
    .filter((x) => x.titleScore >= CONFIG.titleMatchThreshold)
    .sort((a, b) => b.titleScore - a.titleScore)
    .slice(0, CONFIG.candidatesToInspect);

  if (preScored.length === 0) {
    return { status: "no_title_match", topResult: rawResults[0]?.title };
  }

  const scoredCandidates = [];
  for (const { r } of preScored) {
    const detailsResult = await fetchTmdbMovieDetails(r.id);
    if (!detailsResult.ok) continue;
    scoredCandidates.push(scoreCandidate(stored, detailsResult.data));
  }

  if (scoredCandidates.length === 0) {
    return { status: "details_fetch_failed" };
  }

  scoredCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
  const best = scoredCandidates[0];

  const accepted =
    best.compositeScore >= CONFIG.confidenceThreshold &&
    best.titleScore >= CONFIG.minAcceptTitleScore &&
    (!CONFIG.requireSecondarySignal || best.hasSecondarySignal);

  return {
    status: accepted ? "accepted" : "low_confidence",
    best,
    allCandidates: scoredCandidates,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📖 Reading ${CONFIG.filePath} ...`);
  const source = fs.readFileSync(CONFIG.filePath, "utf8");

  const spans = extractMovieObjectSpans(source);
  console.log(`🎬 Found ${spans.length} movie objects.\n`);

  if (spans.length === 0) {
    console.error("❌ No movie objects found. Aborting without writing anything.");
    process.exit(1);
  }

  const summary = {
    totalMovieObjects: spans.length,
    processed: 0,
    updated: 0,
    skippedAlreadyCorrect: 0,
    skippedLowConfidence: 0,
    skippedNoSearchResults: 0,
    skippedNoTitleMatch: 0,
    skippedSearchFailed: 0,
    skippedDetailsFailed: 0,
    skippedFilteredOut: 0,
    duplicateTmdbIdsDetected: [],
    details: [],
  };

  const patches = [];
  const newTmdbIdsSeen = new Map(); // tmdbId -> [ids of movies assigned it in this run]

  let attemptedCount = 0;

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const objText = span.text;

    const idField = extractField(objText, "id");
    const titleField = extractField(objText, "title");
    const tmdbIdField = extractField(objText, "tmdbId");
    const directorField = extractField(objText, "director");
    const runtimeField = extractField(objText, "runtime");
    const releaseDateField = extractField(objText, "releaseDate");
    const castNames = extractCastNames(objText);

    const label = `id=${idField?.value ?? "?"} "${titleField?.value ?? "?"}"`;

    if (!tmdbIdField || !titleField) {
      summary.details.push({ id: idField?.value, title: titleField?.value, status: "missing_required_field" });
      continue;
    }

    // --movie filter
    if (CONFIG.movieFilter && normalizeTitle(titleField.value) !== normalizeTitle(CONFIG.movieFilter)) {
      continue;
    }

    // --limit cap (counts movies actually attempted, not skipped-by-filter)
    if (CONFIG.limit && attemptedCount >= CONFIG.limit) {
      summary.skippedFilteredOut++;
      continue;
    }
    attemptedCount++;

    const stored = {
      id: idField.value,
      title: titleField.value,
      tmdbId: tmdbIdField.value,
      directors: splitDirectors(directorField?.value),
      runtime: runtimeField?.value ?? null,
      year: releaseDateField?.value ? Number(releaseDateField.value.slice(0, 4)) : null,
      castNames,
    };

    summary.processed++;
    process.stdout.write(`[${summary.processed}] ${label} (tmdbId ${stored.tmdbId}) ... `);

    const result = await repairOneMovie(stored);

    if (result.status === "search_failed") {
      console.log(`🔌 search failed (${result.reason})`);
      summary.skippedSearchFailed++;
      summary.details.push({ id: stored.id, title: stored.title, oldTmdbId: stored.tmdbId, status: "search_failed", reason: result.detail });
      continue;
    }
    if (result.status === "no_search_results") {
      console.log(`⚠️  no search results — leaving tmdbId unchanged`);
      summary.skippedNoSearchResults++;
      summary.details.push({ id: stored.id, title: stored.title, oldTmdbId: stored.tmdbId, status: "no_search_results" });
      continue;
    }
    if (result.status === "no_title_match") {
      console.log(`⚠️  no candidate met title-match floor — leaving tmdbId unchanged`);
      summary.skippedNoTitleMatch++;
      summary.details.push({ id: stored.id, title: stored.title, oldTmdbId: stored.tmdbId, status: "no_title_match", topTmdbResult: result.topResult });
      continue;
    }
    if (result.status === "details_fetch_failed") {
      console.log(`🔌 details fetch failed — leaving tmdbId unchanged`);
      summary.skippedDetailsFailed++;
      summary.details.push({ id: stored.id, title: stored.title, oldTmdbId: stored.tmdbId, status: "details_fetch_failed" });
      continue;
    }

    const { best } = result;

    if (result.status === "low_confidence") {
      console.log(
        `⚠️  low confidence (composite ${best.compositeScore}, title ${best.titleScore}, secondary=${best.hasSecondarySignal}) — leaving tmdbId unchanged`
      );
      summary.skippedLowConfidence++;
      summary.details.push({
        id: stored.id,
        title: stored.title,
        oldTmdbId: stored.tmdbId,
        status: "ambiguous_low_confidence",
        confidenceScore: best.compositeScore,
        titleScore: best.titleScore,
        yearScore: best.yearScore,
        runtimeScore: best.runtimeScore,
        directorScore: best.directorScore,
        castScore: best.castScore,
        candidateTmdbId: best.candidateDetails.id,
        candidateTmdbTitle: best.candidateDetails.title,
        reason: !best.hasSecondarySignal
          ? "no director/cast corroboration"
          : "composite score below threshold",
      });
      if (CONFIG.verbose) {
        for (const c of result.allCandidates) {
          console.log(
            `      candidate ${c.candidateDetails.id} "${c.candidateDetails.title}" → composite ${c.compositeScore} (title ${c.titleScore}, year ${c.yearScore}, runtime ${c.runtimeScore}, director ${c.directorScore}, cast ${c.castScore})`
          );
        }
      }
      continue;
    }

    // status === "accepted"
    const newTmdbId = best.candidateDetails.id;

    if (newTmdbId === stored.tmdbId) {
      console.log(`✓ already correct (confidence ${best.compositeScore})`);
      summary.skippedAlreadyCorrect++;
      summary.details.push({
        id: stored.id,
        title: stored.title,
        oldTmdbId: stored.tmdbId,
        newTmdbId,
        status: "already_correct",
        confidenceScore: best.compositeScore,
      });
      continue;
    }

    // Track duplicate assignment within this run (two stored movies both
    // wanting to claim the same TMDB id would indicate a real problem).
    if (!newTmdbIdsSeen.has(newTmdbId)) newTmdbIdsSeen.set(newTmdbId, []);
    newTmdbIdsSeen.get(newTmdbId).push(stored.id);

    console.log(
      `✅ ${stored.tmdbId} → ${newTmdbId} "${best.candidateDetails.title}" (confidence ${best.compositeScore})`
    );

    const oldTmdbIdRaw = tmdbIdField.raw; // e.g. `tmdbId: 12345`
    const newTmdbIdRaw = `tmdbId: ${newTmdbId}`;
    const updatedObjText = objText.replace(oldTmdbIdRaw, newTmdbIdRaw);

    patches.push({ start: span.start, end: span.end, newText: updatedObjText });
    summary.updated++;
    summary.details.push({
      id: stored.id,
      title: stored.title,
      oldTmdbId: stored.tmdbId,
      newTmdbId,
      tmdbTitle: best.candidateDetails.title,
      status: "updated",
      confidenceScore: best.compositeScore,
      titleScore: best.titleScore,
      yearScore: best.yearScore,
      runtimeScore: best.runtimeScore,
      directorScore: best.directorScore,
      castScore: best.castScore,
    });
  }

  for (const [tmdbId, ids] of newTmdbIdsSeen) {
    if (ids.length > 1) {
      summary.duplicateTmdbIdsDetected.push({ tmdbId, claimedByMovieIds: ids });
    }
  }

  // Apply patches back-to-front so earlier offsets remain valid.
  let newSource = source;
  const sortedPatches = [...patches].sort((a, b) => b.start - a.start);
  for (const patch of sortedPatches) {
    newSource = newSource.slice(0, patch.start) + patch.newText + newSource.slice(patch.end);
  }

  if (CONFIG.dryRun) {
    console.log("\n🧪 --dry-run passed: no files were written.");
  } else if (patches.length > 0) {
    const backupPath = `${CONFIG.filePath}.bak-${Date.now()}`;
    fs.writeFileSync(backupPath, source, "utf8");
    fs.writeFileSync(CONFIG.filePath, newSource, "utf8");
    console.log(`\n💾 Backup saved to: ${backupPath}`);
    console.log(`✏️  ${CONFIG.filePath} updated with ${patches.length} tmdbId(s) repaired.`);
  } else {
    console.log("\n✨ No changes needed — nothing to write.");
  }

  // ── Write reports ──
  fs.writeFileSync(CONFIG.reportJsonPath, JSON.stringify(summary, null, 2), "utf8");

  const textReport = buildTextReport(summary);
  fs.writeFileSync(CONFIG.reportTextPath, textReport, "utf8");

  console.log("\n" + textReport);
  console.log(`\n📄 Full JSON report: ${CONFIG.reportJsonPath}`);
  console.log(`📄 Text report:      ${CONFIG.reportTextPath}\n`);
}

function buildTextReport(summary) {
  const lines = [];
  lines.push("═══════════════════════════════════════════════");
  lines.push(" TMDB ID REPAIR — SUMMARY");
  lines.push("═══════════════════════════════════════════════");
  lines.push(`Movie objects found in file:      ${summary.totalMovieObjects}`);
  lines.push(`Movies processed this run:        ${summary.processed}`);
  lines.push(`tmdbIds updated:                  ${summary.updated}`);
  lines.push(`Already correct (no change):      ${summary.skippedAlreadyCorrect}`);
  lines.push(`Skipped — low confidence:         ${summary.skippedLowConfidence}`);
  lines.push(`Skipped — no search results:      ${summary.skippedNoSearchResults}`);
  lines.push(`Skipped — no title match:         ${summary.skippedNoTitleMatch}`);
  lines.push(`Skipped — search failed:          ${summary.skippedSearchFailed}`);
  lines.push(`Skipped — details fetch failed:   ${summary.skippedDetailsFailed}`);
  lines.push(`Skipped — outside --limit/--movie: ${summary.skippedFilteredOut}`);
  lines.push(`Duplicate tmdbIds detected:        ${summary.duplicateTmdbIdsDetected.length}`);
  lines.push("───────────────────────────────────────────────");

  const updated = summary.details.filter((d) => d.status === "updated");
  if (updated.length > 0) {
    lines.push("\n✅ UPDATED:");
    for (const m of updated) {
      lines.push(
        `  - id=${m.id} "${m.title}": ${m.oldTmdbId} → ${m.newTmdbId} ("${m.tmdbTitle}", confidence ${m.confidenceScore})`
      );
    }
  }

  const ambiguous = summary.details.filter((d) => d.status === "ambiguous_low_confidence");
  if (ambiguous.length > 0) {
    lines.push("\n⚠️  AMBIGUOUS / LOW CONFIDENCE (left unchanged — review manually):");
    for (const m of ambiguous) {
      lines.push(
        `  - id=${m.id} "${m.title}" (tmdbId ${m.oldTmdbId}) → best candidate ${m.candidateTmdbId} "${m.candidateTmdbTitle}" ` +
          `(confidence ${m.confidenceScore}, title ${m.titleScore}, year ${m.yearScore}, runtime ${m.runtimeScore}, director ${m.directorScore}, cast ${m.castScore}) — ${m.reason}`
      );
    }
  }

  const noResults = summary.details.filter((d) => d.status === "no_search_results" || d.status === "no_title_match");
  if (noResults.length > 0) {
    lines.push("\n❓ NO USABLE TMDB MATCH FOUND:");
    for (const m of noResults) {
      lines.push(`  - id=${m.id} "${m.title}" (tmdbId ${m.oldTmdbId})`);
    }
  }

  const failures = summary.details.filter((d) => d.status === "search_failed" || d.status === "details_fetch_failed");
  if (failures.length > 0) {
    lines.push("\n🔌 NETWORK / API FAILURES (re-run the script to retry these):");
    for (const m of failures) {
      lines.push(`  - id=${m.id} "${m.title}" (tmdbId ${m.oldTmdbId}) → ${m.status}${m.reason ? `: ${m.reason}` : ""}`);
    }
  }

  if (summary.duplicateTmdbIdsDetected.length > 0) {
    lines.push("\n🚨 DUPLICATE tmdbId ASSIGNMENTS THIS RUN (needs manual review):");
    for (const d of summary.duplicateTmdbIdsDetected) {
      lines.push(`  - tmdbId ${d.tmdbId} claimed by movie ids: ${d.claimedByMovieIds.join(", ")}`);
    }
  }

  lines.push("\n═══════════════════════════════════════════════");
  return lines.join("\n");
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});