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
import React, { createContext, useContext, useEffect, useState } from "react";

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
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage failures (private browsing, quota, etc.)
    }
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () => setThemeState((prev) => (prev === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}