"use client";

import { useMemo, useState } from "react";

import { normalizeOpsBannerInput } from "@/lib/ops/banners";
import { routes } from "@/lib/standards/routes";

type BannerForm = {
  message: string;
  href: string;
  label: string;
  enabled: boolean;
  level: string;
  startsAt: string;
  endsAt: string;
};

function isoToLocalInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

type Props = {
  initialBanner: BannerForm;
};

export default function OpsBannersClient({ initialBanner }: Props) {
  const [form, setForm] = useState<BannerForm>(initialBanner);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const preview = useMemo(() => normalizeOpsBannerInput(form), [form]);
  const previewState = useMemo(() => {
    if (!preview.enabled) return "비활성";
    const nowMs = Date.now();
    const startsAtMs = preview.startsAt ? Date.parse(preview.startsAt) : null;
    if (startsAtMs !== null && !Number.isNaN(startsAtMs) && nowMs < startsAtMs) return "예약";
    const endsAtMs = preview.endsAt ? Date.parse(preview.endsAt) : null;
    if (endsAtMs !== null && !Number.isNaN(endsAtMs) && nowMs > endsAtMs) return "만료";
    return "활성";
  }, [preview]);

  async function onSave() {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(routes.api.ops.banners(), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { ok?: boolean };
      setNotice(payload.ok ? "저장되었습니다." : "저장에 실패했습니다.");
    } catch {
      setNotice("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dashboard-ops-card min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid min-w-0 gap-3">
        <label className="dashboard-ops-row min-w-0 rounded-lg border border-transparent p-1 text-sm font-medium text-slate-700">
          메시지
          <textarea
            className="dashboard-ops-input mt-1 w-full min-w-0 resize-y rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            rows={3}
            value={form.message}
            onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
          />
        </label>
        <label className="dashboard-ops-row min-w-0 rounded-lg border border-transparent p-1 text-sm font-medium text-slate-700">
          링크 URL (선택)
          <input
            className="dashboard-ops-input mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            value={form.href}
            onChange={(event) => setForm((prev) => ({ ...prev, href: event.target.value }))}
            placeholder="https://... 또는 /dashboard/..."
          />
        </label>
        <label className="dashboard-ops-row min-w-0 rounded-lg border border-transparent p-1 text-sm font-medium text-slate-700">
          링크 라벨 (선택)
          <input
            className="dashboard-ops-input mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            value={form.label}
            onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
          />
        </label>
        <label className="dashboard-ops-row min-w-0 rounded-lg border border-transparent p-1 text-sm font-medium text-slate-700">
          레벨
          <select
            className="dashboard-ops-input mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            value={form.level}
            onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}
          >
            <option value="info">정보</option>
            <option value="warning">주의</option>
            <option value="maintenance">점검</option>
          </select>
        </label>
        <label className="dashboard-ops-row min-w-0 rounded-lg border border-transparent p-1 text-sm font-medium text-slate-700">
          startsAt (선택)
          <input
            type="datetime-local"
            className="dashboard-ops-input mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            value={isoToLocalInput(form.startsAt)}
            onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
          />
        </label>
        <label className="dashboard-ops-row min-w-0 rounded-lg border border-transparent p-1 text-sm font-medium text-slate-700">
          endsAt (선택)
          <input
            type="datetime-local"
            className="dashboard-ops-input mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            value={isoToLocalInput(form.endsAt)}
            onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))}
          />
        </label>
        <label className="dashboard-ops-row inline-flex min-w-0 items-center gap-2 rounded-lg border border-transparent p-1 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="dashboard-ops-input h-4 w-4 rounded border-slate-300 text-slate-900"
            checked={form.enabled}
            onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
          />
          활성화
        </label>
      </div>

      <div className="dashboard-ops-card min-w-0 rounded-lg border border-dashed border-slate-300 p-3 text-sm">
        <p className="mb-2 font-semibold text-slate-700">미리보기</p>
        <p className="mb-2 min-w-0 text-xs font-semibold text-slate-500">
          <span className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 leading-5 whitespace-nowrap">
            상태: {previewState}
          </span>
        </p>
        <p className="min-w-0 whitespace-pre-wrap break-words text-slate-800">
          {preview.enabled ? preview.message : "비활성(메시지가 비어있거나 토글 OFF)"}
        </p>
        {preview.href ? <p className="mt-2 min-w-0 break-all text-xs text-slate-500">{preview.href}</p> : null}
        {preview.label ? <p className="mt-1 min-w-0 break-words text-xs font-semibold text-slate-600">{preview.label}</p> : null}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          aria-disabled={saving}
          className="dashboard-ops-control rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSave}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {notice ? <p className="min-w-0 break-words text-sm text-slate-600">{notice}</p> : null}
      </div>
    </section>
  );
}
