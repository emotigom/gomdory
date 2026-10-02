import Link from "next/link";
import { cookies } from "next/headers";

import {
  blockUser,
  createComment,
  createPost,
  deleteComment,
  moderateComment,
  moderatePost,
  unblockUser,
  updateReportStatus,
} from "./actions";
import { COMMUNITY_CATEGORY_LABELS, COMMUNITY_CATEGORY_VALUES, type CommunityCategory } from "@/lib/community/categories";
import {
  filterAndOrderCommunityPosts,
  normalizeCommunityTab,
  resolveCommunityDataSource,
  type CommunityDataSource,
} from "@/lib/community/feed";
import { getCurrentUserOpsAdmin } from "@/lib/auth/getCurrentUserOpsAdmin";
import { isCommunity3DGalleryEnabled } from "@/lib/community/flags";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteContentByKey } from "@/lib/site-content/server";
import { CommunityPostComposer } from "./CommunityPostComposer";
import { CommunityBoardList } from "./CommunityBoardList";

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
  attachment_file_ids: string[] | null;
  external_attachments: unknown;
  files?: { id: string; filename: string; mime: string | null }[];
};

const LINK_PATTERN = /(https?:\/\/[^\s]+)/g;

function renderLinkedText(body: string) {
  return body.split(LINK_PATTERN).map((chunk, index) => {
    if (/^https?:\/\//.test(chunk)) {
      return (
        <a key={`${chunk}-${index}`} href={chunk} target="_blank" rel="noreferrer noopener" className="text-sky-700 underline">
          {chunk}
        </a>
      );
    }

    return <span key={`txt-${index}`}>{chunk}</span>;
  });
}

function renderCmsBody(body: string) {
  return body
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, rows) => line.length > 0 || (index > 0 && rows[index - 1].length > 0))
    .map((line, index) => {
      if (line.startsWith("### ")) {
        return (
          <h3 key={`h3-${index}`} className="mt-8 text-lg font-semibold text-slate-900">
            {line.slice(4)}
          </h3>
        );
      }

      if (line.startsWith("## ")) {
        return (
          <h2 key={`h2-${index}`} className="mt-10 text-xl font-semibold text-slate-900">
            {line.slice(3)}
          </h2>
        );
      }

      if (line.startsWith("# ")) {
        return (
          <h1 key={`h1-${index}`} className="mt-10 text-2xl font-semibold text-slate-900">
            {line.slice(2)}
          </h1>
        );
      }

      return (
        <p key={`p-${index}`} className="text-sm leading-7 text-slate-700">
          {renderLinkedText(line)}
        </p>
      );
    });
}

function formatCommunityUpdatedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export const dynamic = "force-dynamic";

