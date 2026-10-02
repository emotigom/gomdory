"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUser as requireAppUser } from "@/lib/auth/requireUser";
import { getRequestContext, logAudit, type AuditRequestContext } from "@/lib/data/audit";
import { SupabaseRateLimitStore, enforceRateLimit } from "@/lib/security/rateLimit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { COMMUNITY_CATEGORY_VALUES, type CommunityCategory, isCuratedCommunityCategory, isValidCommunityCategory } from "@/lib/community/categories";
import {
  assertAllowedCommunityAttachmentMime,
  parseCommunityAttachmentFileIds,
  parseCommunityExternalAttachments,
  toCommunityExternalAttachmentsFromLink,
} from "@/lib/community/postAttachments";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateCommentBody } from "@/lib/community/commentValidation";
import { COMMUNITY_AUTO_HIDE_RULES_KEY, findCommunityAutoHideKeywordMatch, parseCommunityAutoHideRulesFromSiteContentBody } from "@/lib/community/autoHideRules";
import { getSiteContentByKey } from "@/lib/site-content/server";
import { toCommunityRateLimitServerMessage } from "@/lib/community/rateLimitUx";

const URL_PATTERN = /https?:\/\/[^\s]+/gi;

function assertNonEmpty(value: string, message: string) {
  if (!value.trim()) {
    throw new Error(message);
  }
}

function assertSafeUrls(value: string, { maxUrls = 3 }: { maxUrls?: number } = {}) {
  const urls = value.match(URL_PATTERN) ?? [];
  if (urls.length > maxUrls) {
    throw new Error("URL은 최대 3개까지만 허용됩니다.");
  }

  for (const raw of urls) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("올바른 URL 형식만 허용됩니다.");
    }

    if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
      throw new Error("http/https URL만 허용됩니다.");
    }

    if (raw.length > 500) {
      throw new Error("URL 길이가 너무 깁니다.");
    }
  }
}

function sanitizeText(input: FormDataEntryValue | null, maxLength: number) {
  return String(input ?? "")
    .trim()
    .slice(0, maxLength);
}

async function enforceCommunityWriteRateLimit(action: string, actorKey: string) {
  const store = new SupabaseRateLimitStore(createSupabaseAdminClient());
  const key = `community:${action}:${actorKey}`;

  const result = await enforceRateLimit({
    key,
    max: 12,
    windowMs: 60 * 1000,
    burstMax: 3,
    burstMs: 10 * 1000,
    store,
  });

  if (!result.allowed) {
    throw new Error(toCommunityRateLimitServerMessage(result.retryAfterSec));
  }
}

async function loadCommunityAutoHideRules() {
  const row = await getSiteContentByKey(COMMUNITY_AUTO_HIDE_RULES_KEY).catch(() => null);
  if (!row?.body?.trim()) {
    return { keywords: [] as string[] };
  }

  return parseCommunityAutoHideRulesFromSiteContentBody(row.body);
}

async function requireUser() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const requestHeaders = await headers();
  const ctx = getRequestContext(requestHeaders);
  const ip = ctx.ip ?? "unknown";
  const actorKey = `${data.user.id}:${ip}`;

  return { supabase, user: data.user, ip, actorKey, ctx };
}

async function assertNotBlocked(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string) {
  const { data, error } = await supabase.from("community_blocked_users").select("user_id").eq("user_id", userId).maybeSingle();

  if (error) {
    throw new Error("차단 상태를 확인하지 못했습니다.");
  }

  if (data) {
    throw new Error("차단된 사용자입니다. 운영자에게 문의해 주세요.");
  }
}

async function requireModerator() {
  const { supabase, user, ip, actorKey, ctx } = await requireUser();
  const { data, error } = await supabase
    .from("community_moderators")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    throw new Error("운영 권한이 필요합니다.");
  }

  return { supabase, user, ip, actorKey, ctx };
}

async function requireOpsModerator() {
  const { user } = await requireAppUser("/community");
  if (!isOpsAdmin(user.email)) {
    throw new Error("운영 권한이 필요합니다.");
  }
  return { user, ctx: getRequestContext(await headers()) };
}

async function writeModeratorAudit(action: string, targetType: string, targetId: string, meta: Record<string, unknown>, ctx: AuditRequestContext) {
  await logAudit({
    action,
    targetType,
    targetId,
    meta,
    ctx,
  });

  console.info(
    JSON.stringify({
      level: "info",
      stage: "community_moderation_action",
      action,
      targetType,
      targetId,
      ...meta,
    }),
  );
}

