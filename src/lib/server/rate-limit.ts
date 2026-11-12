/**
 * Sliding-window rate limiter kept in memory.
 *
 * On Vercel each serverless instance has its own memory, so this is a
 * best-effort per-instance limit: it stops a single client hammering a warm
 * function, not a distributed attack. For a hard global limit, swap the store
 * for Upstash Redis / Vercel KV (see README → Security).
 */
type Bucket = number[];

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (now - lastSweep > windowMs * 5) {
    for (const [k, b] of buckets) if (!b.length || now - b[b.length - 1] > windowMs) buckets.delete(k);
    lastSweep = now;
  }
  const bucket = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (bucket.length >= limit) {
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((windowMs - (now - bucket[0])) / 1000) };
  }
  bucket.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.length, retryAfterSeconds: 0 };
}

export function resetRateLimits(): void {
  buckets.clear();
}
