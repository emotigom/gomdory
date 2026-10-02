import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { parseHiddenCommentIdsCookie, serializeHiddenCommentIdsCookie } from "@/lib/community/commentModeration";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const HIDDEN_COMMENTS_COOKIE = "community_hidden_comment_ids";

export async function POST(_request: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await params;
  if (!commentId) {
    return NextResponse.json({ error: "invalid_comment_id" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const hiddenIds = parseHiddenCommentIdsCookie(cookieStore.get(HIDDEN_COMMENTS_COOKIE)?.value);
  const nextHiddenIds = hiddenIds.includes(commentId) ? hiddenIds.filter((id) => id !== commentId) : [...hiddenIds, commentId];

  cookieStore.set(HIDDEN_COMMENTS_COOKIE, serializeHiddenCommentIdsCookie(nextHiddenIds), {
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
    sameSite: "lax",
    httpOnly: true,
    secure: readEnvString("NODE_ENV") === "production",
  });

  return NextResponse.json({ ok: true, hidden: nextHiddenIds.includes(commentId) });
}