export async function createPost(formData: FormData) {
  const { supabase, user, actorKey, ctx } = await requireUser();
  await enforceCommunityWriteRateLimit("create_post", actorKey);
  await assertNotBlocked(supabase, user.id);

  const title = sanitizeText(formData.get("title"), 140);
  const body = sanitizeText(formData.get("body"), 12000);
  const categoryInput = sanitizeText(formData.get("category"), 24);
  const category: CommunityCategory = isValidCommunityCategory(categoryInput) ? categoryInput : "free";

  assertNonEmpty(title, "제목을 입력해 주세요.");
  assertNonEmpty(body, "내용을 입력해 주세요.");

  if (!COMMUNITY_CATEGORY_VALUES.includes(category)) {
    throw new Error("카테고리를 확인해 주세요.");
  }

  if (isCuratedCommunityCategory(category)) {
    const { data: moderatorRow, error: moderatorError } = await supabase
      .from("community_moderators")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (moderatorError || !moderatorRow) {
      throw new Error("사용법/업데이트 카테고리는 운영자만 작성할 수 있습니다.");
    }
  }

  if (title.length < 3) {
    throw new Error("제목은 3자 이상 입력해 주세요.");
  }

  assertSafeUrls(`${title}\n${body}`);

  const attachmentFileIds = parseCommunityAttachmentFileIds(sanitizeText(formData.get("attachmentFileIds"), 2000));
  const parsedExternal = parseCommunityExternalAttachments(sanitizeText(formData.get("externalAttachments"), 2000));
  const fallbackLink = sanitizeText(formData.get("link"), 500);
  const externalAttachments = parsedExternal.length > 0 ? parsedExternal : toCommunityExternalAttachmentsFromLink(fallbackLink);

  if (attachmentFileIds.length > 0) {
    const { data: files, error: filesError } = await supabase
      .from("board_files")
      .select("id,mime,owner_id,deleted_at")
      .in("id", attachmentFileIds)
      .eq("owner_id", user.id)
      .is("deleted_at", null);

    if (filesError) {
      throw new Error("첨부 파일을 확인하지 못했습니다.");
    }

    if (!files || files.length !== attachmentFileIds.length) {
      throw new Error("내 파일만 첨부할 수 있습니다.");
    }

    for (const file of files) {
      assertAllowedCommunityAttachmentMime(file.mime);
    }
  }

  const autoHideRules = await loadCommunityAutoHideRules();
  const autoHideKeyword = isOpsAdmin(user.email) ? null : findCommunityAutoHideKeywordMatch({ title, body, rules: autoHideRules });
  const shouldAutoHide = Boolean(autoHideKeyword);

  const { data: insertedPost, error } = await supabase
    .from("community_posts")
    .insert({
    author_user_id: user.id,
    title,
    body,
    category,
    attachment_file_ids: attachmentFileIds,
    external_attachments: externalAttachments,
      status: shouldAutoHide ? "hidden" : "active",
      moderation_note: shouldAutoHide ? `auto_hide:${autoHideKeyword}` : null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error("게시글 등록에 실패했습니다.");
  }

  if (shouldAutoHide && insertedPost?.id) {
    await logAudit({
      action: "community_post_auto_hidden",
      targetType: "community_post",
      targetId: insertedPost.id,
      meta: {
        keyword: autoHideKeyword,
        actorUserId: user.id,
      },
      ctx,
    });
  }

  revalidatePath("/community");
}

export async function createComment(formData: FormData) {
  const { supabase, user, actorKey, ctx } = await requireUser();
  await enforceCommunityWriteRateLimit("create_comment", actorKey);
  await assertNotBlocked(supabase, user.id);

  const postId = sanitizeText(formData.get("postId"), 64);
  const body = validateCommentBody(sanitizeText(formData.get("body"), 2000));

  if (!postId) {
    throw new Error("대상 게시글이 없습니다.");
  }

  const autoHideRules = await loadCommunityAutoHideRules();
  const autoHideKeyword = isOpsAdmin(user.email) ? null : findCommunityAutoHideKeywordMatch({ body, rules: autoHideRules });
  const shouldAutoHide = Boolean(autoHideKeyword);

  const { data: insertedComment, error } = await supabase
    .from("community_comments")
    .insert({
      post_id: postId,
      author_user_id: user.id,
      body,
      status: shouldAutoHide ? "hidden" : "active",
      moderation_note: shouldAutoHide ? `auto_hide:${autoHideKeyword}` : null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error("댓글 등록에 실패했습니다.");
  }

  if (shouldAutoHide && insertedComment?.id) {
    await logAudit({
      action: "community_comment_auto_hidden",
      targetType: "community_comment",
      targetId: insertedComment.id,
      meta: {
        keyword: autoHideKeyword,
        actorUserId: user.id,
        postId,
      },
      ctx,
    });
  }

  revalidatePath("/community");
}

export async function listComments(postId: string, cursorCreatedAt?: string | null) {
  const { supabase } = await requireUser();

  if (!postId.trim()) {
    throw new Error("대상 게시글이 없습니다.");
  }

  let query = supabase
    .from("community_comments")
    .select("id,post_id,body,author_user_id,created_at,deleted_at")
    .eq("post_id", postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  if (cursorCreatedAt) {
    query = query.lt("created_at", cursorCreatedAt);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("댓글 목록을 불러오지 못했습니다.");
  }

  return data ?? [];
}

export async function deleteComment(commentId: string) {
  const { supabase, user, actorKey } = await requireUser();
  await enforceCommunityWriteRateLimit("delete_comment", actorKey);

  const sanitizedCommentId = commentId.trim().slice(0, 64);
  if (!sanitizedCommentId) {
    throw new Error("삭제할 댓글을 확인해 주세요.");
  }

  const { data: moderator } = await supabase.from("community_moderators").select("user_id").eq("user_id", user.id).maybeSingle();
  const isModerator = Boolean(moderator?.user_id);

  const deleteQuery = supabase
    .from("community_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", sanitizedCommentId)
    .is("deleted_at", null);

  const scopedDelete = isModerator ? deleteQuery : deleteQuery.eq("author_user_id", user.id);
  const { error } = await scopedDelete;

  if (error) {
    throw new Error("댓글 삭제에 실패했습니다.");
  }

  revalidatePath("/community");
}

export async function toggleReaction(formData: FormData) {
  const { supabase, user, actorKey } = await requireUser();
  await enforceCommunityWriteRateLimit("toggle_reaction", actorKey);
  await assertNotBlocked(supabase, user.id);

  const postId = sanitizeText(formData.get("postId"), 64);
  const active = sanitizeText(formData.get("active"), 5) === "1";

  if (!postId) {
    throw new Error("잘못된 요청입니다.");
  }

  if (active) {
    const { error } = await supabase
      .from("community_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .eq("reaction_type", "like");

    if (error) {
      throw new Error("반응 취소에 실패했습니다.");
    }
  } else {
    const { error } = await supabase.from("community_reactions").insert({
      post_id: postId,
      user_id: user.id,
      reaction_type: "like",
    });

    if (error) {
      throw new Error("반응 등록에 실패했습니다.");
    }
  }

  revalidatePath("/community");
}

export async function submitReport(formData: FormData) {
  const { supabase, user, actorKey } = await requireUser();
  await enforceCommunityWriteRateLimit("submit_report", actorKey);
  await assertNotBlocked(supabase, user.id);

  const targetType = sanitizeText(formData.get("targetType"), 16);
  const targetId = sanitizeText(formData.get("targetId"), 64);
  const reason = sanitizeText(formData.get("reason"), 500);

  if (!(targetType === "post" || targetType === "comment") || !targetId || reason.length < 5) {
    throw new Error("신고 내용을 확인해 주세요.");
  }

  assertSafeUrls(reason, { maxUrls: 1 });

  const { error } = await supabase.from("community_reports").insert({
    target_type: targetType,
    target_id: targetId,
    reporter_user_id: user.id,
    reason,
  });

  if (error) {
    throw new Error("신고 접수에 실패했습니다.");
  }

  revalidatePath("/community");
}

export async function moderatePost(formData: FormData) {
  const { supabase, user, actorKey, ctx } = await requireModerator();
  await enforceCommunityWriteRateLimit("moderate_post", actorKey);

  const postId = sanitizeText(formData.get("postId"), 64);
  const status = sanitizeText(formData.get("status"), 16);
  const note = sanitizeText(formData.get("note"), 200);
  const isPinned = sanitizeText(formData.get("isPinned"), 5);

  if (!(status === "hidden" || status === "spam" || status === "active")) {
    throw new Error("잘못된 상태입니다.");
  }

  const nextValues: { status: string; moderation_note: string | null; is_pinned?: boolean } = {
    status,
    moderation_note: note || null,
  };
  if (isPinned === "1" || isPinned === "0") {
    nextValues.is_pinned = isPinned === "1";
  }

  const { error } = await supabase
    .from("community_posts")
    .update(nextValues)
    .eq("id", postId);

  if (error) {
    throw new Error("게시글 운영 처리에 실패했습니다.");
  }

  await supabase
    .from("community_reports")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: user.id,
    })
    .eq("target_type", "post")
    .eq("target_id", postId)
    .eq("status", "open");

  await writeModeratorAudit("community_post_status_changed", "community_post", postId, { status, isPinned: nextValues.is_pinned ?? null, moderatorUserId: user.id }, ctx);

  revalidatePath("/community");
  revalidatePath("/dashboard/ops/system-jobs");
}

export async function moderateComment(formData: FormData) {
  const { supabase, user, actorKey, ctx } = await requireModerator();
  await enforceCommunityWriteRateLimit("moderate_comment", actorKey);

  const commentId = sanitizeText(formData.get("commentId"), 64);
  const status = sanitizeText(formData.get("status"), 16);
  const note = sanitizeText(formData.get("note"), 200);

  if (!(status === "hidden" || status === "spam" || status === "active")) {
    throw new Error("잘못된 상태입니다.");
  }

  const { error } = await supabase
    .from("community_comments")
    .update({ status, moderation_note: note || null })
    .eq("id", commentId);

  if (error) {
    throw new Error("댓글 운영 처리에 실패했습니다.");
  }

  await supabase
    .from("community_reports")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: user.id,
    })
    .eq("target_type", "comment")
    .eq("target_id", commentId)
    .eq("status", "open");

  await writeModeratorAudit("community_comment_status_changed", "community_comment", commentId, { status, moderatorUserId: user.id }, ctx);

  revalidatePath("/community");
  revalidatePath("/dashboard/ops/system-jobs");
}

