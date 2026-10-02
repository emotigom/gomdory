import { toSnakeKeys } from "@/lib/standards/fields";
import type { Database } from "@/lib/supabase/admin";

export const EDU_ATOMIC_PUBLISH_RPC_V2 = "edu_atomic_publish_v2";
export const EDU_ATOMIC_PUBLISH_RPC_LEGACY = "edu_atomic_publish";

type AtomicPublishInputFile = {
  path: string;
  contentType: string;
  sizeBytes: number;
};

type AtomicPublishPayloadInput = {
  shareCode: string;
  lessonId: number | null;
  authorName: string;
  title: string;
  inSlug: string;
  anonId: string | null;
  boardId: string | null;
  expiresAt: string;
  files: AtomicPublishInputFile[];
  previewUrl: string;
  galleryPreviewUrl: string;
  publicUrl: string;
  classroomUrl: string;
  requestId: string;
};

export function buildAtomicPublishPayload(
  input: AtomicPublishPayloadInput,
): Database["public"]["Functions"]["edu_atomic_publish_v2"]["Args"] {
  return toSnakeKeys(input, { deep: true }) as Database["public"]["Functions"]["edu_atomic_publish_v2"]["Args"];
}

export function getPayloadKeys(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).sort();
}

export function resolveInSlug(payload: Record<string, unknown>): string {
  const raw = payload.in_slug ?? payload.inSlug;
  return typeof raw === "string" ? raw.trim() : "";
}

export function buildDbFunctionBugExtra(input: {
  rpcName: string;
  payload: Record<string, unknown>;
  supabaseRef: string;
  pgCode?: string | null;
}): Record<string, unknown> {
  return {
    hint: "rpc_signature_mismatch",
    rpcName: input.rpcName,
    payloadKeys: getPayloadKeys(input.payload),
    supabaseRef: input.supabaseRef,
    pgCode: input.pgCode ?? null,
  };
}
