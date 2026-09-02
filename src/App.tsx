/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
// firebase/firestore: no active writes remain after preferences moved to Supabase
import { Movie } from "./types";
import { ALL_GENRES } from "./genres";
import {
  migrateRecentlyViewedEntries,
  addRecentlyViewedEntry,
  RecentlyViewedEntry
} from "./lib/recentlyViewed";
import { dedupedFetch } from "./lib/requestDedup";
import { primeMovieCache, resolveMovies } from "./lib/movieResolver";
import { loadMovieCatalog } from "./lib/movieCatalog";
import { seededShuffle, stringToSeed } from "./lib/seededShuffle";
import { preloadImage } from "./lib/imagePreload";
import { timeAsync, startTiming, endTiming } from "./lib/analytics";
import { syncProfileFromFirebaseUser, saveFavoriteGenres, getProfileWithGenres } from "./services/supabase/profiles";
import {
  getOrCreateDefaultWatchlist,
  listWatchlistMovies,
  addMovieToWatchlist,
  removeMovieFromWatchlist
} from "./services/supabase/watchlists";

// Components
import Navbar from "./components/Navbar";
import MovieCard from "./components/MovieCard";
import MovieRail from "./components/MovieRail";
import TrailerModal from "./components/TrailerModal";
import { MovieCardPreferencesProvider } from "./context/MovieCardContext";
import GenreOnboardingModal from "./components/GenreOnboardingModal";
import { ThemeProvider } from "./context/ThemeContext";
import { useToast } from "./context/ToastContext";
import { searchMovies } from "./lib/movieSearch";

const AIMatchmaker = lazy(() => import("./components/AIMatchmaker"));
const CommunityFeed = lazy(() => import("./components/CommunityFeed"));
const UserDashboard = lazy(() => import("./components/UserDashboard"));
const MovieLibrary = lazy(() => import("./components/MovieLibrary"));
// Phase 22 — Bundle Splitting. These three are large (814/888/224 lines)
// and, except for AuthModal, already only ever render conditionally, so
// splitting them out of the main chunk is a pure bundle-size win with no
// behavior change:
//   - MovieDetail only mounts when a movie is selected (see the ternary
//     around `selectedMovie` below) — never needed on first paint.
//   - UserProfile only mounts on the Profile tab, same Suspense pattern
//     already used for AIMatchmaker/CommunityFeed/UserDashboard above.
//   - AuthModal is unconditionally in the tree today (isOpen just toggles
//     its internal AnimatePresence) so lazy-loading it alone wouldn't defer
//     the fetch — see the `hasOpenedAuth` gate further down for how its
//     mount is actually deferred until first use.
const MovieDetail = lazy(() => import("./components/MovieDetail"));
const AuthModal = lazy(() => import("./components/AuthModal"));
const UserProfile = lazy(() => import("./components/UserProfile"));
const SettingsPage = lazy(() => import("./components/SettingsPage"));
const NotificationCenter = lazy(() => import("./components/NotificationCenter"));
const ReviewDetail = lazy(() => import("./components/ReviewDetail"));
import ScrollToTopButton from "./components/ScrollToTopButton";

// Icons
import {
  Star, Film, Bookmark, SlidersHorizontal, Eye, HelpCircle, ArrowRight,
  TrendingUp, Flame, CalendarClock, Compass, PlayCircle, Gem, X as XIcon,
  History, Heart, Sparkle, Clapperboard, Loader2,
  ChevronLeft, ChevronRight, Play, Pause, Clock3
} from "lucide-react";

// localStorage keys for guest-friendly, backend-free personalization
const FAVORITE_GENRES_KEY = "movieapp:favoriteGenres";
const RECENTLY_VIEWED_KEY = "movieapp:recentlyViewed";
const GENRE_ONBOARDING_SEEN_KEY = "movieapp:genreOnboardingSeen";
const RECENT_SEARCHES_KEY = "movieapp:recentSearches";

// Phase 18A — shared confidence copy for personalized rails (Recommended,
// Daily Picks). Mirrors the tiering already used by the AI Oracle
// (services/recommendations.ts) so the language stays consistent app-wide.
const CONFIDENCE_LABELS: Record<"high" | "medium" | "low", string> = {
  high: "High match",
  medium: "Good match",
  low: "General pick"
};

function readLocalJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-7 w-7 text-red-500 animate-spin" aria-hidden="true" />
    </div>
  );
}