export async function updateReportStatus(formData: FormData) {
  const { supabase, user, actorKey, ctx } = await requireModerator();
  await enforceCommunityWriteRateLimit("update_report_status", actorKey);

  const reportId = sanitizeText(formData.get("reportId"), 64);
  const status = sanitizeText(formData.get("status"), 16);

  if (!reportId || !(status === "open" || status === "resolved")) {
    throw new Error("신고 상태 값이 올바르지 않습니다.");
  }

  const { error } = await supabase
    .from("community_reports")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
      resolved_by_user_id: status === "resolved" ? user.id : null,
    })
    .eq("id", reportId);

  if (error) {
    throw new Error("신고 상태를 변경하지 못했습니다.");
  }

  await writeModeratorAudit("community_report_status_changed", "community_report", reportId, { status, moderatorUserId: user.id }, ctx);

  revalidatePath("/community");
  revalidatePath("/dashboard/ops/system-jobs");
}

export async function blockUser(formData: FormData) {
  const { supabase, user, actorKey, ctx } = await requireModerator();
  await enforceCommunityWriteRateLimit("block_user", actorKey);

  const targetUserId = sanitizeText(formData.get("targetUserId"), 64);
  const reason = sanitizeText(formData.get("reason"), 200);

  if (!targetUserId || reason.length < 3) {
    throw new Error("차단 사유를 입력해 주세요.");
  }

  const { error } = await supabase.from("community_blocked_users").upsert({
    user_id: targetUserId,
    blocked_by_user_id: user.id,
    reason,
  });

  if (error) {
    throw new Error("사용자 차단에 실패했습니다.");
  }

  await writeModeratorAudit("community_user_blocked", "community_user", targetUserId, { reason, moderatorUserId: user.id }, ctx);

  revalidatePath("/community");
  revalidatePath("/dashboard/ops/system-jobs");
}

