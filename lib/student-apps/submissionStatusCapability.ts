import crypto from "crypto";

export const SUBMISSION_STATUS_CAPABILITY_BYTES = 32;
const CAPABILITY_HASH_HEX_LENGTH = 64;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43,}$/;

type RandomBytes = (size: number) => Uint8Array;

/** Creates one opaque, URL-safe, 256-bit status capability per submission. */
export function createSubmissionStatusCapability(randomBytes: RandomBytes = crypto.randomBytes): string {
  const bytes = Buffer.from(randomBytes(SUBMISSION_STATUS_CAPABILITY_BYTES));
  if (bytes.length < SUBMISSION_STATUS_CAPABILITY_BYTES) {
    throw new Error("submission_status_capability_randomness_failed");
  }
  return bytes.toString("base64url");
}

/** SHA-256 hex digest of the UTF-8 raw capability; only this value is persisted. */
export function hashSubmissionStatusCapability(rawCapability: string): string {
  if (!CAPABILITY_PATTERN.test(rawCapability)) throw new Error("invalid_submission_status_capability");
  return crypto.createHash("sha256").update(rawCapability, "utf8").digest("hex");
}

/** Kept canonical for the later status enforcement phase. */
export function verifySubmissionStatusCapability(rawCapability: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  let candidateHash: string;
  try {
    candidateHash = hashSubmissionStatusCapability(rawCapability);
  } catch {
    return false;
  }
  const candidate = Buffer.from(candidateHash, "utf8");
  const stored = Buffer.from(storedHash, "utf8");
  return candidate.length === CAPABILITY_HASH_HEX_LENGTH
    && stored.length === CAPABILITY_HASH_HEX_LENGTH
    && crypto.timingSafeEqual(candidate, stored);
}
