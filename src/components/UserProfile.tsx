import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  User, Star, BookMarked, Eye, MessageSquare, Edit3, Check, X,
  Film, Heart, BarChart2, TrendingUp, Loader2, AlertCircle, ChevronRight,
  Users, UserPlus, UserCheck, ArrowLeft, Share2, Award, Clapperboard, Gauge
} from "lucide-react";
import { auth } from "../firebase";
import { getProfileWithGenres, updateProfile, saveFavoriteGenres } from "../services/supabase/profiles";
import { listUserRatings } from "../services/supabase/ratings";
import { listUserReviews } from "../services/supabase/reviews";
import { listRecentlyViewed } from "../services/supabase/recentlyViewed";
import { getOrCreateDefaultWatchlist, listWatchlists, listWatchlistMovies } from "../services/supabase/watchlists";
import {
  getFollowCounts, listFollowers, listFollowing, followUser, unfollowUser,
  checkIsFollowing, getPublicProfile, getReviewLikeCounts, computeBadges,
  type FollowWithProfile, type Badge,
} from "../services/supabase/social";
import { ALL_GENRES } from "../movies-data";
import { loadMovieCatalog, getCachedCatalog } from "../lib/movieCatalog";
import { computeFavoriteDecadeAndDirector, computeTasteMatchPct } from "../lib/profileInsights";
import { useFocusTrap } from "../lib/useFocusTrap";
import { useToast } from "../context/ToastContext";
import type { Movie } from "../types";
import type {
  SupabaseRating,
  SupabaseReview,
  SupabaseRecentlyViewed,
  SupabaseWatchlistMovie,
} from "../types/supabase";

interface UserProfileProps {
  /** If provided and differs from the signed-in user's own uid, the profile
   *  renders in read-only "public profile" mode (Follow button, Taste
   *  Match, no editing). Omit (or pass your own uid) to view/edit your own
   *  profile — the original behavior. */
  viewedUserId?: string;
  /** Shown as a "Back" affordance when viewing someone else's profile. */
  onBack?: () => void;
  /** Called when the person clicks another user (e.g. in a followers list)
   *  so the parent can navigate the profile tab to that user. */
  onViewProfile?: (userId: string) => void;
  /** Phase 21 — when true (and this is the signed-in user's own profile),
   *  opens directly into edit mode once the profile has loaded. Used by
   *  the account dropdown's "Settings" item, since account editing already
   *  lives on this screen. */
  initialEditMode?: boolean;
  /** Phase 21 — called once initialEditMode has been acted on, so the
   *  parent can reset its one-shot flag and editing doesn't reopen on
   *  every subsequent profile visit. */
  onEditModeConsumed?: () => void;
}

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
      <Icon className="h-4 w-4 text-red-500 mb-0.5" aria-hidden="true" />
      <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
      <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-red-500" aria-hidden="true" />
      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">{title}</h3>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800/60 py-8 text-center">
      <Film className="h-7 w-7 text-neutral-700 mx-auto mb-2" aria-hidden="true" />
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
              : <div className="w-full h-full flex items-center justify-center"><Film className="h-5 w-5 text-neutral-600" aria-hidden="true" /></div>
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

const BADGE_COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-600/15 border-blue-600/30 text-blue-400",
  indigo: "bg-indigo-600/15 border-indigo-600/30 text-indigo-400",
  amber: "bg-amber-500/15 border-amber-500/30 text-amber-400",
  teal: "bg-teal-600/15 border-teal-600/30 text-teal-400",
  purple: "bg-purple-600/15 border-purple-600/30 text-purple-400",
  emerald: "bg-emerald-600/15 border-emerald-600/30 text-emerald-400",
  green: "bg-green-600/15 border-green-600/30 text-green-400",
  red: "bg-red-600/15 border-red-600/30 text-red-400",
  yellow: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400",
};

