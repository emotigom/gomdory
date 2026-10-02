/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";

import OpsDetailPanel from "../_components/OpsDetailPanel";
import OpsFilterBar from "../_components/OpsFilterBar";
import OpsTable from "../_components/OpsTable";
import {
  opsCommunityModerationAction,
  opsCommunityReportStatusAction,
} from "../adminActions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CommunityReportRow = {
  id: string;
  target_type: "post" | "comment";
  target_id: string;
  reporter_user_id: string;
  reason: string;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
};

type CommunityTargetRow = {
  id: string;
  author_user_id: string;
  status: "active" | "hidden" | "spam";
};

type BlockedUserRow = {
  user_id: string;
};

const PAGE_SIZE = 50;

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ko-KR");
}

function parsePeriodStart(period: string): string | null {
  const now = new Date();
  if (period === "7d") {
    now.setDate(now.getDate() - 7);
    return now.toISOString();
  }
  if (period === "30d") {
    now.setDate(now.getDate() - 30);
    return now.toISOString();
  }
  if (period === "90d") {
    now.setDate(now.getDate() - 90);
    return now.toISOString();
  }
  return null;
}

export default async function OpsReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const status = String(params.status ?? "open");
  const targetType = String(params.targetType ?? "all");
  const period = String(params.period ?? "30d");
  const query = String(params.q ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const admin = createSupabaseAdminClient() as any;

  let reportsQuery = admin
    .from("community_reports")
    .select(
      "id,target_type,target_id,reporter_user_id,reason,status,created_at,resolved_at,resolved_by_user_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    reportsQuery = reportsQuery.eq("status", status);
  }
  if (targetType !== "all") {
    reportsQuery = reportsQuery.eq("target_type", targetType);
  }

  const periodStart = parsePeriodStart(period);
  if (periodStart) {
    reportsQuery = reportsQuery.gte("created_at", periodStart);
  }

  if (query) {
    const safeQuery = query.replace(/,/g, "").trim();
    reportsQuery = reportsQuery.or(`target_id.eq.${safeQuery},reporter_user_id.eq.${safeQuery}`);
  }

  const { data: rawReports, count } = await reportsQuery;
  const reportRows = (rawReports ?? []) as CommunityReportRow[];
  const postIds = reportRows.filter((row: CommunityReportRow) => row.target_type === "post").map((row: CommunityReportRow) => row.target_id);
  const commentIds = reportRows.filter((row: CommunityReportRow) => row.target_type === "comment").map((row: CommunityReportRow) => row.target_id);
  const relatedUserIds = [
    ...new Set(
      reportRows.flatMap((row: CommunityReportRow) => [row.reporter_user_id, row.resolved_by_user_id].filter((value): value is string => Boolean(value))),
    ),
  ];

  const [postsResult, commentsResult, blockedResult, openCountResult] = await Promise.all([
    postIds.length
      ? admin.from("community_posts").select("id,author_user_id,status").in("id", postIds)
      : Promise.resolve({ data: [] as CommunityTargetRow[] }),
    commentIds.length
      ? admin.from("community_comments").select("id,author_user_id,status").in("id", commentIds)
      : Promise.resolve({ data: [] as CommunityTargetRow[] }),
    relatedUserIds.length
      ? admin.from("community_blocked_users").select("user_id").in("user_id", relatedUserIds)
      : Promise.resolve({ data: [] as BlockedUserRow[] }),
    admin.from("community_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const posts = (postsResult.data ?? []) as CommunityTargetRow[];
  const comments = (commentsResult.data ?? []) as CommunityTargetRow[];
  const blockedUsers = (blockedResult.data ?? []) as BlockedUserRow[];

  const postMap = new Map(posts.map((post: CommunityTargetRow) => [post.id, post]));
  const commentMap = new Map(comments.map((comment: CommunityTargetRow) => [comment.id, comment]));
  const blockedSet = new Set(blockedUsers.map((row: BlockedUserRow) => row.user_id));

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const openCount = openCountResult.count ?? 0;

  return (
    <main className="space-y-4">
      <OpsFilterBar
        title="Community Reports / Moderation"
        description="신고 상태/타입/기간 필터 후 원클릭으로 숨김/해제, 사용자 차단/해제, 신고 상태 변경을 처리합니다."
      >
        <form action="/dashboard/ops/reports" className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            상태
            <select name="status" defaultValue={status} className="block rounded-lg border border-slate-200 px-2 py-1 text-sm">
              <option value="all">전체</option>
              <option value="open">open</option>
              <option value="resolved">resolved</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            타입
            <select name="targetType" defaultValue={targetType} className="block rounded-lg border border-slate-200 px-2 py-1 text-sm">
              <option value="all">전체</option>
              <option value="post">post</option>
              <option value="comment">comment</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            기간
            <select name="period" defaultValue={period} className="block rounded-lg border border-slate-200 px-2 py-1 text-sm">
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
              <option value="90d">최근 90일</option>
              <option value="all">전체</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            검색
            <input
              name="q"
              defaultValue={query}
              placeholder="target_id / reporter_user_id"
              className="block w-64 rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold">필터 적용</button>
        </form>
      </OpsFilterBar>

      <OpsDetailPanel title="운영 개요">
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg bg-amber-50 px-3 py-1 text-amber-700">미처리 신고 {openCount}건</span>
          <span className="rounded-lg bg-slate-100 px-3 py-1 text-slate-700">현재 페이지 {page}/{totalPages}</span>
          <span className="rounded-lg bg-slate-100 px-3 py-1 text-slate-700">조회 결과 {totalCount}건</span>
        </div>
      </OpsDetailPanel>

      <OpsTable>
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2">신고</th>
            <th className="px-3 py-2">대상 상태</th>
            <th className="px-3 py-2">신고 상태</th>
            <th className="px-3 py-2">사용자 차단</th>
            <th className="px-3 py-2">신고 시각</th>
            <th className="px-3 py-2">원클릭 액션</th>
          </tr>
        </thead>
        <tbody>
          {reportRows.map((report: CommunityReportRow) => {
            const target = report.target_type === "post" ? postMap.get(report.target_id) : commentMap.get(report.target_id);
            const targetStatus = target?.status ?? "unknown";
            const targetAuthor = target?.author_user_id ?? null;
            const isBlocked = targetAuthor ? blockedSet.has(targetAuthor) : false;

            return (
              <tr key={report.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-900">{report.target_type}:{report.target_id}</p>
                  <p className="mt-1 text-slate-500">reporter: {report.reporter_user_id}</p>
                  <p className="mt-1 text-slate-700">{report.reason}</p>
                </td>
                <td className="px-3 py-2 text-xs">
                  <p className="text-slate-700">{targetStatus}</p>
                  {targetAuthor ? <p className="mt-1 text-slate-500">author: {targetAuthor}</p> : <p className="mt-1 text-slate-400">작성자 없음</p>}
                </td>
                <td className="px-3 py-2 text-xs">
                  <form className="flex flex-wrap gap-2">
                    <input type="hidden" name="reportId" value={report.id} />
                    <button
                      formAction={opsCommunityReportStatusAction}
                      name="status"
                      value="open"
                      className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                    >
                      open
                    </button>
                    <button
                      formAction={opsCommunityReportStatusAction}
                      name="status"
                      value="resolved"
                      className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                    >
                      resolved
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2 text-xs">
                  {targetAuthor ? (
                    <form className="flex flex-wrap gap-2">
                      <input type="hidden" name="operation" value={isBlocked ? "unblockUser" : "blockUser"} />
                      <input type="hidden" name="targetUserId" value={targetAuthor} />
                      <input type="hidden" name="reportId" value={report.id} />
                      <button
                        formAction={opsCommunityModerationAction}
                        className={`rounded border px-2 py-1 text-xs font-semibold ${
                          isBlocked
                            ? "border-slate-200 text-slate-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {isBlocked ? "차단해제" : "차단"}
                      </button>
                    </form>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  <p>{formatDate(report.created_at)}</p>
                  <p className="mt-1 text-slate-500">해결: {formatDate(report.resolved_at)}</p>
                </td>
                <td className="px-3 py-2">
                  <form className="flex flex-wrap gap-2">
                    <input type="hidden" name="targetType" value={report.target_type} />
                    <input type="hidden" name="targetId" value={report.target_id} />
                    <input type="hidden" name="reportId" value={report.id} />
                    <button
                      formAction={opsCommunityModerationAction}
                      name="operation"
                      value="hideTarget"
                      className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"
                    >
                      숨김
                    </button>
                    <button
                      formAction={opsCommunityModerationAction}
                      name="operation"
                      value="unhideTarget"
                      className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                    >
                      숨김해제
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
          {reportRows.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={6}>
                조건에 맞는 신고가 없습니다.
              </td>
            </tr>
          ) : null}
        </tbody>
      </OpsTable>

      <OpsDetailPanel title="페이지 이동">
        <div className="flex items-center gap-2 text-sm">
          {hasPrev ? (
            <a
              href={`/dashboard/ops/reports?status=${encodeURIComponent(status)}&targetType=${encodeURIComponent(targetType)}&period=${encodeURIComponent(period)}&q=${encodeURIComponent(query)}&page=${page - 1}`}
              className="rounded-lg border border-slate-200 px-3 py-1.5"
            >
              이전
            </a>
          ) : (
            <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-slate-400">이전</span>
          )}
          {hasNext ? (
            <a
              href={`/dashboard/ops/reports?status=${encodeURIComponent(status)}&targetType=${encodeURIComponent(targetType)}&period=${encodeURIComponent(period)}&q=${encodeURIComponent(query)}&page=${page + 1}`}
              className="rounded-lg border border-slate-200 px-3 py-1.5"
            >
              다음
            </a>
          ) : (
            <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-slate-400">다음</span>
          )}
        </div>
      </OpsDetailPanel>
    </main>
  );
}
