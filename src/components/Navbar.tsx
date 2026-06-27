import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Film, Search, Bookmark, Sparkles, User, LogOut, LogIn, Menu, X, Loader2, UserCircle, LayoutDashboard } from "lucide-react";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenAuth: () => void;
  searchLoading?: boolean;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onOpenAuth,
  searchLoading = false
}: NavbarProps) {
  const [user, setUser] = useState(auth.currentUser);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Monitor scroll for glass effect change
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const menuItems = [
    { id: "explore", label: "Explore", icon: Film },
    { id: "watchlist", label: "Watchlist", icon: Bookmark, authRequired: true },
    { id: "oracle", label: "AI Matchmaker", icon: Sparkles },
    { id: "profile", label: "Profile", icon: UserCircle, authRequired: true },
    { id: "dashboard", label: "My Dashboard", icon: LayoutDashboard, authRequired: true }
  ];

  return (
    <nav
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-neutral-950/90 border-b border-neutral-900 shadow-xl backdrop-blur-md py-3.5"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo and Brand */}
        <div
          id="navbar-logo"
          role="button"
          tabIndex={0}
          aria-label="Movie Database, go to Explore"
          onClick={() => {
            setActiveTab("explore");
            document.getElementById("navbar-search")?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveTab("explore");
            }
          }}
          className="flex items-center gap-2.5 cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg"
        >
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-tr from-red-650 to-red-600 bg-red-650 text-white shadow-md shadow-red-950/30">
            <Film className="h-5 w-5" />
          </div>
          <span className="font-extrabold text-lg text-white tracking-tight hidden sm:inline-block">
            Movie <span className="text-red-500">Database</span>
          </span>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="hidden md:flex items-center gap-1.5 bg-neutral-900/60 p-1 rounded-xl border border-neutral-800">
          {menuItems.map((item) => {
            const Icon = item.icon;
            // Hide Watchlist tab if not logged in, or let them click and prompt log in inside App?
            // Safer to display, and if clicked when not logged in, let standard App trigger auth modal!
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => {
                  if (item.authRequired && !user) {
                    onOpenAuth();
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 ${
                  isActive
                    ? "bg-red-650 text-white shadow-md font-extrabold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-neutral-500"}`} />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar - Hide when in Oracle or Watchlist if desired, but general header is epic */}
        <div className="flex-1 max-w-xs mx-4 hidden sm:block relative">
          <label htmlFor="navbar-search" className="sr-only">Search movies and genres</label>
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500 pointer-events-none">
            <Search className="h-4 w-4" />
          </span>
          <input
            id="navbar-search"
            type="text"
            placeholder="Search movies, genres..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (activeTab !== "explore") {
                setActiveTab("explore");
              }
            }}
            className="w-full text-xs font-medium rounded-xl border border-neutral-800 bg-neutral-900/50 py-2.5 pl-9 pr-9 text-white placeholder-neutral-500 outline-none focus:border-red-500/50 focus:bg-neutral-950 transition-all"
          />
          <span className="absolute inset-y-0 right-0 flex items-center pr-2.5">
            {searchLoading ? (
              <Loader2 className="h-3.5 w-3.5 text-red-400 animate-spin" aria-hidden="true" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="rounded-full p-1 text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </span>
        </div>

        {/* User Auth Info Widget */}
        <div className="flex items-center gap-4">
          <AnimatePresence mode="wait">
            {user ? (
              <motion.div
                key="user-logged-in"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                {/* User avatar and name info */}
                <div className="hidden lg:flex flex-col text-right">
                  <span className="font-semibold text-xs text-white leading-tight">
                    {user.displayName || "Movie Critic"}
                  </span>
                  <span className="text-[10px] text-neutral-500 truncate max-w-[120px]">
                    {user.email}
                  </span>
                </div>
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-xs shadow">
                  {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                </div>

                <button
                  id="navbar-logout-btn"
                  onClick={handleLogout}
                  title="Logout Safely"
                  aria-label="Sign out"
                  className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-2 text-neutral-400 hover:text-red-400 hover:border-red-500/20 focus-visible:ring-2 focus-visible:ring-red-500 transition-all cursor-pointer"
                >
                  <LogOut className="h-4.5 w-4.5" />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="user-logged-out"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                id="navbar-login-trigger"
                onClick={onOpenAuth}
                className="flex items-center gap-2 rounded-xl bg-red-650 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-red-600 shadow-red-950/10 focus-visible:ring-2 focus-visible:ring-red-400 transition-all cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </motion.button>
            )}
          </AnimatePresence>

          {/* Mobile menu trigger */}
          <button
            id="mobile-menu-trigger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className="md:hidden rounded-lg border border-neutral-800 bg-neutral-900/60 p-2 text-neutral-400 hover:text-white focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-menu-drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-neutral-900 bg-neutral-950 px-6 py-4 space-y-4 shadow-2xl"
          >
            {/* Mobile Search */}
            <div className="relative">
              <label htmlFor="mobile-search" className="sr-only">Search movies</label>
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                id="mobile-search"
                type="text"
                placeholder="Search movies..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeTab !== "explore") {
                    setActiveTab("explore");
                  }
                }}
                className="w-full text-xs font-medium rounded-xl border border-neutral-800 bg-neutral-900/50 py-2.5 pl-9 pr-9 text-white outline-none focus:border-red-500/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-white cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Mobile links */}
            <div className="flex flex-col gap-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={`mobile-${item.id}`}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (item.authRequired && !user) {
                        onOpenAuth();
                      } else {
                        setActiveTab(item.id);
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-colors cursor-pointer ${
                      isActive
                        ? "bg-red-650 text-white"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
