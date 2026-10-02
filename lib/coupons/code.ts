import "server-only";

const encoder = new TextEncoder();

export function normalizeCouponCode(input: string): string {
  return input.trim().normalize("NFKC");
}

export async function hashCouponCode(input: string): Promise<string> {
  const normalized = normalizeCouponCode(input);
  const buffer = encoder.encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
