import { base64UrlEncode } from "@/lib/crypto/webcrypto";

const DEFAULT_TOKEN_BYTES = 18;

export function createShowcaseToken(byteLength: number = DEFAULT_TOKEN_BYTES): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function maskTokenForLogs(token: string): string {
  if (!token) return "";
  if (token.length <= 10) return `${token.slice(0, 2)}…${token.slice(-2)}`;
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}
