// Native browser image preloading — no library, just the Image() constructor.
// Tracks which URLs have already been requested so hovering the same card
// twice, or re-rendering the same hero slide, never issues a second fetch.
const preloaded = new Set<string>();

export function preloadImage(url: string | undefined | null): void {
  if (!url || preloaded.has(url)) return;
  preloaded.add(url);
  const img = new Image();
  img.src = url;
}

export function getPreloadStats() {
  return { preloadedCount: preloaded.size };
}