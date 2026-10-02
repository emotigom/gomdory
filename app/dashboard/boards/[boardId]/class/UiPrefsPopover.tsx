"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import AnchoredMenu from "@/app/_components/AnchoredMenu";
import {
  DEFAULT_KEYMAP,
  KEYMAP_COMMANDS,
  KEYMAP_LABELS,
  REQUIRED_NAVIGATION_COMMANDS,
  type KeySpec,
  type KeymapCommandId,
} from "./keymap";
import {
  findKeymapConflict,
  formatKeySpecList,
  isReservedKeySpec,
  normalizeKeySpecFromEvent,
} from "./keymapUtils";
import type { ClassUiPrefs } from "./useUiPrefs";
import { stopTilePropagation } from "@/app/_components/interaction";

type UiPrefsPopoverProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: ClassUiPrefs;
  onUpdatePrefs: (patch: Partial<ClassUiPrefs>) => void;
};

const clampOptions: Array<ClassUiPrefs["textClampLines"]> = [2, 3, 4];

export default function UiPrefsPopover({
  isOpen,
  onOpenChange,
  prefs,
  onUpdatePrefs,
}: UiPrefsPopoverProps) {
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [activeCapture, setActiveCapture] = useState<KeymapCommandId | null>(null);
  const [keymapError, setKeymapError] = useState<string | null>(null);

  const clampLabel = useMemo(() => `본문 ${prefs.textClampLines}줄`, [prefs.textClampLines]);
  const keymap = prefs.keymap;

  const updateKeymap = useCallback(
    (commandId: KeymapCommandId, specs: KeySpec[]) => {
      onUpdatePrefs({ keymap: { ...keymap, [commandId]: specs } });
    },
    [keymap, onUpdatePrefs],
  );

  const resetKeymap = useCallback(
    (commandId: KeymapCommandId) => {
      updateKeymap(commandId, DEFAULT_KEYMAP[commandId]);
    },
    [updateKeymap],
  );

  const resetAllKeymap = useCallback(() => {
    onUpdatePrefs({ keymap: DEFAULT_KEYMAP });
  }, [onUpdatePrefs]);

  const validateKeymap = useCallback(
    (commandId: KeymapCommandId, nextSpecs: KeySpec[]) => {
      if (nextSpecs.length > 0) {
        const conflictId = findKeymapConflict(
          { ...keymap, [commandId]: nextSpecs },
          commandId,
          nextSpecs[0],
        );
        if (conflictId) {
          const label = KEYMAP_LABELS.get(conflictId) ?? conflictId;
          return `이미 ‘${label}’에 사용 중인 키예요.`;
        }
        if (isReservedKeySpec(nextSpecs[0])) {
          return "브라우저 예약키는 사용할 수 없어요.";
        }
      }
      const nextKeymap = { ...keymap, [commandId]: nextSpecs };
      const navigationCount = Array.from(REQUIRED_NAVIGATION_COMMANDS).reduce(
        (count, id) => count + (nextKeymap[id]?.length ?? 0),
        0,
      );
      if (navigationCount === 0) {
        return "핵심 이동 단축키는 최소 1개가 필요해요.";
      }
      return null;
    },
    [keymap],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (activeCapture) {
          return;
        }
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCapture, isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) {
      setActiveCapture(null);
      setKeymapError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!activeCapture) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setActiveCapture(null);
        setKeymapError(null);
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        const validation = validateKeymap(activeCapture, []);
        if (validation) {
          setKeymapError(validation);
          return;
        }
        updateKeymap(activeCapture, []);
        setActiveCapture(null);
        setKeymapError(null);
        return;
      }

      const keySpec = normalizeKeySpecFromEvent(event);
      if (!keySpec) {
        return;
      }

      const validation = validateKeymap(activeCapture, [keySpec]);
      if (validation) {
        setKeymapError(validation);
        return;
      }

      updateKeymap(activeCapture, [keySpec]);
      setActiveCapture(null);
      setKeymapError(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [activeCapture, updateKeymap, validateKeymap]);

  const renderKeyPill = (spec: string, options?: { isPlaceholder?: boolean }) => (
    <span
      key={spec}
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${
        options?.isPlaceholder
          ? "border-gray-100 bg-gray-50 text-gray-400"
          : "border-gray-200 bg-gray-50 text-gray-700"
      }`}
    >
      {options?.isPlaceholder ? spec : formatKeySpecList([spec as KeySpec])}
    </span>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="카드 목록 설정"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        data-dismiss-ignore="true"
        data-interactive="true"
        onPointerDown={stopTilePropagation}
        onClick={(event) => {
          stopTilePropagation(event);
          onOpenChange(!isOpen);
        }}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        ⚙︎ 설정
      </button>
      <AnchoredMenu
        open={isOpen}
        anchorRef={triggerRef}
        menuRef={menuRef}
        align="right"
        role="dialog"
        showBackdrop
        onBackdropClick={() => onOpenChange(false)}
        className="w-72 space-y-4 rounded-xl border border-gray-200 bg-white p-4 text-xs shadow-xl"
      >
        <div id={popoverId}>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">밀도</p>
            <div className="flex items-center gap-2">
              {([
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onUpdatePrefs({ density: option.value })}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 ${
                    prefs.density === option.value
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">키보드 힌트</p>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-[11px] text-gray-700">
              <input
                type="checkbox"
                checked={prefs.showKeyboardHints}
                onChange={(event) => onUpdatePrefs({ showKeyboardHints: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10"
              />
              힌트 줄을 표시합니다.
            </label>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">카드 본문</p>
            <div className="flex flex-wrap items-center gap-2">
              {clampOptions.map((lines) => (
                <button
                  key={lines}
                  type="button"
                  onClick={() => onUpdatePrefs({ textClampLines: lines })}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 ${
                    prefs.textClampLines === lines
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {lines}줄
                </button>
              ))}
              <span className="text-[11px] text-gray-400">현재 {clampLabel}</span>
            </div>
          </div>
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">단축키</p>
              <button
                type="button"
                onClick={resetAllKeymap}
                className="rounded-full border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-600 transition hover:border-gray-300"
              >
                기본값으로 초기화
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              변경을 누른 뒤 원하는 키를 입력하세요. ESC는 취소, Backspace/Delete는 해제입니다.
            </p>
            {activeCapture ? (
              <p className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                {KEYMAP_LABELS.get(activeCapture)} 키 입력 대기 중…
              </p>
            ) : null}
            {keymapError ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-600">
                {keymapError}
              </p>
            ) : null}
            <div className="space-y-2">
              {KEYMAP_COMMANDS.map((command) => {
                const specs = keymap[command.id] ?? [];
                const isCapturing = activeCapture === command.id;
                return (
                  <div key={command.id} className="rounded-lg border border-gray-100 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-gray-700">{command.label}</p>
                        <p className="text-[10px] text-gray-400">{command.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {specs.length > 0
                            ? specs.map((spec) => renderKeyPill(spec))
                            : renderKeyPill("미설정", { isPlaceholder: true })}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCapture(command.id);
                              setKeymapError(null);
                            }}
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold transition ${
                              isCapturing
                                ? "border-blue-300 bg-blue-50 text-blue-700"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}
                          >
                            {isCapturing ? "입력 중" : "변경"}
                          </button>
                          <button
                            type="button"
                            onClick={() => resetKeymap(command.id)}
                            className="rounded-full border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500 transition hover:border-gray-300"
                          >
                            초기화
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AnchoredMenu>
    </div>
  );
}
