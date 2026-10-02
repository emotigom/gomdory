"use client";

import { useEffect, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { loadPresenceName, savePresenceName } from "@/lib/presence/storage";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

const STATUS_LABELS = {
  degraded: "연결 지연",
  offline: "연결 불안정",
} as const;

type StudentPresencePanelProps = {
  shareCode: string;
  toolsEnabled?: string[] | null;
};

export default function StudentPresencePanel({ shareCode, toolsEnabled }: StudentPresencePanelProps) {
  const canPresence = hasToolEnabled(toolsEnabled, "presence");
  const [draftName, setDraftName] = useState("");
  const [savedName, setSavedName] = useState("");
  const { presence, presenceStatus, presenceSelfName, refreshPresence } = useLiveSync({
    mode: "viewer",
    shareCode,
    enableLiveSync: false,
    presence: canPresence
      ? {
          mode: "student",
          displayName: savedName,
        }
      : undefined,
  });

  useEffect(() => {
    const stored = loadPresenceName(shareCode);
    setDraftName(stored);
    setSavedName(stored);
  }, [shareCode]);

  const effectiveName = presenceSelfName ?? (savedName.trim() ? savedName.trim() : "익명");
  const statusLabel = STATUS_LABELS[presenceStatus as keyof typeof STATUS_LABELS] ?? null;

  const handleSave = async () => {
    savePresenceName(shareCode, draftName);
    setSavedName(draftName.trim());
    await refreshPresence();
  };

  if (!canPresence) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          참여중 {presence?.activeCount ?? 0}명
        </span>
        {statusLabel ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
            {statusLabel}
          </span>
        ) : null}
        <span className="text-xs text-slate-500">표시: {effectiveName}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          maxLength={12}
          placeholder="닉네임 입력 (선택)"
          className={cn(
            "h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900",
            "focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100",
          )}
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          className={cn(buttonTone("secondary", { size: "sm" }), "h-9 px-4 text-xs font-semibold")}
        >
          닉네임 변경
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        닉네임은 선택 사항이며, 참여자 수 집계에만 사용됩니다.
      </p>
    </div>
  );
}
