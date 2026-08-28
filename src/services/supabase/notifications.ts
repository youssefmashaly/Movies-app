// src/services/supabase/notifications.ts
//
// Phase 46 — Notification Center.
//
// Reads from and writes to the `notifications` Supabase table.
// Every notification corresponds to a real user-triggered event:
//   - "follow"        → someone followed the current user
//   - "review_like"   → someone liked the current user's review
//   - "helpful_vote"  → someone marked the current user's review as helpful
//
// No fake/system-generated notifications are created here.
// Notifications are written by the action helpers at the bottom of this file,
// which are called alongside the existing followUser / likeReview / voteHelpful
// calls in App.tsx / CommunityFeed.tsx.

import { supabase, isSupabaseConfigured } from "../../supabase";
import { SupabaseResult } from "../../types/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType = "follow" | "review_like" | "helpful_vote";

export interface AppNotification {
  id: string;
  user_id: string;        // recipient
  actor_id: string;       // who triggered the action
  actor_name: string | null;
  actor_avatar: string | null;
  type: NotificationType;
  review_id: string | null;
  movie_id: string | null;
  movie_title: string | null;
  read: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

const PAGE_SIZE = 30;

export async function listNotifications(
  userId: string,
  page = 0
): Promise<SupabaseResult<AppNotification[]>> {
  if (!isSupabaseConfigured) return { data: [], error: null };
  try {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, user_id, actor_id, type, review_id, movie_id, movie_title, read, created_at, " +
        "profiles!notifications_actor_id_fkey(display_name, avatar_url)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return { data: null, error: error.message };

    const normalized: AppNotification[] = (data ?? []).map((row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        user_id: row.user_id,
        actor_id: row.actor_id,
        actor_name: profile?.display_name ?? null,
        actor_avatar: profile?.avatar_url ?? null,
        type: row.type as NotificationType,
        review_id: row.review_id ?? null,
        movie_id: row.movie_id ?? null,
        movie_title: row.movie_title ?? null,
        read: row.read ?? false,
        created_at: row.created_at,
      };
    });

    return { data: normalized, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to load notifications." };
  }
}

export async function getUnreadCount(userId: string): Promise<SupabaseResult<number>> {
  if (!isSupabaseConfigured) return { data: 0, error: null };
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (error) return { data: null, error: error.message };
    return { data: count ?? 0, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to get unread count." };
  }
}

// ---------------------------------------------------------------------------
// Read state
// ---------------------------------------------------------------------------

export async function markAllRead(userId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: null };
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to mark notifications read." };
  }
}

export async function markOneRead(notificationId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: null };
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to mark notification read." };
  }
}

// ---------------------------------------------------------------------------
// Write — called alongside the existing social action helpers
// ---------------------------------------------------------------------------

// Avoid duplicate notifications for the same actor+recipient+type combination
// within a short window (e.g. rapid unlike/re-like). Uses upsert on the
// unique index defined in the SQL migration.
async function upsertNotification(payload: {
  user_id: string;
  actor_id: string;
  type: NotificationType;
  review_id?: string | null;
  movie_id?: string | null;
  movie_title?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  // Don't notify yourself
  if (payload.user_id === payload.actor_id) return;
  try {
    await supabase.from("notifications").upsert(
      {
        user_id: payload.user_id,
        actor_id: payload.actor_id,
        type: payload.type,
        review_id: payload.review_id ?? null,
        movie_id: payload.movie_id ?? null,
        movie_title: payload.movie_title ?? null,
        read: false,
      },
      {
        onConflict: "user_id,actor_id,type,review_id",
        ignoreDuplicates: false, // reset read=false so re-engagement surfaces again
      }
    );
  } catch {
    // Fire-and-forget; notification failure must not block the primary action
  }
}

export async function notifyFollow(
  recipientId: string,
  actorId: string
): Promise<void> {
  await upsertNotification({
    user_id: recipientId,
    actor_id: actorId,
    type: "follow",
    review_id: null,
    movie_id: null,
    movie_title: null,
  });
}

export async function notifyReviewLike(opts: {
  reviewOwnerId: string;
  actorId: string;
  reviewId: string;
  movieId: string;
  movieTitle: string;
}): Promise<void> {
  await upsertNotification({
    user_id: opts.reviewOwnerId,
    actor_id: opts.actorId,
    type: "review_like",
    review_id: opts.reviewId,
    movie_id: opts.movieId,
    movie_title: opts.movieTitle,
  });
}

export async function notifyHelpfulVote(opts: {
  reviewOwnerId: string;
  actorId: string;
  reviewId: string;
  movieId: string;
  movieTitle: string;
}): Promise<void> {
  await upsertNotification({
    user_id: opts.reviewOwnerId,
    actor_id: opts.actorId,
    type: "helpful_vote",
    review_id: opts.reviewId,
    movie_id: opts.movieId,
    movie_title: opts.movieTitle,
  });
}