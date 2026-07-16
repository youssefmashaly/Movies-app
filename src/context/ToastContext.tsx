import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export type ToastVariant = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 p-4 sm:items-end"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl motion-reduce:transition-none ${
              toast.variant === "success"
                ? "border-emerald-800/60 bg-emerald-950/90 text-emerald-100"
                : "border-red-800/60 bg-red-950/90 text-red-100"
            }`}
          >
            {toast.variant === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            )}
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-full p-0.5 text-white/60 transition-colors hover:text-white cursor-pointer active:scale-90"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * App-wide toast/snackbar system for transient success/error feedback (e.g.
 * "Added to your watchlist", "Couldn't save — please try again"). Mount once
 * near the root (see main.tsx) and call `useToast().showToast(...)` from any
 * descendant. Auto-dismisses after ~3.2s; also manually dismissible, and
 * announced to screen readers via a polite live region.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 3200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}