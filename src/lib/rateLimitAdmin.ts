import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------
// Escalating lockout for admin login attempts — IP-based ONLY.
//
// Why not lock by email too: with mandatory 2FA (password + Passkey),
// knowing the password alone can't get an attacker in, so the main
// threat an email-based lock defends against is already neutralized.
// Locking by email instead opens a worse door: anyone who knows (or
// guesses) a real admin's email can deliberately fail 3 logins and lock
// the real owner out — a denial-of-service on our own admins. Locking
// by IP avoids this: an attacker can only ever throttle themselves.
// ---------------------------------------------------------------------

const redis = Redis.fromEnv();

const FAILURE_WINDOW_SECONDS = 60;
const STRIKES_PER_LOCK = 3;
const LOCK_LEVEL_DECAY_SECONDS = 60 * 60;
const LOCK_DURATIONS_SECONDS = [30, 120, 600];

function failureKey(ip: string) {
  return `admin-login:fail:${ip}`;
}
function lockKey(ip: string) {
  return `admin-login:lock:${ip}`;
}
function levelKey(ip: string) {
  return `admin-login:level:${ip}`;
}

export type LoginLockStatus =
  | { locked: false }
  | { locked: true; retryAfterSeconds: number };

export async function checkAdminLoginLock(ip: string): Promise<LoginLockStatus> {
  const ttl = await redis.ttl(lockKey(ip));
  if (ttl > 0) {
    return { locked: true, retryAfterSeconds: ttl };
  }
  return { locked: false };
}

export async function recordAdminLoginFailure(ip: string): Promise<void> {
  const count = await redis.incr(failureKey(ip));
  await redis.expire(failureKey(ip), FAILURE_WINDOW_SECONDS);

  if (count % STRIKES_PER_LOCK === 0) {
    const level = await redis.incr(levelKey(ip));
    await redis.expire(levelKey(ip), LOCK_LEVEL_DECAY_SECONDS);
    const duration =
      LOCK_DURATIONS_SECONDS[Math.min(level, LOCK_DURATIONS_SECONDS.length) - 1];
    await redis.set(lockKey(ip), "1", { ex: duration });
  }
}

export async function clearAdminLoginFailures(ip: string): Promise<void> {
  await redis.del(failureKey(ip), lockKey(ip), levelKey(ip));
}