import "server-only";

import { buildShowcaseSnapshot, type ShowcaseSnapshot } from "@/lib/showcase/buildShowcaseSnapshot";
import { createShowcaseToken } from "@/lib/showcase/token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type EnsureShowcaseResult = {
  showcaseId: string;
  token: string;
  snapshot: ShowcaseSnapshot;
};

export async function ensureShowcaseForBoard({
  boardId,
  userId,
  title,
}: {
  boardId: string;
  userId: string;
  title?: string | null;
}): Promise<EnsureShowcaseResult> {
  const admin = createSupabaseAdminClient();
  const snapshot = await buildShowcaseSnapshot(boardId);
  const normalizedTitle = title?.trim() ?? "";

  const { data: existing, error: existingError } = await admin
    .from("showcases")
    .select("id, is_revoked")
    .eq("board_id", boardId)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; is_revoked: boolean }>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  let showcaseId = existing?.id ?? null;
  if (showcaseId) {
    const { error: updateError } = await admin
      .from("showcases")
      .update({
        snapshot,
        is_revoked: false,
        title: normalizedTitle || undefined,
      })
      .eq("id", showcaseId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { data: inserted, error: insertError } = await admin
      .from("showcases")
      .insert({
        board_id: boardId,
        owner_id: userId,
        title: normalizedTitle,
        snapshot,
        mode: "safe",
        source: "session",
        is_revoked: false,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "showcase_create_failed");
    }

    showcaseId = inserted.id as string;
  }

  const { data: existingToken, error: tokenError } = await admin
    .from("showcase_tokens")
    .select("token")
    .eq("showcase_id", showcaseId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ token: string }>();

  if (tokenError) {
    throw new Error(tokenError.message);
  }

  let token = existingToken?.token ?? null;
  if (!token) {
    token = createShowcaseToken();
    const { error: insertTokenError } = await admin
      .from("showcase_tokens")
      .insert({
        token,
        showcase_id: showcaseId,
      });

    if (insertTokenError) {
      throw new Error(insertTokenError.message);
    }
  }

  return { showcaseId, token, snapshot };
}
