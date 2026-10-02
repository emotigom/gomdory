import { digestHex } from "@/lib/crypto/webcrypto";

const RAW_MAX_LENGTH = 1024;

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

export async function buildFingerprint(options: {
  userAgent: string;
  language: string;
  timezoneOffset?: number;
  ip: string;
}) {
  const dayBucket = new Date().toISOString().slice(0, 10);
  const timezone = Number.isFinite(options.timezoneOffset) ? options.timezoneOffset : "";
  const raw = `${options.userAgent}|${options.language}|${timezone}|${options.ip}|${dayBucket}`;
  const trimmedRaw = raw.slice(0, RAW_MAX_LENGTH);
  return digestHex("SHA-256", trimmedRaw);
}

export async function fingerprintFromRequest(
  request: Request,
  options?: { timezoneOffset?: number },
): Promise<string> {
  return buildFingerprint({
    userAgent: request.headers.get("user-agent") ?? "",
    language: request.headers.get("accept-language") ?? "",
    timezoneOffset: options?.timezoneOffset,
    ip: request.headers.get("cf-connecting-ip") ?? getClientIp(request),
  });
}
