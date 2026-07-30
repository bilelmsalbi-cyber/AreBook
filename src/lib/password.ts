import argon2 from "argon2";

/**
 * Hashes a plain text password using argon2id.
 * argon2id is the OWASP-recommended variant (resistant to both
 * GPU cracking and side-channel attacks).
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
  });
}

/**
 * Verifies a plain text password against a stored argon2 hash.
 * Returns true if it matches, false otherwise.
 */
export async function verifyPassword(
  hash: string,
  plainPassword: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    // Malformed hash or internal error — treat as invalid password
    return false;
  }
}