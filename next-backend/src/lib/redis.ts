/**
 * Redis client singleton using ioredis.
 *
 * DESIGN DECISION: ioredis vs the official `redis` package
 * ──────────────────────────────────────────────────────────
 * ioredis is the industry standard for Node.js:
 *   - Automatic reconnection with exponential backoff (built-in)
 *   - Cluster support (when you scale Redis horizontally)
 *   - Pipelines and transactions (MULTI/EXEC)
 *   - Lua scripting support (used for atomic rate limiting)
 *   - BullMQ requires ioredis specifically
 *
 * WHAT IF: What if Redis goes down? (Cache stampede / thundering herd)
 * If Redis fails and 10,000 concurrent requests all get a cache MISS
 * simultaneously, they all hit the database at once — potentially
 * crashing it. This is called a "thundering herd" or "cache stampede".
 *
 * Mitigations we implement:
 *   1. Redis reconnects automatically — short outages are transparent
 *   2. All Redis operations are wrapped in try/catch — on error we
 *      fall through to the database gracefully (Redis is a performance
 *      layer, not a source of truth)
 *   3. For high-traffic endpoints, use a "lock" pattern:
 *      one request fetches from DB + writes cache, others wait briefly
 *
 * WHAT IF: What if we need to wipe ALL cache at once (e.g. after a major
 * product import)? Use the `flushPattern` helper below — never FLUSHALL
 * in production as it wipes everything including sessions and queues.
 *
 * 📚 Read: "Designing Data-Intensive Applications" by Martin Kleppmann
 *    Chapter 5 — Replication covers Redis sentinel/cluster.
 *    Also: Redis documentation → "Persistence" and "Sentinel" guides.
 */

import Redis from "ioredis";
import { config } from "../config/env.js";
import { logger } from "./logger.js";

function createRedisClient(): Redis {
  const client = new Redis(config.REDIS_URL, {
    // Retry connection up to 3 times in dev, 10 times in prod with exponential backoff
    // WHAT IF: Redis isn't running locally? Stops retrying quickly and falls back cleanly.
    retryStrategy(times) {
      const maxRetries = config.NODE_ENV === "development" ? 3 : 10;
      if (times > maxRetries) {
        logger.info("Redis: offline — continuing with direct database fallback");
        return null; // Stop retrying — let the caller handle the miss
      }
      const delay = Math.min(times * 100, 3000);
      logger.debug({ attempt: times, delayMs: delay }, "Redis: reconnecting");
      return delay;
    },

    // Automatically reconnect on connection loss
    reconnectOnError(err) {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      return targetErrors.some((msg) => err.message.includes(msg));
    },

    // Keep connection alive — prevents NAT/firewall from dropping idle TCP
    keepAlive: 1000,

    // Only connect when a command is executed, so the app can start without Redis
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on("connect", () => logger.info("Redis: connected"));
  client.on("ready", () => logger.info("Redis: ready"));
  client.on("error", (err: any) => {
    if (err.code === "ECONNREFUSED") {
      logger.warn("Redis: server not reachable at " + config.REDIS_URL + " — operating in cache-bypass mode");
    } else {
      logger.error({ err }, "Redis: error");
    }
  });
  client.on("close", () => logger.debug("Redis: connection closed"));
  client.on("reconnecting", () => logger.debug("Redis: reconnecting"));

  return client;
}

// Main client for get/set/del operations
export const redis = createRedisClient();

// Separate client for BullMQ — BullMQ requires a dedicated connection
// SHOULD INCASE: BullMQ blocks its connection with BLPOP for queue
// consumption — you cannot use that connection for other commands.
export const redisForQueue = createRedisClient();

// ─── Helper: cache keys ──────────────────────────────────────────────────────

export const CacheKey = {
  product:     (slug: string)      => `product:${slug}`,
  productList: (hash: string)      => `products:list:${hash}`,
  categories:  ()                  => `categories:tree`,
  trendingProducts: ()             => `products:trending`,
  groupedByMerchant: ()            => `products:grouped_by_merchant`,
  otherSellers: (name: string)     => `products:sellers:${Buffer.from(name).toString("base64url")}`,
  homeFeatured: ()                 => `home:featured`,
  cart:        (sessionId: string) => `cart:${sessionId}`,
  session:     (userId: string)    => `session:${userId}`,
  syncLock:    ()                  => `lock:wc-sync`,
} as const;

// ─── Helper: flush by pattern ────────────────────────────────────────────────
// Use this instead of FLUSHALL — only deletes keys matching the pattern.

export async function flushPattern(pattern: string): Promise<number> {
  let cursor = "0";
  let deletedCount = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;

    if (keys.length > 0) {
      // FIX #14: Batch delete via pipeline to prevent blocking Redis event loop
      const pipeline = redis.pipeline();
      for (const key of keys) {
        pipeline.del(key);
      }
      await pipeline.exec();
      deletedCount += keys.length;
    }
  } while (cursor !== "0");

  logger.debug({ pattern, deletedCount }, "Redis: flushed keys by pattern");
  return deletedCount;
}

// ─── Helper: safe get/set with fallback ──────────────────────────────────────
// Wraps operations so a Redis failure never breaks the request handler.

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Redis miss — caller falls through to DB
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Non-fatal — the request still succeeds, just uncached
    logger.warn({ key }, "Redis: failed to set cache");
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    logger.warn({ key }, "Redis: failed to delete cache key");
  }
}
