import { NextResponse } from "next/server";

import { normalizeCommentModerationReasonPayload } from "@/lib/community/commentModeration";
import { serializeCommunityModerationReason } from "@/lib/community/moderationReasons";
import { insertCommunityCommentReport } from "@/lib/community/commentModeration.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await params;
  if (!commentId) {
    return NextResponse.json({ error: "invalid_comment_id" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as { reason?: unknown; otherDetail?: unknown } | null;
  const normalizedReason = normalizeCommentModerationReasonPayload(payload);
  if (!normalizedReason) {
    return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await insertCommunityCommentReport(supabase, {
    commentId,
    reporterUserId: auth.user.id,
    reason: serializeCommunityModerationReason(normalizedReason),
  });

  if (error) {
    return NextResponse.json({ error: "report_failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
