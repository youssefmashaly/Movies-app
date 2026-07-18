// src/components/NotificationBell.tsx
//
// Task Z — Notifications bell.
//
// Frontend-only for this phase: a fixed placeholder list of notifications,
// structured so a future pass can swap PLACEHOLDER_NOTIFICATIONS for a real
// fetch/subscription (e.g. a Supabase table) without touching any of the
// dropdown UI/interaction logic below. Mirrors UserMenu's dropdown pattern
// (outside-click to close, Escape to close + return focus) for a consistent
// account-area interaction model.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, Film, Bookmark, Sparkles } from "lucide-react";

interface NotificationItem {
  id: string;
  icon: React.ElementType;
  title: string;
  timestamp: string;
  unread: boolean;
}

// Placeholder data. Swap this for a real fetch (e.g. a Supabase
// `notifications` table keyed by user id) later — the component below only
// depends on the NotificationItem shape, not on this being static.
const PLACEHOLDER_NOTIFICATIONS: NotificationItem[] = [
  { id: "welcome", icon: Film, title: "Welcome to Movie Database", timestamp: "Just now", unread: true },
  { id: "watchlist-updated", icon: Bookmark, title: "Your watchlist has been updated", timestamp: "1h ago", unread: true },
  { id: "new-movies", icon: Sparkles, title: "New movies have been added", timestamp: "1d ago", unread: false },
];

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const notifications = PLACEHOLDER_NOTIFICATIONS;
  const unreadCount = useMemo(() => notifications.filter((n) => n.unread).length, [notifications]);

  // Close on outside click or Escape — same pattern as UserMenu's dropdown.
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

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="notification-dropdown"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-neutral-400 hover:text-white hover:border-neutral-800 hover:bg-neutral-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-all cursor-pointer"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
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
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md shadow-2xl overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/80">
              <p className="text-xs font-bold uppercase tracking-wider text-white">Notifications</p>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-650/15 border border-red-650/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="py-1.5 max-h-80 overflow-y-auto">
              {notifications.map((n) => {
                const Icon = n.icon;
                return (
                  <div
                    key={n.id}
                    role="menuitem"
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-900 transition-colors"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 text-red-400">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${n.unread ? "font-semibold text-white" : "text-neutral-400"}`}>
                        {n.title}
                      </p>
                      <p className="text-[10px] text-neutral-500 mt-0.5">{n.timestamp}</p>
                    </div>
                    {n.unread && (
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}