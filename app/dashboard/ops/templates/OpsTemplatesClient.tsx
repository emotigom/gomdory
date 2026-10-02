"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Link from "next/link";
import { useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";

type OpsTemplate = {
  id: string;
  title: string;
  visibility: "public" | "unlisted" | "hidden";
  proOnly: boolean;
  picksRank: number | null;
  reports: number;
};

export function OpsTemplatesClient({ templates }: { templates: OpsTemplate[] }) {
  const [items, setItems] = useState<OpsTemplate[]>(templates);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (template: OpsTemplate, next: Partial<OpsTemplate>) => {
    setSavingId(template.id);
    setError(null);
    const response = await fetch(apiV1Path(`templates/${template.id}/admin`), {
      method: "PATCH",
      body: JSON.stringify({
        visibility: next.visibility ?? template.visibility,
        pro_only: next.proOnly ?? template.proOnly,
        picks_rank: next.picksRank ?? template.picksRank,
      }),
    });

    const payload = (await response.json()) as { ok?: boolean; template?: OpsTemplate; error?: { message: string } };
    if (payload.ok && payload.template) {
      setItems((prev) => prev.map((item) => (item.id === template.id ? { ...item, ...payload.template } : item)));
    } else {
      setError(payload.error?.message ?? "저장에 실패했습니다.");
    }
    setSavingId(null);
  };

  return (
    <div className="min-w-0 space-y-4">
      {error ? (
        <div className="dashboard-ops-card min-w-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 break-words">{error}</p>
            <Link href="/dashboard/ops/templates" className="dashboard-ops-control shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700">
              다시 확인
            </Link>
          </div>
        </div>
      ) : null}
      <div className="dashboard-ops-card min-w-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[46rem] divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">제목</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">가시성</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pro</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Picks Rank</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">신고</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr className="dashboard-ops-row">
                <td className="px-4 py-6" colSpan={6}>
                  <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">표시할 템플릿이 없습니다.</p>
                      <p className="mt-1 break-words text-xs text-slate-500">필터나 데이터 상태를 확인한 뒤 다시 불러오세요.</p>
                    </div>
                    <Link href="/dashboard/ops/templates" className="dashboard-ops-control shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                      새로고침
                    </Link>
                  </div>
                </td>
              </tr>
            ) : null}
            {items.map((template) => (
              <tr key={template.id} className="dashboard-ops-row align-top">
                <td className="max-w-[18rem] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900" title={template.title}>{template.title}</p>
                    <p className="mt-1 break-all font-mono text-[11px] font-medium text-slate-500">{template.id}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={template.visibility}
                    onChange={(event) => handleSave(template, { visibility: event.target.value as OpsTemplate["visibility"] })}
                    className="dashboard-ops-input min-w-28 rounded-lg border border-slate-200 px-3 py-1 text-sm font-medium text-slate-800"
                  >
                    <option value="public">public</option>
                    <option value="unlisted">unlisted</option>
                    <option value="hidden">hidden</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <label className="dashboard-ops-row inline-flex min-w-0 items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      defaultChecked={template.proOnly}
                      onChange={(event) => handleSave(template, { proOnly: event.target.checked })}
                      className="dashboard-ops-input h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    <span className="whitespace-nowrap">Pro 전용</span>
                  </label>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    defaultValue={template.picksRank ?? ""}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      handleSave(template, { picksRank: value ? Number(value) : null });
                    }}
                    className="dashboard-ops-input w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm font-medium text-slate-800"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex min-w-10 justify-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                    {template.reports}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSave(template, {})}
                    disabled={savingId === template.id}
                    className={cn(
                      "dashboard-ops-control whitespace-nowrap disabled:cursor-not-allowed",
                      buttonTone("secondary", { size: "sm" }),
                      savingId === template.id ? "opacity-60" : "",
                    )}
                  >
                    {savingId === template.id ? "저장 중..." : "동기화"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
