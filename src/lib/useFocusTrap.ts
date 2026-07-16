import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

function safeFocus(el: HTMLElement | null | undefined): void {
  if (!el) return;
  try {
    el.focus();
  } catch {
    // Some elements (e.g. cross-origin iframes in certain environments)
    // can throw on focus() — never let a focus-management bug crash a dialog.
  }
}

/**
 * Traps Tab / Shift+Tab focus inside the returned container while `active`
 * is true — the standard WCAG 2.4.3 requirement for modal dialogs. On
 * activation it moves focus to the first focusable element inside the
 * container (falling back to the container itself); on deactivation/unmount
 * it restores focus to whatever was focused immediately before the dialog
 * opened (typically the button that triggered it).
 *
 * Usage: attach the returned ref (plus `tabIndex={-1}`) to the dialog's
 * outermost element, and pass the dialog's own "is open" boolean as `active`.
 * This hook must be called unconditionally at the top of the component (as
 * with any hook) — pass `false` when the dialog isn't open rather than
 * skipping the call.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );

    safeFocus(getFocusable()[0] ?? container);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusableEls = getFocusable();
      if (focusableEls.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        safeFocus(last);
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        safeFocus(first);
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      safeFocus(previouslyFocused.current);
    };
  }, [active]);

  return containerRef;
}