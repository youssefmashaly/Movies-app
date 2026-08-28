// src/components/NotificationCenter.tsx
//
// Phase 46 — Notification Center.
//
// A dedicated full-page view (activeTab === "notifications") that shows the
// authenticated user's real activity notifications:
//   • follow       — someone followed you
//   • review_like  — someone liked your review
//   • helpful_vote — someone marked your review helpful
//
// Only real, persisted notifications from the Supabase `notifications` table
// are shown. No fake/system-generated activity appears here.
//
// Design: matches the existing glass-morphism system used throughout the app
// (border-white/[0.06], bg-white/[0.02], backdrop-blur-xl, rounded-3xl).
// Unread notifications are distinguished by a subtle left accent border and
// a slightly lighter background — not colour alone, so screen readers and
// reduced-colour users can still scan the state.

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  UserPlus,
  Heart,
  ThumbsUp,
  CheckCheck,
  RefreshCw,
  AlertCircle,
  Inbox,
  ChevronDown,
} from "lucide-react";
import {
  listNotifications,
  markAllRead,
  markOneRead,
  type AppNotification,
  type NotificationType,
} from "../services/supabase/notifications";

// ---------------------------------------------------------------------------
// Types / props
// ---------------------------------------------------------------------------

interface NotificationCenterProps {
  userId: string;
  /** Called when the user clicks a notification that links to a movie. */
  onSelectMovie?: (movieId: string) => void;
  /** Called when the user clicks a follow notification — opens that profile. */
  onViewProfile?: (userId: string) => void;
  /** Fired after marking all as read so the bell badge can update. */
  onUnreadCountChange?: (count: number) => void;
}

