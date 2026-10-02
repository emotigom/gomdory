"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";

import CollapsibleCardText from "@/app/_components/CollapsibleCardText";
import { COMMUNITY_CATEGORY_LABELS, type CommunityCategory } from "@/lib/community/categories";
import { type CommunityModerationReasonCode } from "@/lib/community/moderationReasons";
import { api } from "@/lib/standards/routes";
import { normalizeExternalAttachments } from "@/lib/types/attachments";
import { clampAttachmentChips, makeExcerpt, matchesCommunitySearch } from "@/lib/community/boardList";
import { getFilenameExtension, getHostnameFromUrl } from "@/lib/community/postAttachments";
import { formatBytes } from "@/lib/format/bytes";
import { isSafeDownloadAttributeHref, resolveDownloadUrlWithCache } from "@/lib/files/downloadCache";
import { safeErrorMessage } from "@/lib/ui/safeErrors";
import { toCommunityRateLimitUxMessageFromError } from "@/lib/community/rateLimitUx";

type CommunityPost = {
  id: string;
  title: string;
  body: string;
  status: "active" | "hidden" | "spam";
  category: CommunityCategory;
  is_pinned: boolean;
  author_user_id: string;
  created_at: string;
  comments: { id: string; body: string; author_user_id: string; created_at: string; deleted_at: string | null; status?: "active" | "hidden" | "spam" }[];
  reactions: { user_id: string; reaction_type: string }[];
  files?: { id: string; filename: string; mime: string | null; size_bytes?: number | null }[];
  external_attachments: unknown;
};

type Props = {
  posts: CommunityPost[];
  currentUserId: string | null;
  hiddenCommentIds: string[];
  moderatedHiddenCommentIds: string[];
  createCommentAction: (formData: FormData) => Promise<void>;
  deleteCommentAction: (commentId: string) => Promise<void>;
};

const FEED_TABS: Array<{ key: "all" | CommunityCategory; label: string }> = [
  { key: "all", label: "전체" },
  { key: "free", label: COMMUNITY_CATEGORY_LABELS.free },
  { key: "edu", label: COMMUNITY_CATEGORY_LABELS.edu },
  { key: "qna", label: COMMUNITY_CATEGORY_LABELS.qna },
];

const COMMENT_ENABLED_CATEGORIES = new Set<CommunityCategory>(["free", "edu", "qna"]);
const COMMENT_REPORT_REASON_CODES: CommunityModerationReasonCode[] = ["spam", "abuse", "off_topic", "privacy", "other"];

