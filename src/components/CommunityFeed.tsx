import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart, Star, Users, MessageSquare, Loader2,
  User, TrendingUp, Film, RefreshCw, UserPlus, UserCheck
} from "lucide-react";
import { auth } from "../firebase";
import {
  listCommunityReviews,
  listFollowingReviews,
  likeReview,
  unlikeReview,
  getUserLikes,
  getReviewLikeCounts,
  listActiveReviewers,
  followUser,
  unfollowUser,
  getFollowingIds,
  type CommunityReview,
  type PublicProfile,
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
  review,
  liked,
  likeCount,
  onLike,
  isAuthed,
  isOwn,
}: {
  review: CommunityReview;
  liked: boolean;
  likeCount: number;
  onLike: (id: string) => void;
  isAuthed: boolean;
  isOwn: boolean;
}) {
  const displayName = review.profiles?.display_name ?? "Anonymous";
  const avatarUrl = review.profiles?.avatar_url ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-3"
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar url={avatarUrl} name={displayName} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-white truncate">{displayName}</span>
              {isOwn && (
                <span className="rounded-full bg-red-600/20 border border-red-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">You</span>
              )}
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
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => isAuthed && onLike(review.id)}
          disabled={!isAuthed}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            liked
              ? "bg-red-500/20 border border-red-500/30 text-red-400"
              : "bg-neutral-800/60 border border-neutral-700/50 text-neutral-500 hover:text-red-400 hover:border-red-500/30"
          } disabled:cursor-default disabled:opacity-50`}
          title={isAuthed ? (liked ? "Unlike" : "Like") : "Sign in to like"}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-red-400" : ""}`} />
          <span>{likeCount > 0 ? likeCount : ""} {liked ? "Liked" : "Like"}</span>
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
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
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

export default function CommunityFeed() {
  const firebaseUser = auth.currentUser;
  const userId = firebaseUser?.uid ?? null;

  const [feedTab, setFeedTab] = useState<"everyone" | "following">("everyone");
  const [reviews, setReviews] = useState<CommunityReview[]>([]);
  const [followingReviews, setFollowingReviews] = useState<CommunityReview[]>([]);
  const [reviewers, setReviewers] = useState<PublicProfile[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [likeLoading, setLikeLoading] = useState<Set<string>>(new Set());
  const [followLoading, setFollowLoading] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [reviewsRes, reviewersRes] = await Promise.all([
      listCommunityReviews(30),
      listActiveReviewers(8),
    ]);
    const fetchedReviews = reviewsRes.data ?? [];
    setReviews(fetchedReviews);
    setReviewers(reviewersRes.data ?? []);

    if (fetchedReviews.length > 0) {
      const ids = fetchedReviews.map((r) => r.id);
      const countsRes = await getReviewLikeCounts(ids);
      setLikeCounts(countsRes.data ?? {});
    }

    if (userId) {
      const [likesRes, followRes] = await Promise.all([
        getUserLikes(userId),
        getFollowingIds(userId),
      ]);
      const likedSet = new Set(likesRes.data ?? []);
      const followingSet = new Set(followRes.data ?? []);
      setLikedIds(likedSet);
      setFollowingIds(followingSet);

      // fetch following feed if user follows anyone
      if (followingSet.size > 0) {
        const fwRes = await listFollowingReviews(Array.from(followingSet), 30);
        setFollowingReviews(fwRes.data ?? []);
      } else {
        setFollowingReviews([]);
      }
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleLike = async (reviewId: string) => {
    if (!userId || likeLoading.has(reviewId)) return;
    setLikeLoading((s) => new Set(s).add(reviewId));
    const isLiked = likedIds.has(reviewId);
    setLikedIds((prev) => {
      const next = new Set(prev);
      isLiked ? next.delete(reviewId) : next.add(reviewId);
      return next;
    });
    setLikeCounts((prev) => ({
      ...prev,
      [reviewId]: Math.max(0, (prev[reviewId] ?? 0) + (isLiked ? -1 : 1)),
    }));
    if (isLiked) {
      await unlikeReview(reviewId, userId);
    } else {
      await likeReview(reviewId, userId);
    }
    setLikeLoading((s) => { const n = new Set(s); n.delete(reviewId); return n; });
  };

  const handleFollow = async (targetId: string) => {
    if (!userId || followLoading.has(targetId)) return;
    setFollowLoading((s) => new Set(s).add(targetId));
    const isFollowing = followingIds.has(targetId);
    setFollowingIds((prev) => {
      const next = new Set(prev);
      isFollowing ? next.delete(targetId) : next.add(targetId);
      return next;
    });
    if (isFollowing) {
      await unfollowUser(userId, targetId);
    } else {
      await followUser(userId, targetId);
    }
    setFollowLoading((s) => { const n = new Set(s); n.delete(targetId); return n; });
  };

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
          className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
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

          {/* ── REVIEW FEED (2/3 width) ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Feed tabs */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-neutral-900 border border-neutral-800 w-fit mb-4">
              <button
                onClick={() => setFeedTab("everyone")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  feedTab === "everyone"
                    ? "bg-red-600 text-white shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Everyone
              </button>
              {userId && (
                <button
                  onClick={() => setFeedTab("following")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    feedTab === "following"
                      ? "bg-red-600 text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Following
                  {followingReviews.length > 0 && feedTab !== "following" && (
                    <span className="ml-0.5 rounded-full bg-red-500/30 text-red-300 px-1.5 text-[10px]">{followingReviews.length}</span>
                  )}
                </button>
              )}
            </div>

            {feedTab === "everyone" ? (
              reviews.length === 0 ? (
                <div className="rounded-2xl border border-neutral-800 py-16 text-center">
                  <MessageSquare className="h-8 w-8 text-neutral-700 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">No reviews yet. Be the first!</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {reviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      liked={likedIds.has(review.id)}
                      likeCount={likeCounts[review.id] ?? 0}
                      onLike={handleLike}
                      isAuthed={!!userId}
                      isOwn={review.user_id === userId}
                    />
                  ))}
                </AnimatePresence>
              )
            ) : (
              followingReviews.length === 0 ? (
                <div className="rounded-2xl border border-neutral-800 py-16 text-center">
                  <UserCheck className="h-8 w-8 text-neutral-700 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500 mb-1">No reviews from people you follow yet.</p>
                  <p className="text-xs text-neutral-600">Follow more members from the sidebar.</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {followingReviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      liked={likedIds.has(review.id)}
                      likeCount={likeCounts[review.id] ?? 0}
                      onLike={handleLike}
                      isAuthed={!!userId}
                      isOwn={review.user_id === userId}
                    />
                  ))}
                </AnimatePresence>
              )
            )}
          </div>

          {/* ── SIDEBAR (1/3 width) ── */}
          <div className="space-y-6">

            {!firebaseUser && (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 text-center space-y-2">
                <User className="h-7 w-7 text-neutral-600 mx-auto" />
                <p className="text-xs text-neutral-400 font-medium">Sign in to like reviews and follow members</p>
              </div>
            )}

            {reviewers.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-red-500" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Active Reviewers</h2>
                </div>
                <div className="space-y-2">
                  {reviewers.map((profile) => (
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
              </div>
            )}

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
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

          </div>
        </div>
      )}
    </div>
  );
}