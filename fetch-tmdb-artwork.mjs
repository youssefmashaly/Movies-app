/**
 * Phase 7C — One-Time TMDB Artwork Migration Script
 * Run: node fetch-tmdb-artwork.mjs
 * Then paste the output patches into src/movies-data.ts
 * Delete this file after migration is complete.
 */

const API_KEY = "5824bee97be9916fc7b8e823174ff4c7";
const BASE    = "https://image.tmdb.org/t/p";

const MOVIES = [
  { id: "1",  tmdbId: 693134,  title: "Dune: Part Two",
    castIds: ["c1","c2","c3","c4"] },
  { id: "2",  tmdbId: 872585,  title: "Oppenheimer",
    castIds: ["c11","c12","c13","c14"] },
  { id: "3",  tmdbId: 569094,  title: "Spider-Man: Across the Spider-Verse",
    castIds: ["c21","c22","c23","c24"] },
  { id: "4",  tmdbId: 414906,  title: "The Batman",
    castIds: ["c31","c32","c33","c34"] },
  { id: "5",  tmdbId: 157336,  title: "Interstellar",
    castIds: ["c41","c42","c43","c44"] },
  { id: "6",  tmdbId: 558449,  title: "Gladiator II",
    castIds: ["c51","c52","c53","c54"] },
  { id: "7",  tmdbId: 1022789, title: "Inside Out 2",
    castIds: ["c61","c62","c63","c64"] },
  { id: "8",  tmdbId: 545611,  title: "Everything Everywhere All at Once",
    castIds: ["c71","c72","c73","c74"] },
  { id: "9",  tmdbId: 1008409, title: "Nosferatu",
    castIds: ["c81","c82","c83","c84"] },
  { id: "10", tmdbId: 786892,  title: "Furiosa: A Mad Max Saga",
    castIds: ["c91","c92","c93","c94"] },
  { id: "11", tmdbId: 840430,  title: "The Holdovers",
    castIds: ["c101","c102","c103","c104"] },
  { id: "12", tmdbId: 466420,  title: "Past Lives",
    castIds: ["c111","c112","c113","c114"] },
  { id: "13", tmdbId: 724089,  title: "Killers of the Flower Moon",
    castIds: ["c121","c122","c123","c124"] },
  { id: "14", tmdbId: 1178685, title: "Wicked",
    castIds: ["c131","c132","c133","c134"] },
  { id: "15", tmdbId: 792307,  title: "Poor Things",
    castIds: ["c141","c142","c143","c144"] },
  { id: "16", tmdbId: 762441,  title: "A Quiet Place: Day One",
    castIds: ["c151","c152","c153","c154"] },
  { id: "17", tmdbId: 1087822, title: "Conclave",
    castIds: ["c161","c162","c163","c164"] },
  { id: "18", tmdbId: 822119,  title: "Moana 2",
    castIds: ["c171","c172","c173","c174"] },
  { id: "19", tmdbId: 718821,  title: "Alien: Romulus",
    castIds: ["c181","c182","c183","c184"] },
  { id: "20", tmdbId: 829799,  title: "Twisters",
    castIds: ["c191","c192","c193","c194"] },
  { id: "21", tmdbId: 155,     title: "The Dark Knight",
    castIds: ["c211","c212","c213","c214"] },
  { id: "22", tmdbId: 496243,  title: "Parasite",
    castIds: ["c221","c222","c223","c224"] },
  { id: "23", tmdbId: 27205,   title: "Inception",
    castIds: ["c231","c232","c233","c234"] },
  { id: "24", tmdbId: 278,     title: "The Shawshank Redemption",
    castIds: ["c241","c242","c243","c244"] },
  { id: "25", tmdbId: 8587,    title: "The Lion King",
    castIds: ["c251","c252","c253","c254"] },
  { id: "26", tmdbId: 680,     title: "Pulp Fiction",
    castIds: ["c261","c262","c263","c264"] },
  { id: "27", tmdbId: 424,     title: "Schindler's List",
    castIds: ["c271","c272","c273","c274"] },
  { id: "28", tmdbId: 13,      title: "Forrest Gump",
    castIds: ["c281","c282","c283","c284"] },
  { id: "29", tmdbId: 238,     title: "The Godfather",
    castIds: ["c291","c292","c293","c294"] },
  { id: "30", tmdbId: 120,     title: "The Lord of the Rings: The Fellowship of the Ring",
    castIds: ["c301","c302","c303","c304"] },
  { id: "31", tmdbId: 769,     title: "Goodfellas",
    castIds: ["c311","c312","c313","c314"] },
  { id: "32", tmdbId: 475557,  title: "Joker",
    castIds: ["c321","c322","c323","c324"] },
  { id: "33", tmdbId: 299534,  title: "Avengers: Endgame",
    castIds: ["c331","c332","c333","c334"] },
  { id: "34", tmdbId: 313369,  title: "La La Land",
    castIds: ["c341","c342","c343","c344"] },
  { id: "35", tmdbId: 419430,  title: "Get Out",
    castIds: ["c351","c352","c353","c354"] },
  { id: "36", tmdbId: 354912,  title: "Coco",
    castIds: ["c361","c362","c363","c364"] },
  { id: "37", tmdbId: 76341,   title: "Mad Max: Fury Road",
    castIds: ["c371","c372","c373","c374"] },
  { id: "38", tmdbId: 531428,  title: "Knives Out",
    castIds: ["c381","c382","c383","c384"] },
  { id: "39", tmdbId: 244786,  title: "Whiplash",
    castIds: ["c391","c392","c393","c394"] },
  { id: "40", tmdbId: 37799,   title: "The Social Network",
    castIds: ["c401","c402","c403","c404"] },
  { id: "41", tmdbId: 493922,  title: "Hereditary",
    castIds: ["c411","c412","c413","c414"] },
  { id: "42", tmdbId: 129,     title: "Spirited Away",
    castIds: ["c421","c422","c423","c424"] },
  { id: "43", tmdbId: 329865,  title: "Arrival",
    castIds: ["c431","c432","c433","c434"] },
  { id: "44", tmdbId: 396342,  title: "The Witch",
    castIds: ["c441","c442","c443","c444"] },
  { id: "45", tmdbId: 204717,  title: "About Time",
    castIds: ["c451","c452","c453","c454"] },
  { id: "46", tmdbId: 862,     title: "Toy Story",
    castIds: ["c461","c462","c463","c464"] },
  { id: "47", tmdbId: 6977,    title: "No Country for Old Men",
    castIds: ["c471","c472","c473","c474"] },
  { id: "48", tmdbId: 194,     title: "Amélie",
    castIds: ["c481","c482","c483","c484"] },
  { id: "49", tmdbId: 62,      title: "2001: A Space Odyssey",
    castIds: ["c491","c492","c493","c494"] },
  { id: "50", tmdbId: 101299,  title: "Silver Linings Playbook",
    castIds: ["c501","c502","c503","c504"] },
  { id: "51", tmdbId: 14160,   title: "Up",
    castIds: ["c511","c512","c513","c514"] },
  { id: "52", tmdbId: 209112,  title: "Gone Girl",
    castIds: ["c521","c522","c523","c524"] },
  { id: "53", tmdbId: 137113,  title: "The Grand Budapest Hotel",
    castIds: ["c531","c532","c533","c534"] },
  { id: "54", tmdbId: 281957,  title: "The Revenant",
    castIds: ["c541","c542","c543","c544"] },
  { id: "55", tmdbId: 38,      title: "Eternal Sunshine of the Spotless Mind",
    castIds: ["c551","c552","c553","c554"] },
  { id: "56", tmdbId: 530915,  title: "1917",
    castIds: ["c561","c562","c563","c564"] },
  { id: "57", tmdbId: 762,     title: "Monty Python and the Holy Grail",
    castIds: ["c571","c572","c573","c574"] },
];

