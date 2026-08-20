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