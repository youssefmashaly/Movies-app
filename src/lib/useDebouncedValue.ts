// src/lib/useDebouncedValue.ts
//
// Small, generic debounce hook. Returns `value` after it has stopped
// changing for `delayMs`. Used by the Navbar's live search suggestions so
// the (potentially fuzzy) match computation doesn't re-run on every single
// keystroke, while the input itself still updates instantly.
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}