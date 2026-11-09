/**
 * Redis client singleton with Upstash Cloud + REST + Local Memory Fallback.
 *
 * DESIGN DECISION: Three-Tier Resilient Caching (TCP -> REST -> In-Memory)
 * ────────────────────────────────────────────────────────────────────────
 * 1. Tier 1 (TCP): High-performance ioredis TLS socket connection for distributed
 *    caching, pub/sub, and BullMQ worker queue operations.
 * 2. Tier 2 (REST): Upstash HTTP REST client fallback when TCP ports are blocked
 *    by corporate/cloud firewalls or in serverless edge environments.
 * 3. Tier 3 (In-Memory L1): Built-in zero-latency TTL cache ensuring the app
 *    always responds in < 5ms without database bottlenecks even during network outages.
 */

import Redis from "ioredis";
import { config } from "../config/env.js";
import { logger } from "./logger.js";

// ── In-Memory TTL Fallback Cache (Tier 3) ──────────────────────────────────────
class LocalMemoryCache {
  private store = new Map<string, { value: any; expiresAt: number }>();
  private readonly maxEntries = 2500;

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set(key: string, value: any, ttlSeconds: number): void {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  flushPattern(pattern: string): number {
    let deleted = 0;
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }
}

export const localMemoryCache = new LocalMemoryCache();

// ── Upstash REST Helper (Tier 2) ───────────────────────────────────────────────
async function executeUpstashRest(command: string[]): Promise<any> {
  if (!config.UPSTASH_REDIS_REST_URL || !config.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    const res = await fetch(config.UPSTASH_REDIS_REST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: any };
    return json.result;
  } catch {
    return null;
  }
}

// ── Effective Redis Connection URL ────────────────────────────────────────────
function getEffectiveRedisUrl(): string {
  // If explicitly configured to non-localhost, respect it
  if (config.REDIS_URL && !config.REDIS_URL.includes("localhost:6379")) {
    return config.REDIS_URL;
  }

  // Derive TLS TCP URL from Upstash REST variables if available
  if (config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const url = new URL(config.UPSTASH_REDIS_REST_URL);
      return `rediss://default:${config.UPSTASH_REDIS_REST_TOKEN}@${url.hostname}:6379`;
    } catch {
      // Fall through to default
    }
  }

  return config.REDIS_URL;
}

const EFFECTIVE_REDIS_URL = getEffectiveRedisUrl();

// ── Redis Connection Management (Tier 1) ──────────────────────────────────────
let isRedisAvailable = false;
let redisWarnLogged = false;

function createRedisClient(extraOptions: { maxRetriesPerRequest?: number | null } = {}): Redis {
  const client = new Redis(EFFECTIVE_REDIS_URL, {
    maxRetriesPerRequest: extraOptions.maxRetriesPerRequest,
    retryStrategy(times) {
      const maxRetries = config.NODE_ENV === "development" ? 3 : 6;
      if (times > maxRetries) {
        if (!redisWarnLogged) {
          logger.info("Redis: offline — active cache switched to resilient in-memory / REST engine");
          redisWarnLogged = true;
        }
        return null; // Stop retrying — fallback handles all requests
      }
      return Math.min(times * 150, 2000);
    },

    reconnectOnError(err) {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      return targetErrors.some((msg) => err.message.includes(msg));
    },

    keepAlive: 1000,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on("connect", () => {
    isRedisAvailable = true;
    logger.info("⚡ Redis: connected successfully");
  });

  client.on("ready", () => {
    isRedisAvailable = true;
    logger.info("⚡ Redis: ready (Upstash Serverless)");
  });

  client.on("error", (err: any) => {
    isRedisAvailable = false;
    if (err.code === "ECONNREFUSED") {
      if (!redisWarnLogged) {
        logger.warn(
          "Redis: server unreachable at " + EFFECTIVE_REDIS_URL + " — operating seamlessly with built-in in-memory cache"
        );
        redisWarnLogged = true;
      }
    } else {
      logger.error({ err }, "Redis: error");
    }
  });

  client.on("close", () => {
    isRedisAvailable = false;
  });

  client.on("end", () => {
    isRedisAvailable = false;
  });

  return client;
}

// Main client for get/set/del operations
export const redis = createRedisClient();

// Dedicated client for BullMQ
export const redisForQueue = createRedisClient({ maxRetriesPerRequest: null });

export function checkRedisAvailable(): boolean {
  return isRedisAvailable && redis.status === "ready";
}

// ─── Helper: cache keys ──────────────────────────────────────────────────────
export const CacheKey = {
  product:           (slug: string)      => `product:${slug}`,
  productList:       (hash: string)      => `products:list:${hash}`,
  categories:        ()                  => `categories:tree`,
  trendingProducts:  ()                  => `products:trending`,
  groupedByMerchant: ()                  => `products:grouped_by_merchant`,
  otherSellers:      (name: string)      => `products:sellers:${Buffer.from(name).toString("base64url")}`,
  homeFeatured:      ()                  => `home:featured`,
  cart:              (sessionId: string) => `cart:${sessionId}`,
  session:           (userId: string)    => `session:${userId}`,
  syncLock:          ()                  => `lock:wc-sync`,
} as const;

// ─── Helper: flush by pattern ────────────────────────────────────────────────
export async function flushPattern(pattern: string): Promise<number> {
  let count = localMemoryCache.flushPattern(pattern);

  // 1. Flush via Redis TCP if connected
  if (isRedisAvailable && redis.status === "ready") {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          const pipeline = redis.pipeline();
          for (const key of keys) pipeline.del(key);
          await pipeline.exec();
          count += keys.length;
        }
      } while (cursor !== "0");
      return count;
    } catch {
      // Fall through to REST
    }
  }

  // 2. Fallback via Upstash REST
  if (config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const keys = await executeUpstashRest(["KEYS", pattern]);
      if (Array.isArray(keys) && keys.length > 0) {
        await executeUpstashRest(["DEL", ...keys]);
        count += keys.length;
      }
    } catch {}
  }

  return count;
}

// ─── Helper: safe get/set with transparent multi-tier fallback ───────────────
export async function cacheGet<T>(key: string): Promise<T | null> {
  // Tier 3: Local memory cache first (instant 0ms)
  const memValue = localMemoryCache.get<T>(key);
  if (memValue !== null) {
    return memValue;
  }

  // Tier 1: Redis TCP if connected
  if (isRedisAvailable && redis.status === "ready") {
    try {
      const raw = await redis.get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        localMemoryCache.set(key, parsed, 60);
        return parsed;
      }
    } catch {
      // Continue to Tier 2
    }
  }

  // Tier 2: Upstash REST API fallback
  if (config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const raw = await executeUpstashRest(["GET", key]);
      if (raw) {
        const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
        localMemoryCache.set(key, parsed, 60);
        return parsed;
      }
    } catch {}
  }

  return null;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  // Always write to Tier 3 (Local memory cache)
  localMemoryCache.set(key, value, ttlSeconds);

  // Tier 1: Redis TCP
  if (isRedisAvailable && redis.status === "ready") {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return;
    } catch {}
  }

  // Tier 2: Upstash REST API
  if (config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) {
    try {
      await executeUpstashRest(["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)]);
    } catch {}
  }
}

export async function cacheDel(key: string): Promise<void> {
  localMemoryCache.del(key);

  if (isRedisAvailable && redis.status === "ready") {
    try {
      await redis.del(key);
      return;
    } catch {}
  }

  if (config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) {
    try {
      await executeUpstashRest(["DEL", key]);
    } catch {}
  }
}
