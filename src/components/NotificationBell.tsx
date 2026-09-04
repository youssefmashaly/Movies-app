// src/components/NotificationBell.tsx
//
// Phase 46 — updated to use real unread count from Supabase and to provide
// a "View all" entry point to the new Notification Center tab.
//
// The dropdown is kept intentionally lightweight: it shows only the 5 most
// recent notifications and a "View all notifications" link that sets
// activeTab → "notifications". The full history and management controls live
// in NotificationCenter.tsx.
//
// Outside-click / Escape-to-close and focus-return behaviour is unchanged
// from the original implementation.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, UserPlus, Heart, ThumbsUp, ArrowRight, Inbox } from "lucide-react";
import type {
  AppNotification,
  NotificationType,
} from "../services/supabase/notifications";

// Icon mapping for each notification type
const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  follow: UserPlus,
  review_like: Heart,
  helpful_vote: ThumbsUp,
};

const TYPE_LABEL: Record<NotificationType, (name: string | null) => string> = {
  follow: (n) => `${n ?? "Someone"} followed you`,
  review_like: (n) => `${n ?? "Someone"} liked your review`,
  helpful_vote: (n) => `${n ?? "Someone"} found your review helpful`,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface NotificationBellProps {
  /** Firebase UID of the signed-in user. Undefined/null → show placeholder icon only. */
  userId?: string | null;
  /** Called when the user clicks "View all notifications". */
  onViewAll?: () => void;
  /** External unread count override — updated by NotificationCenter after mark-all-read. */
  externalUnreadCount?: number;
}

const PREVIEW_LIMIT = 5;
const POLL_INTERVAL_MS = 60_000; // refresh unread count every minute

export default function NotificationBell({ userId, onViewAll, externalUnreadCount }: NotificationBellProps) {
  const uid = userId ?? undefined;

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preview, setPreview] = useState<AppNotification[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Use external override (after mark-all-read in center) if provided
  const displayCount = externalUnreadCount !== undefined ? externalUnreadCount : unreadCount;

  // ---------------------------------------------------------------------------
  // Poll unread count
  // ---------------------------------------------------------------------------
  const refreshCount = useCallback(async () => {
    if (!uid) return;
    const { getUnreadCount } = await import("../services/supabase/notifications");
    const result = await getUnreadCount(uid);
    if (result.data !== null) setUnreadCount(result.data);
  }, [uid]);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // ---------------------------------------------------------------------------
  // Load preview when dropdown opens
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open || !uid) return;
    setPreviewLoading(true);
    import("../services/supabase/notifications").then(({ listNotifications }) =>
      listNotifications(uid, 0)
    ).then((result) => {
      setPreviewLoading(false);
      if (result.data) setPreview(result.data.slice(0, PREVIEW_LIMIT));
    });
  }, [open, uid]);

  // ---------------------------------------------------------------------------
  // Close on outside click / Escape
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleViewAll() {
    setOpen(false);
    onViewAll?.();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="notification-dropdown"
        aria-label={displayCount > 0 ? `Notifications, ${displayCount} unread` : "Notifications"}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-neutral-400 hover:text-white hover:border-white/[0.1] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-all cursor-pointer"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {displayCount > 0 && (
          <span
            className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-neutral-950"
            aria-hidden="true"
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="notification-dropdown"
            role="menu"
            aria-label="Notifications preview"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-white/[0.08] bg-neutral-950/95 backdrop-blur-md shadow-2xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <p className="text-xs font-bold uppercase tracking-wider text-white">Notifications</p>
              {displayCount > 0 && (
                <span className="rounded-full bg-red-650/15 border border-red-650/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                  {displayCount} new
                </span>
              )}
            </div>

            {/* Preview list */}
            <div className="py-1.5 max-h-72 overflow-y-auto">
              {!uid ? (
                <p className="px-4 py-6 text-center text-xs text-neutral-500">
                  Sign in to see your notifications.
                </p>
              ) : previewLoading ? (
                <div className="space-y-2 px-4 py-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-neutral-800 animate-pulse flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 w-3/4 rounded bg-neutral-800 animate-pulse" />
                        <div className="h-2 w-1/3 rounded bg-neutral-800 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : preview.length === 0 ? (
                <div className="flex flex-col items-center py-8 px-4 text-center gap-2">
                  <Inbox className="h-6 w-6 text-neutral-600" aria-hidden="true" />
                  <p className="text-xs text-neutral-500">No notifications yet.</p>
                </div>
              ) : (
                preview.map((n) => {
                  const Icon = TYPE_ICON[n.type];
                  return (
                    <div
                      key={n.id}
                      role="menuitem"
                      className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                        n.read ? "hover:bg-neutral-900" : "bg-white/[0.02] hover:bg-neutral-900"
                      }`}
                    >
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.03] border border-white/[0.06] text-red-400">
                        <Icon className="h-3 w-3" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug ${n.read ? "text-neutral-400" : "font-semibold text-white"}`}>
                          {TYPE_LABEL[n.type](n.actor_name)}
                        </p>
                        {n.movie_title && (
                          <p className="text-[10px] text-neutral-600 truncate">{n.movie_title}</p>
                        )}
                        <p className="text-[10px] text-neutral-500 mt-0.5">{relativeTime(n.created_at)}</p>
                      </div>
                      {!n.read && (
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer — View all */}
            {uid && (
              <div className="border-t border-white/[0.06]">
                <button
                  role="menuitem"
                  onClick={handleViewAll}
                  className="flex w-full items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-neutral-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500 cursor-pointer"
                >
                  View all notifications
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}