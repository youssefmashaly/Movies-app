#!/usr/bin/env node
/**
 * fetch-tmdb-artwork.mjs
 *
 * Repairs posterPath / backdropPath for every movie in src/movies-data.ts
 * using REAL data from the TMDB API. Never fabricates hashes.
 *
 * USAGE:
 *   TMDB_API_KEY=your_key_here node fetch-tmdb-artwork.mjs
 *   node fetch-tmdb-artwork.mjs --key your_key_here
 *   node fetch-tmdb-artwork.mjs --file ./src/movies-data.ts --key your_key_here
 *
 * Requires Node 18+ (uses global fetch). If you're on an older Node, run
 * `npm install node-fetch` and uncomment the import fallback below.
 *
 * TMDB API docs: https://developer.themoviedb.org/reference/movie-details
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

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { file: null, key: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file") out.file = args[++i];
    else if (args[i] === "--key") out.key = args[++i];
  }
  return out;
}

const cliArgs = parseArgs();

const CONFIG = {
  filePath: cliArgs.file || path.join(__dirname, "src", "movies-data.ts"),
  apiKey: cliArgs.key || process.env.TMDB_API_KEY || "",
  tmdbBaseUrl: "https://api.themoviedb.org/3",
  posterBaseUrl: "https://image.tmdb.org/t/p/w500",
  backdropBaseUrl: "https://image.tmdb.org/t/p/original",
  // Requests are throttled to stay well under TMDB's rate limit.
  requestDelayMs: 260,
  maxRetries: 4,
  backoffBaseMs: 600,
  // Below this similarity score (0..1), a title is considered "not matching"
  // and the movie's artwork will NOT be touched — it will only be reported.
  titleMatchThreshold: 0.55,
  // Where to write the run report (JSON + human-readable text).
  reportJsonPath: path.join(__dirname, "tmdb-repair-report.json"),
  reportTextPath: path.join(__dirname, "tmdb-repair-report.txt"),
  dryRun: process.argv.includes("--dry-run"),
};

if (!CONFIG.apiKey) {
  console.error(
    "\n❌ No TMDB API key provided.\n" +
      "   Set it via: TMDB_API_KEY=xxxx node fetch-tmdb-artwork.mjs\n" +
      "   or:         node fetch-tmdb-artwork.mjs --key xxxx\n"
  );
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────
// SMALL UTILITIES
// ─────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Normalize a title for comparison: lowercase, strip accents/punctuation,
 *  collapse whitespace, drop a leading "the"/"a"/"an". */
function normalizeTitle(title) {
  return title
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
  for (const candidate of candidates) {
    if (norm === candidate) return { match: true, score: 1, matchedAgainst: candidate };
    if (norm.includes(candidate) || candidate.includes(norm)) {
      best = Math.max(best, 0.85);
    }
    best = Math.max(best, diceCoefficient(norm, candidate));
  }

  return {
    match: best >= CONFIG.titleMatchThreshold,
    score: Number(best.toFixed(3)),
    matchedAgainst: candidates[0] || "",
  };
}

// ─────────────────────────────────────────────────────────────────────────
// TMDB API CALL (with retry + exponential backoff)
// ─────────────────────────────────────────────────────────────────────────

