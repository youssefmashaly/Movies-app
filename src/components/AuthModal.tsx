import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { auth } from "../firebase";
import { X, Mail, Lock, User, Sparkles } from "lucide-react";
import { useFocusTrap } from "../lib/useFocusTrap";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (info: { isNewAccount: boolean }) => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

// Close on Escape for keyboard users
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess?.({ isNewAccount: isSignUp });
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("This email address is already, registered.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else if (err.code === "auth/invalid-credential") {
        setError("Incorrect email or password combination.");
      } else {
        setError(err.message || "An authentication error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            id="auth-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md"
          />

          {/* Modal box */}
          <motion.div
            id="auth-container"
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-neutral-900/90 p-8 text-neutral-100 shadow-2xl backdrop-blur-xl outline-none"
          >
            {/* Top graphic accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-indigo-600" />

            <button
              id="auth-close-btn"
              onClick={onClose}
              aria-label="Close sign-in dialog"
              className="absolute top-4 right-4 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-red-600 text-[#ffffff] shadow-lg shadow-red-900/20 mb-3">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 id="auth-modal-title" className="text-2xl font-bold tracking-tight">
                {isSignUp ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                {isSignUp ? "Sign up to maintain reviews & watchlist!" : "Sign in to access your personal cinema hub"}
              </p>
            </div>

            {error && (
              <motion.div
                id="auth-error-msg"
                role="alert"
                aria-live="assertive"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs font-medium text-red-400"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label htmlFor="auth-name-input" className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">
                    Your Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                      <User className="h-5 w-5" />
                    </span>
                    <input
                      id="auth-name-input"
                      type="text"
                      required
                      placeholder="Christopher Nolan"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-neutral-950/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email-input" className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <Mail className="h-5 w-5" />
                  </span>
                  <input
                    id="auth-email-input"
                    type="email"
                    required
                    placeholder="you@cinema.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-neutral-950/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all-2xl border border-white/[0.06] overflow-hidden"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-pass-input" className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <Lock className="h-5 w-5" />
                  </span>
                  <input
                    id="auth-pass-input"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-neutral-950/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all-2xl border border-white/[0.06] overflow-hidden"
                  />
                </div>
              </div>

              <button
                id="auth-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full mt-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 py-3 font-semibold text-[#ffffff] shadow-lg hover:from-red-500 hover:to-amber-505 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 focus-visible:ring-red-400"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ffffff] border-t-transparent" />
                ) : isSignUp ? (
                  "Create Free Account"
                ) : (
                  "Sign In securely"
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-xs">
              <span className="text-neutral-500">
                {isSignUp ? "Already have an account?" : "New to Movie Database?"}
              </span>{" "}
              <button
                id="auth-toggle-mode-btn"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                }}
                className="font-semibold text-red-400 hover:text-red-300 transition-colors focus-visible:ring-2 focus-visible:ring-red-500 rounded"
              >
                {isSignUp ? "Sign In Instead" : "Create an Account"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
