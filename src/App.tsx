/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Movie } from "./types";
import { ALL_GENRES } from "./movies-data";

// Components
import Navbar from "./components/Navbar";
import MovieCard from "./components/MovieCard";
import MovieRail from "./components/MovieRail";
import MovieDetail from "./components/MovieDetail";
import AIMatchmaker from "./components/AIMatchmaker";
import AuthModal from "./components/AuthModal";

// Icons
import {
  Star, Film, Bookmark, SlidersHorizontal, Eye, HelpCircle, ArrowRight,
  TrendingUp, Flame, CalendarClock, Compass, PlayCircle, Gem, X as XIcon
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("explore"); // explore, watchlist, oracle
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [authOpen, setAuthOpen] = useState<boolean>(false);

  // User state
  const [user, setUser] = useState(auth.currentUser);

  // Movie lists state
  const [movies, setMovies] = useState<Movie[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [latestMovies, setLatestMovies] = useState<Movie[]>([]);
  const [moviesLoading, setMoviesLoading] = useState<boolean>(true);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  // Filter state
  const [selectedGenre, setSelectedGenre] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("popularity"); // popularity, releaseDate, rating, alphabetical
  const [minRating, setMinRating] = useState<number>(0); // 0 = Any
  const [selectedYear, setSelectedYear] = useState<string>("All");

  // Watchlist browsing state
  const [watchlistSortBy, setWatchlistSortBy] = useState<string>("dateAdded");
  const [watchlistGenreFilter, setWatchlistGenreFilter] = useState<string>("All");

  // Watchlist state
  const [watchlistMovies, setWatchlistMovies] = useState<Movie[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState<boolean>(false);

  // 1. Sync Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch movies from fullstack backend APIs on mount
  useEffect(() => {
    const fetchPresetMovies = async () => {
      try {
        setMoviesLoading(true);
        // Fetch trending
        const trendRes = await fetch("/api/movies/trending");
        if (trendRes.ok) {
          const trendData = await trendRes.json();
          setTrendingMovies(trendData);
          setMovies(trendData); // Default
        }

        // Fetch latest
        const latestRes = await fetch("/api/movies/latest");
        if (latestRes.ok) {
          const latestData = await latestRes.json();
          setLatestMovies(latestData);
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

    const delayDebounce = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await fetch(`/api/movies/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const results = await res.json();
          setMovies(results);
        }
      } catch (err) {
        console.error("Search query server error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, sortBy, trendingMovies, latestMovies]);

  // 4. Update movies list when SortBy swaps
  useEffect(() => {
    if (searchQuery.trim()) return; // Keep search results if search is active
    setMovies(sortBy === "releaseDate" ? latestMovies : trendingMovies);
  }, [sortBy, trendingMovies, latestMovies, searchQuery]);

  // 5. Watchlist Real-time syncing from Firestore
  useEffect(() => {
    if (!user) {
      setWatchlistMovies([]);
      setWatchlistLoading(false);
      return;
    }

    setWatchlistLoading(true);
    const q = query(collection(db, "watchlist"), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Movie[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        list.push({
          id: d.id,
          title: d.title,
          posterPath: d.posterPath,
          releaseDate: d.releaseDate,
          voteAverage: d.voteAverage,
          voteCount: 0,
          genres: d.genres || [],
          overview: "",
          backdropPath: d.posterPath || "",
          addedAt: d.addedAt?.toMillis ? d.addedAt.toMillis() : Date.now()
        });
      });
      setWatchlistMovies(list);
      setWatchlistLoading(false);
    }, (error) => {
      console.error("Watchlist real-time listener error:", error);
      setWatchlistLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

// Fast lookup set for "is this movie saved" checks used by card quick-actions
  const watchlistIds = useMemo(() => new Set(watchlistMovies.map((m) => m.id)), [watchlistMovies]);

  // Quick-add/remove from any MovieCard (Trending/Popular/Latest/Recommended rails + grid)
  // without leaving the current view. Mirrors the toggle logic in MovieDetail.
  const handleQuickToggleWatchlist = async (movie: Movie) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const docId = `${user.uid}_${movie.id}`;
    const docRef = doc(db, "watchlist", docId);
    try {
      if (watchlistIds.has(movie.id)) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, {
          id: movie.id,
          title: movie.title,
          posterPath: movie.posterPath,
          releaseDate: movie.releaseDate,
          voteAverage: movie.voteAverage,
          genres: movie.genres || [],
          userId: user.uid,
          addedAt: serverTimestamp() || Date.now()
        });
      }
    } catch (err) {
      console.error("Quick watchlist toggle failed:", err);
    }
  };

  // "Popular" rail: same catalog as Trending, re-cut by raw score so the row
  // tells a different story (acclaim vs. momentum) without a new backend route.
  const popularMovies = useMemo(() => {
    return [...trendingMovies].sort((a, b) => b.voteAverage - a.voteAverage || b.voteCount - a.voteCount);
  }, [trendingMovies]);

  // "Recommended" rail: personalized to the signed-in user's watchlist genres
  // when we have signal, otherwise a diverse, high-rated fallback cut.
  const recommendedMovies = useMemo(() => {
    const sourcePool = trendingMovies.length ? trendingMovies : latestMovies;
    if (sourcePool.length === 0) return [];

    const watchlistGenres = new Set(
      watchlistMovies.flatMap((m) => m.genres || []).map((g) => g.toLowerCase())
    );

    if (watchlistGenres.size > 0) {
      const matches = sourcePool.filter(
        (m) => !watchlistIds.has(m.id) && m.genres?.some((g) => watchlistGenres.has(g.toLowerCase()))
      );
      if (matches.length >= 4) return matches;
    }

    return [...sourcePool]
      .filter((m) => m.voteAverage >= 7)
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(4, 16);
  }, [trendingMovies, latestMovies, watchlistMovies, watchlistIds]);

  // Combined, de-duplicated pool used for genre sections / year options / hidden gems
  // (purely client-side reuse of data we already fetched — no extra API calls)
  const combinedMoviePool = useMemo(() => {
    const map = new Map<string, Movie>();
    [...trendingMovies, ...latestMovies].forEach((m) => map.set(m.id, m));
    return Array.from(map.values());
  }, [trendingMovies, latestMovies]);

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

  // "Hidden Gems" recommendation row: high rating, lower vote count — curated
  // entirely from data already on hand, no new endpoint required.
  const hiddenGemMovies = useMemo(() => {
    if (combinedMoviePool.length === 0) return [];
    const sortedByVotes = [...combinedMoviePool].sort((a, b) => a.voteCount - b.voteCount);
    const medianVoteCount = sortedByVotes[Math.floor(sortedByVotes.length / 2)]?.voteCount ?? 0;
    return combinedMoviePool
      .filter((m) => m.voteAverage >= 7.5 && m.voteCount > 0 && m.voteCount <= medianVoteCount)
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
  }, [combinedMoviePool]);

  // Filter (genre + rating + year) and sort the active list — works the same
  // whether "movies" currently holds the trending/latest pool or search results,
  // so filters and search naturally combine.
  const filteredMovies = useMemo(() => {
    let result = movies.filter((m) => {
      if (selectedGenre !== "All" && !m.genres?.some((g) => g.toLowerCase() === selectedGenre.toLowerCase())) return false;
      if (minRating > 0 && m.voteAverage < minRating) return false;
      if (selectedYear !== "All" && m.releaseDate?.split("-")[0] !== selectedYear) return false;
      return true;
    });

    if (sortBy === "rating") {
      result = [...result].sort((a, b) => b.voteAverage - a.voteAverage);
    } else if (sortBy === "alphabetical") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "releaseDate") {
      result = [...result].sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
    }
    // "popularity" intentionally left in the order the backend already returned

    return result;
  }, [movies, selectedGenre, minRating, selectedYear, sortBy]);

  const activeFilterCount = [selectedGenre !== "All", minRating > 0, selectedYear !== "All"].filter(Boolean).length;

  const clearAllFilters = () => {
    setSelectedGenre("All");
    setMinRating(0);
    setSelectedYear("All");
    setSearchQuery("");
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

  // Featured billboard movie for top of home page
  const featuredMovie = trendingMovies[0];
 
 // Shared "open movie" flow: instant transition to the detail view using
  // whatever data we already have, then enrich in the background.
  const handleSelectMovie = async (movie: Movie) => {
    try {
      setSelectedMovie(movie); // Instant transition
      const res = await fetch(`/api/movies/detail/${movie.id}`);
      if (res.ok) {
        const fullDetail = await res.json();
        setSelectedMovie(fullDetail); // Enrich with real cast or AI generated facts
      }
    } catch (err) {
      console.error("Failed fetching movie details:", err);
    }
  };

  return (
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
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenAuth={() => setAuthOpen(true)}
        searchLoading={searchLoading}
      />

      {/* Auth Modal Overlay Popup */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Responsive layout wrapper */}
      <main id="main-content" className="relative pt-24 z-10">
        <AnimatePresence mode="wait">



          {/* 1. SEPARATE MOVIE DETAILS PAGE */}
          {selectedMovie ? (
            <MovieDetail
              key={`detail-view-${selectedMovie.id}`}
              movie={selectedMovie}
              onBack={() => {
                setSelectedMovie(null);
                // Refetch specific list details if required
              }}
              onOpenAuth={() => setAuthOpen(true)}
            />
          ) : activeTab === "explore" ? (
            /* 2. EXPLORE VIEW (HOME PAGE) */
            <motion.div
              key="explore-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              {/* Cinematic hero skeleton while the first fetch is in flight */}
              {!searchQuery && moviesLoading && !featuredMovie && (
                <div className="max-w-[1600px] mx-auto px-6 mt-4">
                  <div className="skeleton-shimmer relative rounded-3xl border border-neutral-800 h-[380px] sm:h-[430px] md:h-[480px]" />
                </div>
              )}

              {/* Giant Billboard Featured Header (Widescreen cinematic layout) */}
              {!searchQuery && featuredMovie && (
                <div
                  id="featured-board"
                  className="max-w-[1600px] mx-auto px-6 mt-4"
                >
                  <div className="relative rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950 h-[420px] sm:h-[460px] md:h-[520px] flex items-end">
                    <motion.img
                      key={featuredMovie.id}
                      src={featuredMovie.backdropPath}
                      alt=""
                      role="presentation"
                      referrerPolicy="no-referrer"
                      initial={{ scale: 1.08, opacity: 0.6 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 1.4, ease: "easeOut" }}
                      className="absolute inset-0 h-full w-full object-cover brightness-[0.35]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/70 via-transparent to-transparent" />

                    <motion.div
                      initial="hidden"
                      animate="show"
                      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } }}
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
                        Featured Tonight
                      </motion.div>

                      <motion.h1
                        variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                        className="text-3xl md:text-6xl font-black tracking-tight text-white leading-[1.05]"
                      >
                        {featuredMovie.title}
                      </motion.h1>

                      <motion.div
                        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                        className="flex items-center gap-3 mt-4 text-xs text-neutral-300"
                      >
                        <span className="flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/10">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {featuredMovie.voteAverage.toFixed(1)}
                        </span>
                        <span>{featuredMovie.releaseDate?.split("-")[0]}</span>
                        {featuredMovie.genres?.slice(0, 3).map((g) => (
                          <span key={g} className="hidden sm:inline text-neutral-500">&middot; {g}</span>
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
                        <button
                          id="billboard-action-detail"
                          onClick={() => handleSelectMovie(featuredMovie)}
                          className="flex items-center gap-2 rounded-xl bg-red-650 hover:bg-red-600 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-xl shadow-red-950/30 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          {featuredMovie.trailerUrl ? <PlayCircle className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                          {featuredMovie.trailerUrl ? "Watch Trailer" : "View Details"}
                        </button>
                        <button
                          id="billboard-action-watchlist"
                          onClick={() => handleQuickToggleWatchlist(featuredMovie)}
                          aria-pressed={watchlistIds.has(featuredMovie.id)}
                          className="flex items-center gap-2 rounded-xl bg-neutral-900 border border-neutral-800 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-neutral-800 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          <Bookmark className={`h-4.5 w-4.5 ${watchlistIds.has(featuredMovie.id) ? "fill-red-400 text-red-400" : ""}`} />
                          {watchlistIds.has(featuredMovie.id) ? "In Watchlist" : "Add to Watchlist"}
                        </button>
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
                  </div>
                </div>
              )}

              {/* Curated discovery rows: Netflix-style horizontal browsing, separate
                  from the filterable grid below. Hidden during search so results stay focused. */}
              {!searchQuery && (
                <div className="space-y-10">
                  <MovieRail
                    id="rail-trending"
                    title="Trending Now"
                    subtitle="What everyone's watching this week"
                    icon={TrendingUp}
                    accent="red"
                    movies={trendingMovies}
                    isLoading={moviesLoading}
                    onMovieClick={handleSelectMovie}
                    isSaved={(id) => watchlistIds.has(id)}
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
                    isSaved={(id) => watchlistIds.has(id)}
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
                    isSaved={(id) => watchlistIds.has(id)}
                    onToggleSave={handleQuickToggleWatchlist}
                  />
                  <MovieRail
                    id="rail-recommended"
                    title="Recommended For You"
                    subtitle={user ? "Based on your watchlist" : "Sign in to personalize this row"}
                    icon={Compass}
                    accent="indigo"
                    movies={recommendedMovies}
                    isLoading={moviesLoading}
                    onMovieClick={handleSelectMovie}
                    isSaved={(id) => watchlistIds.has(id)}
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
                    isSaved={(id) => watchlistIds.has(id)}
                    onToggleSave={handleQuickToggleWatchlist}
                  />
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
                      isSaved={(id) => watchlistIds.has(id)}
                      onToggleSave={handleQuickToggleWatchlist}
                    />
                  ))}
                </div>
              )}

              {/* Main explore browse grid with sort controls */}
              <div className="max-w-[1600px] mx-auto px-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-neutral-900 gap-4 text-left">
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
                      <option value="releaseDate">Release Date</option>
                      <option value="rating">Rating</option>
                      <option value="alphabetical">A-Z</option>
                    </select>

                    <label htmlFor="rating-filter" className="sr-only">Minimum rating</label>
                    <select
                      id="rating-filter"
                      value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-bold text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:border-red-500/50"
                    >
                      <option value={0}>Any Rating</option>
                      <option value={6}>6+ Rating</option>
                      <option value={7}>7+ Rating</option>
                      <option value={8}>8+ Rating</option>
                      <option value={9}>9+ Rating</option>
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
                            ? "bg-red-650 border-red-650 text-white shadow-lg shadow-red-950/20 font-extrabold"
                            : "bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:text-white"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>

                {/* Skeletons or Empty checks or Main Grid */}
                {moviesLoading || searchLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-6 mt-8">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <MovieCard key={`skeleton-${i}`} isLoading={true} />
                    ))}
                  </div>
                ) : filteredMovies.length === 0 ? (
                  <div className="rounded-3xl border border-neutral-900 py-16 text-center mt-8 px-6">
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
                          className="rounded-lg bg-neutral-850 border border-neutral-800 px-4 py-2 text-xs font-semibold hover:bg-neutral-800 text-red-400 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          Clear search
                        </button>
                      )}
                      {activeFilterCount > 0 && (
                        <button
                          onClick={clearAllFilters}
                          className="rounded-lg bg-neutral-850 border border-neutral-800 px-4 py-2 text-xs font-semibold hover:bg-neutral-800 text-red-400 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
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
                        onToggleSave={() => handleQuickToggleWatchlist(movie)}
                        onClick={() => handleSelectMovie(movie)}
                      />
                    ))}
                  </div>
                )}
              </div>
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
              <div className="mb-8 pb-5 border-b border-neutral-900 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-white flex items-center gap-2 uppercase tracking-wide">
                    <Bookmark className="h-6 w-6 text-red-500" />
                    Your Personal Cine-Watchlist
                  </h1>
                  <p className="text-xs text-neutral-500 mt-1">
                    Keep tabs on premium releases you want to review and analyze. Synced securely to your account.
                  </p>
                </div>

                {!watchlistLoading && watchlistMovies.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label htmlFor="watchlist-sorting" className="sr-only">Sort watchlist</label>
                    <select
                      id="watchlist-sorting"
                      value={watchlistSortBy}
                      onChange={(e) => setWatchlistSortBy(e.target.value)}
                      className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-bold text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:border-red-500/50"
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

              {watchlistLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-6 mt-8">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <MovieCard key={`watch-skeleton-${i}`} isLoading={true} />
                  ))}
                </div>
              ) : watchlistMovies.length === 0 ? (
                <div className="rounded-3xl border border-neutral-800 border-dashed p-12 text-center max-w-md mx-auto mt-12 space-y-4">
                  <Bookmark className="h-10 w-10 text-neutral-700 mx-auto" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Your Watchlist is empty</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed max-w-xs mx-auto">
                    Hover any poster and tap the bookmark icon, or open a film's page and click "Add to Watchlist" to save it here.
                  </p>
                  <button
                    id="watchlist-to-explore"
                    onClick={() => setActiveTab("explore")}
                    className="rounded-lg bg-neutral-850 border border-neutral-800 px-4 py-2 text-xs font-semibold hover:bg-neutral-800 text-red-400 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    Browse Explore
                  </button>
                </div>
              ) : visibleWatchlistMovies.length === 0 ? (
                <div className="rounded-3xl border border-neutral-900 py-16 text-center mt-8 px-6">
                  <HelpCircle className="h-10 w-10 text-neutral-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">No saved films in this genre</h3>
                  <p className="text-xs text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">
                    Switch the genre filter back to "All Genres" to see your full watchlist.
                  </p>
                  <button
                    onClick={() => setWatchlistGenreFilter("All")}
                    className="mt-5 rounded-lg bg-neutral-850 border border-neutral-800 px-4 py-2 text-xs font-semibold hover:bg-neutral-800 text-red-400 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
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
                      onToggleSave={() => handleQuickToggleWatchlist(movie)}
                      onClick={() => handleSelectMovie(movie)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            /* 4. AI MATCHMAKER / ORACLE VIEW */
            <motion.div
              key="oracle-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <AIMatchmaker onSelectMovie={handleSelectMovie} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
