import {
  base64UrlDecodeToBytes,
  base64UrlEncode,
  encodeUtf8,
  timingSafeEqual,
} from "@/lib/crypto/webcrypto";
import { classifyPublishAttemptCompatibility } from "@/lib/edu/publish/attemptCompatibility";

export const EDU_PUBLISH_COMMIT_CAPABILITY_VERSION = 2 as const;
export const EDU_PUBLISH_COMMIT_CAPABILITY_OPERATION = "edu_publish_commit" as const;
export const EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS = 2700;
export const EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS = 60;
export const EDU_PUBLISH_COMMIT_CAPABILITY_MAX_TOKEN_LENGTH = 512;

const MAX_PAYLOAD_SEGMENT_LENGTH = 465;
const SIGNATURE_SEGMENT_LENGTH = 43;
const SIGNATURE_BYTE_LENGTH = 32;
const MIN_KEY_BYTE_LENGTH = 32;
const MAX_KEY_BYTE_LENGTH = 64;
const CLAIM_KEYS = [
  "v",
  "op",
  "attemptId",
  "slug",
  "declaredManifestDigest",
  "manifestSchema",
  "iat",
  "exp",
  "kid",
] as const;
const KID_REGEX = /^[A-Za-z0-9._-]{1,32}$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type EduPublishCommitCapabilityClaimsV2 = {
  v: 2;
  op: "edu_publish_commit";
  attemptId: string;
  slug: string;
  declaredManifestDigest: string;
  manifestSchema: 1;
  iat: number;
  exp: number;
  kid: string;
};

export type EduPublishCapabilityKeySlot = {
  kid: string;
  keyBytes: Uint8Array;
};

export type EduPublishCapabilityKeyRing = {
  current: EduPublishCapabilityKeySlot;
  previous?: EduPublishCapabilityKeySlot;
};

export type EduPublishCapabilityKeyRingInput = {
  currentKid?: unknown;
  currentKeyBase64Url?: unknown;
  previousKid?: unknown;
  previousKeyBase64Url?: unknown;
};

export type EduPublishCapabilityKeyRingParseResult =
  | { ok: true; keyRing: EduPublishCapabilityKeyRing }
  | {
      ok: false;
      reason:
        | "missing_current"
        | "invalid_current"
        | "invalid_previous_pair"
        | "invalid_previous"
        | "duplicate_kid";
    };

export type SignEduPublishCommitCapabilityInput = {
  keyRing: EduPublishCapabilityKeyRing;
  nowSeconds: number;
  publishAttemptId: string;
  slug: string;
  declaredManifestDigest: string;
  manifestSchemaVersion: 1;
};

export type SignEduPublishCommitCapabilityResult =
  | {
      ok: true;
      token: string;
      claims: EduPublishCommitCapabilityClaimsV2;
    }
  | { ok: false; reason: "invalid_input" | "evaluation_failed" };

export type EduPublishCommitCapabilityBinding = {
  publishAttemptId: string;
  slug: string;
  declaredManifestDigest: string;
  manifestSchemaVersion: 1;
};

export type VerifyEduPublishCommitCapabilityInput = {
  token: unknown;
  keyRing: EduPublishCapabilityKeyRing | null;
  nowSeconds: number;
  expected: EduPublishCommitCapabilityBinding;
};

export type EduPublishCommitCapabilityVerificationResult =
  | { mode: "valid_v2"; claims: EduPublishCommitCapabilityClaimsV2; keySlot: "current" | "previous" }
  | { mode: "missing" }
  | { mode: "malformed" }
  | { mode: "unsupported_version" }
  | { mode: "unknown_kid" }
  | { mode: "invalid_signature" }
  | { mode: "expired" }
  | { mode: "not_yet_valid" }
  | { mode: "invalid_lifetime" }
  | { mode: "invalid_claim" }
  | { mode: "claim_mismatch" }
  | { mode: "configuration_unavailable" }
  | { mode: "evaluation_failed" };

