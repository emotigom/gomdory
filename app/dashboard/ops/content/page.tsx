export const dynamic = "force-dynamic";

import Link from "next/link";

import OpsFilterBar from "../_components/OpsFilterBar";
import OpsTable from "../_components/OpsTable";
import { bulkCardModerationAction } from "../adminActions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ContentRow = {
  id: string;
  text: string;
  created_at: string;
  is_hidden: boolean;
  deleted_at: string | null;
  wall_id: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ko-KR");
}

export default async function OpsContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const status = String(params.status ?? "active");

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("cards")
    .select("id, wall_id, text, created_at, is_hidden, deleted_at")
    .order("created_at", { ascending: false })
    .limit(120);

  if (status === "hidden") query = query.eq("is_hidden", true).is("deleted_at", null);
  if (status === "deleted") query = query.not("deleted_at", "is", null);
  if (status === "active") query = query.eq("is_hidden", false).is("deleted_at", null);

  const { data } = await query;
  const rowsRaw = (data ?? []) as ContentRow[];
  const wallIds = Array.from(new Set(rowsRaw.map((row) => row.wall_id)));
  const walls = wallIds.length
    ? await admin.from("walls").select("id, board_id").in("id", wallIds)
    : { data: [] as Array<{ id: string; board_id: string }> };
  const boardByWall = new Map((walls.data ?? []).map((wall) => [wall.id, wall.board_id]));

  const rows = rowsRaw.filter((row) => {
    if (!q) return true;
    const text = row.text?.toLowerCase() ?? "";
    const boardId = boardByWall.get(row.wall_id) ?? "";
    return text.includes(q.toLowerCase()) || row.id.includes(q) || boardId.includes(q);
  });

  return (
    <main className="space-y-4">
      <OpsFilterBar title="Content 관리" description="게시물(카드) 숨김/삭제/복구를 대량 처리">
        <form action="/dashboard/ops/content" className="flex min-w-0 flex-wrap items-end gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="텍스트, 카드ID, 보드ID"
            className="dashboard-ops-input w-56 max-w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
          />
          <select name="status" defaultValue={status} className="dashboard-ops-input max-w-full rounded-lg border border-slate-200 px-2 py-1 text-sm">
            <option value="active">활성</option>
            <option value="hidden">숨김</option>
            <option value="deleted">삭제</option>
            <option value="all">전체</option>
          </select>
          <button className="dashboard-ops-control rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold">적용</button>
        </form>
      </OpsFilterBar>

      <form className="space-y-3">
        <div className="flex min-w-0 flex-wrap gap-2">
          <button formAction={bulkCardModerationAction} name="operation" value="hide" className="dashboard-ops-control rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">숨김</button>
          <button formAction={bulkCardModerationAction} name="operation" value="delete" className="dashboard-ops-control rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">삭제</button>
          <button formAction={bulkCardModerationAction} name="operation" value="restore" className="dashboard-ops-control rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">복구</button>
        </div>
        <OpsTable>
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">선택</th>
              <th className="px-3 py-2">게시물</th>
              <th className="px-3 py-2">보드</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">생성</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const state = row.deleted_at ? "삭제" : row.is_hidden ? "숨김" : "활성";
              const stateClass = row.deleted_at
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : row.is_hidden
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700";
              return (
                <tr key={row.id} className="dashboard-ops-row border-t border-slate-100 align-top">
                  <td className="px-3 py-2"><input type="checkbox" name="cardIds" value={row.id} className="dashboard-ops-input h-4 w-4 rounded border-slate-300 text-slate-900" /></td>
                  <td className="min-w-0 px-3 py-2">
                    <p className="line-clamp-2 max-w-xl break-words text-sm text-slate-900">{row.text || "(empty)"}</p>
                    <p className="mt-1 max-w-xs break-all font-mono text-xs text-slate-500">{row.id}</p>
                  </td>
                  <td className="min-w-0 px-3 py-2 text-xs text-slate-700">
                    <span className="block max-w-48 break-all font-mono">{boardByWall.get(row.wall_id) ?? "-"}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 font-semibold leading-5 whitespace-nowrap ${stateClass}`}>
                      {state}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-600">{formatDate(row.created_at)}</td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr className="dashboard-ops-row border-t border-slate-100">
                <td colSpan={5} className="px-3 py-8 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-sm text-slate-600">
                    <p className="break-words">조건에 맞는 게시물이 없습니다.</p>
                    <Link href="/dashboard/ops/content" className="dashboard-ops-control rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                      필터 초기화
                    </Link>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </OpsTable>
      </form>
    </main>
  );
}
