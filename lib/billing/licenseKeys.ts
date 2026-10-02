import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomBase32Block(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CROCKFORD[byte % CROCKFORD.length]).join("");
}

export function generateLicenseCode(): string {
  const parts = [randomBase32Block(4), randomBase32Block(4), randomBase32Block(4)];
  return `GKD-${parts.join("-")}`;
}

export async function hashCode(code: string): Promise<string> {
  const normalized = code.trim().toUpperCase();
  const buffer = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function hintFromCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  const tail = normalized.slice(-4);
  return `***-${tail}`;
}

type CreateKeyInput = {
  expiresAt?: Date | null;
  maxUses?: number;
  seats?: number;
  issuedTo?: string | null;
  note?: string | null;
  createdBy?: string | null;
  plan?: "free" | "pro";
};

export async function createKey(input: CreateKeyInput) {
  const code = generateLicenseCode();
  const codeSha256 = await hashCode(code);
  const displayHint = hintFromCode(code);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("license_keys")
    .insert({
      code_sha256: codeSha256,
      display_hint: displayHint,
      plan: input.plan ?? "pro",
      seats: input.seats ?? 1,
      expires_at: input.expiresAt ? input.expiresAt.toISOString() : null,
      max_uses: input.maxUses ?? 1,
      uses: 0,
      issued_to: input.issuedTo ?? null,
      note: input.note ?? null,
      created_by_user_id: input.createdBy ?? null,
    })
    .select("id, display_hint, expires_at, max_uses, uses, issued_to, seats, plan, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "license_create_failed");
  }

  return {
    code,
    record: data,
  };
}
