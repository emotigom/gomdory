export const dynamic = "force-dynamic";

import Link from "next/link";

import OpsFilterBar from "../_components/OpsFilterBar";
import OpsTable from "../_components/OpsTable";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assignEasyShareCodeAction,
  disableEasyShareCodeAction,
  removeEasyShareCodeAction,
} from "./actions";

const SHARE_CODE_PATTERN = "[23456789abcdefghjkmnpqrstuvwxyz]{6}";
const SHARE_CODE_CHARACTERS = "23456789abcdefghjkmnpqrstuvwxyz";

type BoardRow = {
  id: string;
  title: string;
  owner_id: string;
  share_code: string | null;
  share_enabled: boolean | null;
  share_write_enabled: boolean | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ko-KR");
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function OpsShareCodesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = readParam(params.q).trim().toLowerCase();
  const kind = readParam(params.kind);
  const message = readParam(params.message);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("boards")
    .select("id, title, owner_id, share_code, share_enabled, share_write_enabled, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(120);

  const rows = ((data ?? []) as BoardRow[]).filter((board) => {
    if (!q) return true;
    return (
      board.id.toLowerCase().includes(q) ||
      board.title.toLowerCase().includes(q) ||
      board.owner_id.toLowerCase().includes(q) ||
      (board.share_code ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="space-y-4">
      <OpsFilterBar
        title="긴급 공유코드"
        description="관리자가 보드에 기억하기 쉬운 6자리 공유코드를 지정하고, 접속을 닫거나 코드를 제거합니다."
      >
        <form action="/dashboard/ops/share-codes" className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm">
            <span className="block font-medium text-slate-700">보드 검색</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="제목, 보드 ID, 현재 코드"
              className="min-w-72 rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">
            검색
          </button>
        </form>
      </OpsFilterBar>

      {message ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {message}
        </div>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-900">보드 ID로 바로 지정</h2>
          <p className="mt-1 text-sm text-slate-600">
            허용 문자: <code className="rounded bg-slate-100 px-1.5 py-0.5">{SHARE_CODE_CHARACTERS}</code>
          </p>
          <p className="mt-1 text-sm font-medium text-rose-700">
            0, 1, i, l, o는 관리자 입력에서도 사용할 수 없습니다.
          </p>
        </div>
        <form action={assignEasyShareCodeAction} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-end">
          <label className="space-y-1 text-sm">
            <span className="block font-medium text-slate-700">보드 ID</span>
            <input
              name="boardId"
              required
              placeholder="보드 UUID"
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="block font-medium text-slate-700">6자리 공유코드</span>
            <input
              name="shareCode"
              required
              minLength={6}
              maxLength={6}
              pattern={SHARE_CODE_PATTERN}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="예: 222222"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono lowercase tracking-widest"
            />
          </label>
          <button className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100">
            읽기 전용으로 열기
          </button>
        </form>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          보드 목록을 불러오지 못했습니다: {error.message}
        </div>
      ) : null}

      <OpsTable>
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2">보드</th>
            <th className="px-3 py-2">현재 공유</th>
            <th className="px-3 py-2">쉬운 코드 지정</th>
            <th className="px-3 py-2">생성</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((board) => {
            const shareOpen = board.share_enabled === true && Boolean(board.share_code);
            return (
              <tr key={board.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-3">
                  <p className="font-semibold text-slate-900">{board.title}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{board.id}</p>
                  <Link
                    href={`/dashboard/boards/${board.id}/board`}
                    className="mt-2 inline-block text-xs font-semibold text-sky-700 underline underline-offset-2"
                  >
                    교사 보드 열기
                  </Link>
                </td>
                <td className="px-3 py-3 text-sm">
                  {board.share_code ? (
                    <>
                      <Link
                        href={`/s/${board.share_code}`}
                        target="_blank"
                        className="font-mono font-semibold text-sky-700 underline underline-offset-2"
                      >
                        {board.share_code}
                      </Link>
                      <p className="mt-1 text-xs text-slate-600">
                        {shareOpen ? "접속 열림" : "접속 닫힘"} · 학생 작성 {board.share_write_enabled ? "허용" : "닫힘"}
                      </p>
                    </>
                  ) : (
                    <span className="text-slate-500">코드 없음</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <form className="flex min-w-[330px] flex-wrap items-center gap-2">
                    <input type="hidden" name="boardId" value={board.id} />
                    <input
                      name="shareCode"
                      defaultValue={board.share_code ?? ""}
                      required
                      minLength={6}
                      maxLength={6}
                      pattern={SHARE_CODE_PATTERN}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="예: 222222"
                      aria-label={`${board.title} 공유코드`}
                      className="w-32 rounded-lg border border-slate-200 px-3 py-2 font-mono lowercase tracking-widest"
                    />
                    <button
                      formAction={assignEasyShareCodeAction}
                      className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800"
                    >
                      지정하고 열기
                    </button>
                    <button
                      formAction={disableEasyShareCodeAction}
                      formNoValidate
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
                    >
                      접속만 닫기
                    </button>
                    <button
                      formAction={removeEasyShareCodeAction}
                      formNoValidate
                      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
                    >
                      코드 제거
                    </button>
                  </form>
                </td>
                <td className="px-3 py-3 text-xs text-slate-600">{formatDate(board.created_at)}</td>
              </tr>
            );
          })}
          {!error && rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                표시할 보드가 없습니다.
              </td>
            </tr>
          ) : null}
        </tbody>
      </OpsTable>
    </main>
  );
}