function AchievementBadge({ badge, unlocked }: { badge: Badge; unlocked: boolean }) {
  const colorClass = BADGE_COLOR_CLASSES[badge.color] ?? "bg-neutral-800 border-neutral-700 text-neutral-400";
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-opacity ${
        unlocked ? colorClass : "bg-neutral-900/40 border-neutral-800/60 text-neutral-400 opacity-50"
      }`}
      title={badge.description}
    >
      <span className="text-lg leading-none" aria-hidden="true">{badge.icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate">{badge.label}</p>
        <p className="text-[10px] opacity-80 truncate">{badge.description}</p>
      </div>
    </div>
  );
}

// All achievements the showcase can display — badges not yet unlocked still
// render (dimmed) so users can see what's next, per the "progress indicator"
// requirement. Kept in sync with computeBadges' id/label/icon/color/description.
const ALL_ACHIEVEMENT_DEFS: Badge[] = [
  { id: "reviewer", label: "Reviewer", icon: "✍️", color: "blue", description: "Write your first review" },
  { id: "critic", label: "Critic", icon: "🎬", color: "indigo", description: "Write 10+ reviews" },
  { id: "top-critic", label: "Top Critic", icon: "🏆", color: "amber", description: "Write 25+ reviews" },
  { id: "explorer", label: "Explorer", icon: "🧭", color: "teal", description: "Rate 10+ movies" },
  { id: "cinephile", label: "Cinephile", icon: "🎥", color: "purple", description: "Rate 50+ movies" },
  { id: "collector", label: "Collector", icon: "📚", color: "emerald", description: "Save 20+ movies to your watchlist" },
  { id: "helpful", label: "Helpful", icon: "👍", color: "green", description: "Receive 10+ likes on your reviews" },
  { id: "community-fav", label: "Community Fav", icon: "❤️", color: "red", description: "Receive 50+ likes on your reviews" },
  { id: "rising", label: "Rising Star", icon: "⭐", color: "amber", description: "Reach 5+ followers" },
  { id: "influencer", label: "Top Contributor", icon: "🌟", color: "yellow", description: "Reach 20+ followers" },
  { id: "horror-expert", label: "Horror Fan", icon: "👻", color: "red", description: "Favorite genre includes Horror" },
  { id: "scifi-master", label: "Sci-Fi Master", icon: "🚀", color: "blue", description: "Favorite genre includes Sci-Fi" },
  { id: "drama-fan", label: "Drama Fan", icon: "🎭", color: "purple", description: "Favorite genre includes Drama" },
  { id: "comedy-lover", label: "Comedy Lover", icon: "😂", color: "yellow", description: "Favorite genre includes Comedy" },
];

// ─── main component ──────────────────────────────────────────────────────────

export default function UserProfile({
  viewedUserId,
  onBack,
  onViewProfile,
  initialEditMode,
  onEditModeConsumed
}: UserProfileProps) {
  const firebaseUser = auth.currentUser;
  const myUserId = firebaseUser?.uid ?? null;
  const { showToast } = useToast();

  // The profile actually being displayed. Falls back to "myself" when no
  // explicit target is given — preserves 100% of the original behavior.
  const targetUserId = viewedUserId ?? myUserId;
  const isOwnProfile = !!myUserId && targetUserId === myUserId;

  // profile
  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
    email: string | null;
    favorite_genres: string[];
    created_at?: string | null;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // activity
  const [ratings, setRatings] = useState<SupabaseRating[]>([]);
  const [reviews, setReviews] = useState<SupabaseReview[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<SupabaseRecentlyViewed[]>([]);
  const [watchlistMovies, setWatchlistMovies] = useState<SupabaseWatchlistMovie[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // social
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 });
  const [socialPanel, setSocialPanel] = useState<"followers" | "following" | null>(null);
  const [socialList, setSocialList] = useState<FollowWithProfile[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const socialPanelDialogRef = useFocusTrap<HTMLDivElement>(Boolean(socialPanel));

  // public-mode-only social state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [myFavoriteGenres, setMyFavoriteGenres] = useState<string[]>([]);
  const [reviewLikeTotal, setReviewLikeTotal] = useState(0);

  const [linkCopied, setLinkCopied] = useState(false);

  // edit (self-mode only)
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!targetUserId) return;
    setProfileLoading(true);
    setProfileError(null);
    const res = await getProfileWithGenres(targetUserId);
    if (res.error || !res.data) {
      setProfileError(res.error ?? "Could not load profile.");
    } else {
      setProfile({
        display_name: res.data.display_name,
        avatar_url: res.data.avatar_url,
        email: res.data.email,
        favorite_genres: res.data.favorite_genres ?? [],
        created_at: res.data.created_at ?? null,
      });
    }
    setProfileLoading(false);
  }, [targetUserId]);

  const loadSocial = useCallback(async () => {
    if (!targetUserId) return;
    const res = await getFollowCounts(targetUserId);
    if (res.data) setFollowCounts(res.data);

    if (!isOwnProfile && myUserId) {
      const [followingRes, myProfileRes] = await Promise.all([
        checkIsFollowing(myUserId, targetUserId),
        getPublicProfile(myUserId),
      ]);
      setIsFollowing(followingRes.data ?? false);
      setMyFavoriteGenres(myProfileRes.data?.favorite_genres ?? []);
    }
  }, [targetUserId, isOwnProfile, myUserId]);

  const openSocialPanel = async (type: "followers" | "following") => {
    if (!targetUserId) return;
    setSocialPanel(type);
    setSocialLoading(true);
    setSocialList([]);
    const res = type === "followers" ? await listFollowers(targetUserId) : await listFollowing(targetUserId);
    setSocialList(res.data ?? []);
    setSocialLoading(false);
  };

  const loadActivity = useCallback(async () => {
    if (!targetUserId) return;
    setActivityLoading(true);
    const [ratRes, revRes, rvRes] = await Promise.all([
      listUserRatings(targetUserId, 20),
      listUserReviews(targetUserId, 20),
      listRecentlyViewed(targetUserId, 12),
    ]);
    setRatings(ratRes.data ?? []);
    setReviews(revRes.data ?? []);
    setRecentlyViewed(rvRes.data ?? []);

    // Own profile keeps the original "create a watchlist if none exists"
    // behavior. Viewing someone ELSE's profile must never write on their
    // behalf just because their profile was opened — read-only lookup only.
    if (isOwnProfile) {
      const wlRes = await getOrCreateDefaultWatchlist(targetUserId);
      if (!wlRes.error && wlRes.data) {
        const movRes = await listWatchlistMovies(wlRes.data.id);
        setWatchlistMovies(movRes.data ?? []);
      }
    } else {
      const listsRes = await listWatchlists(targetUserId);
      const firstList = listsRes.data?.[0];
      if (firstList) {
        const movRes = await listWatchlistMovies(firstList.id);
        setWatchlistMovies(movRes.data ?? []);
      } else {
        setWatchlistMovies([]);
      }
    }

    // Review likes received — used for the "Helpful"/"Community Fav"
    // achievements and the stats grid. One capped query, same pattern as
    // getReviewLikeCounts is already used elsewhere (community feed).
    if (revRes.data && revRes.data.length > 0) {
      const likeCountsRes = await getReviewLikeCounts(revRes.data.map((r) => r.id));
      const total = Object.values(likeCountsRes.data ?? {}).reduce((sum, n) => sum + n, 0);
      setReviewLikeTotal(total);
    } else {
      setReviewLikeTotal(0);
    }

    setActivityLoading(false);
  }, [targetUserId, isOwnProfile]);

  useEffect(() => { loadProfile(); loadActivity(); loadSocial(); }, [loadProfile, loadActivity, loadSocial]);

  // Phase 23 — the movie catalog used to be a static PRESET_MOVIES import
  // (module-level MOVIES_BY_ID, above where this component used to live).
  // It's now loaded on demand through the shared movieCatalog loader.
  // getCachedCatalog() gives an instant non-empty value in the (very
  // common) case App.tsx's own initial fetch already completed by the time
  // this tab is opened; loadMovieCatalog() below is a no-op fetch-wise if
  // so (singleton cache) and only does real work for a cold/deep-linked
  // load straight into the Profile tab.
  const [catalogMovies, setCatalogMovies] = useState<Movie[]>(() => getCachedCatalog());
  useEffect(() => {
    let cancelled = false;
    loadMovieCatalog()
      .then((movies) => {
        if (!cancelled) setCatalogMovies(movies);
      })
      .catch((err) => {
        console.error("Failed to load movie catalog for profile insights:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const MOVIES_BY_ID = useMemo(() => new Map(catalogMovies.map((m) => [m.id, m])), [catalogMovies]);

  // Phase 21 — "Settings" in the account dropdown routes here with
  // initialEditMode=true so it opens straight into the edit form rather
  // than just the read view. Fires once profile data is actually loaded,
  // and only for the signed-in user's own profile.
  useEffect(() => {
    if (initialEditMode && isOwnProfile && !profileLoading && profile && !editing) {
      startEdit();
      onEditModeConsumed?.();
    }
  }, [initialEditMode, isOwnProfile, profileLoading, profile, editing, onEditModeConsumed]);

  const startEdit = () => {
    setEditName(profile?.display_name ?? "");
    setEditAvatar(profile?.avatar_url ?? "");
    setEditGenres(profile?.favorite_genres ?? []);
    setSaveError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!targetUserId) return;
    setSaving(true);
    setSaveError(null);
    const [pr, gr] = await Promise.all([
      updateProfile(targetUserId, { display_name: editName.trim() || null, avatar_url: editAvatar.trim() || null }),
      saveFavoriteGenres(targetUserId, editGenres),
    ]);
    setSaving(false);
    if (pr.error || gr.error) { setSaveError(pr.error ?? gr.error ?? "Failed to save."); return; }
    setProfile(prev => prev ? { ...prev, display_name: editName.trim() || null, avatar_url: editAvatar.trim() || null, favorite_genres: editGenres } : prev);
    setEditing(false);
  };

  const toggleFollow = async () => {
    if (!myUserId || !targetUserId || isOwnProfile) return;
    setFollowBusy(true);
    const res = isFollowing ? await unfollowUser(myUserId, targetUserId) : await followUser(myUserId, targetUserId);
    if (!res.error) {
      setIsFollowing(!isFollowing);
      setFollowCounts((prev) => ({ ...prev, followers: prev.followers + (isFollowing ? -1 : 1) }));
    } else {
      console.error("Failed to update follow state:", res.error);
      showToast("Couldn't update follow status — please try again.", "error");
    }
    setFollowBusy(false);
  };

  const copyProfileLink = async () => {
    if (!targetUserId) return;
    const url = `${window.location.origin}${window.location.pathname}?profile=${targetUserId}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older browsers, insecure context);
      // fail silently rather than throwing — sharing just won't auto-copy.
    }
  };

  // ─── guards ───────────────────────────────────────────────────────────────

  if (!firebaseUser) return (
    <div className="flex flex-col items-center justify-center py-32 text-center px-6">
      <User className="h-12 w-12 text-neutral-700 mb-4" aria-hidden="true" />
      <h2 className="text-lg font-bold text-white mb-2">Sign in to view profiles</h2>
      <p className="text-sm text-neutral-500">Your activity, ratings and watchlist live here.</p>
    </div>
  );

  if (profileLoading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="h-7 w-7 text-red-500 animate-spin" aria-hidden="true" />
    </div>
  );

  if (profileError || !profile) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-6">
      <AlertCircle className="h-7 w-7 text-red-500" aria-hidden="true" />
      <p className="text-sm text-neutral-400">{profileError ?? "This profile could not be found."}</p>
      <button onClick={loadProfile} className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer">Retry</button>
    </div>
  );

  // ─── derived ─────────────────────────────────────────────────────────────

  const displayName = profile.display_name ?? (isOwnProfile ? firebaseUser.displayName : null) ?? "Cinephile";
  const avatarUrl   = profile.avatar_url   ?? (isOwnProfile ? firebaseUser.photoURL   : null);
  const email       = isOwnProfile ? (profile.email ?? firebaseUser.email ?? "") : null;
  const favGenres   = profile.favorite_genres ?? [];

  const formattedJoinDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

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

  // Favorite decade / director — computed from every movie id this profile
  // has touched (rated, reviewed, watchlisted, viewed), cross-referenced
  // against the existing static catalog. No new tables or API calls.
  const allTouchedMovieIds = useMemo(() => {
    const ids = new Set<string>();
    ratings.forEach((r) => ids.add(r.movie_id));
    reviews.forEach((r) => ids.add(r.movie_id));
    watchlistMovies.forEach((w) => ids.add(w.movie_id));
    recentlyViewed.forEach((v) => ids.add(v.movie_id));
    return Array.from(ids);
  }, [ratings, reviews, watchlistMovies, recentlyViewed]);

  const { favoriteDecade, favoriteDirector } = useMemo(
    () => computeFavoriteDecadeAndDirector(allTouchedMovieIds, MOVIES_BY_ID),
    [allTouchedMovieIds]
  );

  const tasteMatchPct = !isOwnProfile
    ? computeTasteMatchPct(myFavoriteGenres, favGenres)
    : null;

  const badgeStats = {
    reviewCount: reviews.length,
    ratingCount: ratings.length,
    watchlistSize: watchlistMovies.length,
    likeCount: reviewLikeTotal,
    followerCount: followCounts.followers,
    favoriteGenres: favGenres,
  };
  const unlockedBadgeIds = new Set(computeBadges(badgeStats).map((b) => b.id));

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4 py-10 space-y-10"
    >
      {!isOwnProfile && onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
        </button>
      )}

      {/* ── HEADER CARD ── */}
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

          {/* avatar */}
          <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-red-600/50 bg-neutral-800 flex items-center justify-center flex-shrink-0">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              : <User className="h-10 w-10 text-neutral-500" aria-hidden="true" />
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
                    aria-label="Display name"
                    className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                  <input
                    value={editAvatar}
                    onChange={e => setEditAvatar(e.target.value)}
                    placeholder="Avatar URL (optional)"
                    aria-label="Avatar URL"
                    className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                  <div>
                    <p className="text-xs text-neutral-500 mb-2 text-left">Favorite genres</p>
                    <div className="flex flex-wrap gap-2">
                      {ALL_GENRES.filter(g => g !== "All").map(g => (
                        <button
                          key={g}
                          onClick={() => setEditGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                          aria-pressed={editGenres.includes(g)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                            editGenres.includes(g)
                              ? "bg-red-600 border-red-500 text-[#ffffff]"
                              : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                          }`}
                        >{g}</button>
                      ))}
                    </div>
                  </div>
                  {saveError && <p className="text-xs text-red-400">{saveError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveEdit} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-[#ffffff] text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />} Save
                    </button>
                    <button onClick={() => setEditing(false)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer">
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                    <h2 className="text-2xl font-bold text-white">{displayName}</h2>
                    {isOwnProfile && (
                      <button onClick={startEdit} aria-label="Edit profile" className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer">
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      onClick={copyProfileLink}
                      aria-label="Copy shareable profile link"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <Share2 className="h-3 w-3" aria-hidden="true" /> {linkCopied ? "Copied!" : "Share"}
                    </button>
                  </div>
                  {email && <p className="text-sm text-neutral-500 mb-1">{email}</p>}
                  {formattedJoinDate && (
                    <p className="text-xs text-neutral-400 mb-3">Joined {formattedJoinDate}</p>
                  )}
                  <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mb-3">
                    {favGenres.map(g => (
                      <span key={g} className="px-2.5 py-0.5 rounded-full bg-red-600/20 border border-red-600/30 text-red-400 text-[11px] font-medium">{g}</span>
                    ))}
                  </div>
                  {(favoriteDecade || favoriteDirector) && (
                    <div className="flex flex-wrap justify-center sm:justify-start gap-3 text-[11px] text-neutral-500">
                      {favoriteDecade && (
                        <span className="flex items-center gap-1"><Clapperboard className="h-3 w-3 text-neutral-600" aria-hidden="true" /> Favorite era: <span className="text-neutral-300 font-medium">{favoriteDecade}</span></span>
                      )}
                      {favoriteDirector && (
                        <span className="flex items-center gap-1"><Film className="h-3 w-3 text-neutral-600" aria-hidden="true" /> Favorite director: <span className="text-neutral-300 font-medium">{favoriteDirector}</span></span>
                      )}
                    </div>
                  )}

                  {/* Public-mode: Follow + Taste Match */}
                  {!isOwnProfile && (
                    <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
                      <button
                        onClick={toggleFollow}
                        disabled={followBusy}
                        aria-pressed={isFollowing}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer ${
                          isFollowing
                            ? "bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                            : "bg-red-600 hover:bg-red-500 text-[#ffffff]"
                        }`}
                      >
                        {followBusy
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          : isFollowing ? <UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        }
                        {isFollowing ? "Following" : "Follow"}
                      </button>
                      {tasteMatchPct !== null && (
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900/60">
                          <Gauge className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                          <span className="text-xs font-semibold text-white">{tasteMatchPct}%</span>
                          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Taste Match</span>
                        </div>
                      )}
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
          <button
            onClick={() => openSocialPanel("followers")}
            className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-5 py-4 min-w-[88px] hover:border-red-600/40 transition-colors cursor-pointer"
          >
            <Users className="h-4 w-4 text-red-500 mb-0.5" aria-hidden="true" />
            <span className="text-2xl font-bold text-white tabular-nums">{followCounts.followers}</span>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Followers</span>
          </button>
          <button
            onClick={() => openSocialPanel("following")}
            className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-5 py-4 min-w-[88px] hover:border-red-600/40 transition-colors cursor-pointer"
          >
            <UserPlus className="h-4 w-4 text-red-500 mb-0.5" aria-hidden="true" />
            <span className="text-2xl font-bold text-white tabular-nums">{followCounts.following}</span>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Following</span>
          </button>
        </div>

        {/* Social Graph Panel */}
        <AnimatePresence>
          {socialPanel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 outline-none"
              onClick={() => setSocialPanel(null)}
              ref={socialPanelDialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={socialPanel === "followers" ? "Followers" : "Following"}
            >
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-3xl p-6 max-h-[70vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-white capitalize">{socialPanel}</h3>
                  <button onClick={() => setSocialPanel(null)} aria-label="Close" className="p-1.5 rounded-xl text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                  {socialLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 text-red-500 animate-spin" aria-hidden="true" /></div>
                  ) : socialList.length === 0 ? (
                    <div className="py-12 text-center">
                      <Users className="h-8 w-8 text-neutral-700 mx-auto mb-2" aria-hidden="true" />
                      <p className="text-sm text-neutral-500">
                        {socialPanel === "followers" ? "No followers yet." : "Not following anyone yet."}
                      </p>
                    </div>
                  ) : (
                    socialList.map(u => (
                      <button
                        key={u.id}
                        onClick={() => {
                          if (onViewProfile) {
                            setSocialPanel(null);
                            onViewProfile(u.id);
                          }
                        }}
                        disabled={!onViewProfile}
                        className="w-full flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-left hover:border-red-600/40 transition-colors cursor-pointer disabled:cursor-default disabled:hover:border-neutral-800"
                      >
                        <div className="h-9 w-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-neutral-400 text-xs flex-shrink-0 overflow-hidden">
                          {u.avatar_url
                            ? <img src={u.avatar_url} alt={u.display_name ?? ""} className="w-full h-full object-cover" />
                            : (u.display_name?.trim() ? u.display_name.trim()[0].toUpperCase() : "?")
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{u.display_name ?? "Anonymous"}</p>
                          {(u.favorite_genres ?? []).length > 0 && (
                            <p className="text-[11px] text-neutral-500 truncate">{(u.favorite_genres ?? []).slice(0, 3).join(" · ")}</p>
                          )}
                        </div>
                        {onViewProfile && <ChevronRight className="h-4 w-4 text-neutral-600 flex-shrink-0" aria-hidden="true" />}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── ACTIVITY ── */}
      {activityLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 text-red-500 animate-spin" aria-hidden="true" /></div>
      ) : (
        <div className="space-y-10">

          <section>
            <SectionTitle icon={Eye} title="Recently Watched" />
            <PosterStrip items={recentlyViewed.map(rv => ({ key: rv.id, title: rv.title, poster_path: rv.poster_path }))} />
          </section>

          <section>
            <SectionTitle icon={BookMarked} title="Watchlist Preview" />
            <PosterStrip items={watchlistMovies.map(wm => ({ key: wm.id, title: wm.title, poster_path: wm.poster_path }))} />
          </section>

          <section>
            <SectionTitle icon={Star} title="Recently Rated" />
            {ratings.length === 0 ? <Empty msg={isOwnProfile ? "You haven't rated any movies yet." : "No ratings yet."} /> : (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 divide-y divide-neutral-800/60">
                {ratings.slice(0, 8).map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-neutral-300 truncate pr-4">{r.movie_title}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" aria-hidden="true" />
                      <span className="text-sm font-semibold text-white">{r.rating}<span className="text-neutral-500 font-normal">/10</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionTitle icon={MessageSquare} title="Recently Reviewed" />
            {reviews.length === 0 ? <Empty msg={isOwnProfile ? "You haven't written any reviews yet." : "No reviews yet."} /> : (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 divide-y divide-neutral-800/60">
                {reviews.slice(0, 6).map(r => (
                  <div key={r.id} className="py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-neutral-200 truncate pr-4">{r.movie_title}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" aria-hidden="true" />
                        <span className="text-xs text-white">{r.rating}/10</span>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── ACHIEVEMENTS ── */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-red-500" aria-hidden="true" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                  Achievements · {unlockedBadgeIds.size}/{ALL_ACHIEVEMENT_DEFS.length}
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ALL_ACHIEVEMENT_DEFS.map((def) => (
                <AchievementBadge key={def.id} badge={def} unlocked={unlockedBadgeIds.has(def.id)} />
              ))}
            </div>
          </section>

          {/* ── INSIGHTS / STATISTICS ── */}
          <section>
            <div className="flex items-center gap-2 mb-5">
              <BarChart2 className="h-4 w-4 text-red-500" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Statistics</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-yellow-400" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Avg. Rating Given</span>
                </div>
                {avgRating
                  ? <div className="flex items-end gap-1"><span className="text-4xl font-bold text-white">{avgRating}</span><span className="text-neutral-500 text-sm mb-1">/10</span></div>
                  : <p className="text-xs text-neutral-400">No ratings yet.</p>
                }
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-red-500" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Review Likes Received</span>
                </div>
                <div className="flex items-end gap-1"><span className="text-4xl font-bold text-white">{reviewLikeTotal}</span></div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Film className="h-4 w-4 text-red-400" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Most Watched Genres</span>
                </div>
                {topWatched.length > 0
                  ? <div className="space-y-2.5">{topWatched.map(([g, c]) => <GenreBar key={g} genre={g} count={c} max={maxWatched} />)}</div>
                  : <p className="text-xs text-neutral-400">Watch some movies to see this.</p>
                }
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-4 w-4 text-yellow-400" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Highest Rated Genres</span>
                </div>
                {topRatedGenres.length > 0
                  ? <div className="space-y-2">
                      {topRatedGenres.map(([g, avg]) => (
                        <div key={g} className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">{g}</span>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" aria-hidden="true" />
                            <span className="text-xs font-semibold text-white">{avg.toFixed(1)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  : <p className="text-xs text-neutral-400">Rate movies across genres to see this.</p>
                }
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-red-500" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Favorite Genres</span>
                </div>
                {favGenres.length > 0
                  ? <div className="flex flex-wrap gap-2">{favGenres.map(g => <span key={g} className="px-3 py-1 rounded-full bg-red-600/20 border border-red-600/30 text-red-400 text-xs font-medium">{g}</span>)}</div>
                  : isOwnProfile
                    ? <button onClick={startEdit} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />Set your favorite genres</button>
                    : <p className="text-xs text-neutral-400">No favorite genres set.</p>
                }
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clapperboard className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Favorite Decade &amp; Director</span>
                </div>
                {favoriteDecade || favoriteDirector
                  ? (
                    <div className="space-y-1.5 text-sm">
                      {favoriteDecade && <p className="text-neutral-300">Era: <span className="font-semibold text-white">{favoriteDecade}</span></p>}
                      {favoriteDirector && <p className="text-neutral-300">Director: <span className="font-semibold text-white">{favoriteDirector}</span></p>}
                    </div>
                  )
                  : <p className="text-xs text-neutral-400">Rate or watchlist movies to see this.</p>
                }
              </div>

            </div>
          </section>
        </div>
      )}
    </motion.div>
  );
}