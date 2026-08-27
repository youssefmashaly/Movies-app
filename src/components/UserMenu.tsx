// src/components/UserMenu.tsx
//
// Phase 21 — Part 1 (Navigation UX).
//
// Replaces the standalone "Profile" / "My Dashboard" nav buttons and the
// bare Logout button with a single avatar-triggered dropdown, in the spirit
// of Google/GitHub/Discord/Netflix account menus:
//   - View Profile / My Dashboard / Settings / Logout
//   - animates open/closed, closes on outside click or Escape
//   - full keyboard support: ArrowUp/ArrowDown/Home/End cycle items, Tab is
//     trapped inside the menu while open, Escape returns focus to the
//     trigger button
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { User as FirebaseUser } from "firebase/auth";
import {
  User as UserIcon,
  UserCircle,
  LayoutDashboard,
  Settings as SettingsIcon,
  LogOut,
  ChevronDown
} from "lucide-react";

interface UserMenuProps {
  user: FirebaseUser;
  onNavigate: (tab: "profile" | "dashboard") => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  onSelect: () => void;
  checkbox?: boolean;
  checked?: boolean;
  danger?: boolean;
}

export default function UserMenu({ user, onNavigate, onOpenSettings, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const items: MenuItem[] = useMemo(
    () => [
      {
        id: "profile",
        label: "View Profile",
        icon: UserCircle,
        onSelect: () => {
          onNavigate("profile");
          setOpen(false);
        }
      },
      {
        id: "dashboard",
        label: "My Dashboard",
        icon: LayoutDashboard,
        onSelect: () => {
          onNavigate("dashboard");
          setOpen(false);
        }
      },
      {
        id: "settings",
        label: "Settings",
        icon: SettingsIcon,
        onSelect: () => {
          onOpenSettings();
          setOpen(false);
        }
      },
      {
        id: "logout",
        label: "Logout",
        icon: LogOut,
        onSelect: () => {
          setOpen(false);
          onLogout();
        },
        danger: true
      }
    ],
    [onNavigate, onOpenSettings, onLogout]
  );

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  // Focus the first item as soon as the menu opens (keyboard-friendly).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => itemRefs.current[0]?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  const focusItem = (index: number) => {
    const count = items.length;
    const next = ((index % count) + count) % count;
    itemRefs.current[next]?.focus();
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(currentIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(currentIndex - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(items.length - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      // Trap focus inside the menu while it's open.
      e.preventDefault();
      focusItem(currentIndex + (e.shiftKey ? -1 : 1));
    }
  };

  const initials = user.displayName ? user.displayName.slice(0, 2).toUpperCase() : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        id="user-menu-trigger"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu-dropdown"
        aria-label="Open account menu"
        className="flex items-center gap-1.5 rounded-xl border border-transparent p-1 pr-1.5 hover:border-white/[0.1] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-all cursor-pointer"
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-xs shadow overflow-hidden flex-shrink-0">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" decoding="async" className="h-full w-full object-cover" />
          ) : initials ? (
            initials
          ) : (
            <UserIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="user-menu-dropdown"
            role="menu"
            aria-label="Account menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onKeyDown={handleMenuKeyDown}
            className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-white/[0.08] bg-neutral-950/95 backdrop-blur-md shadow-2xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-xs font-semibold text-white truncate">{user.displayName || "Movie Critic"}</p>
              <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
            </div>
            <div className="py-1.5">
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    type="button"
                    role={item.checkbox ? "menuitemcheckbox" : "menuitem"}
                    aria-checked={item.checkbox ? item.checked : undefined}
                    tabIndex={-1}
                    onClick={item.onSelect}
                    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer focus:outline-none focus-visible:bg-neutral-900 ${
                      item.danger
                        ? "text-red-400 hover:bg-red-600/10"
                        : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {item.checkbox && (
                      <span
                        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors flex-shrink-0 ${
                          item.checked ? "bg-red-650" : "bg-neutral-700"
                        }`}
                        aria-hidden="true"
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-[#ffffff] transition-transform ${
                            item.checked ? "translate-x-3.5" : "translate-x-0.5"
                          }`}
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}