import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  User, Star, BookMarked, Eye, MessageSquare, Edit3, Check, X,
  Film, Heart, BarChart2, TrendingUp, Loader2, AlertCircle, ChevronRight
} from "lucide-react";
import { auth } from "../firebase";
import { getProfileWithGenres, updateProfile, saveFavoriteGenres } from "../services/supabase/profiles";
import { listUserRatings } from "../services/supabase/ratings";
import { listUserReviews } from "../services/supabase/reviews";
import { listRecentlyViewed } from "../services/supabase/recentlyViewed";
import { getOrCreateDefaultWatchlist, listWatchlistMovies } from "../services/supabase/watchlists";
import { ALL_GENRES } from "../movies-data";
import type {
  SupabaseRating,
  SupabaseReview,
  SupabaseRecentlyViewed,
  SupabaseWatchlistMovie,
} from "../types/supabase";

// ─── tiny helpers ────────────────────────────────────────────────────────────

function genreFreq(items: { genres?: string[] | null }[]): Record<string, number> {
  const f: Record<string, number> = {};
  for (const item of items)
    for (const g of item.genres ?? [])
      f[g] = (f[g] ?? 0) + 1;
  return f;
}

// ─── small display components ────────────────────────────────────────────────

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-5 py-4 min-w-[88px]">
      <Icon className="h-4 w-4 text-red-500 mb-0.5" />
      <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
      <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-red-500" />
      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">{title}</h3>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800/60 py-8 text-center">
      <Film className="h-7 w-7 text-neutral-700 mx-auto mb-2" />
      <p className="text-xs text-neutral-500">{msg}</p>
    </div>
  );
}

function PosterStrip({ items }: { items: { key: string; title: string; poster_path?: string | null }[] }) {
  if (!items.length) return <Empty msg="Nothing here yet." />;
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {items.slice(0, 8).map((item, i) => (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex-shrink-0 w-[88px]"
        >
          <div className="aspect-[2/3] rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700/40">
            {item.poster_path
              ? <img src={item.poster_path} alt={item.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Film className="h-5 w-5 text-neutral-600" /></div>
            }
          </div>
          <p className="mt-1.5 text-[10px] text-neutral-400 line-clamp-2 text-center leading-snug">{item.title}</p>
        </motion.div>
      ))}
    </div>
  );
}

