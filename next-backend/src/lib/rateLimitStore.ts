import { redis } from "./redis.js";
import { logger } from "./logger.js";

// Dynamic require for internal Fastify rate limit store modules
declare const require: any;
const LocalStore = require("@fastify/rate-limit/store/LocalStore.js");
const RedisStore = require("@fastify/rate-limit/store/RedisStore.js");

export interface RateLimitStoreOptions {
  continueExceeding?: boolean;
  exponentialBackoff?: boolean;
  cache?: number;
  nameSpace?: string;
  routeInfo?: {
    method?: string;
    url?: string;
  };
}

/**
 * ResilientRateLimitStore
 *
 * Provides a self-healing, zero-crash hybrid rate limiting store:
 * 1. When Redis is connected & ready ('ready'):
 *    Uses RedisStore for distributed rate limiting across all API instances.
 * 2. When Redis is offline or disconnected ('wait', 'close', 'reconnecting', 'end'):
 *    Seamlessly falls back to fast in-memory LRU store (LocalStore).
 * 3. If a Redis command fails in-flight:
 *    Gracefully catches the error and falls back to LocalStore instead of throwing HTTP 500.
 */
export class ResilientRateLimitStore {
  private localStore: any;
  private redisStore: any;
  private static fallbackNoticeLogged = false;

  constructor(options: RateLimitStoreOptions = {}) {
    const continueExceeding = options.continueExceeding ?? false;
    const exponentialBackoff = options.exponentialBackoff ?? false;
    const cache = options.cache ?? 5000;
    const nameSpace = options.nameSpace ?? "fastify-rate-limit-";

    this.localStore = new LocalStore(continueExceeding, exponentialBackoff, cache);
    this.redisStore = new RedisStore(continueExceeding, exponentialBackoff, redis, nameSpace);
  }

  incr(
    key: string,
    callback: (error: Error | null, result?: { current: number; ttl: number }) => void,
    timeWindow?: number,
    max?: number
  ): void {
    // If Redis is not connected / ready, use in-memory LocalStore immediately
    if (redis.status !== "ready") {
      if (!ResilientRateLimitStore.fallbackNoticeLogged) {
        logger.debug("RateLimit: Redis not ready, using in-memory store fallback");
        ResilientRateLimitStore.fallbackNoticeLogged = true;
      }
      return this.localStore.incr(key, callback, timeWindow, max);
    }

    // Redis is ready — reset the fallback notice flag
    ResilientRateLimitStore.fallbackNoticeLogged = false;

    // Execute on Redis, and if any unexpected socket/stream error occurs, fall back to in-memory store
    this.redisStore.incr(
      key,
      (err: Error | null, result: { current: number; ttl: number } | null) => {
        if (err) {
          logger.warn({ err: err.message }, "RateLimit: Redis command error, falling back to in-memory store");
          return this.localStore.incr(key, callback, timeWindow, max);
        }
        callback(null, result ?? undefined);
      },
      timeWindow,
      max
    );
  }

  child(routeOptions: any): any {
    const childStore = new ResilientRateLimitStore(routeOptions);
    childStore.localStore = this.localStore.child(routeOptions);
    childStore.redisStore = this.redisStore.child(routeOptions);
    return childStore;
  }
}
