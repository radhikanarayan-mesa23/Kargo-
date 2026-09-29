import { createHash, timingSafeEqual } from "crypto";

// Hash both sides to a fixed-length digest first so timingSafeEqual never
// short-circuits on a length mismatch, which would leak the password length.
export function verifyPassword(candidate: string, expected: string): boolean {
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}
