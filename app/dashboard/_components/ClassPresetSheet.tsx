"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";

import CardTile from "@/app/_components/CardTile";
import useDismissableLayer from "@/app/_components/useDismissableLayer";
import { buttonTone, cn, pill } from "@/app/_components/uiTokens";
import { apiFetch } from "@/lib/http/apiFetch";
import { routes } from "@/lib/standards/routes";

import ShareLinkBlock from "./ShareLinkBlock";
import { buildShareLinkInfo, type ShareLinkInfo } from "../shareLinks";
import type { ClassPreset, ClassPresetCardSize, ClassPresetSettings, ClassPresetTarget } from "../presets";

const targetLabels: Record<ClassPresetTarget, { title: string; description: string }> = {
  class: { title: "수업 프리셋", description: "교실 화면을 바로 실행합니다." },
  present: { title: "발표 프리셋", description: "무대/프로젝터 발표를 시작합니다." },
  share: { title: "학생 공유 프리셋", description: "학생 피드 공유를 바로 엽니다." },
};

const sizeOptions: Array<{ value: ClassPresetCardSize; label: string }> = [
  { value: "s", label: "작게" },
  { value: "m", label: "보통" },
  { value: "l", label: "크게" },
];

type ClassPresetSheetProps = {
  isOpen: boolean;
  target: ClassPresetTarget;
  presets: ClassPreset[];
  initialPresetId?: string | null;
  anchorRef?: RefObject<HTMLElement | null>;
  helper?: ReactNode;
  disabled?: boolean;
  boardId?: string | null;
  shareCode?: string | null;
  shareInfo?: ShareLinkInfo | null;
  onShareReady?: (info: ShareLinkInfo) => void;
  onClose: () => void;
  onRun: (
    event: MouseEvent<HTMLButtonElement>,
    preset: ClassPreset,
    settings: ClassPresetSettings,
    shareInfo?: ShareLinkInfo | null,
  ) => void;
};

