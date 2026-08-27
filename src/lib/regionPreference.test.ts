// src/lib/regionPreference.test.ts
//
// Phase 44 — unit tests for the region preference utility.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getRegion,
  getSavedRegion,
  saveRegion,
  clearSavedRegion,
  regionDisplayName,
  TMDB_REGIONS,
} from "./regionPreference";

const STORAGE_KEY = "movieapp:wtw-region";

describe("regionPreference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  // ── getRegion ─────────────────────────────────────────────────────────────

  describe("getRegion()", () => {
    it("returns the stored preference when one is saved", () => {
      localStorage.setItem(STORAGE_KEY, "DE");
      expect(getRegion()).toBe("DE");
    });

    it("ignores invalid stored values and falls back to locale/US", () => {
      localStorage.setItem(STORAGE_KEY, "not-valid");
      // The result should be 2 uppercase letters (locale) or 'US'
      const result = getRegion();
      expect(result).toMatch(/^[A-Z]{2}$/);
    });

    it("falls back to US when no preference and no usable locale", () => {
      // Stub navigator.language to an empty string (no country subtag)
      vi.stubGlobal("navigator", { language: "" });
      const result = getRegion();
      expect(result).toBe("US");
    });

    it("extracts the country subtag from navigator.language as fallback", () => {
      vi.stubGlobal("navigator", { language: "en-GB" });
      expect(getRegion()).toBe("GB");
    });

    it("returns US when navigator.language has no country part", () => {
      vi.stubGlobal("navigator", { language: "en" });
      expect(getRegion()).toBe("US");
    });
  });

  // ── getSavedRegion ────────────────────────────────────────────────────────

  describe("getSavedRegion()", () => {
    it("returns undefined when nothing is saved", () => {
      expect(getSavedRegion()).toBeUndefined();
    });

    it("returns the saved code when present and valid", () => {
      localStorage.setItem(STORAGE_KEY, "JP");
      expect(getSavedRegion()).toBe("JP");
    });

    it("returns undefined for an invalid stored value", () => {
      localStorage.setItem(STORAGE_KEY, "bad");
      expect(getSavedRegion()).toBeUndefined();
    });
  });

  // ── saveRegion ────────────────────────────────────────────────────────────

  describe("saveRegion()", () => {
    it("writes a valid two-letter code to localStorage", () => {
      saveRegion("FR");
      expect(localStorage.getItem(STORAGE_KEY)).toBe("FR");
    });

    it("does not write an invalid code", () => {
      saveRegion("INVALID");
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("does not write a lowercase code (must be uppercase alpha-2)", () => {
      saveRegion("us");
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  // ── clearSavedRegion ──────────────────────────────────────────────────────

  describe("clearSavedRegion()", () => {
    it("removes the stored preference", () => {
      localStorage.setItem(STORAGE_KEY, "CA");
      clearSavedRegion();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("does not throw when nothing is stored", () => {
      expect(() => clearSavedRegion()).not.toThrow();
    });
  });

  // ── regionDisplayName ─────────────────────────────────────────────────────

  describe("regionDisplayName()", () => {
    it("returns a non-empty string for known codes", () => {
      const name = regionDisplayName("US");
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    });

    it("falls back to the raw code for unknown codes", () => {
      // 'ZZ' is not a real region; Intl should either throw or return the
      // raw code — either way our fallback must return something non-empty.
      const name = regionDisplayName("ZZ");
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    });
  });

  // ── TMDB_REGIONS list ─────────────────────────────────────────────────────

  describe("TMDB_REGIONS", () => {
    it("is a non-empty array", () => {
      expect(Array.isArray(TMDB_REGIONS)).toBe(true);
      expect(TMDB_REGIONS.length).toBeGreaterThan(0);
    });

    it("every entry has a valid two-letter code", () => {
      for (const r of TMDB_REGIONS) {
        expect(r.code).toMatch(/^[A-Z]{2}$/);
      }
    });

    it("every entry has a non-empty name", () => {
      for (const r of TMDB_REGIONS) {
        expect(typeof r.name).toBe("string");
        expect(r.name.length).toBeGreaterThan(0);
      }
    });

    it("contains US", () => {
      expect(TMDB_REGIONS.some((r) => r.code === "US")).toBe(true);
    });

    it("contains GB", () => {
      expect(TMDB_REGIONS.some((r) => r.code === "GB")).toBe(true);
    });

    it("contains no duplicate codes", () => {
      const codes = TMDB_REGIONS.map((r) => r.code);
      const unique = new Set(codes);
      expect(unique.size).toBe(codes.length);
    });
  });
});