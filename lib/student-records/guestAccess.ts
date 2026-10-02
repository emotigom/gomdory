import "server-only";

import { base64UrlDecodeToBytes, base64UrlEncode, decodeUtf8, digestHex, encodeUtf8, hmacSha256, timingSafeEqual } from "@/lib/crypto/webcrypto";
import { getRuntimeEnv, readEnvStringFrom, type RuntimeEnv } from "@/lib/server/runtimeEnv";
import { resolveStudentRecordsGuestModel } from "./guestModelPolicy";

export const STUDENT_RECORDS_GUEST_COOKIE = "student_records_guest";
export const STUDENT_RECORDS_GUEST_MAX_AGE_SECONDS = 43_200;
export const STUDENT_RECORDS_GUEST_MAX_STUDENTS = 25;

export type StudentRecordsGuestConfig = { enabled: boolean; accessToken?: string; cookieSecret?: string; apiKey?: string; model?: string; timeoutMs: number; maxOutputTokens: number; configurationError: boolean };

export function getStudentRecordsGuestConfig(env: RuntimeEnv = getRuntimeEnv()): StudentRecordsGuestConfig {
  const enabled = readEnvStringFrom(env, "STUDENT_RECORDS_GUEST_ENABLED") === "true";
  const accessToken = readEnvStringFrom(env, "STUDENT_RECORDS_GUEST_ACCESS_TOKEN");
  const cookieSecret = readEnvStringFrom(env, "STUDENT_RECORDS_GUEST_COOKIE_SECRET");
  const apiKey = readEnvStringFrom(env, "OPENAI_API_KEY");
  const modelResolution = resolveStudentRecordsGuestModel(env);
  const model = modelResolution.ok ? modelResolution.model : undefined;
  return { enabled, accessToken, cookieSecret, apiKey, model, timeoutMs: 25_000, maxOutputTokens: 2_048, configurationError: !enabled || !accessToken || !cookieSecret || !apiKey || !model || !modelResolution.ok };
}

async function safeEqualString(expected: string, actual: string) {
  const [expectedDigest, actualDigest] = await Promise.all([digestHex("SHA-256", expected), digestHex("SHA-256", actual)]);
  return timingSafeEqual(encodeUtf8(expectedDigest), encodeUtf8(actualDigest));
}

export async function isValidGuestInviteToken(token: string, config: StudentRecordsGuestConfig = getStudentRecordsGuestConfig()) {
  return Boolean(config.enabled && config.accessToken && await safeEqualString(config.accessToken, token));
}

async function sign(payload: string, secret: string) { return base64UrlEncode(await hmacSha256(payload, secret)); }

export async function createGuestCookieValue(config: StudentRecordsGuestConfig = getStudentRecordsGuestConfig(), now = Date.now()): Promise<string | null> {
  if (config.configurationError || !config.cookieSecret) return null;
  const payload = base64UrlEncode(encodeUtf8(JSON.stringify({ exp: now + STUDENT_RECORDS_GUEST_MAX_AGE_SECONDS * 1000, nonce: crypto.randomUUID() })));
  return `${payload}.${await sign(payload, config.cookieSecret)}`;
}

export async function verifyGuestCookieValue(value: string | undefined, config: StudentRecordsGuestConfig = getStudentRecordsGuestConfig(), now = Date.now()): Promise<boolean> {
  if (config.configurationError || !config.cookieSecret || !value) return false;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return false;
  const actual = base64UrlDecodeToBytes(signature);
  const expected = base64UrlDecodeToBytes(await sign(payload, config.cookieSecret));
  if (!actual || !expected || !timingSafeEqual(expected, actual)) return false;
  try {
    const parsed = JSON.parse(decodeUtf8(base64UrlDecodeToBytes(payload) ?? new Uint8Array())) as { exp?: unknown; nonce?: unknown };
    return typeof parsed.exp === "number" && Number.isFinite(parsed.exp) && parsed.exp > now && typeof parsed.nonce === "string" && parsed.nonce.length > 0;
  } catch { return false; }
}

export async function hashGuestRateLimitSubject(ip: string, secret: string): Promise<string> { return base64UrlEncode(await hmacSha256(ip, secret)); }