export function CommunityBoardList({ posts, currentUserId, hiddenCommentIds, moderatedHiddenCommentIds, createCommentAction, deleteCommentAction }: Props) {
  const [activeTab, setActiveTab] = useState<(typeof FEED_TABS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [visibleCommentCountByPost, setVisibleCommentCountByPost] = useState<Record<string, number>>({});
  const [hiddenLocalSet, setHiddenLocalSet] = useState(() => new Set(hiddenCommentIds));
  const [pendingCommentActions, setPendingCommentActions] = useState<Record<string, "report" | "hide" | null>>({});
  const [commentInlineStatus, setCommentInlineStatus] = useState<Record<string, string>>({});
  const [commentErrorByPost, setCommentErrorByPost] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (activeTab !== "all" && post.category !== activeTab) {
        return false;
      }
      return matchesCommunitySearch(post, query);
    });
  }, [activeTab, posts, query]);

  const markCommentProcessed = (commentId: string) => {
    setCommentInlineStatus((prev) => ({ ...prev, [commentId]: "처리됨" }));
    window.setTimeout(() => {
      setCommentInlineStatus((prev) => {
        if (!prev[commentId]) return prev;
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
    }, 1800);
  };

  const onReportComment = (commentId: string) => {
    if (pendingCommentActions[commentId]) return;

    const reasonInput = window.prompt("신고 사유 코드: spam, abuse, off_topic, privacy, other");
    if (!reasonInput) return;
    const reasonCode = reasonInput.trim().toLowerCase() as CommunityModerationReasonCode;
    if (!COMMENT_REPORT_REASON_CODES.includes(reasonCode)) {
      window.alert("신고 사유 코드를 확인해 주세요.");
      return;
    }
    const otherDetail = reasonCode === "other" ? (window.prompt("기타 사유를 120자 이내로 입력해 주세요.") ?? "").trim() : "";

    setPendingCommentActions((prev) => ({ ...prev, [commentId]: "report" }));
    startTransition(async () => {
      try {
        const response = await fetch(api.v1("community", "comments", commentId, "report"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: reasonCode, otherDetail }),
        });
        if (!response.ok) {
          window.alert("신고 접수에 실패했습니다.");
          return;
        }
        markCommentProcessed(commentId);
      } finally {
        setPendingCommentActions((prev) => ({ ...prev, [commentId]: null }));
      }
    });
  };

  const onCreateComment = (postId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setCommentErrorByPost((prev) => {
      if (!prev[postId]) return prev;
      const next = { ...prev };
      delete next[postId];
      return next;
    });

    startTransition(async () => {
      try {
        await createCommentAction(formData);
        form.reset();
      } catch (error) {
        setCommentErrorByPost((prev) => ({
          ...prev,
          [postId]: toCommunityRateLimitUxMessageFromError(error) ?? safeErrorMessage(error, { fallback: "댓글 등록에 실패했습니다." }),
        }));
      }
    });
  };

  const onToggleLocalHide = (commentId: string) => {
    if (pendingCommentActions[commentId]) return;
    setPendingCommentActions((prev) => ({ ...prev, [commentId]: "hide" }));
    startTransition(async () => {
      try {
        const response = await fetch(api.v1("community", "comments", commentId, "hide"), {
          method: "POST",
        });
        if (!response.ok) {
          window.alert("숨김 처리에 실패했습니다.");
          return;
        }
        setHiddenLocalSet((prev) => {
          const next = new Set(prev);
          if (next.has(commentId)) {
            next.delete(commentId);
          } else {
            next.add(commentId);
          }
          return next;
        });
        markCommentProcessed(commentId);
      } finally {
        setPendingCommentActions((prev) => ({ ...prev, [commentId]: null }));
      }
    });
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {FEED_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md border px-3 py-1.5 text-sm ${activeTab === tab.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              {tab.label}
            </button>
          ))}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목/본문 검색"
            className="ml-auto w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-60"
          />
        </div>
      </div>

      {filteredPosts.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">검색 결과가 없습니다.</p> : null}

      {filteredPosts.map((post) => {
        const attachments = [
          ...(post.files ?? []).map((file) => ({ id: `file-${file.id}`, fileId: file.id, label: file.filename, href: api.community.files.download(file.id), kind: "file" as const, sizeBytes: file.size_bytes ?? null })),
          ...normalizeExternalAttachments(post.external_attachments)
            .filter((attachment) => attachment.kind === "link" && attachment.url)
            .map((attachment, index) => ({
              id: `external-${post.id}-${index}`,
              label: getHostnameFromUrl(attachment.url ?? "") || "외부 링크",
              href: attachment.url ?? "#",
              kind: "link" as const,
            })),
        ];
        const clampedAttachments = clampAttachmentChips(attachments, 4);
        const myReaction = Boolean(currentUserId && post.reactions.some((reaction) => reaction.user_id === currentUserId));
        const canShowComments = COMMENT_ENABLED_CATEGORIES.has(post.category);

        const sortedComments = [...(post.comments ?? [])]
          .filter((comment) => !comment.deleted_at)
          .sort((a, b) => new Date(b.created_at).valueOf() - new Date(a.created_at).valueOf());
        const visibleCount = visibleCommentCountByPost[post.id] ?? 5;
        const visibleComments = sortedComments.slice(0, visibleCount);
        const hasMore = sortedComments.length > visibleCount;

        return (
          <article key={post.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
            <header className="mb-2">
              <div className="flex flex-wrap items-center gap-2">
                {post.is_pinned ? <span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white">공지</span> : null}
                <span className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700">{COMMUNITY_CATEGORY_LABELS[post.category]}</span>
                <span className="text-xs text-slate-500">{new Date(post.created_at).toLocaleString("ko-KR")}</span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-slate-900">{post.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{makeExcerpt(post.body, 72)}</p>
            </header>

            <CollapsibleCardText text={post.body} collapsedLines={3} className="whitespace-pre-wrap text-sm leading-6 text-slate-700" />

            {clampedAttachments.visible.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {clampedAttachments.visible.map((attachment) => {
                  const isFile = attachment.kind === "file";
                  const safeDownloadHref = isFile && isSafeDownloadAttributeHref(attachment.href);
                  return (
                    <a
                      key={attachment.id}
                      href={attachment.href}
                      download={safeDownloadHref ? "" : undefined}
                      target={isFile ? (safeDownloadHref ? undefined : "_blank") : "_blank"}
                      rel="noreferrer noopener"
                      onClick={
                        isFile
                          ? async (event) => {
                              if (!safeDownloadHref) {
                                return;
                              }
                              event.preventDefault();
                              try {
                                const resolved = await resolveDownloadUrlWithCache({
                                  fileId: attachment.fileId,
                                  downloadPath: attachment.href,
                                });
                                const trigger = document.createElement("a");
                                trigger.href = resolved;
                                trigger.download = "";
                                trigger.rel = "noreferrer noopener";
                                trigger.click();
                              } catch {
                                window.open(attachment.href, "_blank", "noopener,noreferrer");
                              }
                            }
                          : undefined
                      }
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <span>{isFile ? "📎" : "🔗"}</span>
                      <span className="truncate">{attachment.label}</span>
                      {isFile ? <span className="rounded bg-slate-100 px-1">.{getFilenameExtension(attachment.label)}</span> : null}
                      {isFile && typeof attachment.sizeBytes === "number" && attachment.sizeBytes > 0 ? (
                        <span className="rounded bg-slate-100 px-1">{formatBytes(attachment.sizeBytes)}</span>
                      ) : null}
                    </a>
                  );
                })}
                {clampedAttachments.hiddenCount > 0 ? (
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">+{clampedAttachments.hiddenCount} 더보기</span>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>좋아요 {post.reactions.length}</span>
              {myReaction ? <span className="text-slate-700">내 반응 있음</span> : null}
              <span>댓글 {sortedComments.length}</span>
            </div>

            {canShowComments ? (
              <section className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {visibleComments.length === 0 ? <p className="text-xs text-slate-500">첫 댓글을 남겨보세요.</p> : null}
                {visibleComments.map((comment) => {
                  const isLocallyHidden = hiddenLocalSet.has(comment.id);
                  const pendingAction = pendingCommentActions[comment.id];
                  const isModeratedHidden = moderatedHiddenCommentIds.includes(comment.id);
                  const isHidden = isLocallyHidden || isModeratedHidden || comment.status === "hidden" || comment.status === "spam";
                  return (
                    <div key={comment.id} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                      {isHidden ? (
                        <p className="text-xs text-slate-500">숨김 처리됨</p>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <p className="line-clamp-4 text-xs leading-5 text-slate-700">{comment.body}</p>
                          {currentUserId && currentUserId === comment.author_user_id ? (
                            <form
                              action={async () => {
                                await deleteCommentAction(comment.id);
                              }}
                            >
                              <button type="submit" className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-white">
                                삭제
                              </button>
                            </form>
                          ) : null}
                        </div>
                      )}

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-[11px] text-slate-500">{new Date(comment.created_at).toLocaleString("ko-KR")}</p>
                        {currentUserId ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending || Boolean(pendingAction)}
                              onClick={() => onReportComment(comment.id)}
                              className="rounded border border-amber-300 px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                            >
                              {pendingAction === "report" ? "처리 중..." : "신고"}
                            </button>
                            <button
                              type="button"
                              disabled={isPending || Boolean(pendingAction)}
                              onClick={() => onToggleLocalHide(comment.id)}
                              className="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-white disabled:opacity-60"
                            >
                              {pendingAction === "hide" ? "처리 중..." : isLocallyHidden ? "숨기기 해제" : "숨기기"}
                            </button>
                          </>
                        ) : null}
                        {commentInlineStatus[comment.id] ? <span className="text-[11px] font-medium text-emerald-700">{commentInlineStatus[comment.id]}</span> : null}
                      </div>
                    </div>
                  );
                })}
                {hasMore ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-700 underline"
                    onClick={() => setVisibleCommentCountByPost((prev) => ({ ...prev, [post.id]: visibleCount + 5 }))}
                  >
                    더보기
                  </button>
                ) : null}

                {currentUserId ? (
                  <form onSubmit={(event) => onCreateComment(post.id, event)} className="flex items-center gap-2">
                    <input type="hidden" name="postId" value={post.id} />
                    <input
                      name="body"
                      maxLength={2000}
                      required
                      placeholder="댓글을 입력하세요"
                      className="h-8 flex-1 rounded-md border border-slate-300 px-2 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={isPending}
                      className="h-8 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                    >
                      {isPending ? "등록 중..." : "등록"}
                    </button>
                  </form>
                ) : (
                  <p className="text-[11px] text-slate-500">댓글 작성은 로그인 후 가능합니다.</p>
                )}
                {commentErrorByPost[post.id] ? <p className="text-[11px] text-rose-700">{commentErrorByPost[post.id]}</p> : null}
              </section>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