export default function ClassPresetSheet({
  isOpen,
  target,
  presets,
  initialPresetId,
  anchorRef,
  helper,
  disabled,
  boardId,
  shareCode,
  shareInfo,
  onShareReady,
  onClose,
  onRun,
}: ClassPresetSheetProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialPresetId ?? null);
  const [localSettings, setLocalSettings] = useState<ClassPresetSettings | null>(null);
  const [localShareInfo, setLocalShareInfo] = useState<ShareLinkInfo | null>(shareInfo ?? null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const availablePresets = useMemo(
    () => presets.filter((preset) => preset.target === target),
    [presets, target],
  );

  const selectedPreset = useMemo(() => {
    if (!selectedId) return availablePresets[0] ?? null;
    return availablePresets.find((preset) => preset.id === selectedId) ?? availablePresets[0] ?? null;
  }, [availablePresets, selectedId]);

  useEffect(() => {
    if (!isOpen) return;
    const initial =
      availablePresets.find((preset) => preset.id === initialPresetId) ?? availablePresets[0] ?? null;
    setSelectedId(initial?.id ?? null);
    setLocalSettings(initial ? { ...initial.settings } : null);
    setShareError(null);
    setShareLoading(false);
  }, [availablePresets, initialPresetId, isOpen]);

  useEffect(() => {
    if (!selectedPreset) return;
    setLocalSettings((current) => {
      if (!current || selectedPreset.id !== selectedId) {
        return { ...selectedPreset.settings };
      }
      return current;
    });
  }, [selectedId, selectedPreset]);

  useEffect(() => {
    if (!isOpen || target === "class") return;

    if (shareInfo) {
      setLocalShareInfo(shareInfo);
      return;
    }

    if (boardId && shareCode) {
      const resolved = buildShareLinkInfo(boardId, shareCode);
      setLocalShareInfo(resolved);
    } else {
      setLocalShareInfo(null);
    }
  }, [boardId, isOpen, shareCode, shareInfo, target]);

  useDismissableLayer({
    isOpen,
    setIsOpen: (next) => {
      if (!next) {
        onClose();
      }
    },
    layerRef,
    anchorRef,
  });

  if (!isOpen || !selectedPreset || !localSettings) {
    return null;
  }

  const header = targetLabels[target];

  const updateSettings = (patch: Partial<ClassPresetSettings>) => {
    setLocalSettings((current) => (current ? { ...current, ...patch } : current));
  };

  const runLabel = target === "class" ? "수업 시작" : target === "present" ? "발표 실행" : "공유 실행";
  const isShareTarget = target === "present" || target === "share";
  const runDisabled = Boolean(disabled || (isShareTarget && shareLoading));

  const ensureShareInfo = async () => {
    if (!boardId) {
      setShareError("보드를 먼저 선택해 주세요.");
      return null;
    }

    setShareLoading(true);
    setShareError(null);

    try {
      const path = routes.api.boards.shareEnsure(boardId);
      if (process.env.NODE_ENV === "development") {
        console.debug("[shareEnsure]", path, "start");
      }
      const response = await apiFetch(path, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok: true;
            boardId: string;
            code: string;
            shareUrl: string;
            presentUrl: string;
          }
        | { ok?: false; message?: string }
        | null;

      if (!response.ok || !payload || payload.ok !== true || !payload.code) {
        const message =
          payload && "message" in payload && payload.message
            ? payload.message
            : "공유 링크를 준비하지 못했습니다.";
        console.warn("share ensure failed", {
          boardId,
          status: response.status,
          requestId: response.headers.get("x-request-id"),
          pathname: routes.api.boards.shareEnsure(boardId),
          message,
        });
        if (process.env.NODE_ENV === "development") {
          console.debug("[shareEnsure]", path, false);
        }
        setShareError(message);
        return null;
      }

      if (process.env.NODE_ENV === "development") {
        console.debug("[shareEnsure]", path, true);
      }

      const nextInfo: ShareLinkInfo = {
        boardId: payload.boardId,
        code: payload.code,
        shareUrl: payload.shareUrl,
        presentUrl: payload.presentUrl,
      };

      setLocalShareInfo(nextInfo);
      onShareReady?.(nextInfo);
      return nextInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : "공유 링크를 준비하지 못했습니다.";
      console.warn("share ensure request errored", {
        boardId,
        message,
        pathname: routes.api.boards.shareEnsure(boardId),
      });
      if (process.env.NODE_ENV === "development") {
        console.debug("[shareEnsure]", routes.api.boards.shareEnsure(boardId), false);
      }
      setShareError(message);
      return null;
    } finally {
      setShareLoading(false);
    }
  };

  const handleRunClick = async (
    event: MouseEvent<HTMLButtonElement>,
    preset: ClassPreset,
    settings: ClassPresetSettings,
  ) => {
    if (!isShareTarget) {
      onRun(event, preset, settings);
      return;
    }

    const resolvedInfo =
      localShareInfo ?? (boardId && shareCode ? buildShareLinkInfo(boardId, shareCode) : null);

    if (resolvedInfo) {
      setLocalShareInfo(resolvedInfo);
      onRun(event, preset, settings, resolvedInfo);
      return;
    }

    const ensured = await ensureShareInfo();
    if (!ensured) return;

    onRun(event, preset, settings, ensured);
  };

  return (
    <div className="relative">
      <CardTile
        ref={layerRef}
        variant="present"
        className="mt-3 border-slate-200 bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.25)]"
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-slate-500">{header.title}</p>
              <h3 className="mt-2 text-[20px] font-semibold text-slate-900">{header.description}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-interactive="true"
              className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
            >
              닫기
            </button>
          </div>

          <div className="grid gap-2">
            {availablePresets.map((preset) => {
              const active = preset.id === selectedPreset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-interactive="true"
                  onClick={() => {
                    setSelectedId(preset.id);
                    setLocalSettings({ ...preset.settings });
                  }}
                  className={cn(
                    "flex min-h-[56px] w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                    active
                      ? "border-indigo-500 bg-indigo-600 text-white shadow-lg"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300",
                  )}
                >
                  <div className="space-y-1">
                    <p className="text-[18px] font-semibold">{preset.name}</p>
                    <p className={cn("text-xs", active ? "text-white/80" : "text-slate-500")}>
                      {preset.description ?? ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      pill.badge,
                      "min-h-[28px] text-[11px]",
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {active ? "선택됨" : "선택"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-700">빠른 설정</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                data-interactive="true"
                onClick={() => updateSettings({ safeMode: !localSettings.safeMode })}
                className={cn(
                  "min-h-[44px] rounded-full px-4 text-[15px] font-semibold transition",
                  localSettings.safeMode
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200",
                )}
              >
                Safe {localSettings.safeMode ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                data-interactive="true"
                onClick={() => updateSettings({ focusMode: !localSettings.focusMode })}
                className={cn(
                  "min-h-[44px] rounded-full px-4 text-[15px] font-semibold transition",
                  localSettings.focusMode
                    ? "bg-indigo-500 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200",
                )}
              >
                Focus {localSettings.focusMode ? "ON" : "OFF"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {sizeOptions.map((option) => {
                const active = option.value === localSettings.cardSize;
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-interactive="true"
                    onClick={() => updateSettings({ cardSize: option.value })}
                    className={cn(
                      "min-h-[44px] rounded-full px-4 text-[15px] font-semibold transition",
                      active
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-700 ring-1 ring-slate-200",
                    )}
                  >
                    카드 {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {helper ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">{helper}</div> : null}

          {isShareTarget && shareLoading ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
              공유 링크 준비 중… (최대 3초)
            </div>
          ) : null}

          {isShareTarget && shareError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <span>{shareError}</span>
              <button
                type="button"
                onClick={() => void ensureShareInfo()}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[36px]")}
              >
                다시 시도
              </button>
            </div>
          ) : null}

          {isShareTarget && localShareInfo ? (
            <ShareLinkBlock shareUrl={localShareInfo.shareUrl} />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">선택된 프리셋이 즉시 실행됩니다.</div>
            <button
              type="button"
              data-interactive="true"
              data-force-nav="true"
              disabled={runDisabled}
              onClick={(event) => void handleRunClick(event, selectedPreset, localSettings)}
              className={cn(
                buttonTone("primary", { size: "lg", tone: "indigo" }),
                "min-h-[56px] min-w-[160px]",
                runDisabled ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              {runLabel}
            </button>
          </div>
        </div>
      </CardTile>
    </div>
  );
}
