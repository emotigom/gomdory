export const dynamic = "force-dynamic";

import { toggleCommentModeration } from "@/app/(marketing)/community/actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ReportRow = {
  id: string;
  comment_id: string;
  reporter_user_id: string;
  reason: string;
  created_at: string;
};

type CommentRow = {
  id: string;
  body: string;
  author_user_id: string;
};

type ModerationRow = {
  comment_id: string;
  is_hidden: boolean;
  staff_note: string | null;
  updated_at: string;
};

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "hidden", label: "숨김만" },
  { key: "pending", label: "미처리(숨김 아님)" },
] as const;

const SORTS = [
  { key: "latest", label: "최신 신고" },
  { key: "most_reported", label: "신고 많은 댓글" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];
type SortKey = (typeof SORTS)[number]["key"];

export default async function OpsCommunityModerationPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string; sort?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const filter = FILTERS.some((item) => item.key === params.filter) ? (params.filter as FilterKey) : "all";
  const sort = SORTS.some((item) => item.key === params.sort) ? (params.sort as SortKey) : "latest";

  const admin = createSupabaseAdminClient();
  const { data: reportData } = await admin
    .from("community_comment_reports")
    .select("id,comment_id,reporter_user_id,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const reports = (reportData ?? []) as ReportRow[];
  const reportCountByCommentId = reports.reduce<Record<string, number>>((acc, report) => {
    acc[report.comment_id] = (acc[report.comment_id] ?? 0) + 1;
    return acc;
  }, {});

  const commentIds = [...new Set(reports.map((report) => report.comment_id))];

  const [{ data: commentsData }, { data: moderationData }] = await Promise.all([
    commentIds.length
      ? admin.from("community_comments").select("id,body,author_user_id").in("id", commentIds)
      : Promise.resolve({ data: [] as CommentRow[] }),
    commentIds.length
      ? admin.from("community_comment_moderation").select("comment_id,is_hidden,staff_note,updated_at").in("comment_id", commentIds)
      : Promise.resolve({ data: [] as ModerationRow[] }),
  ]);

  const commentMap = new Map(((commentsData ?? []) as CommentRow[]).map((row) => [row.id, row]));
  const moderationMap = new Map(((moderationData ?? []) as ModerationRow[]).map((row) => [row.comment_id, row]));

  const filteredReports = reports.filter((report) => {
    const hidden = moderationMap.get(report.comment_id)?.is_hidden ?? false;
    if (filter === "hidden") return hidden;
    if (filter === "pending") return !hidden;
    return true;
  });

  const sortedReports = [...filteredReports].sort((a, b) => {
    if (sort === "most_reported") {
      const diff = (reportCountByCommentId[b.comment_id] ?? 0) - (reportCountByCommentId[a.comment_id] ?? 0);
      if (diff !== 0) return diff;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filterHref = (nextFilter: FilterKey, nextSort: SortKey) =>
    `/dashboard/ops/community-moderation?filter=${encodeURIComponent(nextFilter)}&sort=${encodeURIComponent(nextSort)}`;

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Community Comment Moderation</h1>
        <p className="mt-1 text-sm text-slate-600">신고 목록 확인, 댓글 숨김/복구, 스태프 메모를 ops 전용으로 관리합니다.</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => {
            const active = item.key === filter;
            return (
              <a
                key={item.key}
                href={filterHref(item.key, sort)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">정렬:</span>
          {SORTS.map((item) => {
            const active = item.key === sort;
            return (
              <a
                key={item.key}
                href={filterHref(filter, item.key)}
                className={`rounded-md border px-2.5 py-1 ${
                  active ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {sortedReports.length === 0 ? <p className="text-sm text-slate-500">조건에 맞는 신고된 댓글이 없습니다.</p> : null}
        <ul className="space-y-3">
          {sortedReports.map((report) => {
            const comment = commentMap.get(report.comment_id);
            const moderation = moderationMap.get(report.comment_id);
            const hidden = moderation?.is_hidden ?? false;
            const reportCount = reportCountByCommentId[report.comment_id] ?? 1;
            return (
              <li key={report.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>report: {report.id}</span>
                  <span>comment: {report.comment_id}</span>
                  <span>reporter: {report.reporter_user_id}</span>
                  <span>누적 신고: {reportCount}</span>
                  <span>{new Date(report.created_at).toLocaleString("ko-KR")}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">신고 사유: {report.reason}</p>
                <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-700">{comment?.body ?? "댓글 원문 없음"}</p>
                <p className="mt-1 text-xs text-slate-500">작성자: {comment?.author_user_id ?? "unknown"}</p>

                <form action={toggleCommentModeration} className="mt-2 space-y-2">
                  <input type="hidden" name="commentId" value={report.comment_id} />
                  <input type="hidden" name="isHidden" value={hidden ? "0" : "1"} />
                  <textarea
                    name="staffNote"
                    defaultValue={moderation?.staff_note ?? ""}
                    placeholder="스태프 메모"
                    className="min-h-20 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${
                        hidden ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {hidden ? "복구 + 메모 저장" : "숨김 + 메모 저장"}
                    </button>
                    <span className="text-xs text-slate-500">현재 상태: {hidden ? "hidden" : "active"}</span>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