function isStrictBase64Url(value: string): boolean {
  return value.length > 0 && value.length % 4 !== 1 && /^[A-Za-z0-9_-]+$/.test(value);
}

function decodeStrictBase64Url(value: string): Uint8Array | null {
  if (!isStrictBase64Url(value)) return null;
  const decoded = base64UrlDecodeToBytes(value);
  if (!decoded || base64UrlEncode(decoded) !== value) return null;
  return decoded;
}

function isValidKid(value: unknown): value is string {
  return typeof value === "string" && KID_REGEX.test(value);
}

function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 64 && SLUG_REGEX.test(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isSafeInteger(value) && value > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return isPositiveSafeInteger(value);
}

function isValidKeyBytes(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array && value.length >= MIN_KEY_BYTE_LENGTH && value.length <= MAX_KEY_BYTE_LENGTH;
}

function isValidKeySlot(value: unknown): value is EduPublishCapabilityKeySlot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const slot = value as Partial<EduPublishCapabilityKeySlot>;
  return isValidKid(slot.kid) && isValidKeyBytes(slot.keyBytes);
}

function isValidKeyRing(value: unknown): value is EduPublishCapabilityKeyRing {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const ring = value as Partial<EduPublishCapabilityKeyRing>;
  if (!isValidKeySlot(ring.current)) return false;
  if (ring.previous !== undefined && !isValidKeySlot(ring.previous)) return false;
  return ring.previous === undefined || ring.current.kid !== ring.previous.kid;
}

function classifyAttemptTriple(
  attemptId: unknown,
  declaredManifestDigest: unknown,
  manifestSchema: unknown,
): boolean {
  return classifyPublishAttemptCompatibility({
    publishAttemptId: attemptId,
    declaredManifestDigest,
    manifestSchemaVersion: manifestSchema,
  }).mode === "attempt_v1";
}

function isValidBinding(value: unknown): value is EduPublishCommitCapabilityBinding {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const binding = value as Partial<EduPublishCommitCapabilityBinding>;
  return (
    classifyAttemptTriple(
      binding.publishAttemptId,
      binding.declaredManifestDigest,
      binding.manifestSchemaVersion,
    ) &&
    isValidSlug(binding.slug)
  );
}

function orderedClaims(input: {
  attemptId: string;
  slug: string;
  declaredManifestDigest: string;
  iat: number;
  exp: number;
  kid: string;
}): EduPublishCommitCapabilityClaimsV2 {
  return {
    v: EDU_PUBLISH_COMMIT_CAPABILITY_VERSION,
    op: EDU_PUBLISH_COMMIT_CAPABILITY_OPERATION,
    attemptId: input.attemptId,
    slug: input.slug,
    declaredManifestDigest: input.declaredManifestDigest,
    manifestSchema: 1,
    iat: input.iat,
    exp: input.exp,
    kid: input.kid,
  };
}

function serializeClaims(claims: EduPublishCommitCapabilityClaimsV2): string {
  return JSON.stringify(claims);
}

async function signBytes(input: string, keyBytes: Uint8Array): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new Uint8Array(keyBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, encodeUtf8(input)));
}

function hasExactClaimKeys(value: unknown): value is Record<(typeof CLAIM_KEYS)[number], unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === CLAIM_KEYS.length && keys.every((key, index) => key === CLAIM_KEYS[index]);
}

function isValidClaims(value: Record<(typeof CLAIM_KEYS)[number], unknown>): value is EduPublishCommitCapabilityClaimsV2 {
  return (
    value.v === EDU_PUBLISH_COMMIT_CAPABILITY_VERSION &&
    value.op === EDU_PUBLISH_COMMIT_CAPABILITY_OPERATION &&
    classifyAttemptTriple(value.attemptId, value.declaredManifestDigest, value.manifestSchema) &&
    isValidSlug(value.slug) &&
    isValidUnixSeconds(value.iat) &&
    isValidUnixSeconds(value.exp) &&
    isValidKid(value.kid)
  );
}

