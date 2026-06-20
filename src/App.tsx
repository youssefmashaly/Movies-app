/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Movie } from "./types";
import { ALL_GENRES } from "./movies-data";

// Components
import Navbar from "./components/Navbar";
import MovieCard from "./components/MovieCard";
import MovieDetail from "./components/MovieDetail";
import AIMatchmaker from "./components/AIMatchmaker";
import AuthModal from "./components/AuthModal";

// Icons
import { Star, Film, Bookmark, Sparkles, SlidersHorizontal, Eye, HelpCircle, ArrowRight } from "lucide-react";

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
  const [sortBy, setSortBy] = useState<string>("popularity"); // popularity, releaseDate

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
      setMovies(sortBy === "popularity" ? trendingMovies : latestMovies);
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
    setMovies(sortBy === "popularity" ? trendingMovies : latestMovies);
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
          genres: [],
          overview: "",
          backdropPath: d.posterPath || ""
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

  // Filter movies by Selected Genre from explore view
  const filteredMovies = movies.filter((m) => {
    if (selectedGenre === "All") return true;
    return m.genres?.some((g) => g.toLowerCase() === selectedGenre.toLowerCase());
  });

  // Featured billboard movie for top of home page
  const featuredMovie = trendingMovies[0];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased select-none pb-12">
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
      />

      {/* Auth Modal Overlay Popup */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Responsive layout wrapper */}
      <div className="relative pt-24 z-10">
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
              {/* Giant Billboard Featured Header (Widescreen cinematic layout) */}
              {!searchQuery && featuredMovie && (
                <div
                  id="featured-board"
                  className="max-w-7xl mx-auto px-6 mt-4"
                >
                  <div className="relative rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950 h-[380px] sm:h-[430px] md:h-[480px] flex items-end">
                    <img
                      src={featuredMovie.backdropPath}
                      alt={featuredMovie.title}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full object-cover brightness-[0.35]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />

                    <div className="relative z-10 p-8 md:p-12 text-left max-w-2xl">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/20 px-3.5 py-1.5 text-xs font-bold text-amber-400 mb-4 uppercase tracking-wider">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        Critically Acclaimed Blockbuster
                      </div>
                      <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
                        {featuredMovie.title}
                      </h2>
                      <p className="text-neutral-400 text-xs sm:text-sm mt-3 line-clamp-3 leading-relaxed">
                        {featuredMovie.overview}
                      </p>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          id="billboard-action-detail"
                          onClick={() => setSelectedMovie(featuredMovie)}
                          className="flex items-center gap-2 rounded-xl bg-red-650 hover:bg-red-600 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-xl shadow-red-950/30 transition-all cursor-pointer"
                        >
                          <Eye className="h-4.5 w-4.5" />
                          View Details
                        </button>
                        <button
                          id="billboard-action-search"
                          onClick={() => {
                            document.getElementById("navbar-search")?.focus();
                          }}
                          className="flex items-center gap-2 rounded-xl bg-neutral-900 border border-neutral-800 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-neutral-800 transition-all cursor-pointer"
                        >
                          Search archives
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Main explore browse grid with sort controls */}
              <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-neutral-900 gap-4 text-left">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 uppercase text-neutral-400">
                      <Film className="h-5 w-5 text-neutral-500" />
                      {searchQuery ? `Search Results for "${searchQuery}"` : "Browse film archives"}
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">
                      {searchQuery ? "Showing dynamic matching titles & genres" : "Browse curated blockbusters or search custom movies"}
                    </p>
                  </div>

                  {/* Sorting filters */}
                  {!searchQuery && (
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <SlidersHorizontal className="h-4 w-4 text-neutral-500" />
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mr-2">Sort:</span>
                      <select
                        id="main-movie-sorting"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-bold text-white outline-none cursor-pointer focus:border-red-500/50"
                      >
                        <option value="popularity">Trending Score</option>
                        <option value="releaseDate">Release Date</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Genre Tabs Filter (Horizontal scrolling pill row) */}
                {!searchQuery && (
                  <div className="flex items-center gap-2 overflow-x-auto py-6 pr-4 no-scrollbar scroll-smooth">
                    {ALL_GENRES.map((g) => {
                      const isSelected = selectedGenre === g;
                      return (
                        <button
                          key={`genre-pill-${g}`}
                          onClick={() => setSelectedGenre(g)}
                          className={`shrink-0 rounded-full px-5 py-2 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer border ${
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
                )}

                {/* Skeletons or Empty checks or Main Grid */}
                {moviesLoading || searchLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-8">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <MovieCard key={`skeleton-${i}`} isLoading={true} />
                    ))}
                  </div>
                ) : filteredMovies.length === 0 ? (
                  <div className="rounded-3xl border border-neutral-900 py-16 text-center mt-8">
                    <HelpCircle className="h-10 w-10 text-neutral-600 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">No matching films found</h3>
                    <p className="text-xs text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">
                      Try searching another title or select "All" from the genre labels to display full blockbusters.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-8">
                    {filteredMovies.map((movie) => (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                        onClick={async () => {
                          // Complete with deep details (about, cast) by fetching/querying details from API!
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
                        }}
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
              className="max-w-7xl mx-auto px-6 text-left"
            >
              <div className="mb-8 pb-5 border-b border-neutral-900">
                <h1 className="text-2xl font-extrabold text-white flex items-center gap-2 uppercase tracking-wide">
                  <Bookmark className="h-6 w-6 text-red-500" />
                  Your Personal Cine-Watchlist
                </h1>
                <p className="text-xs text-neutral-500 mt-1">
                  Keep tabs on premium releases you want to review and analyze. Synced securely to your account.
                </p>
              </div>

              {watchlistLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-8">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <MovieCard key={`watch-skeleton-${i}`} isLoading={true} />
                  ))}
                </div>
              ) : watchlistMovies.length === 0 ? (
                <div className="rounded-3xl border border-neutral-800 border-dashed p-12 text-center max-w-md mx-auto mt-12 space-y-4">
                  <Bookmark className="h-10 w-10 text-neutral-700 mx-auto" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Your Watchlist is empty</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed max-w-xs mx-auto">
                    Browse standard blockbusters inside "Explore" or query the AI matchmaker, then click "Add to Watchlist" to save!
                  </p>
                  <button
                    id="watchlist-to-explore"
                    onClick={() => setActiveTab("explore")}
                    className="rounded-lg bg-neutral-850 border border-neutral-800 px-4 py-2 text-xs font-semibold hover:bg-neutral-800 text-red-400 cursor-pointer"
                  >
                    Browse Explore
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-8">
                  {watchlistMovies.map((movie) => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      onClick={async () => {
                        try {
                          setSelectedMovie(movie); // Instant transition
                          const res = await fetch(`/api/movies/detail/${movie.id}`);
                          if (res.ok) {
                            const fullDetail = await res.json();
                            setSelectedMovie(fullDetail);
                          }
                        } catch (err) {
                          console.error("Failed fetching movie details:", err);
                        }
                      }}
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
              <AIMatchmaker
                onSelectMovie={async (recMovie) => {
                  try {
                    setSelectedMovie(recMovie); // Instant transition
                    const res = await fetch(`/api/movies/detail/${recMovie.id}`);
                    if (res.ok) {
                      const fullDetail = await res.json();
                      setSelectedMovie(fullDetail);
                    }
                  } catch (err) {
                    console.error("Failed fetching movie details:", err);
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
