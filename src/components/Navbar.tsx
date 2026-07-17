import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  Film,
  Search,
  Bookmark,
  Sparkles,
  LogIn,
  Menu,
  X,
  Loader2,
  Clock,
  TrendingUp,
  Trash2,
  SearchX,
  LibraryBig
} from "lucide-react";
import type { Movie } from "../types";
import { searchMovies, highlightMatch, MovieSearchResult } from "../lib/movieSearch";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import UserMenu from "./UserMenu";

// ── Search history (localStorage, guest-friendly, same pattern as App.tsx) ──
const SEARCH_HISTORY_KEY = "movieapp:searchHistory";
const MAX_HISTORY = 6;

function readSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushSearchHistory(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return readSearchHistory();
  const existing = readSearchHistory().filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
  const updated = [trimmed, ...existing].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
  return updated;
}

function clearSearchHistory(): void {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}

// Renders a highlightMatch() span as JSX, falling back to the plain string
// when there's no direct substring match (e.g. a typo-tolerant result).
function renderHighlighted(text: string, query: string): React.ReactNode {
  const span = highlightMatch(text, query);
  if (!span) return text;
  return (
    <>
      {span.before}
      <mark className="bg-red-500/25 text-red-300 rounded-sm px-0.5">{span.match}</mark>
      {span.after}
    </>
  );
}

