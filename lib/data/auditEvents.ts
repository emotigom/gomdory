import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuditEventInput = {
  actorUserId?: string | null;
  actorAnonId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
  requestId?: string | null;
  host?: string | null;
};

const MAX_META_LENGTH = 5000;

function sanitizeMeta(meta: Record<string, unknown> | undefined) {
  const payload = meta ?? {};
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_META_LENGTH) {
      return { truncated: true };
    }
    return payload;
  } catch {
    return { truncated: true };
  }
}

export async function recordAuditEvent(
  input: AuditEventInput,
  client?: SupabaseClient,
) {
  try {
    const supabase = client ?? createSupabaseAdminClient();
    await supabase.from("audit_events").insert({
      actor_user_id: input.actorUserId ?? null,
      actor_anon_id: input.actorAnonId ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      meta: sanitizeMeta(input.meta),
      request_id: input.requestId ?? null,
      host: input.host ?? null,
    });
  } catch (error) {
    console.warn("[audit_events] insert failed", {
      action: input.action,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
