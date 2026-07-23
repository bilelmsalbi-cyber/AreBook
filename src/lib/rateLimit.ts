// Goes in: D:\AreBook\src\lib\rateLimit.ts
//
// A simple per-IP rate limiter, stored in memory.
// Honest limitation: this resets if the server restarts, and doesn't work
// across multiple server instances (real production apps on Vercel would
// use a shared store like Upstash Redis for this). For a single-instance
// app at this stage, this is a legitimate, commonly used baseline —
// it's the same idea (fixed time window + request counter), just without
// an external database behind it yet.

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 5; // max requests per IP per window

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    // start a fresh window for this IP
    buckets.set(ip, { count: 1, windowStart: now });
    return false;
  }

  bucket.count += 1;

  if (bucket.count > MAX_REQUESTS) {
    return true;
  }

  return false;
}

// Basic cleanup so the Map doesn't grow forever (runs on every call, cheap enough at this scale)
export function cleanupOldBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of buckets.entries()) {
    if (now - bucket.windowStart > WINDOW_MS) {
      buckets.delete(ip);
    }
  }
}