function posterUrl(path)   { return path ? `${BASE}/w500${path}`  : null; }
function backdropUrl(path) { return path ? `${BASE}/w1280${path}` : null; }
function profileUrl(path)  { return path ? `${BASE}/w185${path}`  : null; }

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

function q(str) { return str ? `"${str}"` : `null`; }

async function run() {
  const results = [];
  const failed  = [];

  process.stderr.write(`Fetching ${MOVIES.length} movies from TMDB...\n`);

  for (const movie of MOVIES) {
    try {
      const url = `https://api.themoviedb.org/3/movie/${movie.tmdbId}?api_key=${API_KEY}&append_to_response=credits`;
      const data = await fetchWithRetry(url);

      const poster   = posterUrl(data.poster_path);
      const backdrop = backdropUrl(data.backdrop_path);
      const cast     = (data.credits?.cast ?? []).slice(0, 4);

      results.push({ movie, poster, backdrop, cast });
      process.stderr.write(`  ✓ [${movie.id.padStart(2)}] ${movie.title}\n`);
    } catch (e) {
      failed.push({ movie, error: e.message });
      process.stderr.write(`  ✗ [${movie.id.padStart(2)}] ${movie.title} — ${e.message}\n`);
    }

    // 4 req/s — well under TMDB's 40/s limit
    await new Promise(r => setTimeout(r, 260));
  }

  // ── Output patches ─────────────────────────────────────────────────────────

  console.log("// ============================================================");
  console.log("// PHASE 7C — TMDB ARTWORK PATCHES");
  console.log(`// Generated: ${new Date().toISOString()}`);
  console.log(`// Successful: ${results.length}/${MOVIES.length}`);
  if (failed.length) console.log(`// Failed: ${failed.map(f => f.movie.id).join(", ")}`);
  console.log("// Apply each FIND / REPLACE WITH block to src/movies-data.ts");
  console.log("// ============================================================\n");

  for (const { movie, poster, backdrop, cast } of results) {
    console.log(`// ── id: "${movie.id}" — ${movie.title} (tmdbId: ${movie.tmdbId}) ──`);

    // poster + backdrop patch (find the unsplash lines, replace with TMDB)
    console.log(`FIND (posterPath for id ${movie.id}):`);
    console.log(`  Look for: posterPath: "https://images.unsplash.com/..."`);
    console.log(`  Inside the movie block with: id: "${movie.id}",`);
    console.log(`REPLACE WITH:`);
    console.log(`  posterPath: ${q(poster)},`);
    console.log();
    console.log(`FIND (backdropPath for id ${movie.id}):`);
    console.log(`  Look for: backdropPath: "https://images.unsplash.com/..."`);
    console.log(`  Inside the movie block with: id: "${movie.id}",`);
    console.log(`REPLACE WITH:`);
    console.log(`  backdropPath: ${q(backdrop)},`);
    console.log();

    // cast profile patches
    cast.forEach((member, i) => {
      const cid = movie.castIds[i];
      if (!cid) return;
      console.log(`FIND (cast profilePath id ${cid} — ${member.name}):`);
      console.log(`  Look for: { id: "${cid}", name: "${member.name}", character:`);
      console.log(`  profilePath: "https://images.unsplash.com/..."`);
      console.log(`REPLACE WITH:`);
      console.log(`  profilePath: ${q(profileUrl(member.profile_path))},`);
      console.log();
    });

    console.log("---\n");
  }

  if (failed.length) {
    console.log("// ── FAILED MOVIES (keep existing Unsplash URLs) ──");
    for (const { movie, error } of failed) {
      console.log(`// id: "${movie.id}" — ${movie.title}: ${error}`);
    }
  }

  process.stderr.write(`\nDone. ${results.length} patches written to stdout.\n`);
  process.stderr.write("Redirect stdout to a file:  node fetch-tmdb-artwork.mjs > patches.txt\n");
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
