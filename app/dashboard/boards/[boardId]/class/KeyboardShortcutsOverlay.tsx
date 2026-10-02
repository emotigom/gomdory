"use client";

import { useEffect } from "react";

import { getKeyboardShortcutHelpItems } from "@/lib/ui/keyboardShortcuts";

type KeyboardShortcutsOverlayProps = {
  isOpen: boolean;
  showAdvancedActionsEnabled: boolean;
  onClose: () => void;
  onOpenAdvancedSettings: () => void;
};

export default function KeyboardShortcutsOverlay({
  isOpen,
  showAdvancedActionsEnabled,
  onClose,
  onOpenAdvancedSettings,
}: KeyboardShortcutsOverlayProps) {
  const shortcuts = getKeyboardShortcutHelpItems();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="단축키 보기" className="relative z-10 w-full max-w-md rounded-2xl border border-white/20 bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">단축키 보기</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
            닫기
          </button>
        </div>

        <ul className="space-y-2">
          {shortcuts.map((shortcut) => (
            <li key={shortcut.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
              <span className="text-gray-700">{shortcut.description}</span>
              <kbd className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{shortcut.key}</kbd>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-600">고급 액션 표시: <span className="font-semibold">{showAdvancedActionsEnabled ? "ON" : "OFF"}</span></p>
          <button
            type="button"
            onClick={onOpenAdvancedSettings}
            className="mt-2 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            설정에서 변경하기
          </button>
        </div>
      </div>
    </div>
  );
}