async function fetchTmdbMovie(tmdbId, attempt = 1) {
  const url = `${CONFIG.tmdbBaseUrl}/movie/${tmdbId}?api_key=${CONFIG.apiKey}&language=en-US`;

  let response;
  try {
    response = await fetch(url);
  } catch (networkErr) {
    if (attempt <= CONFIG.maxRetries) {
      const backoff = CONFIG.backoffBaseMs * 2 ** (attempt - 1);
      await sleep(backoff);
      return fetchTmdbMovie(tmdbId, attempt + 1);
    }
    return { ok: false, reason: "network_error", detail: String(networkErr) };
  }

  if (response.status === 404) {
    return { ok: false, reason: "invalid_tmdb_id", detail: "404 Not Found" };
  }

  if (response.status === 429) {
    // Respect Retry-After if TMDB sends it, otherwise use backoff.
    const retryAfter = Number(response.headers.get("retry-after")) || 1;
    if (attempt <= CONFIG.maxRetries) {
      await sleep(Math.max(retryAfter * 1000, CONFIG.backoffBaseMs * 2 ** (attempt - 1)));
      return fetchTmdbMovie(tmdbId, attempt + 1);
    }
    return { ok: false, reason: "rate_limited", detail: "429 after max retries" };
  }

  if (!response.ok) {
    if (attempt <= CONFIG.maxRetries) {
      const backoff = CONFIG.backoffBaseMs * 2 ** (attempt - 1);
      await sleep(backoff);
      return fetchTmdbMovie(tmdbId, attempt + 1);
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

// ─────────────────────────────────────────────────────────────────────────
// MOVIE OBJECT EXTRACTION (bracket-counting, safe against nested `cast`)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Finds each top-level `{ ... }` object literal inside the PRESET_MOVIES
 * array and returns { start, end, text } spans (end is exclusive index
 * just past the closing brace). This avoids fragile whole-array regexes
 * and correctly skips over nested objects like `cast: [ { ... }, ... ]`.
 */
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
    processed: 0,
    updated: 0,
    skippedTitleMismatch: 0,
    missingPoster: 0,
    missingBackdrop: 0,
    invalidTmdbId: 0,
    networkFailures: 0,
    unchangedAlreadyCorrect: 0,
    warnings: [],
    details: [],
  };

  // We build up a list of { start, end, newText } patches and apply them
  // to the ORIGINAL source string from back to front, so earlier indices
  // stay valid as we go.
  const patches = [];

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const objText = span.text;

    const idField = extractField(objText, "id");
    const titleField = extractField(objText, "title");
    const tmdbIdField = extractField(objText, "tmdbId");
    const posterField = extractField(objText, "posterPath");
    const backdropField = extractField(objText, "backdropPath");

    const label = `id=${idField?.value ?? "?"} "${titleField?.value ?? "?"}"`;

    if (!tmdbIdField) {
      console.warn(`⚠️  ${label}: no tmdbId field found — skipping.`);
      summary.invalidTmdbId++;
      summary.details.push({ id: idField?.value, title: titleField?.value, status: "no_tmdb_id_field" });
      continue;
    }

    summary.processed++;
    process.stdout.write(`[${summary.processed}/${spans.length}] ${label} (tmdbId ${tmdbIdField.value}) ... `);

    const result = await fetchTmdbMovie(tmdbIdField.value);
    await sleep(CONFIG.requestDelayMs);

    if (!result.ok) {
      console.log(`❌ ${result.reason}`);
      if (result.reason === "invalid_tmdb_id") summary.invalidTmdbId++;
      else summary.networkFailures++;
      summary.details.push({
        id: idField?.value,
        title: titleField?.value,
        tmdbId: tmdbIdField.value,
        status: result.reason,
        detail: result.detail,
      });
      continue;
    }

    const tmdbMovie = result.data;
    const { match, score, matchedAgainst } = titlesMatch(
      titleField?.value ?? "",
      tmdbMovie.title,
      tmdbMovie.original_title
    );

    if (!match) {
      console.log(
        `⚠️  TITLE MISMATCH (score ${score}) — stored "${titleField?.value}" vs TMDB "${tmdbMovie.title}". Skipping artwork update.`
      );
      summary.skippedTitleMismatch++;
      summary.details.push({
        id: idField?.value,
        title: titleField?.value,
        tmdbId: tmdbIdField.value,
        status: "title_mismatch",
        tmdbTitle: tmdbMovie.title,
        tmdbOriginalTitle: tmdbMovie.original_title,
        similarityScore: score,
        matchedAgainst,
      });
      continue;
    }

    const newPosterPath = tmdbMovie.poster_path
      ? `${CONFIG.posterBaseUrl}${tmdbMovie.poster_path}`
      : null;
    const newBackdropPath = tmdbMovie.backdrop_path
      ? `${CONFIG.backdropBaseUrl}${tmdbMovie.backdrop_path}`
      : null;

    if (!newPosterPath) summary.missingPoster++;
    if (!newBackdropPath) summary.missingBackdrop++;

    let updatedObjText = objText;
    let changedPoster = false;
    let changedBackdrop = false;

    if (newPosterPath && posterField && posterField.value !== newPosterPath) {
      const oldLine = posterField.raw;
      const newLine = `posterPath: "${newPosterPath}"`;
      updatedObjText = updatedObjText.replace(oldLine, newLine);
      changedPoster = true;
    }

    if (newBackdropPath && backdropField && backdropField.value !== newBackdropPath) {
      const oldLine = backdropField.raw;
      const newLine = `backdropPath: "${newBackdropPath}"`;
      updatedObjText = updatedObjText.replace(oldLine, newLine);
      changedBackdrop = true;
    }

    if (changedPoster || changedBackdrop) {
      patches.push({ start: span.start, end: span.end, newText: updatedObjText });
      summary.updated++;
      console.log(
        `✅ updated${changedPoster ? " [poster]" : ""}${changedBackdrop ? " [backdrop]" : ""} (title match ${score})`
      );
      summary.details.push({
        id: idField?.value,
        title: titleField?.value,
        tmdbId: tmdbIdField.value,
        status: "updated",
        changedPoster,
        changedBackdrop,
        similarityScore: score,
      });
    } else {
      summary.unchangedAlreadyCorrect++;
      console.log(`✓ already correct`);
      summary.details.push({
        id: idField?.value,
        title: titleField?.value,
        tmdbId: tmdbIdField.value,
        status: "already_correct",
        similarityScore: score,
      });
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
    console.log(`✏️  ${CONFIG.filePath} updated with ${patches.length} movie(s) repaired.`);
  } else {
    console.log("\n✨ No changes needed — nothing to write.");
  }

  // ── Write reports ──
  fs.writeFileSync(CONFIG.reportJsonPath, JSON.stringify(summary, null, 2), "utf8");

  const textReport = buildTextReport(summary, spans.length);
  fs.writeFileSync(CONFIG.reportTextPath, textReport, "utf8");

  console.log("\n" + textReport);
  console.log(`\n📄 Full JSON report: ${CONFIG.reportJsonPath}`);
  console.log(`📄 Text report:      ${CONFIG.reportTextPath}\n`);
}

function buildTextReport(summary, totalSpans) {
  const lines = [];
  lines.push("═══════════════════════════════════════════════");
  lines.push(" TMDB ARTWORK REPAIR — SUMMARY");
  lines.push("═══════════════════════════════════════════════");
  lines.push(`Movie objects found in file:     ${totalSpans}`);
  lines.push(`Movies processed:                ${summary.processed}`);
  lines.push(`Movies successfully updated:      ${summary.updated}`);
  lines.push(`Already correct (no change):      ${summary.unchangedAlreadyCorrect}`);
  lines.push(`Skipped — title mismatch:         ${summary.skippedTitleMismatch}`);
  lines.push(`Missing poster on TMDB:           ${summary.missingPoster}`);
  lines.push(`Missing backdrop on TMDB:         ${summary.missingBackdrop}`);
  lines.push(`Invalid / not-found tmdbId:       ${summary.invalidTmdbId}`);
  lines.push(`Network / API failures:           ${summary.networkFailures}`);
  lines.push("───────────────────────────────────────────────");

  const mismatches = summary.details.filter((d) => d.status === "title_mismatch");
  if (mismatches.length > 0) {
    lines.push("\n⚠️  TITLE MISMATCHES (artwork NOT changed — review manually):");
    for (const m of mismatches) {
      lines.push(
        `  - id=${m.id} "${m.title}" (tmdbId ${m.tmdbId}) → TMDB says "${m.tmdbTitle}" (score ${m.similarityScore})`
      );
    }
  }

  const invalidIds = summary.details.filter((d) => d.status === "invalid_tmdb_id");
  if (invalidIds.length > 0) {
    lines.push("\n❌ INVALID tmdbId (404 from TMDB):");
    for (const m of invalidIds) {
      lines.push(`  - id=${m.id} "${m.title}" (tmdbId ${m.tmdbId})`);
    }
  }

  const failures = summary.details.filter((d) =>
    ["network_error", "rate_limited", "http_error", "parse_error"].includes(d.status)
  );
  if (failures.length > 0) {
    lines.push("\n🔌 NETWORK / API FAILURES (re-run the script to retry these):");
    for (const m of failures) {
      lines.push(`  - id=${m.id} "${m.title}" (tmdbId ${m.tmdbId}) → ${m.status}: ${m.detail}`);
    }
  }

  lines.push("\n═══════════════════════════════════════════════");
  return lines.join("\n");
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});