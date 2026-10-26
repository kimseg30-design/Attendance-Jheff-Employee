import { lazy } from 'react';

/**
 * Resilient lazy loader for route chunks and dynamic components.
 * Guards against:
 * 1. Stale chunk 404s after new deploys (auto reloads once to fetch latest bundles).
 * 2. Swallowed rejections resolving to undefined (which crashes React lazy with "Cannot use 'in' operator to search for 'default' in undefined").
 * 3. Network glitches during navigation.
 */
export function lazyWithRetry(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      if (!mod || typeof mod !== 'object' || !('default' in mod) || typeof mod.default === 'undefined') {
        throw new Error('Dynamic module import did not resolve to a component with default export');
      }
      return mod;
    } catch (err) {
      const now = Date.now();
      const lastRetry = Number(sessionStorage.getItem('last_lazy_retry') || 0);
      if (now - lastRetry > 3000) {
        sessionStorage.setItem('last_lazy_retry', String(now));
        window.location.reload();
        // Return a never-resolving promise so React stays in Suspense during reload
        return new Promise(() => {});
      }
      throw err;
    }
  });
}

export default lazyWithRetry;