export async function unblockUser(formData: FormData) {
  const { supabase, user, actorKey, ctx } = await requireModerator();
  await enforceCommunityWriteRateLimit("unblock_user", actorKey);

  const targetUserId = sanitizeText(formData.get("targetUserId"), 64);

  if (!targetUserId) {
    throw new Error("대상 사용자를 확인해 주세요.");
  }

  const { error } = await supabase.from("community_blocked_users").delete().eq("user_id", targetUserId);

  if (error) {
    throw new Error("사용자 차단 해제에 실패했습니다.");
  }

  await writeModeratorAudit("community_user_unblocked", "community_user", targetUserId, { moderatorUserId: user.id }, ctx);

  revalidatePath("/community");
  revalidatePath("/dashboard/ops/system-jobs");
}

export async function toggleCommentModeration(formData: FormData) {
  const { user, ctx } = await requireOpsModerator();
  const commentId = sanitizeText(formData.get("commentId"), 64);
  const staffNote = sanitizeText(formData.get("staffNote"), 1000);
  const nextHidden = sanitizeText(formData.get("isHidden"), 5) === "1";

  if (!commentId) {
    throw new Error("댓글을 확인해 주세요.");
  }

  type CommunityCommentModerationAdminClient = {
    from: (table: "community_comment_moderation") => {
      upsert: (
        value: { comment_id: string; is_hidden: boolean; staff_note: string | null },
        options: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  const admin = createSupabaseAdminClient() as unknown as CommunityCommentModerationAdminClient;
  const { error } = await admin.from("community_comment_moderation").upsert(
    {
      comment_id: commentId,
      is_hidden: nextHidden,
      staff_note: staffNote || null,
    },
    { onConflict: "comment_id" },
  );

  if (error) {
    throw new Error("댓글 모더레이션 저장에 실패했습니다.");
  }

  await writeModeratorAudit(
    "community_comment_moderation_toggled",
    "community_comment",
    commentId,
    { isHidden: nextHidden, moderatorUserId: user.id, staffNote: staffNote || null },
    ctx,
  );

  revalidatePath("/community");
  revalidatePath("/dashboard/ops/community-moderation");
}
