"use client";

import { useEffect } from "react";

import { shouldIgnoreHotkeyEvent } from "@/lib/keyboard";
import type { DashboardMode } from "./useDashboardMode";

type DashboardHotkeysOptions = {
  mode: DashboardMode;
  onOpenCreate: () => void;
  onFocusCreate: () => void;
  isCreateOpen: boolean;
  onFocusSearch?: () => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onSetMode?: (mode: DashboardMode) => void;
};

function isEditableTarget(target: EventTarget | null) {
  if (!target || !(target as HTMLElement).tagName) return false;
  const element = target as HTMLElement;
  const tag = element.tagName;
  return element.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function createDashboardHotkeyHandler({
  mode,
  onOpenCreate,
  onFocusCreate,
  isCreateOpen,
  onFocusSearch,
  onSelectAll,
  onClearSelection,
  onSetMode,
}: DashboardHotkeysOptions) {
  return (event: KeyboardEvent) => {
    if (shouldIgnoreHotkeyEvent(event)) return;
    if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === "1" || key === "c") {
      event.preventDefault();
      onSetMode?.("clean");
      return;
    }
    if (key === "2" || key === "f") {
      event.preventDefault();
      onSetMode?.("focus");
      return;
    }
    if (key === "3" || key === "m") {
      event.preventDefault();
      onSetMode?.("manage");
      return;
    }
    if (mode === "clean" && key === "n") {
      event.preventDefault();
      if (isCreateOpen) {
        onFocusCreate();
      } else {
        onOpenCreate();
      }
    }
    if (mode === "clean" && event.key === "/") {
      event.preventDefault();
      onFocusSearch?.();
    }
    if (mode === "manage" && key === "a") {
      event.preventDefault();
      onSelectAll?.();
    }
    if (mode === "manage" && event.key === "Escape") {
      event.preventDefault();
      onClearSelection?.();
    }
  };
}

export function useDashboardHotkeys({
  mode,
  onOpenCreate,
  onFocusCreate,
  isCreateOpen,
  onFocusSearch,
  onSelectAll,
  onClearSelection,
}: DashboardHotkeysOptions) {
  useEffect(() => {
    const handler = createDashboardHotkeyHandler({
      mode,
      onOpenCreate,
      onFocusCreate,
      isCreateOpen,
      onFocusSearch,
      onSelectAll,
      onClearSelection,
    });

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isCreateOpen, mode, onClearSelection, onFocusCreate, onFocusSearch, onOpenCreate, onSelectAll]);
}