// A short, human-readable subtitle for a search result explaining *why* it
// matched when the reason isn't the title itself (director/cast/genre/fuzzy).
function matchSubtitle(result: MovieSearchResult, query: string): string | null {
  const { movie, matchedField } = result;
  const q = query.trim().toLowerCase();
  switch (matchedField) {
    case "director":
      return movie.director ? `Directed by ${movie.director}` : null;
    case "cast": {
      const match = movie.cast?.find((c) => c.name.toLowerCase().includes(q));
      return match ? `Starring ${match.name}` : null;
    }
    case "genre": {
      const match = movie.genres?.find((g) => g.toLowerCase().includes(q));
      return match ?? null;
    }
    case "fuzzy":
      return "Did you mean this?";
    case "year":
      return movie.releaseDate?.slice(0, 4) ?? null;
    default:
      return movie.releaseDate?.split("-")[0] ?? null;
  }
}

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenAuth: () => void;
  searchLoading?: boolean;
  suggestionPool?: Movie[];
  /** Phase 21 — opens a movie's detail view directly (e.g. Enter / clicking
   *  a search suggestion), instead of only filling the search box. */
  onSelectMovie?: (movie: Movie) => void;
  /** Phase 21 — "Settings" entry in the account dropdown. Falls back to
   *  just switching to the Profile tab if the parent doesn't supply one. */
  onOpenSettings?: () => void;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onOpenAuth,
  searchLoading = false,
  suggestionPool = [],
  onSelectMovie,
  onOpenSettings
}: NavbarProps) {
  const [user, setUser] = useState(auth.currentUser);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── search suggestions state ──
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readSearchHistory());
  const suggestBlurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 21 — the input updates instantly, but the (potentially fuzzy)
  // multi-field match computation runs off a short local debounce so fast
  // typing doesn't recompute on every keystroke. This is independent of the
  // parent's own (longer) debounce that drives the backend fallback fetch.
  const debouncedQuery = useDebouncedValue(searchQuery, 220);
  const isDebouncing = debouncedQuery !== searchQuery;

  const matches = useMemo(
    () => searchMovies(suggestionPool, debouncedQuery, 8),
    [debouncedQuery, suggestionPool]
  );

  const showingHistory = searchQuery.trim().length === 0;
  const suggestionCount = showingHistory ? recentSearches.length : matches.length;

  // A few of the pool's most common genres, used as quick "try this instead"
  // chips in the no-results state.
  const popularGenres = useMemo(() => {
    const freq = new Map<string, number>();
    suggestionPool.forEach((m) => m.genres?.forEach((g) => freq.set(g, (freq.get(g) ?? 0) + 1)));
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([g]) => g);
  }, [suggestionPool]);

  const commitSearch = (query: string) => {
    const trimmed = query.trim();
    setSearchQuery(trimmed);
    if (activeTab !== "explore") setActiveTab("explore");
    if (trimmed) setRecentSearches(pushSearchHistory(trimmed));
    setSuggestOpen(false);
    setActiveIndex(-1);
  };

  // Phase 21 — opens a movie's detail page directly (modern typeahead UX:
  // picking a specific title goes straight to it, rather than just filling
  // the search box and re-filtering the grid).
  const openMovie = (movie: Movie) => {
    setRecentSearches(pushSearchHistory(movie.title));
    setSuggestOpen(false);
    setActiveIndex(-1);
    onSelectMovie?.(movie);
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setRecentSearches([]);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestOpen || suggestionCount === 0) {
      if (e.key === "Enter") {
        // "Enter opens first result" — if there's a query with a ranked
        // match ready, jump straight to it; otherwise fall back to
        // committing the raw text into the grid search.
        if (!showingHistory && matches.length > 0) {
          e.preventDefault();
          openMovie(matches[0].movie);
        } else {
          commitSearch(searchQuery);
        }
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestionCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestionCount - 1 : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showingHistory) {
        const picked = activeIndex >= 0 ? recentSearches[activeIndex] : searchQuery;
        commitSearch(picked);
      } else {
        const picked = activeIndex >= 0 ? matches[activeIndex]?.movie : matches[0]?.movie;
        if (picked) openMovie(picked);
        else commitSearch(searchQuery);
      }
    } else if (e.key === "Escape") {
      setSuggestOpen(false);
      setActiveIndex(-1);
      (e.target as HTMLInputElement).blur();
    }
  };

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Monitor scroll for glass effect change
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  // Dropdown stays open whenever there's a query to react to (even with
  // zero results — that's the empty/no-results state) or there's history to
  // show. Only fully hidden when there's nothing useful to display at all.
  const showSuggestDropdown = suggestOpen && (searchQuery.trim().length > 0 || recentSearches.length > 0);
  const showNoResults = !showingHistory && !isDebouncing && matches.length === 0;

  // Phase 21 — Profile and My Dashboard now live in the UserMenu account
  // dropdown (see below), not as standalone tab-bar buttons.
  const menuItems = [
    { id: "explore", label: "Explore", icon: Film },
    { id: "library", label: "Movie Library", icon: LibraryBig },
    { id: "watchlist", label: "Watchlist", icon: Bookmark, authRequired: true },
    { id: "oracle", label: "AI Matchmaker", icon: Sparkles }
  ];

  return (
    <nav
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-neutral-950/90 border-b border-neutral-900 shadow-xl backdrop-blur-md py-3.5"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-6">
        {/* Logo and Brand */}
        <div
          id="navbar-logo"
          role="button"
          tabIndex={0}
          aria-label="Movie Database, go to Explore"
          onClick={() => {
            setActiveTab("explore");
            document.getElementById("navbar-search")?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveTab("explore");
            }
          }}
          className="flex items-center gap-2.5 cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg"
        >
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-tr from-red-650 to-red-600 bg-red-650 text-[#ffffff] shadow-md shadow-red-950/30">
            <Film className="h-5 w-5" />
          </div>
          <span className="font-extrabold text-lg text-white tracking-tight hidden sm:inline-block">
            Movie <span className="text-red-500">Database</span>
          </span>
        </div>

        {/* Desktop Navigation Tabs — Phase 21: wider gaps/padding for a less
            crowded feel, same colors/radius/visual language as before. */}
        <div className="hidden md:flex items-center gap-2.5 bg-neutral-900/60 p-1.5 rounded-xl border border-neutral-800">
          {menuItems.map((item) => {
            const Icon = item.icon;
            // Hide Watchlist tab if not logged in, or let them click and prompt log in inside App?
            // Safer to display, and if clicked when not logged in, let standard App trigger auth modal!
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => {
                  if (item.authRequired && !user) {
                    onOpenAuth();
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 ${
                  isActive
                    ? "bg-red-650 text-[#ffffff] shadow-md font-extrabold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-neutral-500"}`} />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar - Hide when in Oracle or Watchlist if desired, but general header is epic */}
        <div className="flex-1 max-w-xs mx-4 hidden sm:block relative">
          <label htmlFor="navbar-search" className="sr-only">Search movies, actors, directors, genres, or year</label>
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500 pointer-events-none">
            <Search className="h-4 w-4" />
          </span>
          <input
            id="navbar-search"
            type="text"
            role="combobox"
            aria-expanded={showSuggestDropdown}
            aria-controls="navbar-search-suggestions"
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="Search for movies..."
            value={searchQuery}
            onFocus={() => {
              if (suggestBlurTimeout.current) clearTimeout(suggestBlurTimeout.current);
              setSuggestOpen(true);
            }}
            onBlur={() => {
              // Delay so a click on a dropdown item registers before we close it
              suggestBlurTimeout.current = setTimeout(() => setSuggestOpen(false), 120);
            }}
            onKeyDown={handleSearchKeyDown}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveIndex(-1);
              setSuggestOpen(true);
              if (activeTab !== "explore") {
                setActiveTab("explore");
              }
            }}
            className="w-full text-xs font-medium rounded-xl border border-neutral-800 bg-neutral-900/50 py-2.5 pl-9 pr-9 text-white placeholder-neutral-500 outline-none focus:border-red-500/50 focus:bg-neutral-950 transition-all"
          />
          <span className="absolute inset-y-0 right-0 flex items-center pr-2.5">
            {searchLoading ? (
              <Loader2 className="h-3.5 w-3.5 text-red-400 animate-spin" aria-hidden="true" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="rounded-full p-1 text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </span>

          {/* Instant suggestions dropdown */}
          <AnimatePresence>
            {showSuggestDropdown && (
              <motion.div
                id="navbar-search-suggestions"
                role="listbox"
                aria-label={showingHistory ? "Recent searches" : "Search suggestions"}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md shadow-2xl overflow-hidden z-50"
              >
                {showingHistory ? (
                  <>
                    <div className="flex items-center justify-between gap-1.5 px-3 pt-2.5 pb-1.5">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        <Clock className="h-3 w-3" /> Recent Searches
                      </span>
                      {recentSearches.length > 0 && (
                        <button
                          type="button"
                          onMouseDown={handleClearHistory}
                          aria-label="Clear recent searches"
                          className="flex items-center gap-1 text-[10px] font-semibold text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" /> Clear
                        </button>
                      )}
                    </div>
                    {recentSearches.map((q, i) => (
                      <button
                        key={q}
                        role="option"
                        aria-selected={activeIndex === i}
                        type="button"
                        onMouseDown={() => commitSearch(q)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                          activeIndex === i ? "bg-red-600/15 text-[#ffffff]" : "text-neutral-300 hover:bg-neutral-900"
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5 text-neutral-600 flex-shrink-0" />
                        <span className="truncate">{q}</span>
                      </button>
                    ))}
                  </>
                ) : isDebouncing ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-xs text-neutral-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Searching…
                  </div>
                ) : showNoResults ? (
                  <div className="px-3 py-4">
                    <div className="flex items-center gap-2 text-xs text-neutral-400 mb-2.5">
                      <SearchX className="h-4 w-4 text-neutral-600 flex-shrink-0" aria-hidden="true" />
                      No matches for &ldquo;{searchQuery.trim()}&rdquo;. Try a title, actor, director, year, or genre.
                    </div>
                    {popularGenres.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {popularGenres.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onMouseDown={() => commitSearch(g)}
                            className="rounded-full border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-[10px] font-semibold text-neutral-300 hover:border-red-500/40 hover:text-white transition-colors cursor-pointer"
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                      <TrendingUp className="h-3 w-3" /> Matching Titles
                    </div>
                    {matches.map((result, i) => {
                      const movie = result.movie;
                      const subtitle = matchSubtitle(result, debouncedQuery);
                      return (
                        <button
                          key={movie.id}
                          role="option"
                          aria-selected={activeIndex === i}
                          type="button"
                          onMouseDown={() => openMovie(movie)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                            activeIndex === i ? "bg-red-600/15 text-[#ffffff]" : "text-neutral-300 hover:bg-neutral-900"
                          }`}
                        >
                          <img
                            src={movie.posterPath}
                            alt=""
                            className="h-8 w-6 rounded object-cover flex-shrink-0 bg-neutral-800"
                            loading="lazy"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{renderHighlighted(movie.title, debouncedQuery)}</span>
                            {subtitle && (
                              <span className="block truncate text-[10px] text-neutral-500">{subtitle}</span>
                            )}
                          </span>
                          {result.matchedField !== "director" &&
                            result.matchedField !== "cast" &&
                            result.matchedField !== "genre" &&
                            result.matchedField !== "fuzzy" && (
                              <span className="ml-auto text-[10px] text-neutral-400 flex-shrink-0">
                                {movie.releaseDate?.split("-")[0]}
                              </span>
                            )}
                        </button>
                      );
                    })}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Auth Info Widget */}
        <div className="flex items-center gap-4">
          <AnimatePresence mode="wait">
            {user ? (
              <motion.div
                key="user-logged-in"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                {/* User name info */}
                <div className="hidden lg:flex flex-col text-right">
                  <span className="font-semibold text-xs text-white leading-tight">
                    {user.displayName || "Movie Critic"}
                  </span>
                  <span className="text-[10px] text-neutral-500 truncate max-w-[120px]">
                    {user.email}
                  </span>
                </div>

                {/* Phase 21 — avatar now opens the account dropdown menu
                    (View Profile / My Dashboard / Settings / Theme / Logout)
                    instead of standalone tab-bar buttons + a bare Logout icon. */}
                <UserMenu
                  user={user}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onOpenSettings={onOpenSettings ?? (() => setActiveTab("profile"))}
                  onLogout={handleLogout}
                />
              </motion.div>
            ) : (
              <motion.button
                key="user-logged-out"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                id="navbar-login-trigger"
                onClick={onOpenAuth}
                className="flex items-center gap-2 rounded-xl bg-red-650 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#ffffff] shadow-md hover:bg-red-600 shadow-red-950/10 focus-visible:ring-2 focus-visible:ring-red-400 transition-all cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </motion.button>
            )}
          </AnimatePresence>

          {/* Mobile menu trigger */}
          <button
            id="mobile-menu-trigger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu-drawer"
            className="md:hidden rounded-lg border border-neutral-800 bg-neutral-900/60 p-2 text-neutral-400 hover:text-white focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-menu-drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-neutral-900 bg-neutral-950 px-6 py-4 space-y-4 shadow-2xl"
          >
            {/* Mobile Search */}
            <div className="relative">
              <label htmlFor="mobile-search" className="sr-only">Search movies</label>
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                id="mobile-search"
                type="text"
                placeholder="Search for movies..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeTab !== "explore") {
                    setActiveTab("explore");
                  }
                }}
                className="w-full text-xs font-medium rounded-xl border border-neutral-800 bg-neutral-900/50 py-2.5 pl-9 pr-9 text-white outline-none focus:border-red-500/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-white cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Mobile links */}
            <div className="flex flex-col gap-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={`mobile-${item.id}`}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (item.authRequired && !user) {
                        onOpenAuth();
                      } else {
                        setActiveTab(item.id);
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-colors cursor-pointer ${
                      isActive
                        ? "bg-red-650 text-[#ffffff]"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}