"use client";

import { useState } from "react";

import CardTile from "@/app/_components/CardTile";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

const STATUS_LABELS = {
  degraded: "연결 지연",
  offline: "연결 불안정",
} as const;

type PresencePanelProps = {
  boardId: string | null;
  shareCode: string | null;
  toolsEnabled?: string[] | null;
};

export default function PresencePanel({ boardId, shareCode, toolsEnabled }: PresencePanelProps) {
  const canPresence = hasToolEnabled(toolsEnabled, "presence");
  const [notice, setNotice] = useState<string | null>(null);
  const { presence, presenceStatus, refreshPresence, resetPresence, publish } = useLiveSync({
    mode: "teacher",
    boardId: boardId ?? undefined,
    enableLiveSync: false,
    presence: canPresence
      ? {
          mode: "observer",
          activeWithinSeconds: 90,
        }
      : undefined,
  });

  const statusLabel = STATUS_LABELS[presenceStatus as keyof typeof STATUS_LABELS] ?? null;
  const activeList = presence?.activeList.slice(0, 12) ?? [];

  const handleReset = async () => {
    const ok = await resetPresence();
    setNotice(ok ? "출석을 리셋했습니다." : "출석 리셋에 실패했어요.");
  };

  const handleNudge = async () => {
    await publish({ presenceNudgeAt: Date.now() });
    setNotice("학생 화면에 출석 알림을 보냈습니다.");
  };

  if (!canPresence) {
    return null;
  }

  return (
    <CardTile variant="dense" subdued className="border-indigo-100">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">라이브 출석</p>
            <p className="text-xs text-gray-600">최근 90초 참여자 기준</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
            {presence?.activeCount ?? 0}명
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span>공유 코드: {shareCode ?? "없음"}</span>
          {statusLabel ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {statusLabel}
            </span>
          ) : null}
        </div>
        {activeList.length > 0 ? (
          <div className="grid gap-1 text-xs text-gray-700">
            {activeList.map((entry) => (
              <div key={`${entry.name}-${entry.lastSeenAt}`} className="flex items-center justify-between">
                <span className="truncate font-medium">{entry.name}</span>
                <span className="text-[11px] text-gray-400">{new Date(entry.lastSeenAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">최근 참여자가 없습니다.</p>
        )}
        {notice ? <p className="text-xs font-semibold text-indigo-600">{notice}</p> : null}
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => void refreshPresence()}
            disabled={!boardId}
            className={cn(buttonTone("secondary", { size: "sm" }), "text-xs")}
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={!boardId}
            className={cn(buttonTone("secondary", { size: "sm" }), "text-xs")}
          >
            출석 리셋
          </button>
          <button
            type="button"
            onClick={() => void handleNudge()}
            disabled={!boardId}
            className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "text-xs")}
          >
            참여 독려
          </button>
        </div>
      </div>
    </CardTile>
  );
}
