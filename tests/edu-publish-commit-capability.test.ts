import assert from "node:assert/strict";
import test from "node:test";

import {
  EDU_PUBLISH_COMMIT_CAPABILITY_MAX_TOKEN_LENGTH,
  EDU_PUBLISH_COMMIT_CAPABILITY_OPERATION,
  EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS,
  EDU_PUBLISH_COMMIT_CAPABILITY_VERSION,
  parseEduPublishCapabilityKeyRing,
  signEduPublishCommitCapability,
  verifyEduPublishCommitCapability,
  type EduPublishCapabilityKeyRing,
  type EduPublishCommitCapabilityBinding,
  type EduPublishCommitCapabilityClaimsV2,
} from "@/lib/edu/publish/commitCapability";

const KEY_BYTES = Uint8Array.from({ length: 32 }, (_, index) => index);
const KEY_BASE64URL = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
const PREVIOUS_KEY_BYTES = Uint8Array.from({ length: 32 }, (_, index) => 31 - index);
const PREVIOUS_KEY_BASE64URL = "Hx4dHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA";
const CURRENT_KID = "cap-2026-01";
const PREVIOUS_KID = "cap-2025-12";
const NOW = 1_760_000_000;
const ATTEMPT_ID = "123e4567-e89b-12d3-a456-426614174000";
const DIGEST = "a".repeat(64);
const SLUG = "abc123-123456-p1";

const GOLDEN_JSON =
  '{"v":2,"op":"edu_publish_commit","attemptId":"123e4567-e89b-12d3-a456-426614174000","slug":"abc123-123456-p1","declaredManifestDigest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","manifestSchema":1,"iat":1760000000,"exp":1760002700,"kid":"cap-2026-01"}';
const GOLDEN_PAYLOAD =
  "eyJ2IjoyLCJvcCI6ImVkdV9wdWJsaXNoX2NvbW1pdCIsImF0dGVtcHRJZCI6IjEyM2U0NTY3LWU4OWItMTJkMy1hNDU2LTQyNjYxNDE3NDAwMCIsInNsdWciOiJhYmMxMjMtMTIzNDU2LXAxIiwiZGVjbGFyZWRNYW5pZmVzdERpZ2VzdCI6ImFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWEiLCJtYW5pZmVzdFNjaGVtYSI6MSwiaWF0IjoxNzYwMDAwMDAwLCJleHAiOjE3NjAwMDI3MDAsImtpZCI6ImNhcC0yMDI2LTAxIn0";
const GOLDEN_SIGNATURE = "9UFijoE3mwXnZvr4EzwjmaM6oLmPy9XR2SHKxYdTID4";
const GOLDEN_TOKEN = `v2.${GOLDEN_PAYLOAD}.${GOLDEN_SIGNATURE}`;

function keyRing(overrides: Partial<EduPublishCapabilityKeyRing> = {}): EduPublishCapabilityKeyRing {
  return {
    current: { kid: CURRENT_KID, keyBytes: new Uint8Array(KEY_BYTES) },
    ...overrides,
  };
}

function expected(overrides: Partial<EduPublishCommitCapabilityBinding> = {}): EduPublishCommitCapabilityBinding {
  return {
    publishAttemptId: ATTEMPT_ID,
    slug: SLUG,
    declaredManifestDigest: DIGEST,
    manifestSchemaVersion: 1,
    ...overrides,
  };
}

function claims(overrides: Partial<EduPublishCommitCapabilityClaimsV2> = {}): EduPublishCommitCapabilityClaimsV2 {
  return {
    v: 2,
    op: "edu_publish_commit",
    attemptId: ATTEMPT_ID,
    slug: SLUG,
    declaredManifestDigest: DIGEST,
    manifestSchema: 1,
    iat: NOW,
    exp: NOW + EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS,
    kid: CURRENT_KID,
    ...overrides,
  };
}

