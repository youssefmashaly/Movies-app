import { describe, it, expect } from "vitest";
import { seededShuffle, stringToSeed } from "./seededShuffle";

describe("seededShuffle", () => {
  it("is deterministic — the same array and seed always produce the same output", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = seededShuffle(arr, 42);
    const b = seededShuffle(arr, 42);
    expect(a).toEqual(b);
  });

  it("produces a different order for a different seed (statistically, for a large-enough array)", () => {
    const arr = Array.from({ length: 20 }, (_, i) => i);
    const a = seededShuffle(arr, 1);
    const b = seededShuffle(arr, 2);
    expect(a).not.toEqual(b);
  });

  it("never mutates the input array", () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    seededShuffle(arr, 7);
    expect(arr).toEqual(original);
  });

  it("preserves every original element exactly once (a true permutation)", () => {
    const arr = ["a", "b", "c", "d", "e"];
    const shuffled = seededShuffle(arr, 99);
    expect([...shuffled].sort()).toEqual([...arr].sort());
    expect(shuffled).toHaveLength(arr.length);
  });

  it("handles empty and single-element arrays without error", () => {
    expect(seededShuffle([], 1)).toEqual([]);
    expect(seededShuffle(["only"], 1)).toEqual(["only"]);
  });
});

describe("stringToSeed", () => {
  it("is deterministic for the same string", () => {
    expect(stringToSeed("movie-123")).toBe(stringToSeed("movie-123"));
  });

  it("produces different seeds for different strings (in general)", () => {
    expect(stringToSeed("movie-123")).not.toBe(stringToSeed("movie-456"));
  });

  it("returns 0 for an empty string", () => {
    expect(stringToSeed("")).toBe(0);
  });

  it("always returns an integer (safe to feed into seededShuffle)", () => {
    const seed = stringToSeed("The Dark Knight");
    expect(Number.isInteger(seed)).toBe(true);
  });
});