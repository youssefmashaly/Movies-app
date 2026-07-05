// Deterministic seeded shuffle (mulberry32 PRNG). Given the same array and
// seed, always produces the same output — used across recommendation rails
// so "soft randomness between sessions" doesn't cause flicker within one.
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  let s = seed;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Deterministic numeric seed derived from a string (e.g. a movie id) — used
// where the shuffle should be stable per-entity rather than per-session.
export function stringToSeed(str: string): number {
  let seed = 0;
  for (let i = 0; i < str.length; i++) seed = (seed * 31 + str.charCodeAt(i)) | 0;
  return seed;
}