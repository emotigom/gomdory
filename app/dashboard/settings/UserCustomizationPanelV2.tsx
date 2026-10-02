"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonTone, cn, pressable, surface } from "@/app/_components/uiTokens";
import { routes } from "@/lib/standards/routes";
import { DEFAULT_TEACHER_UI_PREFS, mergeTeacherUiPrefs, type TeacherUiPrefs } from "@/lib/teacherPrefs/schema";
import { DASHBOARD_LAYOUT_TEMPLATES, getDashboardLayoutTemplate } from "@/lib/teacherPrefs/layoutTemplates";
import { deriveCurrentTemplateId } from "@/lib/teacherPrefs/customizeDraft";
import {
  type TeacherUiCustomPresetV2,
  createTeacherUiPresetV2,
  deleteTeacherUiPresetV2,
  renameTeacherUiPresetV2,
  sanitizeTeacherUiPresetV2List,
  TEACHER_UI_PRESET_V2_LIMIT,
} from "@/lib/teacherPrefs/customPresetV2";
import { applyTeacherPrefsToDocument, useTeacherPrefs } from "@/lib/teacherPrefs/useTeacherPrefs";

const BUILTIN_PRESETS: Array<{ id: string; label: string; prefs: Partial<TeacherUiPrefs> }> = [
  { id: "safe-default", label: "SSOT 기본", prefs: {} },
  {
    id: "focus-dark",
    label: "집중 다크",
    prefs: {
      theme: "dark",
      backgroundMode: "color",
      backgroundColor: "#0f172a",
      textColor: "#e2e8f0",
      accentColor: "#38bdf8",
    },
  },
];

const FONT_LABELS: Record<TeacherUiPrefs["fontFamily"], string> = {
  suit: "SUIT",
  pretendard: "Pretendard",
  notoSansKr: "Noto Sans KR",
  system: "System",
};

const PREVIEW_SENTENCE = "가나다 ABC 123 — 빠른 갈무리와 안전한 운영";

function TemplateGlyph({ tone }: { tone: "balanced" | "dense" | "spacious" | "icon" | "minimal" | "classroom" | "creator" }) {
  const base = "fill-none stroke-current";
  if (tone === "dense") return <svg viewBox="0 0 48 32" className="h-8 w-full"><rect x="3" y="4" width="42" height="6" rx="2" className={base} strokeWidth="2"/><rect x="3" y="13" width="20" height="6" rx="2" className={base} strokeWidth="2"/><rect x="25" y="13" width="20" height="6" rx="2" className={base} strokeWidth="2"/><rect x="3" y="22" width="42" height="6" rx="2" className={base} strokeWidth="2"/></svg>;
  if (tone === "spacious") return <svg viewBox="0 0 48 32" className="h-8 w-full"><rect x="4" y="4" width="40" height="9" rx="3" className={base} strokeWidth="2"/><rect x="4" y="18" width="18" height="10" rx="3" className={base} strokeWidth="2"/><rect x="26" y="18" width="18" height="10" rx="3" className={base} strokeWidth="2"/></svg>;
  if (tone === "icon") return <svg viewBox="0 0 48 32" className="h-8 w-full"><circle cx="9" cy="8" r="4" className={base} strokeWidth="2"/><circle cx="24" cy="8" r="4" className={base} strokeWidth="2"/><circle cx="39" cy="8" r="4" className={base} strokeWidth="2"/><rect x="4" y="16" width="40" height="11" rx="3" className={base} strokeWidth="2"/></svg>;
  if (tone === "minimal") return <svg viewBox="0 0 48 32" className="h-8 w-full"><rect x="4" y="4" width="40" height="24" rx="2" className={base} strokeWidth="2"/><line x1="10" y1="12" x2="38" y2="12" className={base} strokeWidth="2"/><line x1="10" y1="18" x2="30" y2="18" className={base} strokeWidth="2"/></svg>;
  if (tone === "classroom") return <svg viewBox="0 0 48 32" className="h-8 w-full"><rect x="4" y="4" width="40" height="8" rx="2" className={base} strokeWidth="2"/><rect x="4" y="15" width="12" height="13" rx="2" className={base} strokeWidth="2"/><rect x="18" y="15" width="12" height="13" rx="2" className={base} strokeWidth="2"/><rect x="32" y="15" width="12" height="13" rx="2" className={base} strokeWidth="2"/></svg>;
  if (tone === "creator") return <svg viewBox="0 0 48 32" className="h-8 w-full"><path d="M4 24h40" className={base} strokeWidth="2"/><rect x="4" y="4" width="18" height="17" rx="3" className={base} strokeWidth="2"/><path d="m26 7 7 6-7 6" className={base} strokeWidth="2"/><path d="M34 7h10v12H34z" className={base} strokeWidth="2"/></svg>;
  return <svg viewBox="0 0 48 32" className="h-8 w-full"><rect x="4" y="4" width="40" height="8" rx="2" className={base} strokeWidth="2"/><rect x="4" y="15" width="26" height="13" rx="2" className={base} strokeWidth="2"/><rect x="33" y="15" width="11" height="13" rx="2" className={base} strokeWidth="2"/></svg>;
}

