"use client";

import { useEffect } from "react";

import { shouldIgnoreHotkeyEvent } from "@/lib/keyboard";

type GlobalShortcutOptions = {
  key: string;
  enabled?: boolean;
  preventDefault?: boolean;
  onTrigger: (event: KeyboardEvent) => void;
};

export function shouldIgnoreShortcutTarget(target: EventTarget | null): boolean {
  const element =
    typeof HTMLElement !== "undefined"
      ? target instanceof HTMLElement
        ? target
        : null
      : target && typeof target === "object" && "tagName" in target
        ? (target as { tagName: string; isContentEditable?: boolean; closest?: (selector: string) => Element | null })
        : null;

  if (!element) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (element.isContentEditable) {
    return true;
  }

  return Boolean(element.closest?.("[contenteditable='true']"));
}

export function useGlobalShortcut({
  key,
  enabled = true,
  preventDefault = true,
  onTrigger,
}: GlobalShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;

    const normalizedKey = key.toLowerCase();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (shouldIgnoreHotkeyEvent(event)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== normalizedKey) return;
      if (shouldIgnoreShortcutTarget(event.target)) return;

      if (preventDefault) {
        event.preventDefault();
      }

      onTrigger(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, key, onTrigger, preventDefault]);
}

