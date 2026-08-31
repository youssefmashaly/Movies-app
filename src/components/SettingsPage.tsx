// src/components/SettingsPage.tsx
//
// Task Y — dedicated Settings page.
//
// Previously "Settings" (the account dropdown item) just routed to the
// Profile tab in edit mode, and the actual theme toggle lived buried inside
// that same account dropdown as a small checkbox menu item. Neither was a
// real settings experience. This gives Settings its own tab/page, with a
// proper Appearance section owning theme selection — the single source of
// truth for reading/changing theme is still ThemeContext (via useTheme()),
// this component is presentation only, exactly like GenreOnboardingModal is
// for favorite genres.
//
// Phase 44 — added "Where to Watch" section for region preference.
import React, { useState } from "react";
import { motion } from "motion/react";
import { Settings as SettingsIcon, Sun, Moon, Check, Palette, Globe2, ChevronDown } from "lucide-react";
import { useTheme, type Theme } from "../context/ThemeContext";
import {
  getRegion,
  getSavedRegion,
  saveRegion,
  clearSavedRegion,
  regionDisplayName,
  TMDB_REGIONS,
} from "../lib/regionPreference";

interface ThemeOption {
  value: Theme;
  label: string;
  description: string;
  icon: React.ElementType;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: "dark", label: "Dark Mode", description: "Cinematic, easy on the eyes at night.", icon: Moon },
  { value: "light", label: "Light Mode", description: "Bright and clean for daytime browsing.", icon: Sun },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  // Region preference — mirrors the state in WhereToWatch but is also
  // surfaced here so power users can adjust it without opening a movie.
  const [savedRegion, setSavedRegionState] = useState<string | undefined>(
    () => getSavedRegion()
  );
  // Active region (saved or auto-detected)
  const [activeRegion, setActiveRegionState] = useState<string>(() => getRegion());

  function handleRegionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value;
    if (code === "__auto__") {
      clearSavedRegion();
      setSavedRegionState(undefined);
      setActiveRegionState(getRegion()); // re-derive from browser locale
    } else {
      saveRegion(code);
      setSavedRegionState(code);
      setActiveRegionState(code);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto px-4 py-8 space-y-10"
    >
      {/* ── HEADER ── */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-650 to-red-600 text-[#ffffff] shadow-md shadow-red-950/30">
          <SettingsIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Settings</p>
          <h1 className="text-3xl font-bold text-white">Customize your experience</h1>
        </div>
      </div>

      {/* ── APPEARANCE ── */}
      <section
        aria-labelledby="appearance-heading"
        className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8"
      >
        <div className="flex items-start gap-3 mb-6">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-650/15 border border-red-650/20 text-red-400">
            <Palette className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="appearance-heading" className="text-base font-bold text-white">
              Appearance
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Choose how Movie Database looks on this device. Changes apply instantly and are remembered next time
              you visit.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Theme</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-neutral-300"
            aria-live="polite"
          >
            {theme === "dark" ? <Moon className="h-3 w-3 text-red-400" aria-hidden="true" /> : <Sun className="h-3 w-3 text-amber-400" aria-hidden="true" />}
            Currently using {theme === "dark" ? "Dark Mode" : "Light Mode"}
          </span>
        </div>

        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setTheme(option.value)}
                className={`relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                  isSelected
                    ? "border-red-650 bg-red-650/10 shadow-md shadow-red-950/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]"
                }`}
              >
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border ${
                    isSelected ? "bg-red-650 border-red-650 text-[#ffffff]" : "bg-white/[0.03] border-white/[0.06] text-neutral-400"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${isSelected ? "text-white" : "text-neutral-300"}`}>{option.label}</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{option.description}</p>
                </div>
                {isSelected && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-650 text-[#ffffff]">
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── WHERE TO WATCH ── */}
      <section
        aria-labelledby="wtw-settings-heading"
        className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8"
      >
        <div className="flex items-start gap-3 mb-6">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-650/15 border border-red-650/20 text-red-400">
            <Globe2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="wtw-settings-heading" className="text-base font-bold text-white">
              Where to Watch
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Choose the country used when looking up streaming, rental, and purchase availability. The selector on each movie page uses this preference.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Availability region
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-neutral-300"
            aria-live="polite"
          >
            <Globe2 className="h-3 w-3 text-red-400" aria-hidden="true" />
            {savedRegion
              ? regionDisplayName(savedRegion)
              : `Auto-detected (${regionDisplayName(activeRegion)})`}
          </span>
        </div>

        <div className="relative w-full sm:w-72">
          <label htmlFor="settings-wtw-region" className="sr-only">
            Availability region
          </label>
          <Globe2
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none"
            aria-hidden="true"
          />
          <select
            id="settings-wtw-region"
            value={savedRegion ?? "__auto__"}
            onChange={handleRegionChange}
            className={[
              "w-full appearance-none",
              "pl-9 pr-9 py-2.5",
              "text-sm font-medium text-neutral-200",
              "bg-white/[0.04] border border-white/[0.08]",
              "rounded-xl",
              "cursor-pointer",
              "transition-colors",
              "hover:border-white/[0.16] hover:bg-white/[0.07]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
              "[color-scheme:dark]",
            ].join(" ")}
          >
            <option value="__auto__">Auto-detect from browser</option>
            <optgroup label="Select a region">
              {TMDB_REGIONS.map((r) => (
                <option key={r.code} value={r.code} style={{ backgroundColor: "#171717", color: "#ffffff" }}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none"
            aria-hidden="true"
          />
        </div>

        {savedRegion && (
          <p className="text-[11px] text-neutral-600 mt-3">
            Showing availability for{" "}
            <span className="text-neutral-400 font-semibold">
              {regionDisplayName(savedRegion)}
            </span>
            {". "}
            Select "Auto-detect from browser" above to revert to automatic region detection.
          </p>
        )}
      </section>
    </motion.div>
  );
}