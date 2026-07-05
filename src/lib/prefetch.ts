// Prefetches /api/movies/detail/:id on hover/focus intent, so the movie
// detail view has a warm response by the time the user actually clicks.
// Reuses the same dedupedFetch already used for trending/latest — a
// prefetch and a real click on the same movie share one network call.
import { dedupedFetch } from "./requestDedup";

const prefetched = new Set<string>();
const controllers = new Map<string, AbortController>();

export function prefetchMovieDetail(id: string): void {
  if (!id || prefetched.has(id)) return;
  prefetched.add(id);

  const controller = new AbortController();
  controllers.set(id, controller);

  dedupedFetch(`/api/movies/detail/${id}`, { signal: controller.signal })
    .catch(() => {
      prefetched.delete(id);
    })
    .finally(() => {
      controllers.delete(id);
    });
}

export function cancelPrefetch(id: string): void {
  const controller = controllers.get(id);
  if (controller) {
    controller.abort();
    controllers.delete(id);
    prefetched.delete(id);
  }
}

export function getPrefetchStats() {
  return { prefetchedCount: prefetched.size, inFlightCount: controllers.size };
}