"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonTone, cn, pressable, surface } from "@/app/_components/uiTokens";
import { DEFAULT_TEACHER_UI_PREFS, type TeacherUiPrefs } from "@/lib/teacherPrefs/schema";
import { applyTeacherPrefsToDocument, useTeacherPrefs } from "@/lib/teacherPrefs/useTeacherPrefs";

const PRESETS: Array<{ id: string; label: string; prefs: Partial<TeacherUiPrefs> }> = [
  { id: "safe-default", label: "SSOT 기본", prefs: {} },
  {
    id: "focus-dark",
    label: "집중 다크",
    prefs: { theme: "dark", backgroundMode: "color", backgroundColor: "#0f172a", textColor: "#e2e8f0", accentColor: "#38bdf8" },
  },
  {
    id: "paper",
    label: "페이퍼",
    prefs: { theme: "light", backgroundMode: "gradient", backgroundGradient: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)", textColor: "#1f2937", accentColor: "#c2410c" },
  },
];

export default function UserCustomizationPanel() {
  const { prefs, setPrefs, resetPrefs } = useTeacherPrefs();
  const [draft, setDraft] = useState<TeacherUiPrefs>(prefs);

  useEffect(() => {
    setDraft(prefs);
  }, [prefs]);

  useEffect(() => {
    applyTeacherPrefsToDocument(draft);
  }, [draft]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(prefs), [draft, prefs]);

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setDraft((current) => ({ ...current, ...preset.prefs }));
  };

  const cancelDraft = () => {
    setDraft(prefs);
    applyTeacherPrefsToDocument(prefs);
  };

  const saveDraft = () => {
    setPrefs(draft);
  };

  const resetAll = () => {
    setDraft(DEFAULT_TEACHER_UI_PREFS);
    applyTeacherPrefsToDocument(DEFAULT_TEACHER_UI_PREFS);
    resetPrefs();
  };

  return (
    <section className={cn(surface.card, "space-y-6 p-6")}>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brown)]">User Custom</p>
        <h2 className="text-xl font-semibold text-[var(--ink)]">사용자 커스텀 페이지</h2>
        <p className="text-sm text-slate-500">테마/배경/폰트/밀도를 실시간으로 미리 보고, 저장/취소/되돌리기로 안전하게 관리하세요.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">프리셋</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button key={preset.id} type="button" onClick={() => applyPreset(preset.id)} className={cn(pressable.raised, "rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700")}>{preset.label}</button>
              ))}
            </div>
          </div>

          <label className="block space-y-2 text-xs font-semibold text-slate-700">Theme
            <select value={draft.theme} onChange={(event) => setDraft((prev) => ({ ...prev, theme: event.target.value as TeacherUiPrefs["theme"] }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="light">light</option><option value="dark">dark</option><option value="custom">custom</option>
            </select>
          </label>

          <label className="block space-y-2 text-xs font-semibold text-slate-700">Background
            <select value={draft.backgroundMode} onChange={(event) => setDraft((prev) => ({ ...prev, backgroundMode: event.target.value as TeacherUiPrefs["backgroundMode"] }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="color">color</option><option value="gradient">gradient</option><option value="image">image</option>
            </select>
          </label>

          <label className="block space-y-2 text-xs font-semibold text-slate-700">Background color
            <input type="color" value={draft.backgroundColor} onChange={(event) => setDraft((prev) => ({ ...prev, backgroundColor: event.target.value }))} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2" />
          </label>

          <label className="block space-y-2 text-xs font-semibold text-slate-700">Gradient
            <input type="text" value={draft.backgroundGradient} onChange={(event) => setDraft((prev) => ({ ...prev, backgroundGradient: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
          </label>

          <label className="block space-y-2 text-xs font-semibold text-slate-700">Image URL
            <input type="url" value={draft.backgroundImageUrl ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, backgroundImageUrl: event.target.value || null }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
          </label>

          <label className="block space-y-2 text-xs font-semibold text-slate-700">Font
            <select value={draft.fontFamily} onChange={(event) => setDraft((prev) => ({ ...prev, fontFamily: event.target.value as TeacherUiPrefs["fontFamily"] }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="suit">SUIT (기본 프리로드)</option>
              <option value="pretendard">Pretendard (on-demand preload)</option>
              <option value="notoSansKr">Noto Sans KR (on-demand preload)</option>
              <option value="system">System</option>
            </select>
          </label>

          <label className="block space-y-2 text-xs font-semibold text-slate-700">Density
            <select value={draft.density} onChange={(event) => setDraft((prev) => ({ ...prev, density: event.target.value as TeacherUiPrefs["density"] }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="spacious">spacious</option><option value="comfortable">comfortable</option><option value="compact">compact</option>
            </select>
          </label>

          <label className="block space-y-2 text-xs font-semibold text-slate-700">최소 폰트 크기 가드 ({draft.baseFontSize}px)
            <input type="range" min={14} max={20} step={1} value={draft.baseFontSize} onChange={(event) => setDraft((prev) => ({ ...prev, baseFontSize: Number(event.target.value) }))} className="w-full" />
          </label>
        </div>

        <div className={cn(surface.subtle, "space-y-3 p-4")}>
          <p className="text-xs font-semibold text-slate-500">실시간 미리보기</p>
          <div className="dashboard-preview-card space-y-2 border border-slate-300 bg-white p-4">
            <p className="text-base font-semibold">미리보기 타이틀</p>
            <p className="text-sm text-slate-500">최소 대비/최소 폰트 크기 가드가 적용됩니다.</p>
            <button type="button" disabled className={cn(buttonTone("primary", { size: "sm", tone: "slate" }), "text-xs disabled:cursor-not-allowed disabled:opacity-60")}>
              액션 버튼 · 준비 중
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" onClick={resetAll} className={cn(buttonTone("secondary", { size: "sm", muted: true }), "text-xs")}>Reset</button>
            <button type="button" onClick={cancelDraft} className={cn(buttonTone("secondary", { size: "sm" }), "text-xs")}>취소</button>
            <button type="button" onClick={saveDraft} disabled={!dirty} className={cn(buttonTone("primary", { size: "sm", tone: "slate" }), "text-xs disabled:opacity-50")}>저장</button>
          </div>
        </div>
      </div>
    </section>
  );
}