function localBase64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function independentlySignedToken(payload: string | Uint8Array, keyBytes = KEY_BYTES, version = "v2"): Promise<string> {
  const payloadSegment = localBase64UrlEncode(typeof payload === "string" ? new TextEncoder().encode(payload) : payload);
  const signingInput = `${version}.${payloadSegment}`;
  const key = await globalThis.crypto.subtle.importKey("raw", new Uint8Array(keyBytes), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${localBase64UrlEncode(new Uint8Array(signature))}`;
}

async function signedClaims(overrides: Record<string, unknown> = {}, keyBytes = KEY_BYTES): Promise<string> {
  return independentlySignedToken(JSON.stringify({ ...claims(), ...overrides }), keyBytes);
}

async function verify(token: unknown, overrides: Partial<Parameters<typeof verifyEduPublishCommitCapability>[0]> = {}) {
  return verifyEduPublishCommitCapability({ token, keyRing: keyRing(), nowSeconds: NOW, expected: expected(), ...overrides });
}

test("parses current and previous keys strictly, clones bytes, and rejects invalid key rings", () => {
  const input = {
    currentKid: CURRENT_KID,
    currentKeyBase64Url: KEY_BASE64URL,
    previousKid: PREVIOUS_KID,
    previousKeyBase64Url: PREVIOUS_KEY_BASE64URL,
  };
  const before = structuredClone(input);
  const result = parseEduPublishCapabilityKeyRing(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.keyRing, {
    current: { kid: CURRENT_KID, keyBytes: KEY_BYTES },
    previous: { kid: PREVIOUS_KID, keyBytes: PREVIOUS_KEY_BYTES },
  });
  assert.notEqual(result.keyRing.current.keyBytes, KEY_BYTES);
  assert.notEqual(result.keyRing.previous?.keyBytes, PREVIOUS_KEY_BYTES);
  result.keyRing.current.keyBytes[0] = 255;
  assert.deepEqual(input, before);
  assert.deepEqual(parseEduPublishCapabilityKeyRing({ currentKid: CURRENT_KID, currentKeyBase64Url: KEY_BASE64URL }), {
    ok: true,
    keyRing: { current: { kid: CURRENT_KID, keyBytes: KEY_BYTES } },
  });

  const bytes31 = localBase64UrlEncode(new Uint8Array(31));
  const bytes65 = localBase64UrlEncode(new Uint8Array(65));
  const invalidCases: Array<[string, Record<string, unknown>]> = [
    ["missing_current", {}],
    ["invalid_current", { currentKid: "bad kid", currentKeyBase64Url: KEY_BASE64URL }],
    ["invalid_current", { currentKid: CURRENT_KID, currentKeyBase64Url: `${KEY_BASE64URL}=` }],
    ["invalid_current", { currentKid: CURRENT_KID, currentKeyBase64Url: "AB" }],
    ["invalid_current", { currentKid: CURRENT_KID, currentKeyBase64Url: bytes31 }],
    ["invalid_current", { currentKid: CURRENT_KID, currentKeyBase64Url: bytes65 }],
    ["invalid_previous_pair", { currentKid: CURRENT_KID, currentKeyBase64Url: KEY_BASE64URL, previousKid: PREVIOUS_KID }],
    ["invalid_previous", { currentKid: CURRENT_KID, currentKeyBase64Url: KEY_BASE64URL, previousKid: "bad kid", previousKeyBase64Url: PREVIOUS_KEY_BASE64URL }],
    ["invalid_previous", { currentKid: CURRENT_KID, currentKeyBase64Url: KEY_BASE64URL, previousKid: PREVIOUS_KID, previousKeyBase64Url: `${PREVIOUS_KEY_BASE64URL}=` }],
    ["duplicate_kid", { currentKid: CURRENT_KID, currentKeyBase64Url: KEY_BASE64URL, previousKid: CURRENT_KID, previousKeyBase64Url: PREVIOUS_KEY_BASE64URL }],
  ];
  for (const [reason, value] of invalidCases) {
    assert.deepEqual(parseEduPublishCapabilityKeyRing(value), { ok: false, reason });
  }
});

test("signs the fixed golden vector with ordered claims and the current key", async () => {
  const result = await signEduPublishCommitCapability({
    keyRing: keyRing(),
    nowSeconds: NOW,
    publishAttemptId: ATTEMPT_ID,
    slug: SLUG,
    declaredManifestDigest: DIGEST,
    manifestSchemaVersion: 1,
  });
  assert.deepEqual(result, { ok: true, token: GOLDEN_TOKEN, claims: claims() });
  assert.equal(JSON.stringify(result.ok && result.claims), GOLDEN_JSON);
  assert.equal(GOLDEN_PAYLOAD, localBase64UrlEncode(new TextEncoder().encode(GOLDEN_JSON)));
  assert.equal(`v2.${GOLDEN_PAYLOAD}`, GOLDEN_TOKEN.slice(0, -44));
  assert.equal(GOLDEN_TOKEN.endsWith(`.${GOLDEN_SIGNATURE}`), true);
  assert.deepEqual(await signEduPublishCommitCapability({
    keyRing: keyRing({ current: { kid: CURRENT_KID, keyBytes: new Uint8Array(KEY_BYTES) } }),
    nowSeconds: NOW,
    publishAttemptId: ATTEMPT_ID,
    slug: SLUG,
    declaredManifestDigest: DIGEST,
    manifestSchemaVersion: 1,
  }), result);
});

test("rejects invalid signing input without mutating the input", async () => {
  const input = {
    keyRing: keyRing(),
    nowSeconds: NOW,
    publishAttemptId: ATTEMPT_ID,
    slug: SLUG,
    declaredManifestDigest: DIGEST,
    manifestSchemaVersion: 1 as const,
  };
  const before = structuredClone(input);
  for (const override of [
    { nowSeconds: 0 },
    { nowSeconds: 1.5 },
    { publishAttemptId: ATTEMPT_ID.toUpperCase() },
    { declaredManifestDigest: DIGEST.toUpperCase() },
    { slug: "not a slug" },
  ]) {
    assert.deepEqual(await signEduPublishCommitCapability({ ...input, ...override }), { ok: false, reason: "invalid_input" });
  }
  for (const manifestSchemaVersion of [2, "1"] as const) {
    assert.deepEqual(await signEduPublishCommitCapability({
      ...input,
      manifestSchemaVersion,
    } as unknown as typeof input), { ok: false, reason: "invalid_input" });
  }
  assert.deepEqual(input, before);
});

test("verifies current and previous key tokens and reports the selected slot", async () => {
  assert.deepEqual(await verify(GOLDEN_TOKEN), { mode: "valid_v2", claims: claims(), keySlot: "current" });
  const ring = keyRing({ previous: { kid: PREVIOUS_KID, keyBytes: new Uint8Array(PREVIOUS_KEY_BYTES) } });
  const token = await independentlySignedToken(GOLDEN_JSON.replace(CURRENT_KID, PREVIOUS_KID), PREVIOUS_KEY_BYTES);
  assert.deepEqual(await verify(token, { keyRing: ring }), { mode: "valid_v2", claims: claims({ kid: PREVIOUS_KID }), keySlot: "previous" });
});

test("classifies missing, malformed, and unsupported envelopes", async () => {
  assert.deepEqual(await verify(undefined), { mode: "missing" });
  assert.deepEqual(await verify(null), { mode: "missing" });
  for (const token of [
    "",
    42,
    `x${"a".repeat(512)}`,
    `v2.${GOLDEN_PAYLOAD}`,
    `v2.${GOLDEN_PAYLOAD}.${GOLDEN_SIGNATURE}.extra`,
    `v1.${GOLDEN_PAYLOAD}.${GOLDEN_SIGNATURE}`,
    `v3.${GOLDEN_PAYLOAD}.${GOLDEN_SIGNATURE}`,
    `v2.${"A".repeat(466)}.${GOLDEN_SIGNATURE}`,
    `v2.${GOLDEN_PAYLOAD}.${"A".repeat(42)}`,
    `v2.${GOLDEN_PAYLOAD}=${GOLDEN_SIGNATURE}`,
    `v2.${GOLDEN_PAYLOAD.slice(0, -1)}!${GOLDEN_SIGNATURE}`,
  ]) {
    const result = await verify(token);
    assert.ok(["malformed", "unsupported_version"].includes(result.mode), `${String(token).slice(0, 20)}: ${result.mode}`);
  }
  assert.deepEqual(await verify("v2." + "A".repeat(465) + "." + GOLDEN_SIGNATURE), { mode: "malformed" });
  assert.equal(EDU_PUBLISH_COMMIT_CAPABILITY_MAX_TOKEN_LENGTH, 512);
});

test("rejects malformed UTF-8 and JSON after strict envelope parsing", async () => {
  assert.deepEqual(await verify(await independentlySignedToken(Uint8Array.from([0xc3, 0x28]))), { mode: "malformed" });
  assert.deepEqual(await verify(await independentlySignedToken("{not-json")), { mode: "malformed" });
});

test("rejects payload and signature tampering, wrong keys, unknown kids, and truncation", async () => {
  const changedPayload = `${(await independentlySignedToken(JSON.stringify(claims({ slug: "abc123-123456-p2" })))).split(".").slice(0, 2).join(".")}.${GOLDEN_SIGNATURE}`;
  assert.deepEqual(await verify(changedPayload), { mode: "invalid_signature" });
  const changedSignature = `${GOLDEN_TOKEN.slice(0, -1)}${GOLDEN_TOKEN.endsWith("A") ? "B" : "A"}`;
  assert.deepEqual(await verify(changedSignature), { mode: "invalid_signature" });
  assert.deepEqual(await verify(GOLDEN_TOKEN, { keyRing: keyRing({ current: { kid: CURRENT_KID, keyBytes: new Uint8Array(PREVIOUS_KEY_BYTES) } }) }), { mode: "invalid_signature" });
  const unknownKidToken = await signedClaims({ kid: "cap-unknown" });
  assert.deepEqual(await verify(unknownKidToken), { mode: "unknown_kid" });
  assert.deepEqual(await verify(`${GOLDEN_TOKEN.slice(0, -1)}=`), { mode: "malformed" });
});

test("enforces exact canonical claim keys, order, JSON, and values", async () => {
  const reordered = JSON.stringify({
    v: 2,
    op: "edu_publish_commit",
    attemptId: ATTEMPT_ID,
    slug: SLUG,
    declaredManifestDigest: DIGEST,
    manifestSchema: 1,
    exp: NOW + 2700,
    iat: NOW,
    kid: CURRENT_KID,
  });
  assert.deepEqual(await verify(await independentlySignedToken(reordered)), { mode: "malformed" });
  assert.deepEqual(await verify(await independentlySignedToken(JSON.stringify({ ...claims(), unknown: "x" }))), { mode: "malformed" });
  const missing = { ...claims() } as Record<string, unknown>;
  delete missing.kid;
  assert.deepEqual(await verify(await independentlySignedToken(JSON.stringify(missing))), { mode: "malformed" });
  assert.deepEqual(await verify(await independentlySignedToken(` ${GOLDEN_JSON} `)), { mode: "malformed" });

  for (const override of [
    { v: 1 },
    { op: "other_operation" },
    { attemptId: ATTEMPT_ID.toUpperCase() },
    { attemptId: "not-a-uuid" },
    { declaredManifestDigest: DIGEST.toUpperCase() },
    { declaredManifestDigest: "b".repeat(63) },
    { manifestSchema: 2 },
    { slug: "ABC123" },
    { slug: "abc 123" },
    { slug: "abc/123" },
    { slug: "a".repeat(65) },
    { attemptId: 42 },
    { slug: 42 },
    { declaredManifestDigest: 42 },
    { manifestSchema: "1" },
    { iat: "now" },
    { exp: "later" },
  ]) {
    assert.deepEqual(await verify(await signedClaims(override)), { mode: "invalid_claim" }, JSON.stringify(override));
  }
  assert.deepEqual(await verify(await signedClaims({ kid: "bad kid" })), { mode: "malformed" });
});

test("enforces lifetime and clock boundaries", async () => {
  assert.deepEqual(await verify(GOLDEN_TOKEN), { mode: "valid_v2", claims: claims(), keySlot: "current" });
  assert.deepEqual(await verify(await signedClaims({ iat: NOW + 60, exp: NOW + 60 + 2700 }), { nowSeconds: NOW }), { mode: "valid_v2", claims: claims({ iat: NOW + 60, exp: NOW + 60 + 2700 }), keySlot: "current" });
  assert.deepEqual(await verify(await signedClaims({ iat: NOW + 61, exp: NOW + 61 + 2700 }), { nowSeconds: NOW }), { mode: "not_yet_valid" });
  assert.deepEqual(await verify(await signedClaims({ iat: NOW, exp: NOW + 2700 }), { nowSeconds: NOW + 2699 }), { mode: "valid_v2", claims: claims(), keySlot: "current" });
  assert.deepEqual(await verify(await signedClaims({ iat: NOW, exp: NOW + 2700 }), { nowSeconds: NOW + 2700 }), { mode: "expired" });
  for (const override of [
    { iat: NOW, exp: NOW },
    { iat: NOW + 1, exp: NOW },
    { iat: NOW, exp: NOW + 2701 },
  ]) {
    assert.deepEqual(await verify(await signedClaims(override)), { mode: "invalid_lifetime" });
  }
  assert.deepEqual(await verify(GOLDEN_TOKEN, { nowSeconds: 0 }), { mode: "evaluation_failed" });
  assert.deepEqual(await verify(GOLDEN_TOKEN, { nowSeconds: 1.5 }), { mode: "evaluation_failed" });
  assert.deepEqual(await verify(GOLDEN_TOKEN, { nowSeconds: Number.NaN }), { mode: "evaluation_failed" });
});

test("classifies valid binding mismatches separately from invalid expected bindings", async () => {
  for (const override of [
    { publishAttemptId: "123e4567-e89b-12d3-a456-426614174001" },
    { slug: "abc123-123456-p2" },
    { declaredManifestDigest: "b".repeat(64) },
  ]) {
    const binding = { ...expected(), ...override };
    assert.deepEqual(await verify(GOLDEN_TOKEN, { expected: binding }), { mode: "claim_mismatch" });
  }

  const missingSchema = { ...expected() } as Record<string, unknown>;
  delete missingSchema.manifestSchemaVersion;
  const invalidExpectedBindings: unknown[] = [
    { ...expected(), manifestSchemaVersion: 2 },
    { ...expected(), manifestSchemaVersion: "1" },
    { ...expected(), manifestSchemaVersion: 0 },
    missingSchema,
    { ...expected(), publishAttemptId: "not-a-uuid" },
    { ...expected(), declaredManifestDigest: "b".repeat(63) },
    { ...expected(), slug: "not a slug" },
    null,
    [],
  ];
  for (const binding of invalidExpectedBindings) {
    assert.deepEqual(await verify(GOLDEN_TOKEN, {
      expected: binding as unknown as EduPublishCommitCapabilityBinding,
    }), { mode: "evaluation_failed" }, JSON.stringify(binding));
  }

  assert.deepEqual(await verify(GOLDEN_TOKEN, { keyRing: null }), { mode: "configuration_unavailable" });
  assert.deepEqual(await verify(GOLDEN_TOKEN, { keyRing: { current: { kid: "bad kid", keyBytes: KEY_BYTES } } as unknown as EduPublishCapabilityKeyRing }), { mode: "configuration_unavailable" });
});

test("keeps failure results secret-free and does not mutate verification inputs", async () => {
  const input = { token: GOLDEN_TOKEN, keyRing: keyRing(), nowSeconds: NOW, expected: expected() };
  const before = structuredClone(input);
  const result = await verifyEduPublishCommitCapability(input);
  assert.deepEqual(result, { mode: "valid_v2", claims: claims(), keySlot: "current" });
  assert.deepEqual(input, before);

  for (const failure of [
    await verify(`${GOLDEN_TOKEN.slice(0, -1)}A`),
    await verify(await signedClaims({ kid: "cap-unknown" })),
    await verify(await signedClaims({ slug: "wrong-slug" })),
  ]) {
    const serialized = JSON.stringify(failure);
    assert.equal(serialized.includes(GOLDEN_TOKEN), false);
    assert.equal(serialized.includes("cap-unknown"), false);
    assert.equal(serialized.includes("9UFijo"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(failure, "token"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(failure, "kid"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(failure, "signature"), false);
  }
  assert.equal(EDU_PUBLISH_COMMIT_CAPABILITY_VERSION, 2);
  assert.equal(EDU_PUBLISH_COMMIT_CAPABILITY_OPERATION, "edu_publish_commit");
});
