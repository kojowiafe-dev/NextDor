/**
 * Generic Client-Side SWR (Stale-While-Revalidate) Cache Factory.
 *
 * DESIGN PATTERN: Factory + Multi-Tier Cache with Parameterized Sub-Keys
 * ────────────────────────────────────────────────────────────────────────
 * `createSWRCache<T>` returns a typed cache object with operations:
 *
 *   get(subKey?)         — Instant: returns in-memory data (O(1)) or hydrates from
 *                          sessionStorage. Returns null if missing.
 *   set(data, subKey?)   — Writes to both memory and sessionStorage atomically.
 *   isStale(subKey?)     — Checks if entry age > ttlMs (or if not yet cached).
 *   getEntry(subKey?)    — Convenience method returning { data, isStale, hasData }.
 *                          Eliminates race conditions and simplifies page logic.
 *   invalidate(subKey?)  — Invalidate a specific subkey (or default key).
 *   invalidateAll()      — Purges all subkeys for this cache namespace.
 *
 * CACHE TIERS:
 *   1. In-Memory  — Module-level Map<string, ...>. Zero latency. Lives until
 *                   tab reload or explicit invalidation.
 *   2. sessionStorage — Survives same-tab route navigations (React unmount/remount).
 *                   Cleared when the tab closes.
 *
 * INVALIDATION STRATEGY:
 *   - TTL-based: stale data is visible instantly but triggers a background
 *     network fetch ("stale-while-revalidate"). The UI never blocks.
 *   - Mutation-based: after any write (approve/suspend/delete) the caller
 *     must call cache.invalidateAll() so the next read forces a fresh fetch.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number; // Unix ms
}

// Single module-level Map shared across all cache instances.
const MEMORY_STORE = new Map<string, CacheEntry<unknown>>();
const IN_FLIGHT_PROMISES = new Map<string, Promise<unknown>>();

export interface SWRCacheEntryResult<T> {
  data: T | null;
  isStale: boolean;
  hasData: boolean;
}

export interface SWRCache<T> {
  /** Returns cached data (memory → sessionStorage → null). Never throws. */
  get(subKey?: string): T | null;
  /** Writes data to both memory and sessionStorage with current timestamp. */
  set(data: T, subKey?: string): void;
  /** True when the cache is missing or older than ttlMs. */
  isStale(subKey?: string): boolean;
  /** Returns data and staleness status in a single safe call. */
  getEntry(subKey?: string): SWRCacheEntryResult<T>;
  /** Wipes a specific subkey (or default if omitted). */
  invalidate(subKey?: string): void;
  /** Wipes ALL subkeys in this cache namespace. Call after mutations. */
  invalidateAll(): void;
  /**
   * Fetches data with in-flight deduplication.
   * If a fetch for this key is already running, returns the existing Promise.
   * Returns null on error without polluting the cache or crashing.
   */
  fetchDedupe(subKey: string | undefined, fetcher: () => Promise<T | null>): Promise<T | null>;
}

function computeKey(namespace: string, subKey?: string): string {
  return subKey !== undefined && subKey !== "" ? `${namespace}::${subKey}` : namespace;
}

/**
 * Creates a typed SWR cache for a given data shape.
 *
 * @param storageKey  Unique sessionStorage key prefix (use snake_case, e.g. "nextdor_admin_merchants")
 * @param ttlMs       Freshness window in milliseconds before background re-fetch triggers
 *
 * @example
 * const merchantsCache = createSWRCache<MerchantItem[]>("nextdor_admin_merchants", 3 * 60_000);
 */