function GenreBar({ genre, count, max }: { genre: string; count: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-400 w-24 shrink-0 truncate">{genre}</span>
      <div className="flex-1 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
          initial={{ width: 0 }}
          animate={{ width: `${max > 0 ? Math.round((count / max) * 100) : 0}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-neutral-500 w-5 text-right">{count}</span>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function UserProfile() {
  const firebaseUser = auth.currentUser;
  const userId = firebaseUser?.uid ?? null;

  // profile
  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
    email: string | null;
    favorite_genres: string[];
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // activity
  const [ratings, setRatings] = useState<SupabaseRating[]>([]);
  const [reviews, setReviews] = useState<SupabaseReview[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<SupabaseRecentlyViewed[]>([]);
  const [watchlistMovies, setWatchlistMovies] = useState<SupabaseWatchlistMovie[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // edit
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setProfileLoading(true);
    setProfileError(null);
    const res = await getProfileWithGenres(userId);
    if (res.error || !res.data) {
      setProfileError(res.error ?? "Could not load profile.");
    } else {
      setProfile({
        display_name: res.data.display_name,
        avatar_url: res.data.avatar_url,
        email: res.data.email,
        favorite_genres: res.data.favorite_genres ?? [],
      });
    }
    setProfileLoading(false);
  }, [userId]);

  const loadActivity = useCallback(async () => {
    if (!userId) return;
    setActivityLoading(true);
    const [ratRes, revRes, rvRes] = await Promise.all([
      listUserRatings(userId, 20),
      listUserReviews(userId, 20),
      listRecentlyViewed(userId, 12),
    ]);
    setRatings(ratRes.data ?? []);
    setReviews(revRes.data ?? []);
    setRecentlyViewed(rvRes.data ?? []);

    const wlRes = await getOrCreateDefaultWatchlist(userId);
    if (!wlRes.error && wlRes.data) {
      const movRes = await listWatchlistMovies(wlRes.data.id);
      setWatchlistMovies(movRes.data ?? []);
    }
    setActivityLoading(false);
  }, [userId]);

  useEffect(() => { loadProfile(); loadActivity(); }, [loadProfile, loadActivity]);

  const startEdit = () => {
    setEditName(profile?.display_name ?? "");
    setEditAvatar(profile?.avatar_url ?? "");
    setEditGenres(profile?.favorite_genres ?? []);
    setSaveError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!userId) return;
    setSaving(true);
    setSaveError(null);
    const [pr, gr] = await Promise.all([
      updateProfile(userId, { display_name: editName.trim() || null, avatar_url: editAvatar.trim() || null }),
      saveFavoriteGenres(userId, editGenres),
    ]);
    setSaving(false);
    if (pr.error || gr.error) { setSaveError(pr.error ?? gr.error ?? "Failed to save."); return; }
    setProfile(prev => prev ? { ...prev, display_name: editName.trim() || null, avatar_url: editAvatar.trim() || null, favorite_genres: editGenres } : prev);
    setEditing(false);
  };

  // ─── guards ───────────────────────────────────────────────────────────────

  if (!firebaseUser) return (
    <div className="flex flex-col items-center justify-center py-32 text-center px-6">
      <User className="h-12 w-12 text-neutral-700 mb-4" />
      <h2 className="text-lg font-bold text-white mb-2">Sign in to view your profile</h2>
      <p className="text-sm text-neutral-500">Your activity, ratings and watchlist live here.</p>
    </div>
  );

  if (profileLoading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="h-7 w-7 text-red-500 animate-spin" />
    </div>
  );

  if (profileError) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-6">
      <AlertCircle className="h-7 w-7 text-red-500" />
      <p className="text-sm text-neutral-400">{profileError}</p>
      <button onClick={loadProfile} className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer">Retry</button>
    </div>
  );

  // ─── derived ─────────────────────────────────────────────────────────────

  const displayName = profile?.display_name ?? firebaseUser.displayName ?? "Cinephile";
  const avatarUrl   = profile?.avatar_url   ?? firebaseUser.photoURL   ?? null;
  const email       = profile?.email        ?? firebaseUser.email       ?? "";
  const favGenres   = profile?.favorite_genres ?? [];

  const avgRating = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : null;

  const watchedFreq = genreFreq(recentlyViewed);
  const topWatched  = Object.entries(watchedFreq).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const maxWatched  = topWatched[0]?.[1] ?? 1;

  const genreRatingMap: Record<string, { sum: number; n: number }> = {};
  for (const r of ratings) {
    const rv = recentlyViewed.find(v => v.movie_id === r.movie_id);
    for (const g of rv?.genres ?? []) {
      if (!genreRatingMap[g]) genreRatingMap[g] = { sum: 0, n: 0 };
      genreRatingMap[g].sum += r.rating;
      genreRatingMap[g].n  += 1;
    }
  }
  const topRatedGenres = Object.entries(genreRatingMap)
    .map(([g, v]) => [g, v.sum / v.n] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4 py-10 space-y-10"
    >
      {/* ── HEADER CARD ── */}
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

          {/* avatar */}
          <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-red-600/50 bg-neutral-800 flex items-center justify-center flex-shrink-0">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              : <User className="h-10 w-10 text-neutral-500" />
            }
          </div>

          {/* info / edit form */}
          <div className="flex-1 w-full text-center sm:text-left">
            <AnimatePresence mode="wait">
              {editing ? (
                <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Display name"
                    className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                  <input
                    value={editAvatar}
                    onChange={e => setEditAvatar(e.target.value)}
                    placeholder="Avatar URL (optional)"
                    className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                  <div>
                    <p className="text-xs text-neutral-500 mb-2 text-left">Favorite genres</p>
                    <div className="flex flex-wrap gap-2">
                      {ALL_GENRES.filter(g => g !== "All").map(g => (
                        <button
                          key={g}
                          onClick={() => setEditGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                            editGenres.includes(g)
                              ? "bg-red-600 border-red-500 text-white"
                              : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                          }`}
                        >{g}</button>
                      ))}
                    </div>
                  </div>
                  {saveError && <p className="text-xs text-red-400">{saveError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveEdit} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
                    </button>
                    <button onClick={() => setEditing(false)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer">
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                    <h2 className="text-2xl font-bold text-white">{displayName}</h2>
                    <button onClick={startEdit} className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-neutral-500 mb-3">{email}</p>
                  {favGenres.length > 0 && (
                    <div className="flex flex-wrap justify-center sm:justify-start gap-1.5">
                      {favGenres.map(g => (
                        <span key={g} className="px-2.5 py-0.5 rounded-full bg-red-600/20 border border-red-600/30 text-red-400 text-[11px] font-medium">{g}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* stats row */}
        <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-6 pt-6 border-t border-neutral-800">
          <Stat icon={BookMarked}    label="Watchlist" value={watchlistMovies.length} />
          <Stat icon={Star}          label="Ratings"   value={ratings.length} />
          <Stat icon={MessageSquare} label="Reviews"   value={reviews.length} />
          <Stat icon={Eye}           label="Viewed"    value={recentlyViewed.length} />
        </div>
      </div>

      {/* ── ACTIVITY ── */}
      {activityLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 text-red-500 animate-spin" /></div>
      ) : (
        <div className="space-y-10">

          <section>
            <SectionTitle icon={Eye} title="Recently Viewed" />
            <PosterStrip items={recentlyViewed.map(rv => ({ key: rv.id, title: rv.title, poster_path: rv.poster_path }))} />
          </section>

          <section>
            <SectionTitle icon={BookMarked} title="Watchlist" />
            <PosterStrip items={watchlistMovies.map(wm => ({ key: wm.id, title: wm.title, poster_path: wm.poster_path }))} />
          </section>

          <section>
            <SectionTitle icon={Star} title="Recently Rated" />
            {ratings.length === 0 ? <Empty msg="You haven't rated any movies yet." /> : (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 divide-y divide-neutral-800/60">
                {ratings.slice(0, 8).map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-neutral-300 truncate pr-4">{r.movie_title}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-semibold text-white">{r.rating}<span className="text-neutral-500 font-normal">/10</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionTitle icon={MessageSquare} title="Recently Reviewed" />
            {reviews.length === 0 ? <Empty msg="You haven't written any reviews yet." /> : (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 divide-y divide-neutral-800/60">
                {reviews.slice(0, 6).map(r => (
                  <div key={r.id} className="py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-neutral-200 truncate pr-4">{r.movie_title}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-white">{r.rating}/10</span>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── INSIGHTS ── */}
          <section>
            <div className="flex items-center gap-2 mb-5">
              <BarChart2 className="h-4 w-4 text-red-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Profile Insights</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Avg. Rating Given</span>
                </div>
                {avgRating
                  ? <div className="flex items-end gap-1"><span className="text-4xl font-bold text-white">{avgRating}</span><span className="text-neutral-500 text-sm mb-1">/10</span></div>
                  : <p className="text-xs text-neutral-600">Rate some movies to see your average.</p>
                }
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Film className="h-4 w-4 text-red-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Most Watched Genres</span>
                </div>
                {topWatched.length > 0
                  ? <div className="space-y-2.5">{topWatched.map(([g, c]) => <GenreBar key={g} genre={g} count={c} max={maxWatched} />)}</div>
                  : <p className="text-xs text-neutral-600">Watch some movies to see your patterns.</p>
                }
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Favorite Genres</span>
                </div>
                {favGenres.length > 0
                  ? <div className="flex flex-wrap gap-2">{favGenres.map(g => <span key={g} className="px-3 py-1 rounded-full bg-red-600/20 border border-red-600/30 text-red-400 text-xs font-medium">{g}</span>)}</div>
                  : <button onClick={startEdit} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"><ChevronRight className="h-3.5 w-3.5" />Set your favorite genres</button>
                }
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Highest Rated Genres</span>
                </div>
                {topRatedGenres.length > 0
                  ? <div className="space-y-2">
                      {topRatedGenres.map(([g, avg]) => (
                        <div key={g} className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">{g}</span>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-xs font-semibold text-white">{avg.toFixed(1)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  : <p className="text-xs text-neutral-600">Rate movies across genres to see this.</p>
                }
              </div>

            </div>
          </section>
        </div>
      )}
    </motion.div>
  );
}