export default async function CommunityPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedParams = (await searchParams) ?? {};
  const tab = normalizeCommunityTab(typeof resolvedParams.tab === "string" ? resolvedParams.tab : null);

  const dataSource: CommunityDataSource = resolveCommunityDataSource(tab);
  const isCmsTab = dataSource.kind === "cms";
  const isOpsAdmin = await getCurrentUserOpsAdmin();

  let currentUserId: string | null = null;
  let isModerator = false;
  let openReports: { id: string; target_type: string; target_id: string; reason: string; status: "open" | "resolved" }[] = [];
  let blockedUsers: { user_id: string; reason: string; created_at: string }[] = [];
  let posts: CommunityPost[] = [];
  let cmsContent: { title: string; body: string; updatedAt: string | null } | null = null;
  let setupWarning: string | null = null;
  let uploadBoardId: string | null = null;
  let fileById = new Map<string, { id: string; filename: string; mime: string | null }>();
  let hiddenCommentIds: string[] = [];
  const moderatedHiddenCommentIds: string[] = [];

  try {
    const supabase = createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    currentUserId = auth.user?.id ?? null;

    if (currentUserId) {
      const { data: firstBoard } = await supabase
        .from("boards")
        .select("id")
        .eq("owner_id", currentUserId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      uploadBoardId = firstBoard?.id ?? null;

      const cookieStore = await cookies();
      const hiddenRaw = cookieStore.get("community_hidden_comment_ids")?.value;
      if (hiddenRaw) {
        try {
          const parsed = JSON.parse(hiddenRaw) as unknown;
          if (Array.isArray(parsed)) {
            hiddenCommentIds = parsed.filter((id): id is string => typeof id === "string");
          }
        } catch {
          hiddenCommentIds = [];
        }
      }
    }

    const [moderatorResult, reportsResult, blockedResult] = await Promise.all([
      currentUserId
        ? supabase.from("community_moderators").select("user_id").eq("user_id", currentUserId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("community_reports").select("id,target_type,target_id,status,reason").order("created_at", { ascending: false }).limit(20),
      supabase.from("community_blocked_users").select("user_id,reason,created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    isModerator = Boolean(moderatorResult.data?.user_id && currentUserId && moderatorResult.data.user_id === currentUserId);
    openReports = (reportsResult.data ?? []) as typeof openReports;
    blockedUsers = (blockedResult.data ?? []) as typeof blockedUsers;

    if (isCmsTab) {
      const row = await getSiteContentByKey(dataSource.key);
      cmsContent = {
        title: row?.title?.trim() || COMMUNITY_CATEGORY_LABELS[tab as CommunityCategory],
        body: row?.body?.trim() || "아직 올라온 글이 없습니다.",
        updatedAt: row?.publishedAt ?? row?.updatedAt ?? null,
      };
    } else {
      const postQuery = supabase
        .from("community_posts")
        .select("id,title,body,status,category,is_pinned,author_user_id,created_at,attachment_file_ids,external_attachments,comments:community_comments(id,body,author_user_id,created_at,deleted_at,status),reactions:community_reactions(user_id,reaction_type)")
        .order("created_at", { ascending: false })
        .limit(120)
        .in("category", ["free", "edu", "qna"]);

      const { data: postRows } = tab === "all" ? await postQuery : await postQuery.eq("category", tab);
      posts = filterAndOrderCommunityPosts((postRows ?? []) as CommunityPost[], tab) as CommunityPost[];

      const attachmentIds = Array.from(
        new Set(
          posts.flatMap((post) =>
            Array.isArray(post.attachment_file_ids) ? post.attachment_file_ids.filter((id): id is string => typeof id === "string") : [],
          ),
        ),
      );

      if (attachmentIds.length > 0) {
        const { data: files } = await supabase
          .from("board_files")
          .select("id,filename,mime")
          .in("id", attachmentIds)
          .is("deleted_at", null);

        fileById = new Map((files ?? []).map((file) => [file.id, file]));
      }

      posts = posts.map((post) => ({
        ...post,
        files: (post.attachment_file_ids ?? [])
          .map((fileId) => fileById.get(fileId))
          .filter((file): file is { id: string; filename: string; mime: string | null } => Boolean(file)),
      }));

    }
  } catch (error) {
    setupWarning = error instanceof Error ? error.message : "커뮤니티 데이터를 불러오지 못했습니다.";
  }

  const postAuthorMap = new Map(posts.map((post) => [post.id, post.author_user_id]));
  const commentAuthorMap = new Map(posts.flatMap((post) => post.comments.map((comment) => [comment.id, comment.author_user_id])));
  const formattedCmsUpdatedAt = formatCommunityUpdatedAt(cmsContent?.updatedAt ?? null);

  return (
    <main data-community-interaction-scope className="community-workshop mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <section className="community-workshop-hero overflow-hidden rounded-[3px_14px_3px_14px] border-2 border-[var(--theme-border-strong)] bg-[var(--theme-card)] p-6 shadow-[7px_7px_0_#f0643c] sm:p-9">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black tracking-[0.16em] text-[var(--theme-accent)]">COMMUNITY BOARD / 함께 나누기</p>
            <h1 className="mt-4 text-4xl font-black leading-[1.04] tracking-[-0.055em] text-slate-900 sm:text-6xl">수업에서 나온 이야기,<br />한곳에 모으기</h1>
            <p className="mt-4 text-base font-medium leading-7 text-slate-600">수업 사례와 운영 팁을 나누는 커뮤니티입니다.</p>
          </div>
          {isCommunity3DGalleryEnabled() ? (
            <Link
              href="/community/gallery-3d"
              className="inline-flex min-h-12 items-center justify-center rounded-[4px] border-2 border-[var(--theme-border-strong)] bg-[#e6f05a] px-4 text-sm font-black text-[var(--theme-text)] shadow-[3px_3px_0_var(--theme-border-strong)]"
            >
              3D 갤러리 보기
            </Link>
          ) : null}
        </div>
      </section>

      <section className="community-index-tabs border-y-2 border-[var(--theme-border-strong)] bg-[var(--theme-card)] px-1 py-1">
        <div className="flex flex-wrap gap-1">
          <Link
            href="/community"
            className={`community-tab-link border-b-4 px-4 py-3 text-sm font-black ${tab === "all" ? "border-[var(--theme-accent)] bg-[#e6f05a] text-[var(--theme-text)]" : "border-transparent text-slate-700 hover:bg-slate-50"}`}
          >
            전체
          </Link>
          {COMMUNITY_CATEGORY_VALUES.map((category) => (
            <Link
              key={category}
              href={`/community?tab=${category}`}
              className={`community-tab-link border-b-4 px-4 py-3 text-sm font-black ${tab === category ? "border-[var(--theme-accent)] bg-[#e6f05a] text-[var(--theme-text)]" : "border-transparent text-slate-700 hover:bg-slate-50"}`}
            >
              {COMMUNITY_CATEGORY_LABELS[category]}
            </Link>
          ))}
        </div>
      </section>

      {setupWarning ? (
        <p className="border-l-8 border-amber-500 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-950">커뮤니티를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.</p>
      ) : null}

      {!isCmsTab && currentUserId ? (
        <CommunityPostComposer createPostAction={createPost} uploadBoardId={uploadBoardId} />
      ) : !isCmsTab ? (
        <p className="border-l-8 border-[#e6f05a] bg-[var(--theme-card)] px-5 py-4 text-sm font-semibold text-[var(--theme-text-muted)]">로그인하면 글과 댓글을 남길 수 있습니다.</p>
      ) : null}

      {isCmsTab ? (
        <section className="border border-slate-200 bg-white p-6 shadow-sm">
          <header className="border-b border-slate-200 pb-4">
            <h2 className="text-2xl font-semibold text-slate-900">{cmsContent?.title || COMMUNITY_CATEGORY_LABELS[tab as CommunityCategory]}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {formattedCmsUpdatedAt ? (
                <p className="text-xs text-slate-500">마지막 업데이트: {formattedCmsUpdatedAt}</p>
              ) : null}
              {isOpsAdmin ? (
                <Link
                  href={`/dashboard/ops/site-content?key=${dataSource.kind === "cms" ? dataSource.key : "community_usage"}`}
                  className="inline-flex items-center rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  운영자 편집
                </Link>
              ) : null}
            </div>
          </header>
          <article className="mt-5 space-y-3">{renderCmsBody(cmsContent?.body || "")}</article>
        </section>
      ) : (
        <CommunityBoardList
          posts={posts}
          currentUserId={currentUserId}
          hiddenCommentIds={hiddenCommentIds}
          moderatedHiddenCommentIds={moderatedHiddenCommentIds}
          createCommentAction={createComment}
          deleteCommentAction={deleteComment}
        />
      )}

      {isModerator && !isCmsTab ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">신고 관리</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {openReports.length === 0 ? <li>신고 내역이 없습니다.</li> : null}
            {openReports.map((report) => {
              const targetAuthorId = report.target_type === "post" ? postAuthorMap.get(report.target_id) : commentAuthorMap.get(report.target_id);

              return (
                <li key={report.id} className="space-y-2 rounded-lg bg-slate-50 px-3 py-3">
                  <p>
                    [{report.status === "open" ? "대기" : "처리완료"}] {report.target_type}:{report.target_id} · {report.reason}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <form action={updateReportStatus}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <input type="hidden" name="status" value={report.status === "open" ? "resolved" : "open"} />
                      <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-white">{report.status === "open" ? "처리완료" : "대기로 변경"}</button>
                    </form>

                    {report.target_type === "post" ? (
                      <form action={moderatePost}>
                        <input type="hidden" name="postId" value={report.target_id} />
                        <input type="hidden" name="status" value="hidden" />
                        <input type="hidden" name="note" value="report_quick_hide" />
                        <button className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">신고 대상 숨김</button>
                      </form>
                    ) : (
                      <form action={moderateComment}>
                        <input type="hidden" name="commentId" value={report.target_id} />
                        <input type="hidden" name="status" value="hidden" />
                        <input type="hidden" name="note" value="report_quick_hide" />
                        <button className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">신고 대상 숨김</button>
                      </form>
                    )}

                    {targetAuthorId ? (
                      <>
                        <form action={blockUser}>
                          <input type="hidden" name="targetUserId" value={targetAuthorId} />
                          <input type="hidden" name="reason" value={`report:${report.id}`} />
                          <button className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">작성자 차단</button>
                        </form>
                        <form action={unblockUser}>
                          <input type="hidden" name="targetUserId" value={targetAuthorId} />
                          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-white">작성자 차단 해제</button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <h3 className="mt-6 text-sm font-semibold text-slate-900">최근 차단 사용자</h3>
          <ul className="mt-2 space-y-2 text-xs text-slate-700">
            {blockedUsers.length === 0 ? <li>차단된 사용자가 없습니다.</li> : null}
            {blockedUsers.map((entry) => (
              <li key={entry.user_id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-2 py-2">
                <span>{entry.user_id}</span>
                <span className="text-slate-500">{entry.reason}</span>
                <span className="text-slate-400">{new Date(entry.created_at).toLocaleString("ko-KR")}</span>
                <form action={unblockUser}>
                  <input type="hidden" name="targetUserId" value={entry.user_id} />
                  <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-white">차단 해제</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
