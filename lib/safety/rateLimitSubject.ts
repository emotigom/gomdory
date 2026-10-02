import { digestHex } from "@/lib/crypto/webcrypto";
import { getClientIp } from "@/lib/http/fingerprint";

const MAX_RAW_LENGTH = 512;

export async function getRateLimitSubject(request: Request, anonId?: string | null) {
  if (anonId && anonId.trim()) {
    return anonId.trim().slice(0, 120);
  }

  const host = request.headers.get("host") ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "";
  const ip = request.headers.get("cf-connecting-ip") ?? getClientIp(request);
  const raw = `${host}|${userAgent}|${ip}`.slice(0, MAX_RAW_LENGTH);
  const hash = await digestHex("SHA-256", raw);
  return `h:${hash}`;
}
