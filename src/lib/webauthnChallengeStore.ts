import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const CHALLENGE_TTL_SECONDS = 300;

function key(scope: "reg" | "auth", id: string) {
  return `webauthn:challenge:${scope}:${id}`;
}

export async function saveChallenge(
  scope: "reg" | "auth",
  id: string,
  challenge: string
): Promise<void> {
  await redis.set(key(scope, id), challenge, { ex: CHALLENGE_TTL_SECONDS });
}

export async function consumeChallenge(
  scope: "reg" | "auth",
  id: string
): Promise<string | null> {
  const challenge = await redis.get<string>(key(scope, id));
  if (challenge) {
    await redis.del(key(scope, id));
  }
  return challenge;
}