export default function App() {
  // Phase 19 — shareable public profile URLs (?profile=<uid>). No router
  // dependency added — plain History API, consistent with this app's
  // existing tab-based navigation (activeTab already drives everything).
  const [activeTab, setActiveTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("review")) return "review";
    if (params.get("profile")) return "profile";
    return "explore";
  }); // explore, watchlist, oracle, profile, review, ...
  const [notificationUnreadCount, setNotificationUnreadCount] = useState<number>(0);
  const [viewedProfileUserId, setViewedProfileUserId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("profile")
  );
  // Phase 50 — mirrors viewedProfileUserId's pattern exactly: which review
  // is currently open in the focused Review Detail experience, with the
  // same ?review=<id> shareable-URL sync below.
  const [viewedReviewId, setViewedReviewId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("review")
  );
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  // Task 4 (Phase 42) — without this, the browser keeps whatever scroll
  // position you were at on the previous tab/view, so navigating away from a
  // deep-scrolled page (e.g. Movie Library after infinite-scrolling) lands
  // you mid-page on the new view instead of at the top. Keyed on the movie's
  // id (not the whole object) so re-enriching selectedMovie in place after
  // its detail fetch resolves doesn't re-trigger this.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab, selectedMovie?.id]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [authOpen, setAuthOpen] = useState<boolean>(false);
  // Phase 22 — AuthModal is rendered unconditionally today (isOpen just
  // toggles its internal AnimatePresence so close animates out), so its
  // chunk would otherwise load immediately on first paint regardless of
  // whether it's ever used. This flips true the first time authOpen does,
  // and AuthModal only enters the tree from that point on — deferring both
  // the code-split chunk fetch AND the mount until the person actually
  // clicks "Sign in", while keeping every subsequent open/close animation
  // identical to before once it's mounted.
  const [hasOpenedAuth, setHasOpenedAuth] = useState(false);
  useEffect(() => {
    if (authOpen) setHasOpenedAuth(true);
  }, [authOpen]);

  // User state
  const [user, setUser] = useState(auth.currentUser);

  // Stable per-session shuffle seed — computed once on mount, unchanged across
  // re-renders (no flicker), differs between sessions (soft randomness).
  const [sessionSeed] = useState<number>(() => Math.floor(Math.random() * 2 ** 31));

  // Phase 18A — Daily Picks: seed derived from today's date (not session), so
  // the row is stable all day for a given user and refreshes tomorrow.
  const dailySeed = useMemo(() => stringToSeed(new Date().toDateString()), []);

  // Movie lists state
  const [movies, setMovies] = useState<Movie[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [latestMovies, setLatestMovies] = useState<Movie[]>([]);
  const [moviesLoading, setMoviesLoading] = useState<boolean>(true);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  // Filter state
  const [selectedGenre, setSelectedGenre] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("popularity");
  const [minRating, setMinRating] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<string>("All");
  const [maxRuntime, setMaxRuntime] = useState<number>(0); // 0 = Any

  // Advanced filter panel state (Phase 11A Batch 2) — additive, independent
  // from the quick genre pill row above; combined with AND logic.
  const [panelGenres, setPanelGenres] = useState<string[]>([]);
  const [selectedDecade, setSelectedDecade] = useState<string>("All");
  const [selectedDirector, setSelectedDirector] = useState<string>("All");
  const [selectedActor, setSelectedActor] = useState<string>("All");
  const [filterPanelOpen, setFilterPanelOpen] = useState<boolean>(false);
  const [filterSection, setFilterSection] = useState<string | null>("genres");

  // Watchlist browsing state
  const [watchlistSortBy, setWatchlistSortBy] = useState<string>("dateAdded");
  const [watchlistGenreFilter, setWatchlistGenreFilter] = useState<string>("All");

  // Watchlist state
  const [watchlistMovies, setWatchlistMovies] = useState<Movie[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState<boolean>(false);
  const [defaultWatchlistId, setDefaultWatchlistId] = useState<string | null>(null);

  // Personalization state (device-local via localStorage; mirrored to Firestore
  // for signed-in users so preferences follow the account, not just the browser)
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(() => readLocalJSON(FAVORITE_GENRES_KEY, []));
  // Phase 18D — Continue Browsing now caches only { id, viewedAt } pairs,
  // never full Movie objects, so artwork always reflects the current
  // catalog. migrateRecentlyViewedEntries transparently upgrades any
  // legacy full-object cache the first time it's read (no user action,
  // no lost history).
  const [recentlyViewedEntries, setRecentlyViewedEntries] = useState<RecentlyViewedEntry[]>(() =>
    migrateRecentlyViewedEntries(readLocalJSON<unknown>(RECENTLY_VIEWED_KEY, []))
  );
  // Phase 30 — replaces the old permanently-visible inline genre panel.
  // `genreOnboardingSeen` guards the *automatic* triggers (new signup,
  // first Dashboard visit with no genres) so they fire at most once ever
  // per browser; manual reopens from Dashboard/Settings always work
  // regardless of this flag.
  const [showGenreOnboarding, setShowGenreOnboarding] = useState(false);
  const [genreOnboardingSeen, setGenreOnboardingSeen] = useState<boolean>(() =>
    readLocalJSON(GENRE_ONBOARDING_SEEN_KEY, false)
  );
  // Phase 18A — Recently Searched: device-local, capped, most-recent-first.
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readLocalJSON(RECENT_SEARCHES_KEY, []));

   // Phase 20 — Continue Browsing's cached { id, viewedAt } entries are
  // resolved into up-to-date Movie objects via the universal movie
  // resolver (src/lib/movieResolver.ts) instead of a map built only from
  // whatever trending/latest happen to contain. The resolver's own cache
  // is primed from trending/latest as soon as they load (see the fetch
  // effect below), so in the common case this resolves instantly from
  // memory; any id that isn't already cached is fetched in one batched
  // request to GET /api/movies/batch. Always-fresh Movie[] for everything
  // that reads recentlyViewed (genre affinity, dashboard stats, the rail
  // itself) — same shape and same downstream usage as before.
  const [recentlyViewed, setRecentlyViewed] = useState<Movie[]>([]);
  useEffect(() => {
    const ids = recentlyViewedEntries.map((e) => e.id);
    if (ids.length === 0) {
      setRecentlyViewed([]);
      return;
    }
    const controller = new AbortController();
    resolveMovies(ids, { signal: controller.signal })
      .then((resolved) => {
        if (!controller.signal.aborted) setRecentlyViewed(resolved);
      })
      .catch((err) => {
        if (!controller.signal.aborted) console.error("Failed to resolve recently viewed movies:", err);
      });
    return () => controller.abort();
  }, [recentlyViewedEntries]);

  // 1. Sync Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // Ensure a Supabase profile row exists for this user. Fire-and-forget:
      // failures are logged only and never affect the Firebase auth state above.
      if (u) {
        syncProfileFromFirebaseUser({ uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL }).then((result) => {
          if (result.error) console.error("Supabase profile sync failed:", result.error);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch movies from fullstack backend APIs on mount
  useEffect(() => {
    const fetchPresetMovies = async () => {
      try {
        setMoviesLoading(true);
        // Phase 23 — the catalog now loads through the shared movieCatalog
        // loader (singleton fetch + cache, already primes the movieResolver
        // internally) instead of a standalone dedupedFetch call here, so
        // this effect and UserProfile's favorite-decade/director insight
        // share exactly one network request and one parsed copy. Isolated
        // in its own try/catch so a catalog failure still lets the
        // "latest" fetch below proceed, matching the original behavior.
        try {
          const trendData = await loadMovieCatalog();
          setTrendingMovies(trendData);
          setMovies(trendData); // Default
          // Phase 53: reduced from 4 → 2 preloads. On slow-4G mobile, 4
          // concurrent image fetches competed with the hero backdrop and
          // deferred meaningful content. Two warms the first visible card
          // without starving the LCP element.
          trendData.slice(0, 2).forEach((m: Movie) => preloadImage(m.posterPath));
        } catch (err) {
          console.error("Failed loading movie catalog:", err);
        }

        // Fetch latest
        const latestRes = await dedupedFetch("/api/movies/latest");
        if (latestRes.ok) {
          const latestData = await latestRes.json();
          setLatestMovies(latestData);
          // Phase 20 — same priming as trending, above.
          primeMovieCache(latestData);
        }
      } catch (err) {
        console.error("Failed fetching movies from server:", err);
      } finally {
        setMoviesLoading(false);
      }
    };

    fetchPresetMovies();
  }, []);

  // 3. Monitor Search query -> Call server search API with debouncing or immediate trigger
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Revert to current standard list based on sorting
      setMovies(sortBy === "releaseDate" ? latestMovies : trendingMovies);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const delayDebounce = setTimeout(async () => {
      try {
        setSearchLoading(true);
        // Phase 21 — intelligent local search first: title/partial/year/
        // director/cast/genre matching with typo tolerance, ranked, and
        // running entirely client-side against the catalog (trendingMovies
        // is the full 500-movie catalog — /api/movies/trending returns it
        // unsliced). Falls back to the existing AI-augmented backend search
        // only when local matching comes up empty, so a well-formed query
        // never needs a network round trip at all.
        const localResults = searchMovies(trendingMovies, searchQuery).map((r) => r.movie);
        if (localResults.length > 0) {
          if (!controller.signal.aborted) {
            setMovies(localResults);
            recordRecentSearch(searchQuery);
          }
        } else {
          // Phase 22 — pass the signal through so a caller that DID
          // initiate this particular request can still cancel it; a
          // shared in-flight dedupedFetch from another caller won't be
          // cancelled by our abort, so we also re-check `aborted` before
          // committing state below (belt-and-suspenders against a slow,
          // superseded query overwriting fresher results).
          const res = await timeAsync("search-suggestion-response", () =>
            dedupedFetch(`/api/movies/search?q=${encodeURIComponent(searchQuery)}`, { signal: controller.signal })
          );
          if (res.ok && !controller.signal.aborted) {
            const results = await res.json();
            if (!controller.signal.aborted) {
              setMovies(results);
              recordRecentSearch(searchQuery);
            }
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("Search query server error:", err);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(delayDebounce);
      controller.abort();
    };
  }, [searchQuery, sortBy, trendingMovies, latestMovies]);

  // 4. Update movies list when SortBy swaps
  useEffect(() => {
    if (searchQuery.trim()) return; // Keep search results if search is active
    setMovies(sortBy === "releaseDate" ? latestMovies : trendingMovies);
  }, [sortBy, trendingMovies, latestMovies, searchQuery]);

  // 5. Watchlist syncing from Supabase (migrated from Firestore)
  useEffect(() => {
    if (!user) {
      setWatchlistMovies([]);
      setDefaultWatchlistId(null);
      setWatchlistLoading(false);
      return;
    }

    let cancelled = false;
    setWatchlistLoading(true);

    (async () => {
      const watchlistResult = await getOrCreateDefaultWatchlist(user.uid);
      if (cancelled) return;
      if (watchlistResult.error || !watchlistResult.data) {
        console.error("Failed to load watchlist:", watchlistResult.error);
        setWatchlistMovies([]);
        setWatchlistLoading(false);
        return;
      }

      setDefaultWatchlistId(watchlistResult.data.id);

      const moviesResult = await listWatchlistMovies(watchlistResult.data.id);
      if (cancelled) return;
      if (moviesResult.error) {
        console.error("Failed to load watchlist movies:", moviesResult.error);
        setWatchlistMovies([]);
        setWatchlistLoading(false);
        return;
      }

      const mapped: Movie[] = (moviesResult.data || []).map((m) => ({
        id: m.movie_id,
        title: m.title,
        posterPath: m.poster_path || "",
        releaseDate: m.release_date || "",
        voteAverage: m.vote_average || 0,
        voteCount: 0,
        genres: m.genres || [],
        overview: "",
        backdropPath: m.poster_path || "",
        addedAt: new Date(m.added_at).getTime()
      }));
      setWatchlistMovies(mapped);
      setWatchlistLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // 6. Persist personalization state locally so guests keep it across visits
  useEffect(() => {
    localStorage.setItem(FAVORITE_GENRES_KEY, JSON.stringify(favoriteGenres));
  }, [favoriteGenres]);

  // Phase 18A — persist recently searched terms locally (guest-friendly, no backend call)
  useEffect(() => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
  }, [recentSearches]);

  useEffect(() => {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recentlyViewedEntries));
  }, [recentlyViewedEntries]);

  // Phase 19 — keep ?profile=<uid> in the URL in sync with whichever
  // profile is currently being viewed, so the link stays shareable and
  // survives a refresh.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeTab === "profile" && viewedProfileUserId) {
      url.searchParams.set("profile", viewedProfileUserId);
    } else {
      url.searchParams.delete("profile");
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeTab, viewedProfileUserId]);

  // Phase 50 — same shareable-link treatment for the focused Review Detail
  // view: keep ?review=<id> in sync with whichever review is open.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeTab === "review" && viewedReviewId) {
      url.searchParams.set("review", viewedReviewId);
    } else {
      url.searchParams.delete("review");
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeTab, viewedReviewId]);

  useEffect(() => {
    localStorage.setItem(GENRE_ONBOARDING_SEEN_KEY, JSON.stringify(genreOnboardingSeen));
  }, [genreOnboardingSeen]);

  // Phase 30 — auto-show the genre onboarding the first time a signed-in
  // user with no saved genres opens their Dashboard. Guarded by
  // `genreOnboardingSeen` so it only ever auto-fires once per browser;
  // reopening later (Dashboard/Settings button) always works regardless.
  useEffect(() => {
    if (activeTab === "dashboard" && user && favoriteGenres.length === 0 && !genreOnboardingSeen) {
      setShowGenreOnboarding(true);
      setGenreOnboardingSeen(true);
    }
  }, [activeTab, user, favoriteGenres.length, genreOnboardingSeen]);

  // 7. On sign-in, hydrate favourite genres from Supabase profiles.favorite_genres.
  // If the account has saved genres, they win over whatever is in localStorage
  // (account follows the user across devices). If the account has none but the
  // guest picked some locally, push them up so they aren't lost.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const result = await getProfileWithGenres(user.uid);
        if (result.error) { console.error("Failed to sync genre preferences:", result.error); return; }
        const saved = result.data?.favorite_genres ?? [];
        if (saved.length > 0) {
          setFavoriteGenres(saved);
        } else if (favoriteGenres.length > 0) {
          await saveFavoriteGenres(user.uid, favoriteGenres);
        }
      } catch (err) {
        console.error("Failed to sync genre preferences:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fast lookup set for "is this movie saved" checks used by card quick-actions
  const watchlistIds = useMemo(() => new Set(watchlistMovies.map((m) => m.id)), [watchlistMovies]);

  const { showToast } = useToast();

  // Quick-add/remove from any MovieCard (Trending/Popular/Latest/Recommended rails + grid)
  // without leaving the current view. Mirrors the toggle logic in MovieDetail.
  const handleQuickToggleWatchlist = React.useCallback(async (movie: Movie) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }

    let watchlistId = defaultWatchlistId;
    if (!watchlistId) {
      const ensured = await getOrCreateDefaultWatchlist(user.uid);
      if (ensured.error || !ensured.data) {
        console.error("Quick watchlist toggle failed:", ensured.error);
        showToast("Couldn't update your watchlist — please try again.", "error");
        return;
      }
      watchlistId = ensured.data.id;
      setDefaultWatchlistId(watchlistId);
    }

    const alreadySaved = watchlistIds.has(movie.id);

    // Optimistic update: Supabase isn't wired to a live listener here (see
    // task 10 note), so the UI updates immediately rather than waiting on
    // the round trip, then rolls back if the write actually fails.
    setWatchlistMovies((prev) => (alreadySaved ? prev.filter((m) => m.id !== movie.id) : [movie, ...prev]));

    try {
      if (alreadySaved) {
        const result = await removeMovieFromWatchlist(watchlistId, movie.id);
        if (result.error) throw new Error(result.error);
        showToast(`Removed "${movie.title}" from your watchlist.`, "success");
      } else {
        const result = await addMovieToWatchlist(watchlistId, {
          movie_id: movie.id,
          title: movie.title,
          poster_path: movie.posterPath,
          release_date: movie.releaseDate,
          vote_average: movie.voteAverage,
          genres: movie.genres || []
        });
        if (result.error) throw new Error(result.error);
        showToast(`Added "${movie.title}" to your watchlist.`, "success");
      }
    } catch (err) {
      console.error("Quick watchlist toggle failed:", err);
      setWatchlistMovies((prev) => (alreadySaved ? [movie, ...prev] : prev.filter((m) => m.id !== movie.id)));
      showToast("Couldn't update your watchlist — please try again.", "error");
    }
  }, [user, defaultWatchlistId, watchlistIds, showToast]);

  // Toggle a favorite genre on/off. Works for guests (localStorage only, via
  // the persistence effect above) and signed-in users (also mirrored to Firestore).
  const toggleFavoriteGenre = async (genre: string) => {
    const updated = favoriteGenres.includes(genre)
      ? favoriteGenres.filter((g) => g !== genre)
      : [...favoriteGenres, genre];
    setFavoriteGenres(updated);
    if (user) {
      try {
        const result = await saveFavoriteGenres(user.uid, updated);
        if (result.error) console.error("Failed to save genre preference:", result.error);
      } catch (err) {
        console.error("Failed to save genre preference:", err);
      }
    }
  };

  // Track a movie as recently viewed (most-recent-first, deduped, capped) —
  // device-local only, no extra Firestore writes per view.
  const trackRecentlyViewed = (movie: Movie) => {
    setRecentlyViewedEntries((prev) => addRecentlyViewedEntry(prev, movie.id));
  };

  // Phase 18A — Recently Searched: records a committed query, case-insensitive
  // de-dup, most-recent-first, capped so the chip row stays scannable.
  const recordRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const withoutCurrent = prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
      return [trimmed, ...withoutCurrent].slice(0, 8);
    });
  };

  const clearRecentSearches = () => setRecentSearches([]);

  // "Popular" rail: same catalog as Trending, re-cut by raw score so the row
  // tells a different story (acclaim vs. momentum) without a new backend route.
  const popularMovies = useMemo(() => {
    return [...trendingMovies].sort((a, b) => b.voteAverage - a.voteAverage || b.voteCount - a.voteCount);
  }, [trendingMovies]);

  // Weighted genre affinity across every personalization signal we have:
  // explicit favorites count most, watchlist next, recently-viewed least.
  const genreAffinity = useMemo(() => {
    const map = new Map<string, number>();
    favoriteGenres.forEach((g) => map.set(g, (map.get(g) || 0) + 3));
    watchlistMovies.forEach((m) => m.genres?.forEach((g) => map.set(g, (map.get(g) || 0) + 2)));
    recentlyViewed.forEach((m) => m.genres?.forEach((g) => map.set(g, (map.get(g) || 0) + 1)));
    return map;
  }, [favoriteGenres, watchlistMovies, recentlyViewed]);

  const topAffinityGenres = useMemo(() => {
    return Array.from(genreAffinity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);
  }, [genreAffinity]);

  // "Recommended" rail: personalized to favorite genres + watchlist + recently
  // viewed when we have signal, otherwise a diverse, high-rated fallback cut.
  // Diversity pass: widen the relevance-sorted candidate pool 2x past the
  // display count, then seeded-shuffle just that widened set — every shown
  // movie is still highly relevant, but which subset appears varies by session.
  const recommendedMovies = useMemo(() => {
    if (import.meta.env.DEV) startTiming("recommendation-generation");
    const sourcePool = trendingMovies.length ? trendingMovies : latestMovies;
    if (sourcePool.length === 0) {
      if (import.meta.env.DEV) endTiming("recommendation-generation");
      return [];
    }

    const DISPLAY_COUNT = 16;

    if (topAffinityGenres.length > 0) {
      const lowerTop = topAffinityGenres.map((g) => g.toLowerCase());
      const matches = sourcePool.filter(
        (m) => !watchlistIds.has(m.id) && m.genres?.some((g) => lowerTop.includes(g.toLowerCase()))
      );
      if (matches.length >= 4) {
        const ranked = [...matches].sort((a, b) => b.voteAverage - a.voteAverage);
        const widened = ranked.slice(0, DISPLAY_COUNT * 2);
        const result = seededShuffle(widened, sessionSeed).slice(0, DISPLAY_COUNT);
        if (import.meta.env.DEV) endTiming("recommendation-generation");
        return result;
      }
    }

    // Fallback: a diverse, high-rated cut offset from the Trending rail so it
    // doesn't just look like a duplicate of row one.
    const fallbackRanked = [...sourcePool]
      .filter((m) => m.voteAverage >= 7)
      .sort((a, b) => b.voteAverage - a.voteAverage);
    const widenedFallback = fallbackRanked.slice(4, 4 + DISPLAY_COUNT * 2);
    const fallbackResult = seededShuffle(widenedFallback, sessionSeed).slice(0, DISPLAY_COUNT);
    if (import.meta.env.DEV) endTiming("recommendation-generation");
    return fallbackResult;
  }, [trendingMovies, latestMovies, topAffinityGenres, watchlistIds, sessionSeed]);

  // Surfaces *why* the Recommended row looks the way it does, so it reads as
  // intentional curation rather than a random slice.
  const recommendationReason = topAffinityGenres[0] || null;

  // Phase 18A — shared confidence signal for personalized rails (Recommended,
  // Daily Picks). Mirrors the tiering already used by the AI Oracle
  // (services/recommendations.ts) but computed synchronously from local state
  // only, so it can drive plain rail subtitles with no extra network calls.
  const discoveryConfidence: "high" | "medium" | "low" = useMemo(() => {
    const signalCount =
      (favoriteGenres.length > 0 ? 1 : 0) +
      (watchlistMovies.length > 0 ? 1 : 0) +
      (recentlyViewed.length > 0 ? 1 : 0) +
      (topAffinityGenres.length >= 2 ? 1 : 0);
    if (signalCount >= 3) return "high";
    if (signalCount >= 1) return "medium";
    return "low";
  }, [favoriteGenres, watchlistMovies, recentlyViewed, topAffinityGenres]);

  const recommendedMovieIds = useMemo(() => new Set(recommendedMovies.map((m) => m.id)), [recommendedMovies]);

  // "Expand Your Horizons" — controlled genre exploration OUTSIDE the user's
  // top genres. Separate, additive rail; does not alter Recommended's logic.
  const expandHorizonsMovies = useMemo(() => {
    const pool = trendingMovies.length ? trendingMovies : latestMovies;
    if (pool.length === 0 || topAffinityGenres.length === 0) return [];
    const lowerTop = new Set(topAffinityGenres.map((g) => g.toLowerCase()));
    const outside = pool.filter(
      (m) => !watchlistIds.has(m.id) && m.voteAverage >= 7 &&
        m.genres?.length && !m.genres.some((g) => lowerTop.has(g.toLowerCase()))
    );
    const ranked = [...outside].sort((a, b) => b.voteAverage - a.voteAverage);
    return seededShuffle(ranked.slice(0, 24), sessionSeed).slice(0, 12);
  }, [trendingMovies, latestMovies, topAffinityGenres, watchlistIds, sessionSeed]);

  // Combined, de-duplicated pool used for genre sections / year options / hidden gems
  // (purely client-side reuse of data we already fetched — no extra API calls)
  const combinedMoviePool = useMemo(() => {
    const map = new Map<string, Movie>();
    [...trendingMovies, ...latestMovies].forEach((m) => map.set(m.id, m));
    return Array.from(map.values());
  }, [trendingMovies, latestMovies]);

  // Phase 18A — "Daily Picks For You": a second, date-seeded personalization
  // row. Deliberately excludes anything already in Recommended so the two
  // rows read as complementary rather than duplicated. Refreshes once every
  // 24h because the shuffle seed is derived from the calendar date, not the
  // session — reuses the same signals as Recommended, no new API calls.
  const dailyPicksMovies = useMemo(() => {
    if (combinedMoviePool.length === 0) return [];
    const DISPLAY_COUNT = 12;
    const base = combinedMoviePool.filter(
      (m) => !watchlistIds.has(m.id) && !recommendedMovieIds.has(m.id)
    );

    if (topAffinityGenres.length > 0) {
      const lowerTop = topAffinityGenres.map((g) => g.toLowerCase());
      const matches = base.filter((m) => m.genres?.some((g) => lowerTop.includes(g.toLowerCase())));
      if (matches.length >= 4) {
        const ranked = [...matches].sort((a, b) => b.voteAverage - a.voteAverage);
        return seededShuffle(ranked.slice(0, DISPLAY_COUNT * 2), dailySeed).slice(0, DISPLAY_COUNT);
      }
    }

    const fallbackRanked = base
      .filter((m) => m.voteAverage >= 6.5)
      .sort((a, b) => b.voteAverage - a.voteAverage);
    return seededShuffle(fallbackRanked.slice(0, DISPLAY_COUNT * 2), dailySeed).slice(0, DISPLAY_COUNT);
  }, [combinedMoviePool, watchlistIds, recommendedMovieIds, topAffinityGenres, dailySeed]);

  // Dynamic "Browse by Genre" rows: only genres with enough titles to feel like
  // a real row, capped so the homepage doesn't sprawl forever.
  const genreSections = useMemo(() => {
    return ALL_GENRES.filter((g) => g !== "All")
      .map((g) => ({
        genre: g,
        movies: combinedMoviePool.filter((m) => m.genres?.some((mg) => mg.toLowerCase() === g.toLowerCase()))
      }))
      .filter((section) => section.movies.length >= 4)
      .slice(0, 6);
  }, [combinedMoviePool]);

  // Years actually present in the fetched data, for the release-year filter
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    combinedMoviePool.forEach((m) => {
      if (m.releaseDate) years.add(m.releaseDate.split("-")[0]);
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [combinedMoviePool]);

  // Decades present in the catalog, for the advanced filter panel
  const availableDecades = useMemo(() => {
    const decades = new Set<number>();
    combinedMoviePool.forEach((m) => {
      const year = parseInt(m.releaseDate?.split("-")[0] || "", 10);
      if (!isNaN(year)) decades.add(Math.floor(year / 10) * 10);
    });
    return Array.from(decades).sort((a, b) => b - a);
  }, [combinedMoviePool]);

  // Directors present in the catalog, alphabetical
  const availableDirectors = useMemo(() => {
    const directors = new Set<string>();
    combinedMoviePool.forEach((m) => {
      if (m.director) directors.add(m.director);
    });
    return Array.from(directors).sort((a, b) => a.localeCompare(b));
  }, [combinedMoviePool]);

  // Actors present in 2+ catalog movies — capped list so the dropdown stays
  // usable instead of listing every one-off cast credit.
  const availableActors = useMemo(() => {
    const freq = new Map<string, number>();
    combinedMoviePool.forEach((m) => {
      m.cast?.forEach((c) => freq.set(c.name, (freq.get(c.name) ?? 0) + 1));
    });
    return Array.from(freq.entries())
      .filter(([, count]) => count >= 2)
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b));
  }, [combinedMoviePool]);

  // "Hidden Gems" recommendation row: high rating, lower vote count — curated
  // entirely from data already on hand, no new endpoint required.
  // Diversity pass applied the same way as Recommended (see above).
  const hiddenGemMovies = useMemo(() => {
    if (combinedMoviePool.length === 0) return [];
    const sortedByVotes = [...combinedMoviePool].sort((a, b) => a.voteCount - b.voteCount);
    const medianVoteCount = sortedByVotes[Math.floor(sortedByVotes.length / 2)]?.voteCount ?? 0;
    const ranked = combinedMoviePool
      .filter((m) => m.voteAverage >= 7.5 && m.voteCount > 0 && m.voteCount <= medianVoteCount)
      .sort((a, b) => b.voteAverage - a.voteAverage);
    return seededShuffle(ranked.slice(0, 32), sessionSeed).slice(0, 16);
  }, [combinedMoviePool, sessionSeed]);

  // Discovery collections tier — curated client-side from existing pool, no
  // new API calls. Sequentially deduplicated: each collection below excludes
  // movies already claimed by an earlier one in this list, so a title doesn't
  // simultaneously clutter Award Winners AND Critically Acclaimed AND Feel-Good.
  // Trending/Popular/Latest/decade/director rails are intentionally excluded
  // from this dedup chain — those are meant to be canonical "full" browses
  // where a movie should appear if it truly qualifies, overlap and all.
  const usedInCollections = new Set<string>();
  const claim = (movies: Movie[]) => {
    movies.forEach((m) => usedInCollections.add(m.id));
    return movies;
  };

  const awardWinners = useMemo(() => {
    const awardKeywords = ["biography", "history", "drama"];
    const result = combinedMoviePool
      .filter((m) => m.voteAverage >= 8.0 && m.genres?.some((g) => awardKeywords.includes(g.toLowerCase())))
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool]);

  const criticallyAcclaimed = useMemo(() => {
    const result = combinedMoviePool
      .filter((m) => m.voteAverage >= 8.4 && !usedInCollections.has(m.id))
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool, awardWinners]);

  // "Underrated Movies" — distinct from Hidden Gems: solid-but-not-top ratings
  // (6.5–7.8) paired with very low vote counts, i.e. genuinely flew under the
  // radar rather than "great and slightly under-discussed."
  const underratedMovies = useMemo(() => {
    if (combinedMoviePool.length === 0) return [];
    const sortedByVotes = [...combinedMoviePool].sort((a, b) => a.voteCount - b.voteCount);
    const lowQuartileVoteCount = sortedByVotes[Math.floor(sortedByVotes.length / 4)]?.voteCount ?? 0;
    const result = combinedMoviePool
      .filter((m) =>
        m.voteAverage >= 6.5 && m.voteAverage < 7.8 &&
        m.voteCount > 0 && m.voteCount <= lowQuartileVoteCount &&
        !usedInCollections.has(m.id)
      )
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool, criticallyAcclaimed]);

  const familyNight = useMemo(() => {
    const result = combinedMoviePool
      .filter((m) => m.genres?.some((g) => ["animation", "family"].includes(g.toLowerCase())) && !usedInCollections.has(m.id))
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool, underratedMovies]);

  const mindBending = useMemo(() => {
    const mbKeywords = ["sci-fi", "mystery", "thriller"];
    const result = combinedMoviePool
      .filter((m) => m.voteAverage >= 7.5 && m.genres?.some((g) => mbKeywords.includes(g.toLowerCase())) && !usedInCollections.has(m.id))
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool, familyNight]);

  const basedOnTrueStories = useMemo(() => {
    const trueStoryKeywords = ["biography", "history"];
    const result = combinedMoviePool
      .filter((m) => m.genres?.some((g) => trueStoryKeywords.includes(g.toLowerCase())) && !usedInCollections.has(m.id))
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool, mindBending]);

  const feelGood = useMemo(() => {
    const feelGoodKeywords = ["comedy", "romance", "animation", "family"];
    const result = combinedMoviePool
      .filter((m) => m.voteAverage >= 7.5 && m.genres?.some((g) => feelGoodKeywords.includes(g.toLowerCase())) && !usedInCollections.has(m.id))
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool, basedOnTrueStories]);

  const internationalCinema = useMemo(() => {
    const englishDirectors = new Set([
      "christopher nolan", "steven spielberg", "david fincher", "martin scorsese",
      "quentin tarantino", "peter jackson", "ridley scott", "james cameron",
      "peter weir", "ron howard", "frank darabont", "jonathan demme",
      "danny boyle", "adam mckay", "barry jenkins", "martin mcdonagh",
      "noah baumbach", "dan gilroy", "lenny abrahamson", "garth davis",
      "mel gibson", "dean deblois, chris sanders", "andrew stanton", "brad bird",
      "john lasseter", "pete docter", "andrew stanton", "josh safdiej, benny safdie"
    ]);
    const result = combinedMoviePool
      .filter((m) => m.director && !englishDirectors.has(m.director.toLowerCase()) && !usedInCollections.has(m.id))
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool, feelGood]);

  const cultClassics = useMemo(() => {
    const cutoff = new Date("2010-01-01").toISOString().split("T")[0];
    const result = combinedMoviePool
      .filter((m) => (m.releaseDate || "") < cutoff && m.voteAverage >= 8.0 && !usedInCollections.has(m.id))
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool, internationalCinema]);

  // Premium collection highlights (Phase 17A) — reuse the same
  // filter/sort/slice pattern and continue the existing sequential-dedup
  // chain rather than introducing a new selection mechanism.
  const staffPicks = useMemo(() => {
    const result = combinedMoviePool
      .filter((m) => m.voteAverage >= 8.2 && !usedInCollections.has(m.id))
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool, cultClassics]);

  const editorsChoice = useMemo(() => {
    // A slightly different cut than Staff Picks: rewards vote *count* alongside
    // rating, surfacing well-established favorites rather than pure top-rated.
    const result = combinedMoviePool
      .filter((m) => m.voteAverage >= 7.6 && m.voteCount >= 500 && !usedInCollections.has(m.id))
      .sort((a, b) => (b.voteAverage * Math.log10(b.voteCount + 1)) - (a.voteAverage * Math.log10(a.voteCount + 1)))
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool, staffPicks]);

  const weekendMovies = useMemo(() => {
    const weekendKeywords = ["adventure", "action", "comedy", "family"];
    const result = combinedMoviePool
      .filter((m) => m.genres?.some((g) => weekendKeywords.includes(g.toLowerCase())) && !usedInCollections.has(m.id))
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
    return claim(result);
  }, [combinedMoviePool, editorsChoice]);

  // Decade explore rails — not part of the collections dedup chain by design;
  // these are canonical "full browse of an era" rows.
  const decade1990s = useMemo(() => {
    return combinedMoviePool
      .filter((m) => (m.releaseDate || "") >= "1990-01-01" && (m.releaseDate || "") < "2000-01-01")
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
  }, [combinedMoviePool]);

  const decade2000s = useMemo(() => {
    return combinedMoviePool
      .filter((m) => (m.releaseDate || "") >= "2000-01-01" && (m.releaseDate || "") < "2010-01-01")
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
  }, [combinedMoviePool]);

  const decade2010s = useMemo(() => {
    return combinedMoviePool
      .filter((m) => (m.releaseDate || "") >= "2010-01-01" && (m.releaseDate || "") < "2020-01-01")
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
  }, [combinedMoviePool]);

  // Director spotlight rails — canonical full browse of that director's work
  // in the catalog; also not part of the collections dedup chain.
  const nolanMovies = useMemo(() => {
    return combinedMoviePool
      .filter((m) => m.director?.toLowerCase() === "christopher nolan")
      .sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));
  }, [combinedMoviePool]);

  const spielbergMovies = useMemo(() => {
    return combinedMoviePool
      .filter((m) => m.director?.toLowerCase() === "steven spielberg")
      .sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));
  }, [combinedMoviePool]);

  const tarantinoMovies = useMemo(() => {
    return combinedMoviePool
      .filter((m) => m.director?.toLowerCase() === "quentin tarantino")
      .sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));
  }, [combinedMoviePool]);

  // Filter (genre + rating + year + runtime + advanced panel filters) and sort the active list
  const filteredMovies = useMemo(() => {
    let result = movies.filter((m) => {
      if (selectedGenre !== "All" && !m.genres?.some((g) => g.toLowerCase() === selectedGenre.toLowerCase())) return false;
      if (minRating > 0 && m.voteAverage < minRating) return false;
      if (selectedYear !== "All" && m.releaseDate?.split("-")[0] !== selectedYear) return false;
      if (maxRuntime > 0 && m.runtime && m.runtime > maxRuntime) return false;
      if (panelGenres.length > 0 && !m.genres?.some((g) => panelGenres.some((pg) => pg.toLowerCase() === g.toLowerCase()))) return false;
      if (selectedDecade !== "All") {
        const year = parseInt(m.releaseDate?.split("-")[0] || "", 10);
        const decadeStart = parseInt(selectedDecade, 10);
        if (isNaN(year) || year < decadeStart || year >= decadeStart + 10) return false;
      }
      if (selectedDirector !== "All" && m.director !== selectedDirector) return false;
      if (selectedActor !== "All" && !m.cast?.some((c) => c.name === selectedActor)) return false;
      return true;
    });

    if (sortBy === "rating-desc") {
      result = [...result].sort((a, b) => b.voteAverage - a.voteAverage);
    } else if (sortBy === "rating-asc") {
      result = [...result].sort((a, b) => a.voteAverage - b.voteAverage);
    } else if (sortBy === "rating") {
      result = [...result].sort((a, b) => b.voteAverage - a.voteAverage);
    } else if (sortBy === "alphabetical") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "alphabetical-desc") {
      result = [...result].sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === "releaseDate") {
      result = [...result].sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
    } else if (sortBy === "releaseDate-asc") {
      result = [...result].sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));
    }

    return result;
  }, [movies, selectedGenre, minRating, selectedYear, maxRuntime, panelGenres, selectedDecade, selectedDirector, selectedActor, sortBy]);

  const activeFilterCount = [
    selectedGenre !== "All",
    minRating > 0,
    selectedYear !== "All",
    maxRuntime > 0,
    panelGenres.length > 0,
    selectedDecade !== "All",
    selectedDirector !== "All",
    selectedActor !== "All",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSelectedGenre("All");
    setMinRating(0);
    setSelectedYear("All");
    setMaxRuntime(0);
    setPanelGenres([]);
    setSelectedDecade("All");
    setSelectedDirector("All");
    setSelectedActor("All");
    setSearchQuery("");
  };

  const togglePanelGenre = (genre: string) => {
    setPanelGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  // Genres actually present in the user's saved list, for the watchlist genre filter
  const watchlistGenresAvailable = useMemo(() => {
    const set = new Set<string>();
    watchlistMovies.forEach((m) => m.genres?.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [watchlistMovies]);

  // Sorted + filtered view of the watchlist (separate from the raw synced list,
  // which is still used for the "is this saved" lookups and the true empty state)
  const visibleWatchlistMovies = useMemo(() => {
    let list = watchlistMovies;
    if (watchlistGenreFilter !== "All") {
      list = list.filter((m) => m.genres?.some((g) => g.toLowerCase() === watchlistGenreFilter.toLowerCase()));
    }
    const sorted = [...list];
    if (watchlistSortBy === "rating") sorted.sort((a, b) => b.voteAverage - a.voteAverage);
    else if (watchlistSortBy === "alphabetical") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (watchlistSortBy === "releaseDate") sorted.sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
    else sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); // dateAdded, newest first
    return sorted;
  }, [watchlistMovies, watchlistGenreFilter, watchlistSortBy]);

  // Lightweight stats surfaced above the watchlist grid — pure aggregation
  // over data already in memory, no extra fetch.
  const watchlistStats = useMemo(() => {
    if (watchlistMovies.length === 0) return null;
    const avgRating = watchlistMovies.reduce((sum, m) => sum + m.voteAverage, 0) / watchlistMovies.length;
    const genreCounts = new Map<string, number>();
    watchlistMovies.forEach((m) => m.genres?.forEach((g) => genreCounts.set(g, (genreCounts.get(g) || 0) + 1)));
    let topGenre: string | null = null;
    let topCount = 0;
    genreCounts.forEach((count, genre) => {
      if (count > topCount) {
        topCount = count;
        topGenre = genre;
      }
    });
    return { count: watchlistMovies.length, avgRating, topGenre };
  }, [watchlistMovies]);

  // Enhanced Hero: rotates through the top N trending movies instead of a
  // single static pick. `featuredMovie` is kept as the name every downstream
  // consumer (CTA handlers, watchlist check, etc.) already reads, so nothing
  // else in the billboard's action buttons needs to change.
  const [heroIndex, setHeroIndex] = useState<number>(0);
  const [heroPlaying, setHeroPlaying] = useState<boolean>(true);
  // Previously `trendingMovies.slice(0, 5)` — always the identical top-5
  // trending movies in the identical order, every single day. Reusing the
  // same `dailySeed` already used for Daily Picks elsewhere in this file
  // gives a wider, still-deterministic-per-day rotation: the same 5 movies
  // (and order) all day for a given user, a different 5 tomorrow.
  const heroSlides = useMemo(
    () => seededShuffle(trendingMovies.slice(0, 20), dailySeed).slice(0, 5),
    [trendingMovies, dailySeed]
  );

  // Predictively preload the *next* hero slide's backdrop so the rotation
  // (auto or manual) never shows a blank frame while the image loads.
  // Phase 53: use /w1280/ instead of /original/ — 1280 px is more than
  // sufficient for the 420–520 px hero container and saves 2–5 MB per image
  // on mobile (where /original/ serves a 3840×2160 JPEG nobody can see).
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const nextIndex = (heroIndex + 1) % heroSlides.length;
    const url = heroSlides[nextIndex]?.backdropPath?.replace("/original/", "/w1280/");
    preloadImage(url);
  }, [heroIndex, heroSlides]);
  const safeHeroIndex = heroSlides.length > 0 ? heroIndex % heroSlides.length : 0;
  const featuredMovie = heroSlides[safeHeroIndex] ?? trendingMovies[0];

  const goToHeroSlide = (index: number) => {
    if (heroSlides.length === 0) return;
    setHeroIndex(((index % heroSlides.length) + heroSlides.length) % heroSlides.length);
  };

  // Auto-advance every 3.5s while playing and more than one slide exists
  // (Phase 32: doubled speed from the previous 7s interval). Paused
  // entirely (no timer at all) when heroPlaying is false, rather than
  // just visually frozen — avoids any background work while paused.
  useEffect(() => {
    if (!heroPlaying || heroSlides.length <= 1) return;
    const id = setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroSlides.length);
    }, 3500);
    return () => clearInterval(id);
  }, [heroPlaying, heroSlides.length]);

 // Shared "open movie" flow: instant transition to the detail view using
  // whatever data we already have, then enrich in the background.
  const handleSelectMovie = React.useCallback(async (movie: Movie) => {
    try {
      setSelectedMovie(movie); // Instant transition
      trackRecentlyViewed(movie);
      const res = await timeAsync(`movie-detail-load-${movie.id}`, () =>
        dedupedFetch(`/api/movies/detail/${movie.id}`)
      );
      if (res.ok) {
        const fullDetail = await res.json();
        setSelectedMovie(fullDetail); // Enrich with real cast or AI generated facts
      }
    } catch (err) {
      console.error("Failed fetching movie details:", err);
    }
  }, []);

  // Stable "is this movie saved" check — passed to every MovieRail instance.
  // Memoized against watchlistIds so it only changes when the set itself changes,
  // instead of creating a brand-new closure on every render.
  const isMovieSaved = React.useCallback((id: string) => watchlistIds.has(id), [watchlistIds]);

  // Shared trailer modal state — one instance for the whole app, opened by
  // any MovieCard via the MovieCardPreferencesProvider below.
  const [trailerMovie, setTrailerMovie] = useState<Movie | null>(null);
  const openTrailer = React.useCallback((movie: Movie) => setTrailerMovie(movie), []);

  // Phase 21 — "Settings" in the account dropdown routes to the Profile tab
  // (where account editing already lives) and opens it directly in edit
  // mode. One-shot flag: UserProfile calls onEditModeConsumed once it has
  // triggered edit mode so this doesn't reopen on every profile revisit.
  const [openProfileInEditMode, setOpenProfileInEditMode] = useState(false);

  return (
    <ThemeProvider>
    <MovieCardPreferencesProvider favoriteGenres={favoriteGenres} openTrailer={openTrailer}>
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased select-none pb-12">
      {/* Skip link: first focusable element for keyboard/screen-reader users */}
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Background radial highlight */}
      <div className="pointer-events-none fixed top-0 left-0 right-0 h-[600px] bg-[radial-gradient(circle_at_top,_rgba(220,38,38,0.08)_0%,_transparent_60%)] z-0" />

      {/* Global Header Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedMovie(null); // Return to list
          setViewedProfileUserId(null); // Phase 19 — Profile nav click always means "my profile"
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenAuth={() => setAuthOpen(true)}
        searchLoading={searchLoading}
        suggestionPool={combinedMoviePool}
        onSelectMovie={handleSelectMovie}
        onOpenSettings={() => {
          setActiveTab("settings");
          setSelectedMovie(null);
          setViewedProfileUserId(null);
        }}
        onViewNotifications={() => {
          setActiveTab("notifications");
          setSelectedMovie(null);
          setViewedProfileUserId(null);
        }}
        notificationUnreadCount={notificationUnreadCount}
      />

      {/* Auth Modal Overlay Popup — Phase 22: only mounted after first open (see hasOpenedAuth above) */}
      {hasOpenedAuth && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={authOpen}
            onClose={() => setAuthOpen(false)}
            onAuthSuccess={({ isNewAccount }) => {
              if (isNewAccount) {
                setShowGenreOnboarding(true);
                setGenreOnboardingSeen(true);
              }
            }}
          />
        </Suspense>
      )}

      {/* Phase 30 — genre onboarding modal: auto-shown for new signups and
          first-time Dashboard visits with no saved genres (see effects
          above), or reopened manually from Dashboard. */}
      <GenreOnboardingModal
        isOpen={showGenreOnboarding}
        favoriteGenres={favoriteGenres}
        onToggleGenre={toggleFavoriteGenre}
        onSave={() => setShowGenreOnboarding(false)}
        onSkip={() => setShowGenreOnboarding(false)}
      />

      {/* Responsive layout wrapper */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`relative z-10 pt-24 ${
          activeTab === "explore" || activeTab === "library" ? "md:pt-48" : "md:pt-28"
        }`}
      >
        <AnimatePresence mode="wait">



          {/* 1. SEPARATE MOVIE DETAILS PAGE */}
          {selectedMovie ? (
            <Suspense fallback={<TabLoadingFallback />}>
              <MovieDetail
                key={`detail-view-${selectedMovie.id}`}
                movie={selectedMovie}
                onBack={() => {
                  setSelectedMovie(null);
                  // Refetch specific list details if required
                }}
                onOpenAuth={() => setAuthOpen(true)}
                relatedPool={combinedMoviePool}
                onSelectMovie={handleSelectMovie}
                watchlistIds={watchlistIds}
                onToggleSave={handleQuickToggleWatchlist}
              />
            </Suspense>
          ) : activeTab === "explore" ? (
            /* 2. EXPLORE VIEW (HOME PAGE) */
            <motion.div
              key="explore-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              {/* Phase 30 — the genre picker used to live here permanently;
                  it's now GenreOnboardingModal, triggered automatically
                  (new signup, first Dashboard visit) or reopened from
                  Dashboard. See the modal render near AuthModal below. */}
              {/* Cinematic hero skeleton while the first fetch is in flight */}
              {!searchQuery && moviesLoading && !featuredMovie && (
                <div className="max-w-[1600px] mx-auto px-6 mt-4">
                  <div className="skeleton-shimmer relative rounded-3xl border border-white/[0.06] h-[380px] sm:h-[430px] md:h-[480px]" />
                </div>
              )}

              {/* Giant Billboard Featured Header (Widescreen cinematic layout) */}
              {!searchQuery && featuredMovie && (
                <div
                  id="featured-board"
                  className="max-w-[1600px] mx-auto px-6 mt-4"
                  onMouseEnter={() => setHeroPlaying(false)}
                  onMouseLeave={() => setHeroPlaying(true)}
                >
                  <div className="relative rounded-3xl overflow-hidden border border-white/[0.06] bg-neutral-950 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.8)] h-[420px] sm:h-[460px] md:h-[520px] flex items-end">
                    {/* Soft ambient glow behind the featured art, cross-fades with the slide */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 opacity-60 blur-3xl scale-110 transition-opacity duration-700"
                      style={{
                        background:
                          "radial-gradient(circle at 30% 40%, rgba(220,38,38,0.25), transparent 60%), radial-gradient(circle at 80% 70%, rgba(120,53,15,0.14), transparent 60%)",
                      }}
                    />

                    <AnimatePresence mode="wait">
                      <motion.img
                        key={featuredMovie.id}
                        src={featuredMovie.backdropPath?.replace("/original/", "/w1280/")}
                        alt=""
                        role="presentation"
                        referrerPolicy="no-referrer"
                        fetchPriority="high"
                        decoding="async"
                        initial={{ opacity: 0, scale: 1.06 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        transition={{ duration: 0.45, ease: "easeInOut" }}
                        onError={(e) => { (e.target as HTMLImageElement).src = featuredMovie.posterPath; }}
                        className="absolute inset-0 h-full w-full object-cover brightness-[0.35]"
                      />
                    </AnimatePresence>
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/70 via-transparent to-transparent" />

                    {/* Prev / Next manual controls */}
                    {heroSlides.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => goToHeroSlide(safeHeroIndex - 1)}
                          aria-label="Previous featured movie"
                          className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-neutral-950/60 border border-neutral-700/60 text-white hover:bg-neutral-900 backdrop-blur-md transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => goToHeroSlide(safeHeroIndex + 1)}
                          aria-label="Next featured movie"
                          className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-neutral-950/60 border border-neutral-700/60 text-white hover:bg-neutral-900 backdrop-blur-md transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={featuredMovie.id}
                        initial="hidden"
                        animate="show"
                        exit={{ opacity: 0, y: -8, transition: { duration: 0.25 } }}
                        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } } }}
                        className="relative z-10 p-8 md:p-12 text-left max-w-2xl"
                      >
                        <motion.div
                          variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/20 px-3.5 py-1.5 text-xs font-bold text-amber-400 mb-4 uppercase tracking-wider"
                        >
                          <span className="relative flex h-2 w-2" aria-hidden="true">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                          </span>
                          Featured Today
                        </motion.div>

                        <motion.h1
                          variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                          className="text-3xl md:text-6xl font-black tracking-tight text-white leading-[1.05] [text-shadow:0_2px_40px_rgba(220,38,38,0.25),0_1px_3px_rgba(0,0,0,0.85)]"
                        >
                          {featuredMovie.title}
                        </motion.h1>

                        <motion.div
                          variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                          className="flex flex-wrap items-center gap-2 mt-4 text-xs text-neutral-300"
                        >
                          <span className="flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 backdrop-blur-md px-2 py-1 rounded-lg border border-amber-500/10">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {featuredMovie.voteAverage.toFixed(1)}
                          </span>
                          <span className="text-neutral-400">{featuredMovie.releaseDate?.split("-")[0]}</span>
                          {featuredMovie.runtime ? (
                            <span className="flex items-center gap-1 text-neutral-400">
                              <Clock3 className="h-3 w-3" />
                              {Math.floor(featuredMovie.runtime / 60)}h {featuredMovie.runtime % 60}m
                            </span>
                          ) : null}
                          {featuredMovie.genres?.slice(0, 3).map((g) => (
                            <span
                              key={g}
                              className="hidden sm:inline-flex rounded-full border border-neutral-700/60 bg-neutral-900/50 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-300"
                            >
                              {g}
                            </span>
                          ))}
                        </motion.div>

                        <motion.p
                          variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                          className="text-neutral-400 text-xs sm:text-sm mt-3 line-clamp-3 leading-relaxed"
                        >
                          {featuredMovie.overview}
                        </motion.p>

                        <motion.div
                          variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                          className="mt-6 flex flex-wrap gap-3"
                        >
                          <motion.button
                            id="billboard-action-detail"
                            onClick={() => handleSelectMovie(featuredMovie)}
                            whileHover={{ scale: 1.035 }}
                            whileTap={{ scale: 0.97 }}
                            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-650 to-red-600 hover:from-red-600 hover:to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-[#ffffff] shadow-[0_10px_40px_-8px_rgba(220,38,38,0.7)] hover:shadow-[0_14px_50px_-8px_rgba(220,38,38,0.9)] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400"
                          >
                            {featuredMovie.trailerUrl ? <PlayCircle className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                            {featuredMovie.trailerUrl ? "Watch Trailer" : "View Details"}
                          </motion.button>
                          <motion.button
                            id="billboard-action-watchlist"
                            onClick={() => handleQuickToggleWatchlist(featuredMovie)}
                            aria-pressed={watchlistIds.has(featuredMovie.id)}
                            whileHover={{ scale: 1.035 }}
                            whileTap={{ scale: 0.97 }}
                            className="flex items-center gap-2 rounded-2xl bg-white/[0.07] border border-white/15 backdrop-blur-md px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-white/[0.12] hover:border-white/25 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                          >
                            <Bookmark className={`h-4.5 w-4.5 ${watchlistIds.has(featuredMovie.id) ? "fill-red-400 text-red-400" : ""}`} />
                            {watchlistIds.has(featuredMovie.id) ? "In Watchlist" : "Add to Watchlist"}
                          </motion.button>
                          <button
                            id="billboard-action-search"
                            onClick={() => {
                              document.getElementById("navbar-search")?.focus();
                            }}
                            className="hidden sm:flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                          >
                            Search archives
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </motion.div>
                      </motion.div>
                    </AnimatePresence>

                    {/* Play/Pause + progress indicator, bottom-right */}
                    {heroSlides.length > 1 && (
                      <div className="absolute bottom-5 right-6 z-20 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setHeroPlaying((p) => !p)}
                          aria-label={heroPlaying ? "Pause rotation" : "Play rotation"}
                          aria-pressed={heroPlaying}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950/60 border border-neutral-700/60 text-white hover:bg-neutral-900 backdrop-blur-md transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          {heroPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                        </button>
                        <div className="flex items-center gap-1.5">
                          {heroSlides.map((slide, i) => (
                            <button
                              key={slide.id}
                              type="button"
                              onClick={() => goToHeroSlide(i)}
                              aria-label={`Go to featured movie ${i + 1}: ${slide.title}`}
                              aria-current={i === safeHeroIndex}
                              className="relative h-1 w-8 rounded-full bg-neutral-700/50 overflow-hidden cursor-pointer"
                            >
                              {i === safeHeroIndex && (
                                <span
                                  key={`${featuredMovie.id}-${heroPlaying}`}
                                  className={`absolute inset-y-0 left-0 bg-red-500 rounded-full ${heroPlaying ? "hero-progress-active" : "hero-progress-paused w-full"}`}
                                />
                              )}
                              {i < safeHeroIndex && <span className="absolute inset-0 bg-neutral-400 rounded-full" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Curated discovery rows: Netflix-style horizontal browsing, separate
                  from the filterable grid below. Hidden during search so results stay focused. */}
              {!searchQuery && (
                <div className="space-y-10">
                  {recentSearches.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider mr-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        Recent Searches
                      </span>
                      {recentSearches.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setSearchQuery(q)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900/60 border border-neutral-700/60 text-neutral-300 hover:text-white hover:border-red-500/40 transition-colors cursor-pointer"
                        >
                          {q}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={clearRecentSearches}
                        className="px-2 py-1.5 text-xs font-medium text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                  {recentlyViewed.length > 0 && (
                    <MovieRail
                      id="rail-continue-watching"
                      title="Continue Browsing"
                      subtitle="Pick up where you left off"
                      icon={History}
                      accent="red"
                      movies={recentlyViewed}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  <MovieRail
                    id="rail-recommended"
                    title="Recommended For You"
                    subtitle={recommendationReason ? `Because you like ${recommendationReason} · ${CONFIDENCE_LABELS[discoveryConfidence]}` : user ? "Save a few favorites to personalize this row" : "Sign in to personalize this row"}
                    icon={Compass}
                    accent="indigo"
                    movies={recommendedMovies}
                    isLoading={moviesLoading}
                    onMovieClick={handleSelectMovie}
                    isSaved={isMovieSaved}
                    onToggleSave={handleQuickToggleWatchlist}
                  />
                  {dailyPicksMovies.length > 0 && (
                    <MovieRail
                      id="rail-daily-picks"
                      title="Daily Picks For You"
                      subtitle={`${CONFIDENCE_LABELS[discoveryConfidence]} · ${recommendationReason ? `Fresh picks in ${recommendationReason}` : "Refreshes every day"}`}
                      icon={CalendarClock}
                      accent="amber"
                      movies={dailyPicksMovies}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  <MovieRail
                    id="rail-trending"
                    title="Trending Now"
                    subtitle="What everyone's discovering this week"
                    icon={TrendingUp}
                    accent="red"
                    movies={trendingMovies}
                    isLoading={moviesLoading}
                    onMovieClick={handleSelectMovie}
                    isSaved={isMovieSaved}
                    onToggleSave={handleQuickToggleWatchlist}
                  />
                  <MovieRail
                    id="rail-popular"
                    title="Popular"
                    subtitle="Highest-rated by the community"
                    icon={Flame}
                    accent="amber"
                    movies={popularMovies}
                    isLoading={moviesLoading}
                    onMovieClick={handleSelectMovie}
                    isSaved={isMovieSaved}
                    onToggleSave={handleQuickToggleWatchlist}
                  />
                  <MovieRail
                    id="rail-latest"
                    title="Latest Releases"
                    subtitle="Newest titles, freshest first"
                    icon={CalendarClock}
                    accent="teal"
                    movies={latestMovies}
                    isLoading={moviesLoading}
                    onMovieClick={handleSelectMovie}
                    isSaved={isMovieSaved}
                    onToggleSave={handleQuickToggleWatchlist}
                  />
                  <MovieRail
                    id="rail-hidden-gems"
                    title="Hidden Gems"
                    subtitle="Highly rated, lower profile picks"
                    icon={Gem}
                    accent="emerald"
                    movies={hiddenGemMovies}
                    isLoading={moviesLoading}
                    onMovieClick={handleSelectMovie}
                    isSaved={isMovieSaved}
                    onToggleSave={handleQuickToggleWatchlist}
                  />
                  {criticallyAcclaimed.length >= 4 && (
                    <MovieRail
                      id="rail-critically-acclaimed"
                      title="Critically Acclaimed"
                      subtitle="The films critics won't stop talking about"
                      icon={Star}
                      accent="amber"
                      movies={criticallyAcclaimed}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {awardWinners.length >= 4 && (
                    <MovieRail
                      id="rail-award-winners"
                      title="Award Winners"
                      subtitle="Oscar favourites and festival darlings"
                      icon={TrendingUp}
                      accent="indigo"
                      movies={awardWinners}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {mindBending.length >= 4 && (
                    <MovieRail
                      id="rail-mind-bending"
                      title="Mind-Bending"
                      subtitle="Films that challenge how you see the world"
                      icon={Compass}
                      accent="teal"
                      movies={mindBending}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {familyNight.length >= 4 && (
                    <MovieRail
                      id="rail-family-night"
                      title="Family Night"
                      subtitle="Everyone at the table will love these"
                      icon={Heart}
                      accent="emerald"
                      movies={familyNight}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {feelGood.length >= 4 && (
                    <MovieRail
                      id="rail-feel-good"
                      title="Feel-Good Movies"
                      subtitle="Guaranteed to leave you smiling"
                      icon={Flame}
                      accent="amber"
                      movies={feelGood}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {basedOnTrueStories.length >= 4 && (
                    <MovieRail
                      id="rail-true-stories"
                      title="Based on True Stories"
                      subtitle="Real events, cinematic scale"
                      icon={History}
                      accent="red"
                      movies={basedOnTrueStories}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {internationalCinema.length >= 4 && (
                    <MovieRail
                      id="rail-international"
                      title="International Cinema"
                      subtitle="World-class storytelling from every corner of the globe"
                      icon={Gem}
                      accent="teal"
                      movies={internationalCinema}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {cultClassics.length >= 4 && (
                    <MovieRail
                      id="rail-cult-classics"
                      title="Cult Classics"
                      subtitle="Timeless films that defined generations"
                      icon={CalendarClock}
                      accent="indigo"
                      movies={cultClassics}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {staffPicks.length >= 4 && (
                    <MovieRail
                      id="rail-staff-picks"
                      title="Staff Picks"
                      subtitle="Our highest-rated favorites in the catalog"
                      icon={Sparkle}
                      accent="amber"
                      movies={staffPicks}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {editorsChoice.length >= 4 && (
                    <MovieRail
                      id="rail-editors-choice"
                      title="Editor's Choice"
                      subtitle="Well-loved favorites, not just top-rated"
                      icon={Star}
                      accent="red"
                      movies={editorsChoice}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {weekendMovies.length >= 4 && (
                    <MovieRail
                      id="rail-weekend-movies"
                      title="Weekend Movies"
                      subtitle="Easy, crowd-pleasing picks for a night in"
                      icon={Flame}
                      accent="teal"
                      movies={weekendMovies}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {underratedMovies.length >= 4 && (
                    <MovieRail
                      id="rail-underrated"
                      title="Underrated Movies"
                      subtitle="Solid films that flew under the radar"
                      icon={Gem}
                      accent="teal"
                      movies={underratedMovies}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {expandHorizonsMovies.length >= 4 && (
                    <MovieRail
                      id="rail-expand-horizons"
                      title="Expand Your Horizons"
                      subtitle="Highly rated picks outside your usual genres"
                      icon={Sparkle}
                      accent="indigo"
                      movies={expandHorizonsMovies}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {decade1990s.length >= 4 && (
                    <MovieRail
                      id="rail-decade-1990s"
                      title="Explore the 1990s"
                      subtitle="A decade of defining cinema"
                      icon={CalendarClock}
                      accent="amber"
                      movies={decade1990s}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {decade2000s.length >= 4 && (
                    <MovieRail
                      id="rail-decade-2000s"
                      title="Explore the 2000s"
                      subtitle="The 2000s, revisited"
                      icon={CalendarClock}
                      accent="red"
                      movies={decade2000s}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {decade2010s.length >= 4 && (
                    <MovieRail
                      id="rail-decade-2010s"
                      title="Explore the 2010s"
                      subtitle="The decade that shaped modern film"
                      icon={CalendarClock}
                      accent="teal"
                      movies={decade2010s}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {nolanMovies.length >= 3 && (
                    <MovieRail
                      id="rail-director-nolan"
                      title="Directed by Christopher Nolan"
                      subtitle="Mind-bending, meticulously crafted"
                      icon={Clapperboard}
                      accent="indigo"
                      movies={nolanMovies}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {spielbergMovies.length >= 3 && (
                    <MovieRail
                      id="rail-director-spielberg"
                      title="Directed by Steven Spielberg"
                      subtitle="A master of modern blockbusters"
                      icon={Clapperboard}
                      accent="amber"
                      movies={spielbergMovies}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                  {tarantinoMovies.length >= 3 && (
                    <MovieRail
                      id="rail-director-tarantino"
                      title="Directed by Quentin Tarantino"
                      subtitle="Sharp dialogue, unmistakable style"
                      icon={Clapperboard}
                      accent="red"
                      movies={tarantinoMovies}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  )}
                </div>
              )}

              {/* Browse by Genre: dynamic rows generated from already-fetched data */}
              {!searchQuery && genreSections.length > 0 && (
                <div className="space-y-10">
                  <div className="max-w-[1600px] mx-auto px-6">
                    <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">Browse by Genre</h2>
                  </div>
                  {genreSections.map((section, idx) => (
                    <MovieRail
                      key={`genre-rail-${section.genre}`}
                      id={`rail-genre-${section.genre.toLowerCase()}`}
                      title={section.genre}
                      icon={Film}
                      accent={(["red", "amber", "teal", "indigo", "emerald"] as const)[idx % 5]}
                      movies={section.movies}
                      isLoading={moviesLoading}
                      onMovieClick={handleSelectMovie}
                      isSaved={isMovieSaved}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  ))}
                </div>
              )}

              {/* Main explore browse grid with sort controls.
                  Task 5 — this used to render unconditionally as a "Full Film
                  Archive" full-catalog browse grid (with sort + advanced
                  filters), duplicating Movie Library's entire job once that
                  tab existed. Now gated behind an active search query: it
                  only appears as search results when the person actually
                  searches from Explore, which is expected search behavior,
                  not a duplicate "browse everything" experience. Movie
                  Library remains the one place to browse the full catalog
                  with no search query. */}
              {searchQuery && (
              <div className="max-w-[1600px] mx-auto px-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-white/[0.06] gap-4 text-left">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 uppercase text-neutral-400">
                      <Film className="h-5 w-5 text-neutral-500" />
                      {searchQuery ? `Search Results for "${searchQuery}"` : "Full Film Archive"}
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">
                      {searchQuery ? "Showing dynamic matching titles & genres" : "Browse and filter the entire catalog, beyond the curated rows above"}
                    </p>
                  </div>

                  {/* Sort + Rating + Year filters — visible during search too, so filters and search combine */}
                  <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                    <SlidersHorizontal className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                    <label htmlFor="main-movie-sorting" className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mr-1">Sort:</label>
                    <select
                      id="main-movie-sorting"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-bold text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:border-red-500/50"
                    >
                      <option value="popularity">Trending Score</option>
                      <option value="rating-desc">Highest Rated</option>
                      <option value="rating-asc">Lowest Rated</option>
                      <option value="releaseDate">Newest First</option>
                      <option value="releaseDate-asc">Oldest First</option>
                      <option value="alphabetical">A → Z</option>
                      <option value="alphabetical-desc">Z → A</option>
                    </select>

                    <label htmlFor="rating-filter" className="sr-only">Minimum rating</label>
                    <select
                      id="rating-filter"
                      value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-bold text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:border-red-500/50"
                    >
                      <option value={0}>Any Rating</option>
                      <option value={6}>6+ Stars</option>
                      <option value={7}>7+ Stars</option>
                      <option value={8}>8+ Stars</option>
                      <option value={9}>9+ Stars</option>
                    </select>

                    <label htmlFor="year-filter" className="sr-only">Release year</label>
                    <select
                      id="year-filter"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-bold text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:border-red-500/50"
                    >
                      <option value="All">All Years</option>
                      {availableYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>

                    <label htmlFor="runtime-filter" className="sr-only">Max runtime</label>
                    <select
                      id="runtime-filter"
                      value={maxRuntime}
                      onChange={(e) => setMaxRuntime(Number(e.target.value))}
                      className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-bold text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:border-red-500/50"
                    >
                      <option value={0}>Any Length</option>
                      <option value={90}>Under 90 min</option>
                      <option value={120}>Under 2 hrs</option>
                      <option value={150}>Under 2.5 hrs</option>
                      <option value={180}>Under 3 hrs</option>
                    </select>

                    <button
                      onClick={() => setFilterPanelOpen(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl px-4 py-2 text-xs font-bold text-white hover:border-red-500/40 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      More Filters
                      {(panelGenres.length > 0 || selectedDecade !== "All" || selectedDirector !== "All" || selectedActor !== "All") && (
                        <span className="rounded-full bg-red-600 text-[#ffffff] px-1.5 text-[10px] font-extrabold">
                          {[panelGenres.length > 0, selectedDecade !== "All", selectedDirector !== "All", selectedActor !== "All"].filter(Boolean).length}
                        </span>
                      )}
                    </button>

                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                        Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
                      </button>
                    )}
                  </div>
                </div>

                {/* ── ADVANCED FILTER PANEL (drawer) ── */}
                <AnimatePresence>
                  {filterPanelOpen && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
                      onClick={() => setFilterPanelOpen(false)}
                    >
                      <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "tween", duration: 0.25 }}
                        className="h-full w-full sm:w-[420px] bg-neutral-950 border-l border-white/[0.08] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] bg-neutral-950/95 backdrop-blur-md">
                          <h2 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4 text-red-500" />
                            Advanced Filters
                          </h2>
                          <button
                            onClick={() => setFilterPanelOpen(false)}
                            aria-label="Close filter panel"
                            className="rounded-xl p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="p-6 space-y-3">

                          {/* Genres (multi-select) */}
                          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
                            <button
                              onClick={() => setFilterSection(filterSection === "genres" ? null : "genres")}
                              className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
                            >
                              <span>Genres {panelGenres.length > 0 && <span className="text-red-400">({panelGenres.length})</span>}</span>
                              <span className="text-neutral-500">{filterSection === "genres" ? "−" : "+"}</span>
                            </button>
                            {filterSection === "genres" && (
                              <div className="px-4 pb-4 flex flex-wrap gap-2">
                                {ALL_GENRES.filter((g) => g !== "All").map((g) => {
                                  const isSelected = panelGenres.includes(g);
                                  return (
                                    <button
                                      key={`panel-genre-${g}`}
                                      onClick={() => togglePanelGenre(g)}
                                      aria-pressed={isSelected}
                                      className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                                        isSelected
                                          ? "bg-red-650 border-red-650 text-[#ffffff]"
                                          : "bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:text-white"
                                      }`}
                                    >
                                      {g}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Decade */}
                          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
                            <button
                              onClick={() => setFilterSection(filterSection === "decade" ? null : "decade")}
                              className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
                            >
                              <span>Decade {selectedDecade !== "All" && <span className="text-red-400">({selectedDecade}s)</span>}</span>
                              <span className="text-neutral-500">{filterSection === "decade" ? "−" : "+"}</span>
                            </button>
                            {filterSection === "decade" && (
                              <div className="px-4 pb-4 flex flex-wrap gap-2">
                                <button
                                  onClick={() => setSelectedDecade("All")}
                                  aria-pressed={selectedDecade === "All"}
                                  className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                                    selectedDecade === "All"
                                      ? "bg-red-650 border-red-650 text-[#ffffff]"
                                      : "bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:text-white"
                                  }`}
                                >
                                  Any
                                </button>
                                {availableDecades.map((d) => (
                                  <button
                                    key={`decade-${d}`}
                                    onClick={() => setSelectedDecade(String(d))}
                                    aria-pressed={selectedDecade === String(d)}
                                    className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                                      selectedDecade === String(d)
                                        ? "bg-red-650 border-red-650 text-[#ffffff]"
                                        : "bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:text-white"
                                    }`}
                                  >
                                    {d}s
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Director */}
                          {availableDirectors.length > 0 && (
                            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
                              <button
                                onClick={() => setFilterSection(filterSection === "director" ? null : "director")}
                                className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
                              >
                                <span>Director {selectedDirector !== "All" && <span className="text-red-400">(1)</span>}</span>
                                <span className="text-neutral-500">{filterSection === "director" ? "−" : "+"}</span>
                              </button>
                              {filterSection === "director" && (
                                <div className="px-4 pb-4">
                                  <label htmlFor="director-filter" className="sr-only">Filter by director</label>
                                  <select
                                    id="director-filter"
                                    value={selectedDirector}
                                    onChange={(e) => setSelectedDirector(e.target.value)}
                                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl px-4 py-2.5 text-xs font-bold text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:border-red-500/50"
                                  >
                                    <option value="All">Any Director</option>
                                    {availableDirectors.map((d) => (
                                      <option key={d} value={d}>{d}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Actor */}
                          {availableActors.length > 0 && (
                            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
                              <button
                                onClick={() => setFilterSection(filterSection === "actor" ? null : "actor")}
                                className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
                              >
                                <span>Actor {selectedActor !== "All" && <span className="text-red-400">(1)</span>}</span>
                                <span className="text-neutral-500">{filterSection === "actor" ? "−" : "+"}</span>
                              </button>
                              {filterSection === "actor" && (
                                <div className="px-4 pb-4">
                                  <label htmlFor="actor-filter" className="sr-only">Filter by actor</label>
                                  <select
                                    id="actor-filter"
                                    value={selectedActor}
                                    onChange={(e) => setSelectedActor(e.target.value)}
                                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl px-4 py-2.5 text-xs font-bold text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:border-red-500/50"
                                  >
                                    <option value="All">Any Actor</option>
                                    {availableActors.map((a) => (
                                      <option key={a} value={a}>{a}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}

                        </div>

                        <div className="sticky bottom-0 flex items-center gap-3 px-6 py-4 border-t border-white/[0.06] bg-neutral-950/95 backdrop-blur-md">
                          <button
                            onClick={clearAllFilters}
                            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl px-4 py-3 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-all cursor-pointer"
                          >
                            Clear All
                          </button>
                          <button
                            onClick={() => setFilterPanelOpen(false)}
                            className="flex-1 rounded-xl bg-red-650 hover:bg-red-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#ffffff] transition-all cursor-pointer"
                          >
                            Show {filteredMovies.length} Results
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Genre Tabs Filter (Horizontal scrolling pill row) — combines with search/rating/year */}
                <div role="group" aria-label="Filter by genre" className="flex items-center gap-2 overflow-x-auto py-6 pr-4 no-scrollbar scroll-smooth">
                  {ALL_GENRES.map((g) => {
                    const isSelected = selectedGenre === g;
                    return (
                      <button
                        key={`genre-pill-${g}`}
                        onClick={() => setSelectedGenre(g)}
                        aria-pressed={isSelected}
                        className={`shrink-0 rounded-full px-5 py-2 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer border focus-visible:ring-2 focus-visible:ring-red-500 ${
                          isSelected
                            ? "bg-red-650 border-red-650 text-[#ffffff] shadow-lg shadow-red-950/20 font-extrabold"
                            : "bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:text-white"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>

                {/* Result count + active filter badges */}
                {!moviesLoading && !searchLoading && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 pb-4">
                    <span className="text-xs text-neutral-500 font-medium">
                      {filteredMovies.length} {filteredMovies.length === 1 ? "film" : "films"}
                    </span>
                    {selectedGenre !== "All" && (
                      <button
                        onClick={() => setSelectedGenre("All")}
                        className="flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/25 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/25 transition-colors cursor-pointer"
                      >
                        {selectedGenre} <XIcon className="h-3 w-3" />
                      </button>
                    )}
                    {minRating > 0 && (
                      <button
                        onClick={() => setMinRating(0)}
                        className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/25 px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/25 transition-colors cursor-pointer"
                      >
                        {minRating}+ Stars <XIcon className="h-3 w-3" />
                      </button>
                    )}
                    {selectedYear !== "All" && (
                      <button
                        onClick={() => setSelectedYear("All")}
                        className="flex items-center gap-1 rounded-full bg-teal-500/15 border border-teal-500/25 px-2.5 py-1 text-[11px] font-semibold text-teal-400 hover:bg-teal-500/25 transition-colors cursor-pointer"
                      >
                        {selectedYear} <XIcon className="h-3 w-3" />
                      </button>
                    )}
                    {maxRuntime > 0 && (
                      <button
                        onClick={() => setMaxRuntime(0)}
                        className="flex items-center gap-1 rounded-full bg-indigo-500/15 border border-indigo-500/25 px-2.5 py-1 text-[11px] font-semibold text-indigo-400 hover:bg-indigo-500/25 transition-colors cursor-pointer"
                      >
                        Under {maxRuntime} min <XIcon className="h-3 w-3" />
                      </button>
                    )}
                    {panelGenres.map((g) => (
                      <button
                        key={`badge-${g}`}
                        onClick={() => togglePanelGenre(g)}
                        className="flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/25 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/25 transition-colors cursor-pointer"
                      >
                        {g} <XIcon className="h-3 w-3" />
                      </button>
                    ))}
                    {selectedDecade !== "All" && (
                      <button
                        onClick={() => setSelectedDecade("All")}
                        className="flex items-center gap-1 rounded-full bg-purple-500/15 border border-purple-500/25 px-2.5 py-1 text-[11px] font-semibold text-purple-400 hover:bg-purple-500/25 transition-colors cursor-pointer"
                      >
                        {selectedDecade}s <XIcon className="h-3 w-3" />
                      </button>
                    )}
                    {selectedDirector !== "All" && (
                      <button
                        onClick={() => setSelectedDirector("All")}
                        className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                      >
                        Dir: {selectedDirector} <XIcon className="h-3 w-3" />
                      </button>
                    )}
                    {selectedActor !== "All" && (
                      <button
                        onClick={() => setSelectedActor("All")}
                        className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/25 px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/25 transition-colors cursor-pointer"
                      >
                        {selectedActor} <XIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}

                {/* Skeletons or Empty checks or Main Grid */}
                {moviesLoading || searchLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-6 mt-8">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <MovieCard key={`skeleton-${i}`} isLoading={true} />
                    ))}
                  </div>
                ) : filteredMovies.length === 0 ? (
                  <div className="rounded-3xl border border-white/[0.06] py-16 text-center mt-8 px-6">
                    <HelpCircle className="h-10 w-10 text-neutral-600 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      {searchQuery ? `No results for "${searchQuery}"` : "No matching films found"}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">
                      {searchQuery && activeFilterCount > 0
                        ? "Your search and active filters don't overlap. Try loosening a filter."
                        : searchQuery
                        ? "Try a different title, actor, or genre keyword."
                        : "Try another genre, rating, or year, or reset every filter."}
                    </p>
                    <div className="mt-5 flex items-center justify-center gap-3">
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="rounded-lg bg-white/[0.05] border border-white/[0.08] px-4 py-2 text-xs font-semibold hover:bg-white/[0.08] text-red-400 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          Clear search
                        </button>
                      )}
                      {activeFilterCount > 0 && (
                        <button
                          onClick={clearAllFilters}
                          className="rounded-lg bg-white/[0.05] border border-white/[0.08] px-4 py-2 text-xs font-semibold hover:bg-white/[0.08] text-red-400 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          Reset all filters
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-6 mt-8">
                    {filteredMovies.map((movie, idx) => (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                        index={idx}
                        isSaved={watchlistIds.has(movie.id)}
                        onToggleSave={handleQuickToggleWatchlist}
                        onClick={handleSelectMovie}
                      />
                    ))}
                  </div>
                )}
              </div>
              )}
            </motion.div>
          ) : activeTab === "watchlist" ? (
            /* 3. YOUR WATCHLIST VIEW */
            <motion.div
              key="watchlist-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-[1600px] mx-auto px-6 text-left"
            >
              <div className="mb-8 pb-5 border-b border-white/[0.06] flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="hidden sm:block h-8 w-1 rounded-full bg-gradient-to-b from-red-500 to-red-700 mt-1" aria-hidden="true" />
                  <div>
                    <h1 className="text-2xl font-extrabold text-white flex items-center gap-2 uppercase tracking-wide">
                      <Bookmark className="h-6 w-6 text-red-500" />
                      Your Personal Cine-Watchlist
                    </h1>
                    <p className="text-xs text-neutral-500 mt-1">
                      Keep tabs on premium releases you want to review and analyze. Synced securely to your account.
                    </p>
                  </div>
                </div>

                {!watchlistLoading && watchlistMovies.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label htmlFor="watchlist-sorting" className="sr-only">Sort watchlist</label>
                    <select
                      id="watchlist-sorting"
                      value={watchlistSortBy}
                      onChange={(e) => setWatchlistSortBy(e.target.value)}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl px-4 py-2 text-xs font-bold text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:border-red-500/50"
                    >
                      <option value="dateAdded">Recently Added</option>
                      <option value="rating">Rating</option>
                      <option value="releaseDate">Release Date</option>
                      <option value="alphabetical">A-Z</option>
                    </select>

                    {watchlistGenresAvailable.length > 0 && (
                      <>
                        <label htmlFor="watchlist-genre-filter" className="sr-only">Filter watchlist by genre</label>
                        <select
                          id="watchlist-genre-filter"
                          value={watchlistGenreFilter}
                          onChange={(e) => setWatchlistGenreFilter(e.target.value)}
                          className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-bold text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:border-red-500/50"
                        >
                          <option value="All">All Genres</option>
                          {watchlistGenresAvailable.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Watchlist statistics: pure aggregation over data already in memory */}
              {watchlistStats && (
                <div className="flex flex-wrap gap-3 mb-8 -mt-4">
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl px-4 py-2.5">
                    <Bookmark className="h-4 w-4 text-red-400" aria-hidden="true" />
                    <span className="text-sm font-bold text-white">{watchlistStats.count}</span>
                    <span className="text-xs text-neutral-500">{watchlistStats.count === 1 ? "movie saved" : "movies saved"}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-2.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                    <span className="text-sm font-bold text-white">{watchlistStats.avgRating.toFixed(1)}</span>
                    <span className="text-xs text-neutral-500">avg rating</span>
                  </div>
                  {watchlistStats.topGenre && (
                    <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-2.5">
                      <Heart className="h-4 w-4 text-red-400" aria-hidden="true" />
                      <span className="text-xs text-neutral-500">Favorite genre:</span>
                      <span className="text-sm font-bold text-white">{watchlistStats.topGenre}</span>
                    </div>
                  )}
                </div>
              )}

              {watchlistLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-6 mt-8">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <MovieCard key={`watch-skeleton-${i}`} isLoading={true} />
                  ))}
                </div>
              ) : watchlistMovies.length === 0 ? (
                <div className="rounded-3xl border border-white/[0.08] border-dashed p-12 text-center max-w-md mx-auto mt-12 space-y-4">
                  <Bookmark className="h-10 w-10 text-neutral-700 mx-auto" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Your Watchlist is empty</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed max-w-xs mx-auto">
                    Hover any poster and tap the bookmark icon, or open a film's page and click "Add to Watchlist" to save it here.
                  </p>
                  <button
                    id="watchlist-to-explore"
                    onClick={() => setActiveTab("explore")}
                    className="rounded-lg bg-white/[0.05] border border-white/[0.08] px-4 py-2 text-xs font-semibold hover:bg-white/[0.08] text-red-400 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    Browse Explore
                  </button>
                </div>
              ) : visibleWatchlistMovies.length === 0 ? (
                <div className="rounded-3xl border border-white/[0.06] py-16 text-center mt-8 px-6">
                  <HelpCircle className="h-10 w-10 text-neutral-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">No saved films in this genre</h3>
                  <p className="text-xs text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">
                    Switch the genre filter back to "All Genres" to see your full watchlist.
                  </p>
                  <button
                    onClick={() => setWatchlistGenreFilter("All")}
                    className="mt-5 rounded-lg bg-white/[0.05] border border-white/[0.08] px-4 py-2 text-xs font-semibold hover:bg-white/[0.08] text-red-400 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    Reset genre filter
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-6 mt-8">
                  {visibleWatchlistMovies.map((movie, idx) => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      index={idx}
                      isSaved={true}
                      onToggleSave={handleQuickToggleWatchlist}
                      onClick={handleSelectMovie}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : activeTab === "oracle" ? (
            /* 4. AI MATCHMAKER / ORACLE VIEW */
            <motion.div
              key="oracle-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <Suspense fallback={<TabLoadingFallback />}>
                <AIMatchmaker
                  onSelectMovie={handleSelectMovie}
                  userId={user?.uid}
                  favoriteGenres={favoriteGenres}
                  watchlistMovies={watchlistMovies}
                  recentlyViewedMovies={recentlyViewed}
                />
              </Suspense>
            </motion.div>
          ) : activeTab === "profile" ? (
            /* 5. USER PROFILE */
            <motion.div
              key="profile-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <Suspense fallback={<TabLoadingFallback />}>
                <UserProfile
                  viewedUserId={viewedProfileUserId ?? undefined}
                  onBack={viewedProfileUserId ? () => setViewedProfileUserId(null) : undefined}
                  onViewProfile={(userId) => setViewedProfileUserId(userId)}
                  initialEditMode={openProfileInEditMode}
                  onEditModeConsumed={() => setOpenProfileInEditMode(false)}
                />
              </Suspense>
            </motion.div>
          ) : activeTab === "community" ? (
            /* 6. COMMUNITY FEED */
            <motion.div
              key="community-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <Suspense fallback={<TabLoadingFallback />}>
                <CommunityFeed
                  combinedMoviePool={combinedMoviePool}
                  onSelectMovie={handleSelectMovie}
                  onToggleSave={handleQuickToggleWatchlist}
                  watchlistIds={watchlistIds}
                  onViewProfile={(userId) => {
                    setViewedProfileUserId(userId);
                    setActiveTab("profile");
                  }}
                  onOpenAuth={() => setAuthOpen(true)}
                  onOpenReview={(reviewId) => {
                    setViewedReviewId(reviewId);
                    setActiveTab("review");
                  }}
                />
              </Suspense>
            </motion.div>
          ) : activeTab === "review" && viewedReviewId ? (
            /* 6.25 REVIEW DETAIL — Phase 50: focused single-review view,
               reached from Community's "Read full review" affordance. */
            <motion.div
              key="review-detail-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <Suspense fallback={<TabLoadingFallback />}>
                <ReviewDetail
                  reviewId={viewedReviewId}
                  combinedMoviePool={combinedMoviePool}
                  onBack={() => {
                    setViewedReviewId(null);
                    setActiveTab("community");
                  }}
                  onSelectMovie={handleSelectMovie}
                  onViewProfile={(userId) => {
                    setViewedProfileUserId(userId);
                    setActiveTab("profile");
                  }}
                  onOpenAuth={() => setAuthOpen(true)}
                />
              </Suspense>
            </motion.div>
          ) : activeTab === "library" ? (
            /* 6.5 MOVIE LIBRARY — full-catalog browse (Phase 29) */
            <motion.div
              key="library-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <Suspense fallback={<TabLoadingFallback />}>
                <MovieLibrary
                  onSelectMovie={handleSelectMovie}
                  watchlistIds={watchlistIds}
                  onToggleSave={handleQuickToggleWatchlist}
                />
              </Suspense>
            </motion.div>
          ) : activeTab === "notifications" ? (
            /* 6.5 NOTIFICATIONS — Phase 46: Notification Center */
            <motion.div
              key="notifications-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              {user ? (
                <Suspense fallback={<TabLoadingFallback />}>
                  <NotificationCenter
                    userId={user.uid}
                    onSelectMovie={(movieId) => {
                      const movie = combinedMoviePool.find((m) => m.id === movieId);
                      if (movie) handleSelectMovie(movie);
                    }}
                    onViewProfile={(userId) => {
                      setViewedProfileUserId(userId);
                      setActiveTab("profile");
                    }}
                    onUnreadCountChange={setNotificationUnreadCount}
                  />
                </Suspense>
              ) : (
                <div className="max-w-2xl mx-auto px-4 py-20 text-center">
                  <p className="text-neutral-500 text-sm">Sign in to view your notifications.</p>
                </div>
              )}
            </motion.div>
          ) : activeTab === "settings" ? (
            /* 6.75 SETTINGS — Task Y: dedicated Settings page (Appearance/theme) */
            <motion.div
              key="settings-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <Suspense fallback={<TabLoadingFallback />}>
                <SettingsPage />
              </Suspense>
            </motion.div>
          ) : (
            /* 7. PERSONAL DASHBOARD */
            <motion.div
              key="dashboard-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <Suspense fallback={<TabLoadingFallback />}>
                <UserDashboard
                  recentlyViewed={recentlyViewed}
                  watchlistMovies={watchlistMovies}
                  favoriteGenres={favoriteGenres}
                  combinedMoviePool={combinedMoviePool}
                  onSelectMovie={handleSelectMovie}
                  onToggleSave={handleQuickToggleWatchlist}
                  watchlistIds={watchlistIds}
                  onEditGenres={() => setShowGenreOnboarding(true)}
                  onViewProfile={() => setActiveTab("profile")}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <TrailerModal movie={trailerMovie} onClose={() => setTrailerMovie(null)} />
      <ScrollToTopButton />
    </div>
    </MovieCardPreferencesProvider>
    </ThemeProvider>
  );
}