interface TypeMetaEntry {
  icon: React.ElementType;
  label: (name: string | null) => string;
  color: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_META: Record<NotificationType, TypeMetaEntry> = {
  follow: {
    icon: UserPlus,
    label: (name) => `${name ?? "Someone"} followed you.`,
    color: "text-blue-400",
  },
  review_like: {
    icon: Heart,
    label: (name) => `${name ?? "Someone"} liked your review.`,
    color: "text-red-400",
  },
  helpful_vote: {
    icon: ThumbsUp,
    label: (name) => `${name ?? "Someone"} found your review helpful.`,
    color: "text-emerald-400",
  },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Single notification row
// ---------------------------------------------------------------------------

interface NotificationRowProps {
  notification: AppNotification;
  onAction: (n: AppNotification) => void;
}

function NotificationRow({ notification: n, onAction }: NotificationRowProps) {
  const meta = TYPE_META[n.type];
  const Icon = meta.icon;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={[
        "group relative flex items-start gap-3 rounded-2xl px-4 py-3.5 transition-colors",
        "cursor-pointer select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
        // Unread: subtle left border accent + slightly lighter bg
        n.read
          ? "border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03]"
          : "border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.06] border-l-2 border-l-red-500/60",
      ].join(" ")}
      role="button"
      tabIndex={0}
      aria-label={`${meta.label(n.actor_name)}${n.movie_title ? ` on ${n.movie_title}` : ""}${n.read ? "" : " (unread)"}`}
      onClick={() => onAction(n)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? onAction(n) : undefined)}
    >
      {/* Actor avatar or icon fallback */}
      <div className="relative flex-shrink-0 mt-0.5">
        <div className="h-9 w-9 rounded-full overflow-hidden border border-white/[0.08] bg-neutral-800 flex items-center justify-center">
          {n.actor_avatar ? (
            <img
              src={n.actor_avatar}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="text-sm font-bold text-neutral-400" aria-hidden="true">
              {n.actor_name?.[0]?.toUpperCase() ?? "?"}
            </span>
          )}
        </div>
        {/* Type badge */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900 border border-white/[0.08] ${meta.color}`}
          aria-hidden="true"
        >
          <Icon className="h-2.5 w-2.5" />
        </span>
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${n.read ? "text-neutral-300" : "text-white font-medium"}`}>
          {meta.label(n.actor_name)}
        </p>
        {n.movie_title && (
          <p className="text-xs text-neutral-500 mt-0.5 truncate">
            {n.movie_title}
          </p>
        )}
        <p className="text-[11px] text-neutral-600 mt-1">{relativeTime(n.created_at)}</p>
      </div>

      {/* Unread dot — supplementary to the border accent, not the sole indicator */}
      {!n.read && (
        <span
          className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-red-500"
          aria-hidden="true"
        />
      )}
    </motion.li>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function NotificationSkeleton() {
  return (
    <ul className="space-y-2" aria-label="Loading notifications" role="status">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.01] px-4 py-3.5"
        >
          <div className="h-9 w-9 rounded-full bg-neutral-800 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-3/4 rounded bg-neutral-800 animate-pulse" />
            <div className="h-2.5 w-1/2 rounded bg-neutral-800 animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <Inbox className="h-7 w-7 text-neutral-600" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-neutral-300 mb-1">No notifications yet</h3>
      <p className="text-sm text-neutral-600 max-w-xs">
        When someone follows you, likes your review, or finds it helpful, it will show up here.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 30;

export default function NotificationCenter({
  userId,
  onSelectMovie,
  onViewProfile,
  onUnreadCountChange,
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Announce unread count to parent (bell badge)
  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  // Focus the heading on mount for keyboard/screen-reader users
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const loadPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) setStatus("loading");
      else setLoadingMore(true);

      const result = await listNotifications(userId, pageNum);

      if (replace) setStatus("ready");
      else setLoadingMore(false);

      if (result.error || result.data === null) {
        setErrorMsg(result.error ?? "Unknown error");
        if (replace) setStatus("error");
        return;
      }

      setHasMore(result.data.length === PAGE_SIZE);

      if (replace) {
        setNotifications(result.data);
      } else {
        setNotifications((prev) => {
          const ids = new Set(prev.map((n) => n.id));
          return [...prev, ...result.data!.filter((n) => !ids.has(n.id))];
        });
      }
    },
    [userId]
  );

  useEffect(() => {
    loadPage(0, true);
  }, [loadPage]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function handleMarkAllRead() {
    if (markingRead || unreadCount === 0) return;
    setMarkingRead(true);
    await markAllRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setMarkingRead(false);
  }

  async function handleNotificationAction(n: AppNotification) {
    // Mark read immediately (optimistic)
    if (!n.read) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
      await markOneRead(n.id);
    }

    // Navigate
    if (n.type === "follow" && n.actor_id && onViewProfile) {
      onViewProfile(n.actor_id);
    } else if ((n.type === "review_like" || n.type === "helpful_vote") && n.movie_id && onSelectMovie) {
      onSelectMovie(n.movie_id);
    }
  }

  async function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    await loadPage(next, false);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto px-4 py-8"
    >
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className="hidden sm:flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-650 to-red-600 text-white shadow-md shadow-red-950/30"
            aria-hidden="true"
          >
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Activity</p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-3xl font-bold text-white focus-visible:outline-none"
            >
              Notifications
              {unreadCount > 0 && (
                <span
                  className="ml-3 inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold"
                  aria-label={`${unreadCount} unread`}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* Mark all read */}
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingRead}
            className={[
              "flex items-center gap-1.5 rounded-xl border px-3 py-1.5",
              "text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
              markingRead
                ? "border-white/[0.04] text-neutral-600 cursor-not-allowed"
                : "border-white/[0.08] text-neutral-300 hover:border-white/[0.16] hover:text-white cursor-pointer",
            ].join(" ")}
            aria-label="Mark all notifications as read"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Mark all read
          </button>
        )}
      </div>

      {/* ── CONTENT ── */}
      <section
        aria-labelledby="notifications-heading"
        aria-live="polite"
        aria-busy={status === "loading"}
      >
        <h2 id="notifications-heading" className="sr-only">
          Notification list
        </h2>

        {status === "loading" ? (
          <NotificationSkeleton />
        ) : status === "error" ? (
          <div
            role="alert"
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center"
          >
            <AlertCircle className="h-8 w-8 text-neutral-600 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-neutral-400 mb-4">
              {errorMsg || "Could not load notifications right now."}
            </p>
            <button
              onClick={() => loadPage(0, true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white hover:border-white/[0.16] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <AnimatePresence initial={false}>
              <ul className="space-y-2" role="list" aria-label="Notifications">
                {notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onAction={handleNotificationAction}
                  />
                ))}
              </ul>
            </AnimatePresence>

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className={[
                    "flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                    loadingMore
                      ? "border-white/[0.04] text-neutral-600 cursor-not-allowed"
                      : "border-white/[0.08] text-neutral-300 hover:border-white/[0.16] hover:text-white cursor-pointer",
                  ].join(" ")}
                  aria-label="Load more notifications"
                >
                  {loadingMore ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </motion.div>
  );
}