export function createSWRCache<T>(storageKey: string, ttlMs: number): SWRCache<T> {
  return {
    get(subKey?: string): T | null {
      const fullKey = computeKey(storageKey, subKey);

      // 1. Memory-first (O(1) hash lookup)
      const memEntry = MEMORY_STORE.get(fullKey) as CacheEntry<T> | undefined;
      if (memEntry) return memEntry.data;

      // 2. sessionStorage fallback (survives React unmount/remount within the same tab)
      if (typeof window === "undefined") return null;
      try {
        const raw = sessionStorage.getItem(fullKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CacheEntry<T>;
        if (parsed?.data !== undefined && typeof parsed.timestamp === "number") {
          // Hydrate memory from storage so subsequent calls are O(1)
          MEMORY_STORE.set(fullKey, parsed);
          return parsed.data;
        }
      } catch {
        // Corrupt JSON or quota error — treat as miss
      }
      return null;
    },

    set(data: T, subKey?: string): void {
      const fullKey = computeKey(storageKey, subKey);
      const entry: CacheEntry<T> = { data, timestamp: Date.now() };

      // Write memory first (always succeeds)
      MEMORY_STORE.set(fullKey, entry as CacheEntry<unknown>);

      // Persist to sessionStorage (best-effort)
      if (typeof window === "undefined") return;
      try {
        sessionStorage.setItem(fullKey, JSON.stringify(entry));
      } catch {
        // QuotaExceededError: still fine, memory cache is active
      }
    },

    isStale(subKey?: string): boolean {
      const fullKey = computeKey(storageKey, subKey);
      let entry = MEMORY_STORE.get(fullKey);

      // Hydrate from storage if not in memory
      if (!entry && typeof window !== "undefined") {
        try {
          const raw = sessionStorage.getItem(fullKey);
          if (raw) {
            const parsed = JSON.parse(raw) as CacheEntry<T>;
            if (parsed?.data !== undefined && typeof parsed.timestamp === "number") {
              MEMORY_STORE.set(fullKey, parsed);
              entry = parsed;
            }
          }
        } catch {}
      }

      if (!entry) return true; // no data = always stale
      return Date.now() - entry.timestamp > ttlMs;
    },

    getEntry(subKey?: string): SWRCacheEntryResult<T> {
      const fullKey = computeKey(storageKey, subKey);
      let entry = MEMORY_STORE.get(fullKey) as CacheEntry<T> | undefined;

      if (!entry && typeof window !== "undefined") {
        try {
          const raw = sessionStorage.getItem(fullKey);
          if (raw) {
            const parsed = JSON.parse(raw) as CacheEntry<T>;
            if (parsed?.data !== undefined && typeof parsed.timestamp === "number") {
              MEMORY_STORE.set(fullKey, parsed);
              entry = parsed;
            }
          }
        } catch {}
      }

      if (!entry || entry.data === undefined) {
        return { data: null, isStale: true, hasData: false };
      }

      const isStale = Date.now() - entry.timestamp > ttlMs;
      return { data: entry.data, isStale, hasData: true };
    },

    invalidate(subKey?: string): void {
      const fullKey = computeKey(storageKey, subKey);
      MEMORY_STORE.delete(fullKey);
      if (typeof window === "undefined") return;
      try {
        sessionStorage.removeItem(fullKey);
      } catch {}
    },

    invalidateAll(): void {
      const prefix = `${storageKey}::`;

      // 1. Purge from Memory
      for (const k of Array.from(MEMORY_STORE.keys())) {
        if (k === storageKey || k.startsWith(prefix)) {
          MEMORY_STORE.delete(k);
        }
      }

      // 2. Purge from sessionStorage
      if (typeof window === "undefined") return;
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && (k === storageKey || k.startsWith(prefix))) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          sessionStorage.removeItem(k);
        }
      } catch {}
    },

    async fetchDedupe(subKey: string | undefined, fetcher: () => Promise<T | null>): Promise<T | null> {
      const fullKey = computeKey(storageKey, subKey);
      const existing = IN_FLIGHT_PROMISES.get(fullKey) as Promise<T | null> | undefined;
      if (existing) {
        return existing;
      }

      const promise = (async () => {
        try {
          const result = await fetcher();
          // Write result to cache automatically only when valid data is returned
          if (result !== null && result !== undefined) {
            const entry: CacheEntry<T> = { data: result, timestamp: Date.now() };
            MEMORY_STORE.set(fullKey, entry as CacheEntry<unknown>);
            if (typeof window !== "undefined") {
              try {
                sessionStorage.setItem(fullKey, JSON.stringify(entry));
              } catch {}
            }
          }
          return result;
        } catch (err) {
          console.error(`[clientCache] fetchDedupe caught error for "${fullKey}":`, err);
          return null;
        } finally {
          IN_FLIGHT_PROMISES.delete(fullKey);
        }
      })();

      IN_FLIGHT_PROMISES.set(fullKey, promise);
      return promise;
    },
  };
}