function validateLifetime(claims: EduPublishCommitCapabilityClaimsV2): boolean {
  return claims.exp > claims.iat && claims.exp - claims.iat <= EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS;
}

export function parseEduPublishCapabilityKeyRing(
  input: EduPublishCapabilityKeyRingInput,
): EduPublishCapabilityKeyRingParseResult {
  const currentKidPresent = input?.currentKid !== undefined;
  const currentKeyPresent = input?.currentKeyBase64Url !== undefined;
  if (!currentKidPresent && !currentKeyPresent) return { ok: false, reason: "missing_current" };
  if (!currentKidPresent || !currentKeyPresent) return { ok: false, reason: "invalid_current" };

  if (!isValidKid(input.currentKid) || typeof input.currentKeyBase64Url !== "string") {
    return { ok: false, reason: "invalid_current" };
  }
  const currentKeyBytes = decodeStrictBase64Url(input.currentKeyBase64Url);
  if (!currentKeyBytes || !isValidKeyBytes(currentKeyBytes)) return { ok: false, reason: "invalid_current" };

  const previousKidPresent = input.previousKid !== undefined;
  const previousKeyPresent = input.previousKeyBase64Url !== undefined;
  if (previousKidPresent !== previousKeyPresent) return { ok: false, reason: "invalid_previous_pair" };

  let previous: EduPublishCapabilityKeySlot | undefined;
  if (previousKidPresent && previousKeyPresent) {
    if (!isValidKid(input.previousKid) || typeof input.previousKeyBase64Url !== "string") {
      return { ok: false, reason: "invalid_previous" };
    }
    const previousKeyBytes = decodeStrictBase64Url(input.previousKeyBase64Url);
    if (!previousKeyBytes || !isValidKeyBytes(previousKeyBytes)) return { ok: false, reason: "invalid_previous" };
    previous = { kid: input.previousKid, keyBytes: new Uint8Array(previousKeyBytes) };
  }

  if (previous && input.currentKid === previous.kid) return { ok: false, reason: "duplicate_kid" };
  return {
    ok: true,
    keyRing: {
      current: { kid: input.currentKid, keyBytes: new Uint8Array(currentKeyBytes) },
      ...(previous ? { previous } : {}),
    },
  };
}

