// src/context/ThemeContext.tsx
//
// Phase 21 — Theme Toggle.
//
// This app's visual design is currently dark-only (hardcoded neutral-900 /
// red-650 Tailwind classes throughout, no `dark:` variants anywhere). Fully
// re-skinning every component for a light theme is a much larger effort
// than this phase — see the Phase 21 audit notes for the explicit scope
// decision. What this context DOES provide is a real, working,
// localStorage-persisted dark/light preference and the document-level hook
// (`data-theme` on <html>) that a future pass can build a full light theme
// on top of without touching the toggle mechanism itself.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "dark" | "light";

const THEME_KEY = "movieapp:theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

function readStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    const root = document.documentElement;

    // Task Y — root cause of the reported "freeze" was `.theme-transitioning`
    // (see index.css) forcing background-color/border-color/color/box-shadow/
    // fill/stroke/background-image transitions onto *every element and
    // pseudo-element in the DOM* for 240ms. box-shadow and background-image
    // are not compositor-only properties — animating them forces the browser
    // to repaint on every frame, and with a few hundred movie cards on
    // screen that repaint cost is what read as a freeze. The CSS rule has
    // been trimmed to only the cheap, GPU-composited color properties and
    // no longer touches ::before/::after, and the window below is shortened
    // to match — the flip still cross-fades, it just does far less work
    // per frame while doing it.
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReducedMotion) {
      root.classList.add("theme-transitioning");
    }

    root.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage failures (private browsing, quota, etc.)
    }

    if (prefersReducedMotion) return;
    const timeout = window.setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [theme]);

  // Stable function identities so consuming components (UserMenu previously,
  // now SettingsPage) don't re-render just because some unrelated state
  // higher up caused ThemeProvider itself to re-render.
  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(() => setThemeState((prev) => (prev === "dark" ? "light" : "dark")), []);

  // The old inline object literal (`value={{ theme, toggleTheme, setTheme }}`)
  // was a brand-new object on every ThemeProvider render, which — since
  // ThemeProvider wraps the entire app in App.tsx — meant every consumer of
  // useTheme() re-rendered on any app-wide state change, not just real theme
  // changes. Memoizing against `theme` (the only value that actually varies)
  // means consumers now only re-render when the theme itself changes.
  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme, toggleTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}