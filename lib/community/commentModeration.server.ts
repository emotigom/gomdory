import type { SupabaseClient } from "@supabase/supabase-js";

export async function insertCommunityCommentReport(
  supabase: SupabaseClient,
  input: { commentId: string; reporterUserId: string; reason: string },
) {
  return supabase.from("community_comment_reports").insert({
    comment_id: input.commentId,
    reporter_user_id: input.reporterUserId,
    reason: input.reason,
  });
}
