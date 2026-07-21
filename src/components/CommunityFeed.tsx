import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart, Star, Users, MessageSquare, Loader2, ThumbsUp,
  User, TrendingUp, Film, RefreshCw, UserPlus, UserCheck,
  Trophy, Sparkles, Zap, Flame
} from "lucide-react";
import { auth } from "../firebase";
import { useToast } from "../context/ToastContext";
import {
  listCommunityReviews,
  listTrendingReviews,
  listFollowingReviews,
  likeReview,
  unlikeReview,
  getUserLikes,
  getReviewLikeCounts,
  voteHelpful,
  unvoteHelpful,
  getUserHelpfulVotes,
  getHelpfulVoteCounts,
  listActiveReviewers,
  getReviewLeaderboard,
  getSuggestedUsers,
  getPublicProfile,
  followUser,
  unfollowUser,
  getFollowingIds,
  type CommunityReview,
  type PublicProfile,
  type LeaderboardEntry,
  type SuggestedUser,
} from "../services/supabase/social";

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Avatar({ url, name, size = "md" }: { url?: string | null; name?: string | null; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs";
  const initial = (name ?? "?")[0].toUpperCase();
  return url ? (
    <img src={url} alt={name ?? "User"} className={`${dim} rounded-full object-cover flex-shrink-0 border border-neutral-700`} />
  ) : (
    <div className={`${dim} rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-neutral-400 flex-shrink-0`}>
      {initial}
    </div>
  );
}

// ─── ReviewCard ───────────────────────────────────────────────────────────────

function ReviewCard({
  review, liked, likeCount, onLike,
  helpful, helpfulCount, onHelpful,
  isAuthed, isOwn, isTrending,
}: {
  review: CommunityReview;
  liked: boolean; likeCount: number; onLike: (id: string) => void;
  helpful: boolean; helpfulCount: number; onHelpful: (id: string) => void;
  isAuthed: boolean; isOwn: boolean; isTrending?: boolean;
}) {
  const displayName = review.profiles?.display_name ?? "Anonymous";
  const avatarUrl = review.profiles?.avatar_url ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3"
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar url={avatarUrl} name={displayName} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-white truncate">{displayName}</span>
              {isOwn && <span className="rounded-full bg-red-600/20 border border-red-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">You</span>}
              {isTrending && <span className="flex items-center gap-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold text-amber-400"><Zap className="h-2.5 w-2.5" />Trending</span>}
            </div>
            <span className="text-[11px] text-neutral-500">{timeAgo(review.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-1">
          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
          <span className="text-xs font-bold text-amber-300">{review.rating}/10</span>
        </div>
      </div>

      {/* movie title */}
      <div className="flex items-center gap-1.5">
        <Film className="h-3.5 w-3.5 text-neutral-500 flex-shrink-0" />
        <span className="text-xs font-medium text-neutral-400 truncate">{review.movie_title}</span>
      </div>

      {/* comment */}
      {review.comment && (
        <p className="text-sm text-neutral-300 leading-relaxed line-clamp-4">{review.comment}</p>
      )}

      {/* footer */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button
          onClick={() => isAuthed && onLike(review.id)}
          disabled={!isAuthed}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            liked ? "bg-red-500/20 border border-red-500/30 text-red-400"
                  : "bg-neutral-800/60 border border-neutral-700/50 text-neutral-500 hover:text-red-400 hover:border-red-500/30"
          } disabled:cursor-default disabled:opacity-50`}
          title={isAuthed ? (liked ? "Unlike" : "Like") : "Sign in to like"}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-red-400" : ""}`} />
          <span>{likeCount > 0 ? likeCount : ""} {liked ? "Liked" : "Like"}</span>
        </button>
        <button
          onClick={() => isAuthed && !isOwn && onHelpful(review.id)}
          disabled={!isAuthed || isOwn}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            helpful ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                    : "bg-neutral-800/60 border border-neutral-700/50 text-neutral-500 hover:text-emerald-400 hover:border-emerald-500/30"
          } disabled:cursor-default disabled:opacity-50`}
          title={isOwn ? "Can't vote on your own review" : isAuthed ? (helpful ? "Remove helpful vote" : "Mark as helpful") : "Sign in to vote"}
        >
          <ThumbsUp className={`h-3.5 w-3.5 ${helpful ? "fill-emerald-400" : ""}`} />
          <span>{helpfulCount > 0 ? helpfulCount : ""} Helpful</span>
        </button>
      </div>
    </motion.div>
  );
}

// ─── ReviewerCard ─────────────────────────────────────────────────────────────

function ReviewerCard({
  profile,
  isFollowing,
  isOwn,
  onFollow,
  isAuthed,
}: {
  profile: PublicProfile;
  isFollowing: boolean;
  isOwn: boolean;
  onFollow: (id: string) => void;
  isAuthed: boolean;
}) {
  const displayName = profile.display_name ?? "Anonymous";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <Avatar url={profile.avatar_url} name={displayName} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{displayName}</p>
        {(profile.favorite_genres ?? []).length > 0 && (
          <p className="text-[11px] text-neutral-500 truncate">
            {(profile.favorite_genres ?? []).slice(0, 3).join(" · ")}
          </p>
        )}
      </div>
      {!isOwn && isAuthed && (
        <button
          onClick={() => onFollow(profile.id)}
          className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all cursor-pointer flex-shrink-0 ${
            isFollowing
              ? "bg-neutral-800 border border-neutral-700 text-neutral-400 hover:border-red-500/40 hover:text-red-400"
              : "bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30"
          }`}
        >
          {isFollowing ? (
            <><UserCheck className="h-3 w-3" /> Following</>
          ) : (
            <><UserPlus className="h-3 w-3" /> Follow</>
          )}
        </button>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

type FeedTab = "everyone" | "trending" | "following";
type SidebarTab = "active" | "suggested" | "leaderboard";

export default function CommunityFeed() {
  const firebaseUser = auth.currentUser;
  const userId = firebaseUser?.uid ?? null;
  const { showToast } = useToast();

  // feed state
  const [feedTab, setFeedTab] = useState<FeedTab>("everyone");
  const [reviews, setReviews] = useState<CommunityReview[]>([]);
  const [trendingReviews, setTrendingReviews] = useState<CommunityReview[]>([]);
  const [followingReviews, setFollowingReviews] = useState<CommunityReview[]>([]);

  // sidebar state
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("active");
  const [reviewers, setReviewers] = useState<PublicProfile[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // interaction state
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [helpfulIds, setHelpfulIds] = useState<Set<string>>(new Set());
  const [helpfulCounts, setHelpfulCounts] = useState<Record<string, number>>({});
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  // loading state
  const [loading, setLoading] = useState(true);
  const [likeLoading, setLikeLoading] = useState<Set<string>>(new Set());
  const [helpfulLoading, setHelpfulLoading] = useState<Set<string>>(new Set());
  const [followLoading, setFollowLoading] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);

    // Core parallel fetch
    const [reviewsRes, reviewersRes, trendingRes, leaderboardRes] = await Promise.all([
      listCommunityReviews(30),
      listActiveReviewers(8),
      listTrendingReviews(10),
      getReviewLeaderboard(8),
    ]);

    const fetchedReviews = reviewsRes.data ?? [];
    setReviews(fetchedReviews);
    setReviewers(reviewersRes.data ?? []);
    setTrendingReviews(trendingRes.data ?? []);
    setLeaderboard(leaderboardRes.data ?? []);

    // Like + helpful counts for the main feed
    if (fetchedReviews.length > 0) {
      const ids = fetchedReviews.map(r => r.id);
      const [countsRes, helpfulRes] = await Promise.all([
        getReviewLikeCounts(ids),
        getHelpfulVoteCounts(ids),
      ]);
      setLikeCounts(countsRes.data ?? {});
      setHelpfulCounts(helpfulRes.data ?? {});
    }

    // Auth-gated data
    if (userId) {
      const [likesRes, followRes, helpfulVotesRes] = await Promise.all([
        getUserLikes(userId),
        getFollowingIds(userId),
        getUserHelpfulVotes(userId),
      ]);
      const followingSet = new Set(followRes.data ?? []);
      setLikedIds(new Set(likesRes.data ?? []));
      setFollowingIds(followingSet);
      setHelpfulIds(new Set(helpfulVotesRes.data ?? []));

      // Following feed
      if (followingSet.size > 0) {
        const fwRes = await listFollowingReviews(Array.from(followingSet), 30);
        setFollowingReviews(fwRes.data ?? []);
      }

      // Suggested users — reuses followingSet already fetched above instead of
      // calling getFollowingIds a second time. Non-blocking after main render.
      getPublicProfile(userId).then(async profileRes => {
        const myGenres = profileRes.data?.favorite_genres ?? [];
        const sugRes = await getSuggestedUsers(userId, myGenres, Array.from(followingSet), 6);
        setSuggestedUsers(sugRes.data ?? []);
      });
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── handlers ─────────────────────────────────────────────────────────────

  const handleLike = async (reviewId: string) => {
    if (!userId || likeLoading.has(reviewId)) return;
    setLikeLoading(s => new Set(s).add(reviewId));
    const isLiked = likedIds.has(reviewId);
    setLikedIds(prev => { const n = new Set(prev); isLiked ? n.delete(reviewId) : n.add(reviewId); return n; });
    setLikeCounts(prev => ({ ...prev, [reviewId]: Math.max(0, (prev[reviewId] ?? 0) + (isLiked ? -1 : 1)) }));
    const result = isLiked ? await unlikeReview(reviewId, userId) : await likeReview(reviewId, userId);
    if (result.error) {
      // Roll back the optimistic update — without this, a failed write left
      // the like state permanently out of sync with the database.
      setLikedIds(prev => { const n = new Set(prev); isLiked ? n.add(reviewId) : n.delete(reviewId); return n; });
      setLikeCounts(prev => ({ ...prev, [reviewId]: Math.max(0, (prev[reviewId] ?? 0) + (isLiked ? 1 : -1)) }));
      console.error("Failed to update like:", result.error);
    }
    setLikeLoading(s => { const n = new Set(s); n.delete(reviewId); return n; });
  };

  const handleHelpful = async (reviewId: string) => {
    if (!userId || helpfulLoading.has(reviewId)) return;
    setHelpfulLoading(s => new Set(s).add(reviewId));
    const isHelpful = helpfulIds.has(reviewId);
    setHelpfulIds(prev => { const n = new Set(prev); isHelpful ? n.delete(reviewId) : n.add(reviewId); return n; });
    setHelpfulCounts(prev => ({ ...prev, [reviewId]: Math.max(0, (prev[reviewId] ?? 0) + (isHelpful ? -1 : 1)) }));
    const result = isHelpful ? await unvoteHelpful(reviewId, userId) : await voteHelpful(reviewId, userId);
    if (result.error) {
      // Roll back — same reasoning as handleLike above.
      setHelpfulIds(prev => { const n = new Set(prev); isHelpful ? n.add(reviewId) : n.delete(reviewId); return n; });
      setHelpfulCounts(prev => ({ ...prev, [reviewId]: Math.max(0, (prev[reviewId] ?? 0) + (isHelpful ? 1 : -1)) }));
      console.error("Failed to update helpful vote:", result.error);
    }
    setHelpfulLoading(s => { const n = new Set(s); n.delete(reviewId); return n; });
  };

  const handleFollow = async (targetId: string) => {
    if (!userId || followLoading.has(targetId)) return;
    setFollowLoading(s => new Set(s).add(targetId));
    const isFollowing = followingIds.has(targetId);
    setFollowingIds(prev => { const n = new Set(prev); isFollowing ? n.delete(targetId) : n.add(targetId); return n; });
    const result = isFollowing ? await unfollowUser(userId, targetId) : await followUser(userId, targetId);
    if (result.error) {
      // Roll back the optimistic follow-state change and let the user know,
      // since silently leaving the button in the wrong state is worse than
      // a brief error toast here.
      setFollowingIds(prev => { const n = new Set(prev); isFollowing ? n.add(targetId) : n.delete(targetId); return n; });
      console.error("Failed to update follow state:", result.error);
      showToast("Couldn't update follow status — please try again.", "error");
    }
    setFollowLoading(s => { const n = new Set(s); n.delete(targetId); return n; });
  };

  // ── helpers ───────────────────────────────────────────────────────────────

  const renderReviewList = (list: CommunityReview[], emptyIcon: React.ReactNode, emptyMsg: string, emptyHint?: string) =>
    list.length === 0 ? (
      <div className="rounded-2xl border border-white/[0.08] py-16 text-center">
        <div className="flex justify-center mb-3">{emptyIcon}</div>
        <p className="text-sm text-neutral-400">{emptyMsg}</p>
        {emptyHint && <p className="text-xs text-neutral-400 mt-1">{emptyHint}</p>}
      </div>
    ) : (
      <AnimatePresence mode="popLayout">
        {list.map(review => (
          <ReviewCard
            key={review.id}
            review={review}
            liked={likedIds.has(review.id)}
            likeCount={likeCounts[review.id] ?? review.like_count ?? 0}
            onLike={handleLike}
            helpful={helpfulIds.has(review.id)}
            helpfulCount={helpfulCounts[review.id] ?? 0}
            onHelpful={handleHelpful}
            isAuthed={!!userId}
            isOwn={review.user_id === userId}
            isTrending={feedTab === "trending"}
          />
        ))}
      </AnimatePresence>
    );

  const activeList = feedTab === "trending" ? trendingReviews : feedTab === "following" ? followingReviews : reviews;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Discover</p>
          <h1 className="text-3xl font-bold text-white">Community</h1>
          <p className="text-sm text-neutral-400 mt-1">See what other film lovers are watching and thinking</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 text-red-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── FEED (2/3) ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Feed tab switcher */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] w-fit mb-2">
              {([
                { key: "everyone",  label: "Everyone",  icon: Users },
                { key: "trending",  label: "Trending",  icon: Flame },
                ...(userId ? [{ key: "following" as FeedTab, label: "Following", icon: UserCheck }] : []),
              ] as { key: FeedTab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setFeedTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    feedTab === key
                      ? key === "trending" ? "bg-amber-500 text-[#ffffff] shadow" : "bg-red-600 text-[#ffffff] shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {key === "following" && followingReviews.length > 0 && feedTab !== "following" && (
                    <span className="ml-0.5 rounded-full bg-red-500/30 text-red-300 px-1.5 text-[10px]">{followingReviews.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Review list */}
            {feedTab === "everyone" && renderReviewList(
              activeList,
              <MessageSquare className="h-8 w-8 text-neutral-700" />,
              "No reviews yet. Be the first!"
            )}
            {feedTab === "trending" && renderReviewList(
              activeList,
              <Flame className="h-8 w-8 text-neutral-700" />,
              "No trending reviews this week yet.",
              "Reviews gain trending status from community likes."
            )}
            {feedTab === "following" && renderReviewList(
              activeList,
              <UserCheck className="h-8 w-8 text-neutral-700" />,
              "No reviews from people you follow yet.",
              "Follow members from the sidebar to see their reviews here."
            )}
          </div>

          {/* ── SIDEBAR (1/3) ── */}
          <div className="space-y-5">

            {!firebaseUser && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center space-y-2">
                <User className="h-7 w-7 text-neutral-600 mx-auto" />
                <p className="text-xs text-neutral-400 font-medium">Sign in to like reviews and follow members</p>
              </div>
            )}

            {/* Community stats */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-red-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Community</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{reviews.length}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Reviews</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{reviewers.length}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Reviewers</p>
                </div>
              </div>
            </div>

            {/* Sidebar tab switcher */}
            <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]">
              {([
                { key: "active",      label: "Active",   icon: TrendingUp },
                { key: "suggested",   label: "For You",  icon: Sparkles },
                { key: "leaderboard", label: "Top",      icon: Trophy },
              ] as { key: SidebarTab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSidebarTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                    sidebarTab === key ? "bg-red-600 text-[#ffffff]" : "text-neutral-500 hover:text-white"
                  }`}
                >
                  <Icon className="h-3 w-3" />{label}
                </button>
              ))}
            </div>

            {/* Active Reviewers */}
            {sidebarTab === "active" && (
              <div className="space-y-2">
                {reviewers.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-6">No reviewers yet.</p>
                ) : reviewers.map(profile => (
                  <ReviewerCard
                    key={profile.id}
                    profile={profile}
                    isFollowing={followingIds.has(profile.id)}
                    isOwn={profile.id === userId}
                    onFollow={handleFollow}
                    isAuthed={!!userId}
                  />
                ))}
              </div>
            )}

            {/* Suggested Users / Taste Matching */}
            {sidebarTab === "suggested" && (
              <div className="space-y-2">
                {!userId ? (
                  <div className="rounded-2xl border border-white/[0.08] py-8 text-center">
                    <Sparkles className="h-6 w-6 text-neutral-700 mx-auto mb-2" />
                    <p className="text-xs text-neutral-500">Sign in to discover users with similar taste.</p>
                  </div>
                ) : suggestedUsers.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.08] py-8 text-center">
                    <Sparkles className="h-6 w-6 text-neutral-700 mx-auto mb-2" />
                    <p className="text-xs text-neutral-500">Set favorite genres in your profile to get suggestions.</p>
                  </div>
                ) : suggestedUsers.map(u => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar url={u.avatar_url} name={u.display_name} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{u.display_name ?? "Anonymous"}</p>
                        <p className="text-[11px] text-neutral-500">{u.reviewCount} review{u.reviewCount !== 1 ? "s" : ""}</p>
                      </div>
                      {!followingIds.has(u.id) && (
                        <button
                          onClick={() => handleFollow(u.id)}
                          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 transition-all cursor-pointer flex-shrink-0"
                        >
                          <UserPlus className="h-3 w-3" /> Follow
                        </button>
                      )}
                    </div>
                    {/* Taste match bar */}
                    {u.tasteMatchPct > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-neutral-500">Taste match</span>
                          <span className="text-[10px] font-bold text-red-400">{u.tasteMatchPct}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-400 transition-all"
                            style={{ width: `${u.tasteMatchPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {u.sharedGenres.length > 0 && (
                      <p className="text-[10px] text-neutral-500 truncate">
                        Both like: {u.sharedGenres.slice(0, 3).join(", ")}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Leaderboard */}
            {sidebarTab === "leaderboard" && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Most Reviews</span>
                </div>
                <div className="divide-y divide-neutral-800/60">
                  {leaderboard.length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-8">No data yet.</p>
                  ) : leaderboard.map((entry, i) => (
                    <div key={entry.user_id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`text-xs font-black w-4 flex-shrink-0 ${
                        i === 0 ? "text-amber-400" : i === 1 ? "text-neutral-300" : i === 2 ? "text-amber-700" : "text-neutral-400"
                      }`}>{i + 1}</span>
                      <Avatar url={entry.avatar_url} name={entry.display_name} size="sm" />
                      <p className="flex-1 text-xs font-semibold text-white truncate">{entry.display_name ?? "Anonymous"}</p>
                      <span className="text-[11px] text-neutral-500 flex-shrink-0">{entry.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}