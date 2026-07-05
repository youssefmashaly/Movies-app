import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import {
  Star, Eye, MessageSquare, BookMarked, TrendingUp,
  Film, Heart, Award, Zap, Target, Loader2, ChevronRight,
  Users, Sparkles, Globe
} from "lucide-react";
import { auth } from "../firebase";
import { listUserRatings } from "../services/supabase/ratings";
import { listUserReviews } from "../services/supabase/reviews";
import {
  getFollowingIds,
  getSuggestedUsers,
  getRatingsFromUsers,
  getCommunityFavoriteMovies,
  type CollaborativeMovieSignal,
} from "../services/supabase/social";
import { startTiming, endTiming } from "../lib/analytics";
import MovieRail from "./MovieRail";
import type { Movie } from "../types";
import type { SupabaseRating, SupabaseReview } from "../types/supabase";

// Deterministic per-session shuffle (mulberry32) — mirrors the same helper in
// App.tsx. Duplicated locally rather than extracted to a shared module to
// keep this an additive, self-contained change (no new shared-utils file).
function seededShuffle<T>(arr: T[], seed: number): T[] {
  let s = seed;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function genreFreq(movies: Movie[]): Record<string, number> {
  const f: Record<string, number> = {};
  for (const m of movies)
    for (const g of m.genres ?? [])
      f[g] = (f[g] ?? 0) + 1;
  return f;
}

function topGenres(freq: Record<string, number>, n = 3): string[] {
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(([g]) => g);
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatBadge({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number | string; color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-5 py-4 min-w-[88px]">
      <Icon className={`h-4 w-4 ${color} mb-0.5`} />
      <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
      <span className="text-[10px] text-neutral-500 uppercase tracking-wider text-center">{label}</span>
    </div>
  );
}

function Achievement({ icon: Icon, label, desc, unlocked }: {
  icon: React.ElementType; label: string; desc: string; unlocked: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
      unlocked
        ? "border-amber-500/30 bg-amber-500/10"
        : "border-neutral-800 bg-neutral-900/40 opacity-50"
    }`}>
      <div className={`rounded-xl p-2 flex-shrink-0 ${unlocked ? "bg-amber-500/20 text-amber-400" : "bg-neutral-800 text-neutral-600"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${unlocked ? "text-amber-300" : "text-neutral-500"}`}>{label}</p>
        <p className="text-[10px] text-neutral-600 leading-snug">{desc}</p>
      </div>
      {unlocked && <Zap className="h-3 w-3 text-amber-400 ml-auto flex-shrink-0" />}
    </div>
  );
}

function SectionLabel({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-red-500" />
      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">{title}</h3>
    </div>
  );
}

// Empty-state variant of a MovieRail's header — used when a personalized row
// has no data yet, so the section explains itself instead of silently vanishing.
function DashboardEmptyRail({
  icon: Icon,
  title,
  subtitle,
  message,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  message: string;
}) {
  return (
    <section>
      <div className="flex items-end justify-between mb-4 gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg sm:text-xl font-extrabold tracking-tight text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border bg-neutral-800/40 border-neutral-700">
              <Icon className="h-3.5 w-3.5 text-neutral-500" />
            </span>
            {title}
          </h2>
          {subtitle && <p className="text-xs text-neutral-500 mt-1 ml-9">{subtitle}</p>}
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 py-10 px-6 text-center">
        <Icon className="h-7 w-7 text-neutral-700 mx-auto mb-3" />
        <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">{message}</p>
      </div>
    </section>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

interface UserDashboardProps {
  recentlyViewed: Movie[];
  watchlistMovies: Movie[];
  favoriteGenres: string[];
  combinedMoviePool: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onToggleSave: (movie: Movie) => void;
  watchlistIds: Set<string>;
}

export default function UserDashboard({
  recentlyViewed,
  watchlistMovies,
  favoriteGenres,
  combinedMoviePool,
  onSelectMovie,
  onToggleSave,
  watchlistIds,
}: UserDashboardProps) {
  const firebaseUser = auth.currentUser;
  const userId = firebaseUser?.uid ?? null;

  const [ratings, setRatings] = useState<SupabaseRating[]>([]);
  const [reviews, setReviews] = useState<SupabaseReview[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Session-stable shuffle seed, mirrors the pattern used in App.tsx's rails.
  const [sessionSeed] = useState<number>(() => Math.floor(Math.random() * 2 ** 31));

  // Collaborative discovery signals (Phase 11A final batch)
  const [followingHighlyRated, setFollowingHighlyRated] = useState<CollaborativeMovieSignal[]>([]);
  const [similarTasteHighlyRated, setSimilarTasteHighlyRated] = useState<CollaborativeMovieSignal[]>([]);
  const [communityFavorites, setCommunityFavorites] = useState<CollaborativeMovieSignal[]>([]);

  useEffect(() => {
    if (!userId) { setActivityLoading(false); return; }
    setActivityLoading(true);
    startTiming(`dashboard-render-${userId}`);
    Promise.all([
      listUserRatings(userId, 50),
      listUserReviews(userId, 20),
      getFollowingIds(userId),
    ]).then(([r, rv, followRes]) => {
      setRatings(r.data ?? []);
      setReviews(rv.data ?? []);
      setActivityLoading(false);
      endTiming(`dashboard-render-${userId}`);

      // Collaborative signals load separately/non-blocking — the core
      // dashboard (ratings/reviews) never waits on these extra queries.
      const followingIds = followRes.data ?? [];
      Promise.all([
        followingIds.length > 0 ? getRatingsFromUsers(followingIds, 8, 200) : Promise.resolve({ data: [], error: null }),
        getSuggestedUsers(userId, favoriteGenres, followingIds, 10),
        getCommunityFavoriteMovies(1000),
      ]).then(([followRatingsRes, suggestedRes, communityRes]) => {
        setFollowingHighlyRated(followRatingsRes.data ?? []);
        setCommunityFavorites(communityRes.data ?? []);

        const similarTasteIds = (suggestedRes.data ?? [])
          .filter((u) => u.tasteMatchPct > 0)
          .map((u) => u.id);
        if (similarTasteIds.length > 0) {
          getRatingsFromUsers(similarTasteIds, 8, 200).then((res) => {
            setSimilarTasteHighlyRated(res.data ?? []);
          });
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ─── derived ───────────────────────────────────────────────────────────────

  const avgRating = useMemo(() => {
    if (!ratings.length) return null;
    return (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1);
  }, [ratings]);

  const watchedGenreFreq = useMemo(() => genreFreq(recentlyViewed), [recentlyViewed]);
  const mostWatchedGenres = useMemo(() => topGenres(watchedGenreFreq, 3), [watchedGenreFreq]);
  const primaryGenre = mostWatchedGenres[0] ?? favoriteGenres[0] ?? null;

  const lastWatched = recentlyViewed[0] ?? null;

  const becauseYouWatched = useMemo(() => {
    if (!lastWatched) return [];
    const ranked = combinedMoviePool
      .filter((m) => m.id !== lastWatched.id && m.genres?.some((g) => lastWatched.genres?.includes(g)))
      .sort((a, b) => b.voteAverage - a.voteAverage);
    // Widen past the display count, then seeded-shuffle just that widened set —
    // same relevance tier, less repetition of the exact same top-N every time.
    return seededShuffle(ranked.slice(0, 24), sessionSeed).slice(0, 12);
  }, [lastWatched, combinedMoviePool, sessionSeed]);

  // ── Collaborative discovery rails: map aggregated signals onto full Movie
  // objects using the pool already in memory — no extra network calls. ──
  const followingHighlyRatedMovies = useMemo(() => {
    const scoreMap = new Map(followingHighlyRated.map((s) => [s.movie_id, s.avgRating]));
    return combinedMoviePool
      .filter((m) => scoreMap.has(m.id))
      .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))
      .slice(0, 12);
  }, [followingHighlyRated, combinedMoviePool]);

  const similarTasteHighlyRatedMovies = useMemo(() => {
    const scoreMap = new Map(similarTasteHighlyRated.map((s) => [s.movie_id, s.avgRating]));
    return combinedMoviePool
      .filter((m) => scoreMap.has(m.id))
      .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))
      .slice(0, 12);
  }, [similarTasteHighlyRated, combinedMoviePool]);

  const communityFavoriteMovies = useMemo(() => {
    const scoreMap = new Map(communityFavorites.map((s) => [s.movie_id, s.avgRating]));
    return combinedMoviePool
      .filter((m) => scoreMap.has(m.id))
      .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))
      .slice(0, 12);
  }, [communityFavorites, combinedMoviePool]);

  const basedOnFavorites = useMemo(() => {
    const genres = favoriteGenres.length ? favoriteGenres : mostWatchedGenres;
    if (!genres.length) return [];
    return combinedMoviePool
      .filter((m) => !watchlistIds.has(m.id) && m.genres?.some((g) => genres.includes(g)))
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 16);
  }, [favoriteGenres, mostWatchedGenres, combinedMoviePool, watchlistIds]);

  const trendingInGenre = useMemo(() => {
    if (!primaryGenre) return [];
    return combinedMoviePool
      .filter((m) => m.genres?.includes(primaryGenre))
      .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
      .slice(0, 12);
  }, [primaryGenre, combinedMoviePool]);

  const yourHighestRated = useMemo(() => {
    const ratingMap = new Map(ratings.map((r) => [r.movie_id, r.rating]));
    return combinedMoviePool
      .filter((m) => ratingMap.has(m.id))
      .sort((a, b) => (ratingMap.get(b.id) ?? 0) - (ratingMap.get(a.id) ?? 0))
      .slice(0, 12);
  }, [ratings, combinedMoviePool]);

  const hiddenGemsForYou = useMemo(() => {
    const genres = favoriteGenres.length ? favoriteGenres : mostWatchedGenres;
    return combinedMoviePool
      .filter((m) =>
        !watchlistIds.has(m.id) &&
        m.voteAverage >= 7.8 &&
        (m.voteCount ?? 0) < 15000 &&
        (genres.length === 0 || m.genres?.some((g) => genres.includes(g)))
      )
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 12);
  }, [favoriteGenres, mostWatchedGenres, combinedMoviePool, watchlistIds]);

  const achievements = useMemo(() => [
    { icon: MessageSquare, label: "First Review",   desc: "Write your first movie review",       unlocked: reviews.length >= 1 },
    { icon: Star,          label: "Critic",         desc: "Rate 10 or more movies",              unlocked: ratings.length >= 10 },
    { icon: BookMarked,    label: "Collector",      desc: "Add 25 movies to your watchlist",     unlocked: watchlistMovies.length >= 25 },
    { icon: Film,          label: "Genre Explorer", desc: "Watch movies in 5 different genres",  unlocked: Object.keys(watchedGenreFreq).length >= 5 },
    { icon: Eye,           label: "Cinephile",      desc: "Watch 20 or more movies",             unlocked: recentlyViewed.length >= 20 },
    { icon: Award,         label: "Reviewer",       desc: "Write 5 or more reviews",             unlocked: reviews.length >= 5 },
  ], [reviews.length, ratings.length, watchlistMovies.length, watchedGenreFreq, recentlyViewed.length]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  // ─── unauthenticated guard ────────────────────────────────────────────────

  if (!firebaseUser) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-6">
        <Film className="h-12 w-12 text-neutral-700 mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Sign in to see your dashboard</h2>
        <p className="text-sm text-neutral-500">Your personalized movie universe lives here.</p>
      </div>
    );
  }

  const displayName = firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "Cinephile";

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 py-8 space-y-12"
    >
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Your Dashboard</p>
          <h1 className="text-3xl font-bold text-white">
            Welcome back, <span className="text-red-400">{displayName}</span>
          </h1>
          {primaryGenre && (
            <p className="text-sm text-neutral-400 mt-1">
              Your most-watched genre:{" "}
              <span className="text-white font-medium">{primaryGenre}</span>
            </p>
          )}
        </div>
        {!activityLoading && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Award className="h-4 w-4 text-amber-400" />
            <span>{unlockedCount}/{achievements.length} achievements unlocked</span>
          </div>
        )}
      </div>

      {/* ── STATS ── */}
      <section>
        <SectionLabel icon={TrendingUp} title="Your Activity" />
        <div className="flex flex-wrap gap-3">
          <StatBadge icon={Eye}           label="Watched"    value={recentlyViewed.length}  color="text-teal-400" />
          <StatBadge icon={BookMarked}    label="Watchlist"  value={watchlistMovies.length} color="text-red-400" />
          <StatBadge icon={Star}          label="Rated"      value={ratings.length}         color="text-amber-400" />
          <StatBadge icon={MessageSquare} label="Reviews"    value={reviews.length}         color="text-indigo-400" />
          {avgRating && (
            <StatBadge icon={Target} label="Avg Rating" value={avgRating} color="text-emerald-400" />
          )}
        </div>
      </section>

      {activityLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 text-red-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── CONTINUE WATCHING ── */}
          {recentlyViewed.length > 0 ? (
            <MovieRail
              id="dash-recently-viewed"
              title="Continue Watching"
              subtitle="Pick up where you left off"
              icon={Eye}
              accent="teal"
              movies={recentlyViewed.slice(0, 12)}
              isLoading={false}
              onMovieClick={onSelectMovie}
              isSaved={(id) => watchlistIds.has(id)}
              onToggleSave={onToggleSave}
            />
          ) : (
            <DashboardEmptyRail
              icon={Eye}
              title="Continue Watching"
              subtitle="Pick up where you left off"
              message="Nothing here yet. Open any movie's page and it'll show up in this row so you can jump back in later."
            />
          )}

          {/* ── BECAUSE YOU WATCHED ── */}
          {lastWatched && becauseYouWatched.length >= 4 ? (
            <MovieRail
              id="dash-because-watched"
              title={`Because You Watched ${lastWatched.title}`}
              subtitle="Movies with a similar feel"
              icon={ChevronRight}
              accent="red"
              movies={becauseYouWatched}
              isLoading={false}
              onMovieClick={onSelectMovie}
              isSaved={(id) => watchlistIds.has(id)}
              onToggleSave={onToggleSave}
            />
          ) : (
            <DashboardEmptyRail
              icon={ChevronRight}
              title="Because You Watched..."
              subtitle="Movies with a similar feel"
              message={
                lastWatched
                  ? `We don't have enough similar titles to ${lastWatched.title} yet. Explore a few more genres to unlock this row.`
                  : "Watch a movie first and we'll build a row of similar picks based on it."
              }
            />
          )}

          {/* ── YOUR WATCHLIST ── */}
          {watchlistMovies.length > 0 ? (
            <MovieRail
              id="dash-watchlist"
              title="Your Watchlist"
              subtitle="Movies you've saved to watch"
              icon={BookMarked}
              accent="indigo"
              movies={watchlistMovies.slice(0, 16)}
              isLoading={false}
              onMovieClick={onSelectMovie}
              isSaved={(id) => watchlistIds.has(id)}
              onToggleSave={onToggleSave}
            />
          ) : (
            <DashboardEmptyRail
              icon={BookMarked}
              title="Your Watchlist"
              subtitle="Movies you've saved to watch"
              message="Your watchlist is empty. Tap the bookmark icon on any movie card to save it here."
            />
          )}

          {/* ── BASED ON FAVORITE GENRES ── */}
          {basedOnFavorites.length >= 4 && (
            <MovieRail
              id="dash-fav-genres"
              title="Based on Your Taste"
              subtitle={
                favoriteGenres.length > 0
                  ? `Picked for your love of ${favoriteGenres.slice(0, 2).join(" & ")}`
                  : "Curated from your most-watched genres"
              }
              icon={Heart}
              accent="red"
              movies={basedOnFavorites}
              isLoading={false}
              onMovieClick={onSelectMovie}
              isSaved={(id) => watchlistIds.has(id)}
              onToggleSave={onToggleSave}
            />
          )}

          {/* ── YOUR HIGHEST RATED ── */}
          {yourHighestRated.length >= 2 && (
            <MovieRail
              id="dash-highest-rated"
              title="Your Highest Rated"
              subtitle="Movies you personally loved"
              icon={Star}
              accent="amber"
              movies={yourHighestRated}
              isLoading={false}
              onMovieClick={onSelectMovie}
              isSaved={(id) => watchlistIds.has(id)}
              onToggleSave={onToggleSave}
            />
          )}

          {/* ── TRENDING IN YOUR GENRE ── */}
          {trendingInGenre.length >= 4 && primaryGenre ? (
            <MovieRail
              id="dash-trending-genre"
              title={`Trending in ${primaryGenre}`}
              subtitle="The most-watched films in your favourite genre"
              icon={TrendingUp}
              accent="teal"
              movies={trendingInGenre}
              isLoading={false}
              onMovieClick={onSelectMovie}
              isSaved={(id) => watchlistIds.has(id)}
              onToggleSave={onToggleSave}
            />
          ) : (
            <DashboardEmptyRail
              icon={TrendingUp}
              title="Trending in Your Favorite Genres"
              subtitle="The most-watched films in your favourite genre"
              message={
                primaryGenre
                  ? `Not enough trending titles in ${primaryGenre} yet. Check back after watching a few more movies.`
                  : "Pick a few favorite genres in your profile, or watch some movies, to see what's trending in your favorites."
              }
            />
          )}

          {/* ── HIDDEN GEMS FOR YOU ── */}
          {hiddenGemsForYou.length >= 4 ? (
            <MovieRail
              id="dash-hidden-gems"
              title="Hidden Gems For You"
              subtitle="Underrated picks that match your taste"
              icon={Film}
              accent="emerald"
              movies={hiddenGemsForYou}
              isLoading={false}
              onMovieClick={onSelectMovie}
              isSaved={(id) => watchlistIds.has(id)}
              onToggleSave={onToggleSave}
            />
          ) : (
            <DashboardEmptyRail
              icon={Film}
              title="Hidden Gems For You"
              subtitle="Underrated picks that match your taste"
              message="We need a bit more signal to surface hidden gems. Save a few favorite genres or watch some movies to unlock this row."
            />
          )}

          {/* ── GENRE BREAKDOWN ── */}
          {mostWatchedGenres.length > 0 && (
            <section>
              <SectionLabel icon={Film} title="Your Genre Profile" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(watchedGenreFreq)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([genre, count]) => {
                    const max = Math.max(...Object.values(watchedGenreFreq));
                    const pct = Math.round((count / max) * 100);
                    return (
                      <div key={genre} className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-white">{genre}</span>
                          <span className="text-[10px] text-neutral-500">{count} film{count !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* ── HIGHLY RATED BY PEOPLE YOU FOLLOW ── */}
          {followingHighlyRatedMovies.length >= 4 && (
            <MovieRail
              id="dash-following-rated"
              title="Highly Rated By People You Follow"
              subtitle="What the people you follow loved"
              icon={Users}
              accent="red"
              movies={followingHighlyRatedMovies}
              isLoading={false}
              onMovieClick={onSelectMovie}
              isSaved={(id) => watchlistIds.has(id)}
              onToggleSave={onToggleSave}
            />
          )}

          {/* ── POPULAR AMONG SIMILAR USERS ── */}
          {similarTasteHighlyRatedMovies.length >= 4 && (
            <MovieRail
              id="dash-similar-taste-rated"
              title="Popular Among Similar Users"
              subtitle="Loved by people with taste like yours"
              icon={Sparkles}
              accent="indigo"
              movies={similarTasteHighlyRatedMovies}
              isLoading={false}
              onMovieClick={onSelectMovie}
              isSaved={(id) => watchlistIds.has(id)}
              onToggleSave={onToggleSave}
            />
          )}

          {/* ── COMMUNITY FAVORITES ── */}
          {communityFavoriteMovies.length >= 4 && (
            <MovieRail
              id="dash-community-favorites"
              title="Community Favorites"
              subtitle="Highly rated across the whole community"
              icon={Globe}
              accent="amber"
              movies={communityFavoriteMovies}
              isLoading={false}
              onMovieClick={onSelectMovie}
              isSaved={(id) => watchlistIds.has(id)}
              onToggleSave={onToggleSave}
            />
          )}

          {/* ── ACHIEVEMENTS ── */}
          <section>
            <SectionLabel icon={Award} title={`Achievements · ${unlockedCount}/${achievements.length}`} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {achievements.map((a) => (
                <Achievement key={a.label} {...a} />
              ))}
            </div>
          </section>

          {/* ── RECENTLY REVIEWED ── */}
          {reviews.length > 0 ? (
            <section>
              <SectionLabel icon={MessageSquare} title="Recently Reviewed" />
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 divide-y divide-neutral-800/60">
                {reviews.slice(0, 5).map((r) => (
                  <div key={r.id} className="py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-neutral-200 truncate pr-4">{r.movie_title}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-semibold text-white">{r.rating}/10</span>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{r.comment}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section>
              <SectionLabel icon={MessageSquare} title="Recently Reviewed" />
              <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 py-10 px-6 text-center">
                <MessageSquare className="h-7 w-7 text-neutral-700 mx-auto mb-3" />
                <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                  You haven't reviewed anything yet. Share your thoughts on a movie you've watched and it'll show up here.
                </p>
              </div>
            </section>
          )}

          </>
      )}
    </motion.div>
  );
}