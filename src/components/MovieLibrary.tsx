import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, SlidersHorizontal, X, LibraryBig, Loader2 } from "lucide-react";
import MovieCard from "./MovieCard";
import { loadMovieCatalog, getCachedCatalog, isCatalogLoaded } from "../lib/movieCatalog";
import { searchMovies } from "../lib/movieSearch";
import { useFocusTrap } from "../lib/useFocusTrap";
import type { Movie } from "../types";

const WELCOME_SESSION_KEY = "movieapp:library-welcome-shown";
const PAGE_SIZE = 24;

type SortOption = "relevance" | "title-asc" | "rating-desc" | "release-desc" | "release-asc";

const SORT_LABELS: Record<SortOption, string> = {
  relevance: "Relevance",
  "title-asc": "Title (A–Z)",
  "rating-desc": "Rating (High to Low)",
  "release-desc": "Release Date (Newest)",
  "release-asc": "Release Date (Oldest)",
};

interface MovieLibraryProps {
  onSelectMovie: (movie: Movie) => void;
  watchlistIds: Set<string>;
  onToggleSave: (movie: Movie) => void;
}

function WelcomeModal({ onClose, movieCount }: { onClose: () => void; movieCount: number }) {
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="library-welcome-title"
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-neutral-900/90 p-8 text-neutral-100 shadow-2xl backdrop-blur-xl outline-none"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-5 rounded-full p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-red-600 text-[#ffffff] shadow-lg shadow-red-900/20 mb-4">
            <LibraryBig className="h-6 w-6" />
          </div>

          <h2 id="library-welcome-title" className="text-xl font-extrabold text-white mb-2">
            Welcome to the Movie Library
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed mb-6">
            Every title in our catalog lives here — over {movieCount} movies you can search, filter by genre,
            sort, and browse at your own pace. This is the place to dig deeper than the homepage rails.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-gradient-to-r from-red-600 to-amber-600 py-3 font-semibold text-[#ffffff] shadow-lg hover:from-red-500 hover:to-amber-505 active:scale-[0.98] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 focus-visible:ring-red-400"
          >
            Start Browsing
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function MovieLibrary({ onSelectMovie, watchlistIds, onToggleSave }: MovieLibraryProps) {
  const [catalog, setCatalog] = useState<Movie[]>(() => (isCatalogLoaded() ? getCachedCatalog() : []));
  const [catalogLoading, setCatalogLoading] = useState<boolean>(!isCatalogLoaded());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showWelcome, setShowWelcome] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isCatalogLoaded()) {
      loadMovieCatalog().then((movies) => {
        if (!cancelled) {
          setCatalog(movies);
          setCatalogLoading(false);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // First visit to the Library during this browser session only.
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(WELCOME_SESSION_KEY)) {
        setShowWelcome(true);
        sessionStorage.setItem(WELCOME_SESSION_KEY, "1");
      }
    } catch {
      // Private browsing / storage disabled — just skip the welcome modal.
    }
  }, []);

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const movie of catalog) {
      for (const g of movie.genres || []) set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [catalog]);

  const filteredSorted = useMemo(() => {
    let pool: Movie[];

    if (searchQuery.trim()) {
      pool = searchMovies(catalog, searchQuery, catalog.length).map((r) => r.movie);
    } else {
      pool = catalog.slice();
    }

    if (selectedGenre !== "all") {
      pool = pool.filter((m) => (m.genres || []).includes(selectedGenre));
    }

    // "relevance" keeps searchMovies' own ranked order (or catalog order
    // when there's no active search); every other option re-sorts pool.
    if (sortBy === "title-asc") {
      pool = pool.slice().sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "rating-desc") {
      pool = pool.slice().sort((a, b) => b.voteAverage - a.voteAverage);
    } else if (sortBy === "release-desc") {
      pool = pool.slice().sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
    } else if (sortBy === "release-asc") {
      pool = pool.slice().sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));
    }

    return pool;
  }, [catalog, searchQuery, selectedGenre, sortBy]);

  // Reset pagination whenever the active filter/search/sort actually changes
  // the underlying result set, so "Load more" always starts from the top of
  // the new list instead of showing a stale offset into it.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedGenre, sortBy]);

  const visibleMovies = filteredSorted.slice(0, visibleCount);
  const hasMore = visibleCount < filteredSorted.length;

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredSorted.length));
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, filteredSorted.length]);

  return (
    <div>
      {showWelcome && (
        <WelcomeModal onClose={() => setShowWelcome(false)} movieCount={catalog.length || 500} />
      )}

      <div className="flex items-start gap-3 mb-6">
        <span className="hidden sm:block h-9 w-1 rounded-full bg-gradient-to-b from-red-500 to-red-700 mt-1.5" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <LibraryBig className="h-7 w-7 text-red-500" aria-hidden="true" />
            Movie Library
          </h1>
          <p className="text-sm text-neutral-400">
            {catalogLoading ? "Loading the full catalog…" : `Browse all ${catalog.length} movies — search, filter, and sort at your own pace.`}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" aria-hidden="true" />
          <label htmlFor="library-search-input" className="sr-only">
            Search the movie library
          </label>
          <input
            id="library-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, director, actor, or year…"
            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.6)] focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:border-red-500/40 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-neutral-500 hidden sm:block" aria-hidden="true" />
          <label htmlFor="library-genre-select" className="sr-only">
            Filter by genre
          </label>
          <select
            id="library-genre-select"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl py-3 px-4 text-sm text-white shadow-[0_15px_40px_-20px_rgba(0,0,0,0.6)] focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer"
          >
            <option value="all">All Genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <label htmlFor="library-sort-select" className="sr-only">
            Sort results
          </label>
          <select
            id="library-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-xl border border-neutral-800 bg-neutral-900/60 py-3 px-4 text-sm text-white focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {catalogLoading ? "Loading movies" : `${filteredSorted.length} movies found`}
      </p>

      {catalogLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <MovieCard key={`library-skeleton-${i}`} isLoading={true} />
          ))}
        </div>
      ) : filteredSorted.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] py-20 text-center">
          <Search className="h-8 w-8 text-neutral-700 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm font-semibold text-neutral-400">No movies match your search.</p>
          <p className="text-xs text-neutral-500 mt-1 mb-4">Try a different title, genre, or clearing your filters.</p>
          {(searchQuery || selectedGenre !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedGenre("all");
              }}
              className="rounded-lg bg-white/[0.05] px-4 py-2 text-xs font-semibold text-red-400 border border-white/[0.08] hover:bg-white/[0.08] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-6">
            {visibleMovies.map((movie, idx) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                index={idx % PAGE_SIZE}
                isSaved={watchlistIds.has(movie.id)}
                onToggleSave={onToggleSave}
                onClick={onSelectMovie}
              />
            ))}
          </div>

          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 text-neutral-500 animate-spin" aria-hidden="true" />
            </div>
          )}
        </>
      )}
    </div>
  );
}