export default function UserCustomizationPanelV2() {
  const { prefs, setPrefs, resetPrefs } = useTeacherPrefs();
  const [draft, setDraft] = useState<TeacherUiPrefs>(prefs);
  const [savedSnapshot, setSavedSnapshot] = useState<TeacherUiPrefs>(prefs);
  const [undoStack, setUndoStack] = useState<TeacherUiPrefs[]>([]);
  const [presets, setPresets] = useState<TeacherUiCustomPresetV2[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetSearch, setPresetSearch] = useState("");
  const [presetSort, setPresetSort] = useState<"recent" | "name">("recent");
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(() => deriveCurrentTemplateId(prefs));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(prefs);
    setSavedSnapshot(prefs);
    setUndoStack([]);
    setCurrentTemplateId(deriveCurrentTemplateId(prefs));
  }, [prefs]);

  useEffect(() => {
    applyTeacherPrefsToDocument(draft);
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const response = await fetch(routes.api.me.uiPrefsPresets(), { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { presets?: unknown; error?: { message?: string } } | null;
      if (!response.ok) {
        if (!cancelled) setError(payload?.error?.message ?? "프리셋을 불러오지 못했습니다.");
        return;
      }
      if (!cancelled) {
        setPresets(sanitizeTeacherUiPresetV2List(payload?.presets));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(savedSnapshot), [draft, savedSnapshot]);
  const currentTemplate = useMemo(
    () => (currentTemplateId ? getDashboardLayoutTemplate(currentTemplateId) : null),
    [currentTemplateId],
  );

  const filteredPresets = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    const list = presets.filter((preset) => (!q ? true : preset.name.toLowerCase().includes(q)));
    return list.sort((a, b) => {
      if (presetSort === "name") return a.name.localeCompare(b.name, "ko");
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [presetSearch, presetSort, presets]);

  const previewBackground =
    draft.backgroundMode === "gradient"
      ? draft.backgroundGradient
      : draft.backgroundMode === "image" && draft.backgroundImageUrl
        ? `url(${draft.backgroundImageUrl}) center / cover no-repeat`
        : draft.backgroundColor;

  const updateDraft = (patch: Partial<TeacherUiPrefs>) => {
    setDraft((current) => {
      setUndoStack((prev) => [...prev.slice(-29), current]);
      const next = mergeTeacherUiPrefs(current, patch);
      setCurrentTemplateId(deriveCurrentTemplateId(next));
      return next;
    });
  };

  const applyLayoutTemplate = (templateId: string) => {
    const template = getDashboardLayoutTemplate(templateId);
    if (!template) return;
    if (dirty && currentTemplateId !== template.id) {
      const confirmed = window.confirm("현재 미저장 변경이 있습니다. 템플릿을 바꾸면 미리보기가 즉시 갱신됩니다.");
      if (!confirmed) return;
    }
    updateDraft(template.tokenPreset);
    setCurrentTemplateId(template.id);
    setNotice(`Template ${template.name} 적용됨`);
  };

  const applyBuiltinPreset = (presetId: string) => {
    const preset = BUILTIN_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    updateDraft(preset.prefs);
    setNotice("임시 변경이 적용되었습니다. 저장 전까지는 미리보기 상태입니다.");
  };

  const applyCustomPreset = (preset: TeacherUiCustomPresetV2) => {
    updateDraft(preset.prefs);
    setNotice(`프리셋 \"${preset.name}\"을(를) 미리보기에 적용했습니다.`);
  };

  const withRollback = async (next: TeacherUiCustomPresetV2[], method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => {
    const previous = presets;
    setPresets(next);
    setError(null);
    const response = await fetch(routes.api.me.uiPrefsPresets(), {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { presets?: unknown; error?: { message?: string } } | null;
    if (!response.ok) {
      setPresets(previous);
      setError(payload?.error?.message ?? "요청에 실패해 이전 상태로 되돌렸습니다.");
      return;
    }
    setPresets(sanitizeTeacherUiPresetV2List(payload?.presets));
  };

  const createPreset = async () => {
    const local = createTeacherUiPresetV2(presets, { name: presetName, prefs: draft });
    if (!local.ok) {
      setError(local.message);
      return;
    }
    setPresetName("");
    await withRollback(local.presets, "POST", { name: presetName, prefs: draft });
    setNotice("프리셋을 저장했습니다.");
  };

  const renamePreset = async (id: string, name: string) => {
    const nextName = window.prompt("새 프리셋 이름", name);
    if (!nextName) return;
    const local = renameTeacherUiPresetV2(presets, { id, name: nextName });
    if (!local.ok) {
      setError(local.message);
      return;
    }
    await withRollback(local.presets, "PATCH", { id, name: nextName });
  };

  const removePreset = async (id: string) => {
    const local = deleteTeacherUiPresetV2(presets, id);
    if (!local.ok) {
      setError(local.message);
      return;
    }
    await withRollback(local.presets, "DELETE", { id });
  };

  return (
    <section className={cn(surface.card, "space-y-6 p-6")} data-testid="dashboard-custom-v2-root">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-[var(--ink)]">사용자 커스텀 V2</h2>
        <p className="text-sm text-slate-500">프리셋 CRUD + 미리보기/되돌리기 + 안전 가드가 포함된 확장 모드입니다.</p>
      </header>

      <div className={cn("sticky top-2 z-10 rounded-md border px-3 py-2 text-xs font-semibold", dirty ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{dirty ? "Unsaved changes · 저장 전 미리보기 상태" : "저장된 상태와 동기화됨"}</span>
          <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[11px]">
            현재 템플릿: {currentTemplate?.name ?? "커스텀"}
          </span>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-700">Preview Frame</p>
        <div className="rounded-xl border border-slate-200 p-4" style={{ background: previewBackground, color: draft.textColor, fontFamily: "var(--dashboard-font-family)", fontSize: `${draft.baseFontSize}px` }}>
          <div className="mb-3 flex items-center justify-between rounded-lg bg-white/75 px-3 py-2 backdrop-blur" style={{ borderRadius: draft.dashboardCardRadius }}>
            <span className="font-semibold">Dashboard preview</span>
            <span className="text-xs" style={{ color: draft.accentColor }}>live</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-white/80 p-3" style={{ borderRadius: draft.dashboardCardRadius }}>
              <p className="text-xs opacity-70">Widget A</p>
              <p className="font-semibold">오늘의 진행 요약</p>
            </div>
            <div className="rounded-lg border bg-white/80 p-3" style={{ borderRadius: draft.dashboardCardRadius }}>
              <p className="text-xs opacity-70">Widget B</p>
              <p className="font-semibold">프리셋 영향 미리보기</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700">Layout templates</p>
          <button
            type="button"
            onClick={() => {
              if (!currentTemplate) return;
              updateDraft(currentTemplate.tokenPreset);
              setNotice(`${currentTemplate.name} 기본값으로 되돌렸습니다.`);
            }}
            disabled={!currentTemplate}
            className={cn(buttonTone("secondary", { size: "sm" }), "!rounded-md")}
          >
            Reset to template defaults
          </button>
        </div>
        <p className="text-[11px] text-slate-500">현재 템플릿의 밀도/폰트/카드 반경/강조색만 되돌립니다. 저장 전에는 미리보기로만 반영됩니다.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {DASHBOARD_LAYOUT_TEMPLATES.map((template) => {
            const selected = currentTemplateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => applyLayoutTemplate(template.id)}
                className={cn(
                  "space-y-2 rounded-md border px-3 py-2 text-left transition",
                  selected ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                <TemplateGlyph tone={template.icon} />
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold">{template.name}</p>
                    {selected ? <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">현재</span> : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {template.badges.map((badge) => (
                      <span key={badge} className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {badge}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">추천: {template.recommendation}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-semibold text-slate-700">기본 프리셋</p>
        <div className="flex flex-wrap gap-2">
          {BUILTIN_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => applyBuiltinPreset(preset.id)} className={cn(pressable.raised, "rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700")}>{preset.label}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input value={presetName} onChange={(event) => setPresetName(event.target.value)} maxLength={40} placeholder="새 프리셋 이름" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
        <button type="button" onClick={createPreset} className={buttonTone("primary", { size: "sm", tone: "slate" })}>프리셋 저장 ({presets.length}/{TEACHER_UI_PRESET_V2_LIMIT})</button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
        <input value={presetSearch} onChange={(event) => setPresetSearch(event.target.value)} placeholder="프리셋 검색" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
        <select value={presetSort} onChange={(event) => setPresetSort(event.target.value as "recent" | "name")} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="recent">최근 수정순</option>
          <option value="name">이름순</option>
        </select>
      </div>

      <ul className="space-y-2" data-testid="dashboard-custom-v2-presets">
        {filteredPresets.map((preset) => (
          <li key={preset.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-700">{preset.name}</p>
              <p className="text-[11px] text-slate-500">{new Date(preset.updatedAt).toLocaleString("ko-KR")}</p>
            </div>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => applyCustomPreset(preset)} className={cn(buttonTone("secondary", { size: "sm" }), "!px-2")}>적용</button>
              <button type="button" className="text-slate-600 underline" onClick={() => renamePreset(preset.id, preset.name)}>편집</button>
              <button type="button" className="text-rose-600 underline" onClick={() => removePreset(preset.id)}>삭제</button>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block space-y-2 text-xs font-semibold text-slate-700">Theme
          <select value={draft.theme} onChange={(event) => updateDraft({ theme: event.target.value as TeacherUiPrefs["theme"] })} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="light">light</option><option value="dark">dark</option><option value="custom">custom</option>
          </select>
        </label>
        <label className="block space-y-2 text-xs font-semibold text-slate-700">Background color
          <input type="color" value={draft.backgroundColor} onChange={(event) => updateDraft({ backgroundColor: event.target.value })} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2" />
        </label>
        <label className="block space-y-2 text-xs font-semibold text-slate-700">Background mode
          <select value={draft.backgroundMode} onChange={(event) => updateDraft({ backgroundMode: event.target.value as TeacherUiPrefs["backgroundMode"] })} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="color">color</option><option value="gradient">gradient</option><option value="image">image(URL/preset only)</option>
          </select>
        </label>
        <label className="block space-y-2 text-xs font-semibold text-slate-700">Background image URL
          <input value={draft.backgroundImageUrl ?? ""} onChange={(event) => updateDraft({ backgroundImageUrl: event.target.value || null })} placeholder="https://..." className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-2 text-xs font-semibold text-slate-700">Font family
          <select value={draft.fontFamily} onChange={(event) => updateDraft({ fontFamily: event.target.value as TeacherUiPrefs["fontFamily"] })} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            {Object.entries(FONT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium" style={{ fontFamily: "var(--dashboard-font-family)" }}>{PREVIEW_SENTENCE}</p>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setPrefs(draft); setSavedSnapshot(draft); setUndoStack([]); setNotice("저장되었습니다."); }} className={buttonTone("primary", { size: "sm", tone: "slate" })}>저장</button>
        <button type="button" onClick={() => {
          const previous = undoStack.at(-1);
          if (!previous) return;
          setUndoStack((stack) => stack.slice(0, -1));
          setDraft(previous);
          setNotice("직전 변경을 되돌렸습니다.");
        }} disabled={undoStack.length === 0} className={buttonTone("secondary", { size: "sm" })}>Undo</button>
        <button type="button" onClick={() => { setDraft(savedSnapshot); setUndoStack([]); setNotice("마지막 저장 상태로 되돌렸습니다."); }} disabled={!dirty} className={buttonTone("secondary", { size: "sm" })}>마지막 저장으로 되돌리기</button>
        <button type="button" onClick={() => { setDraft(DEFAULT_TEACHER_UI_PREFS); resetPrefs(); setSavedSnapshot(DEFAULT_TEACHER_UI_PREFS); setUndoStack([]); setNotice("기본 프리셋으로 초기화했습니다."); }} className={buttonTone("primary", { size: "sm", tone: "rose" })}>기본 프리셋 초기화</button>
      </div>

      {notice ? <p className="text-xs font-semibold text-emerald-700">{notice}</p> : null}
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </section>
  );
}
