import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  base64UrlDecodeToBytes,
  base64UrlEncode,
  decodeUtf8,
  encodeUtf8,
  hmacSha256,
  timingSafeEqual,
} from "@/lib/crypto/webcrypto";
import { readTurnstileBypassSecretKey } from "@/lib/env/appConfig";

const COOKIE_NAME = "ts_bypass";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function getSecretKey(): string | null {
  return readTurnstileBypassSecretKey() ?? null;
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const signature = await hmacSha256(payload, secret);
  return base64UrlEncode(signature);
}

async function createPayloadWithSecret(
  secret: string,
): Promise<{ encoded: string; signature: string }> {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const nonce = crypto.randomUUID();
  const payload = base64UrlEncode(encodeUtf8(JSON.stringify({ exp, nonce })));
  const signature = await signPayload(payload, secret);

  return { encoded: payload, signature };
}

async function createPayload(): Promise<{ encoded: string; signature: string }> {
  const secret = getSecretKey();

  if (!secret) {
    throw new Error("TURNSTILE_SECRET_KEY or E2E_TURNSTILE_SECRET_KEY is not set");
  }

  return createPayloadWithSecret(secret);
}

export async function setBypassCookie(responseCookies: CookieStore) {
  const { encoded, signature } = await createPayload();

  responseCookies.set({
    name: COOKIE_NAME,
    value: `${encoded}.${signature}`,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function setBypassCookieOnResponse(
  response: NextResponse,
): Promise<{ ok: boolean; reason?: string }> {
  const secret = getSecretKey();

  if (!secret) {
    return { ok: false, reason: "missing_secret" };
  }

  const { encoded, signature } = await createPayloadWithSecret(secret);
  response.cookies.set({
    name: COOKIE_NAME,
    value: `${encoded}.${signature}`,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  return { ok: true };
}

function safeTimingCompare(expected: string, actual: string): boolean {
  const expectedBytes = base64UrlDecodeToBytes(expected);
  const actualBytes = base64UrlDecodeToBytes(actual);

  if (!expectedBytes || !actualBytes || expectedBytes.length !== actualBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, actualBytes);
}

function parsePayload(raw: string): { exp: number; nonce: string } | null {
  const decodedBytes = base64UrlDecodeToBytes(raw);

  if (!decodedBytes) {
    return null;
  }

  try {
    const decoded = decodeUtf8(decodedBytes);
    const parsed = JSON.parse(decoded) as { exp?: unknown; nonce?: unknown };

    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
      return null;
    }

    if (typeof parsed.nonce !== "string" || !parsed.nonce) {
      return null;
    }

    return { exp: parsed.exp, nonce: parsed.nonce };
  } catch {
    return null;
  }
}

export async function verifyBypassCookie(requestCookies: CookieStore): Promise<boolean> {
  const secret = getSecretKey();

  if (!secret) {
    return false;
  }

  const rawCookie = requestCookies.get(COOKIE_NAME)?.value;

  if (!rawCookie) {
    return false;
  }

  const [payload, signature] = rawCookie.split(".");

  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = await signPayload(payload, secret);

  if (!safeTimingCompare(expectedSignature, signature)) {
    return false;
  }

  const parsed = parsePayload(payload);

  if (!parsed) {
    return false;
  }

  if (parsed.exp < Date.now()) {
    return false;
  }

  return true;
}

export const bypassCookieName = COOKIE_NAME;
