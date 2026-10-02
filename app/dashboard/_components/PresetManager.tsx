"use client";

import { useState } from "react";

import CardTile from "@/app/_components/CardTile";
import { buttonTone, cn, pill } from "@/app/_components/uiTokens";

import {
  createPresetId,
  getDefaultPresets,
  type ClassPreset,
  type ClassPresetCardSize,
  type ClassPresetTarget,
} from "../presets";

const targetOptions: Array<{ value: ClassPresetTarget; label: string }> = [
  { value: "class", label: "수업" },
  { value: "present", label: "발표" },
  { value: "share", label: "학생 공유" },
];

const sizeOptions: Array<{ value: ClassPresetCardSize; label: string }> = [
  { value: "s", label: "작게" },
  { value: "m", label: "보통" },
  { value: "l", label: "크게" },
];

type PresetManagerProps = {
  presets: ClassPreset[];
  onChange: (presets: ClassPreset[]) => void;
  onClose: () => void;
};

type PresetPatch = Omit<Partial<ClassPreset>, "settings"> & {
  settings?: Partial<ClassPreset["settings"]>;
};

export default function PresetManager({ presets, onChange, onClose }: PresetManagerProps) {
  const [draftName, setDraftName] = useState("");
  const [draftTarget, setDraftTarget] = useState<ClassPresetTarget>("class");
  const [draftDescription, setDraftDescription] = useState("");

  const canAdd = draftName.trim().length > 0;

  const presetCount = presets.length;

  const updatePreset = (id: string, patch: PresetPatch) => {
    onChange(
      presets.map((preset) =>
        preset.id === id
          ? {
              ...preset,
              ...patch,
              settings: patch.settings ? { ...preset.settings, ...patch.settings } : preset.settings,
            }
          : preset,
      ),
    );
  };

  const removePreset = (id: string) => {
    onChange(presets.filter((preset) => preset.id !== id));
  };

  const movePreset = (id: string, direction: "up" | "down") => {
    const index = presets.findIndex((preset) => preset.id === id);
    if (index < 0) return;
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= presets.length) return;
    const next = [...presets];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    onChange(next);
  };

  const resetDefaults = () => {
    if (!window.confirm("프리셋을 기본값으로 되돌릴까요?")) return;
    onChange(getDefaultPresets());
  };

  const handleAdd = () => {
    if (!canAdd) return;
    const newPreset: ClassPreset = {
      id: createPresetId(),
      name: draftName.trim(),
      description: draftDescription.trim() || undefined,
      target: draftTarget,
      settings: {
        safeMode: true,
        focusMode: false,
        cardSize: "m",
        density: "comfortable",
        projectorPreset: false,
      },
    };
    onChange([...presets, newPreset]);
    setDraftName("");
    setDraftDescription("");
    setDraftTarget("class");
  };

  return (
    <CardTile variant="present" className="border-slate-200 bg-white">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">관리 패널</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">프리셋 관리</h3>
            <p className="mt-1 text-sm text-slate-600">프리셋 이름, 순서, 설정을 정리합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetDefaults}
              data-interactive="true"
              className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
            >
              기본값 복원
            </button>
            <button
              type="button"
              onClick={onClose}
              data-interactive="true"
              className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
            >
              닫기
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="preset-name">
                새 프리셋 이름
              </label>
              <input
                id="preset-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="예: 집중 발표"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="preset-target">
                대상
              </label>
              <select
                id="preset-target"
                value={draftTarget}
                onChange={(event) => setDraftTarget(event.target.value as ClassPresetTarget)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                {targetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1.5fr_0.5fr]">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="preset-description">
                설명 (선택)
              </label>
              <input
                id="preset-description"
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                placeholder="간단한 안내 문구"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              data-interactive="true"
              disabled={!canAdd}
              className={cn(
                buttonTone("primary", { size: "md", tone: "indigo" }),
                "min-h-[44px]",
                !canAdd ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              추가
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>총 {presetCount}개 프리셋</span>
        </div>

        <div className="space-y-4">
          {presets.map((preset, index) => (
            <div key={preset.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(pill.badge, "bg-slate-100 text-slate-700")}>#{index + 1}</span>
                  <span className={cn(pill.badge, "bg-slate-50 text-slate-700")}>{
                    targetOptions.find((option) => option.value === preset.target)?.label
                  }</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => movePreset(preset.id, "up")}
                    data-interactive="true"
                    className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                  >
                    위로
                  </button>
                  <button
                    type="button"
                    onClick={() => movePreset(preset.id, "down")}
                    data-interactive="true"
                    className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                  >
                    아래로
                  </button>
                  <button
                    type="button"
                    onClick={() => removePreset(preset.id)}
                    data-interactive="true"
                    className={cn(
                      buttonTone("secondary", { size: "sm" }),
                      "min-h-[44px] border-red-200 text-red-600 hover:bg-red-50",
                    )}
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1.5fr_1fr]">
                <input
                  value={preset.name}
                  onChange={(event) => updatePreset(preset.id, { name: event.target.value })}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                />
                <select
                  value={preset.target}
                  onChange={(event) => updatePreset(preset.id, { target: event.target.value as ClassPresetTarget })}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {targetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1.5fr_1fr]">
                <input
                  value={preset.description ?? ""}
                  onChange={(event) => updatePreset(preset.id, { description: event.target.value })}
                  placeholder="설명"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                />
                <select
                  value={preset.settings.density ?? "comfortable"}
                  onChange={(event) =>
                    updatePreset(preset.id, {
                      settings: { density: event.target.value as "comfortable" | "compact" },
                    })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  <option value="comfortable">밀도: 편안함</option>
                  <option value="compact">밀도: 컴팩트</option>
                </select>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-interactive="true"
                  onClick={() => updatePreset(preset.id, { settings: { safeMode: !preset.settings.safeMode } })}
                  className={cn(
                    "min-h-[44px] rounded-full px-4 text-[13px] font-semibold",
                    preset.settings.safeMode
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-700",
                  )}
                >
                  Safe {preset.settings.safeMode ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  data-interactive="true"
                  onClick={() => updatePreset(preset.id, { settings: { focusMode: !preset.settings.focusMode } })}
                  className={cn(
                    "min-h-[44px] rounded-full px-4 text-[13px] font-semibold",
                    preset.settings.focusMode
                      ? "bg-indigo-500 text-white"
                      : "bg-slate-100 text-slate-700",
                  )}
                >
                  Focus {preset.settings.focusMode ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  data-interactive="true"
                  onClick={() =>
                    updatePreset(preset.id, { settings: { projectorPreset: !preset.settings.projectorPreset } })
                  }
                  className={cn(
                    "min-h-[44px] rounded-full px-4 text-[13px] font-semibold",
                    preset.settings.projectorPreset
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700",
                  )}
                >
                  프로젝터 {preset.settings.projectorPreset ? "ON" : "OFF"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {sizeOptions.map((option) => {
                  const active = option.value === preset.settings.cardSize;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      data-interactive="true"
                      onClick={() => updatePreset(preset.id, { settings: { cardSize: option.value } })}
                      className={cn(
                        "min-h-[44px] rounded-full px-4 text-[13px] font-semibold",
                        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700",
                      )}
                    >
                      카드 {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardTile>
  );
}