export async function signEduPublishCommitCapability(
  input: SignEduPublishCommitCapabilityInput,
): Promise<SignEduPublishCommitCapabilityResult> {
  if (
    !input ||
    !isValidKeyRing(input.keyRing) ||
    !isValidUnixSeconds(input.nowSeconds) ||
    !classifyAttemptTriple(input.publishAttemptId, input.declaredManifestDigest, input.manifestSchemaVersion) ||
    !isValidSlug(input.slug)
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const iat = input.nowSeconds;
  const exp = iat + EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS;
  if (!Number.isSafeInteger(exp)) return { ok: false, reason: "invalid_input" };
  const claims = orderedClaims({
    attemptId: input.publishAttemptId,
    slug: input.slug,
    declaredManifestDigest: input.declaredManifestDigest,
    iat,
    exp,
    kid: input.keyRing.current.kid,
  });

  try {
    const payloadSegment = base64UrlEncode(encodeUtf8(serializeClaims(claims)));
    const signingInput = `v2.${payloadSegment}`;
    const signatureSegment = base64UrlEncode(await signBytes(signingInput, input.keyRing.current.keyBytes));
    const token = `${signingInput}.${signatureSegment}`;
    if (payloadSegment.length > MAX_PAYLOAD_SEGMENT_LENGTH || token.length > EDU_PUBLISH_COMMIT_CAPABILITY_MAX_TOKEN_LENGTH) {
      return { ok: false, reason: "invalid_input" };
    }
    return { ok: true, token, claims };
  } catch {
    return { ok: false, reason: "evaluation_failed" };
  }
}

export async function verifyEduPublishCommitCapability(
  input: VerifyEduPublishCommitCapabilityInput,
): Promise<EduPublishCommitCapabilityVerificationResult> {
  if (!input || input.keyRing === null || input.keyRing === undefined) return { mode: "configuration_unavailable" };
  if (input.token === undefined || input.token === null) return { mode: "missing" };
  if (typeof input.token !== "string" || input.token.length === 0 || input.token.length > EDU_PUBLISH_COMMIT_CAPABILITY_MAX_TOKEN_LENGTH) {
    return { mode: "malformed" };
  }

  const segments = input.token.split(".");
  if (segments.length !== 3) return { mode: "malformed" };
  const [versionSegment, payloadSegment, signatureSegment] = segments;
  if (versionSegment !== "v2") return /^v\d+$/.test(versionSegment) ? { mode: "unsupported_version" } : { mode: "malformed" };
  if (
    payloadSegment.length === 0 ||
    payloadSegment.length > MAX_PAYLOAD_SEGMENT_LENGTH ||
    signatureSegment.length !== SIGNATURE_SEGMENT_LENGTH
  ) {
    return { mode: "malformed" };
  }

  const payloadBytes = decodeStrictBase64Url(payloadSegment);
  const submittedSignature = decodeStrictBase64Url(signatureSegment);
  if (!payloadBytes || !submittedSignature || submittedSignature.length !== SIGNATURE_BYTE_LENGTH) {
    return { mode: "malformed" };
  }

  let payloadJson: string;
  let parsed: unknown;
  try {
    payloadJson = new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes);
    parsed = JSON.parse(payloadJson) as unknown;
  } catch {
    return { mode: "malformed" };
  }

  const untrustedKid = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as { kid?: unknown }).kid
    : undefined;
  if (!isValidKid(untrustedKid)) return { mode: "malformed" };
  if (!isValidKeyRing(input.keyRing)) return { mode: "configuration_unavailable" };

  const keySlot = input.keyRing.current.kid === untrustedKid
    ? "current"
    : input.keyRing.previous?.kid === untrustedKid
      ? "previous"
      : null;
  if (!keySlot) return { mode: "unknown_kid" };
  const keyBytes = keySlot === "current" ? input.keyRing.current.keyBytes : input.keyRing.previous!.keyBytes;

  let expectedSignature: Uint8Array;
  try {
    expectedSignature = await signBytes(`v2.${payloadSegment}`, keyBytes);
  } catch {
    return { mode: "evaluation_failed" };
  }
  if (expectedSignature.length !== SIGNATURE_BYTE_LENGTH) return { mode: "evaluation_failed" };
  if (!timingSafeEqual(expectedSignature, submittedSignature)) return { mode: "invalid_signature" };

  if (!hasExactClaimKeys(parsed)) return { mode: "malformed" };
  if (!isValidClaims(parsed)) return { mode: "invalid_claim" };
  const canonicalPayload = base64UrlEncode(encodeUtf8(serializeClaims(parsed)));
  if (canonicalPayload !== payloadSegment || payloadJson !== serializeClaims(parsed)) return { mode: "malformed" };
  if (!validateLifetime(parsed)) return { mode: "invalid_lifetime" };
  if (!isValidUnixSeconds(input.nowSeconds)) return { mode: "evaluation_failed" };
  if (parsed.iat > input.nowSeconds + EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS) return { mode: "not_yet_valid" };
  if (input.nowSeconds >= parsed.exp) return { mode: "expired" };

  if (!isValidBinding(input.expected)) return { mode: "evaluation_failed" };
  if (
    parsed.attemptId !== input.expected.publishAttemptId ||
    parsed.slug !== input.expected.slug ||
    parsed.declaredManifestDigest !== input.expected.declaredManifestDigest ||
    parsed.manifestSchema !== input.expected.manifestSchemaVersion
  ) {
    return { mode: "claim_mismatch" };
  }
  return { mode: "valid_v2", claims: parsed, keySlot };
}
