"use client";

import { useEffect } from "react";

import { shouldIgnoreHotkeyEvent } from "@/lib/keyboard";

type LaunchpadHotkeyOptions = {
  onToggleSession: () => void;
  onCopyLink: () => void;
  onToggleQr: () => void;
  onOpenHud: () => void;
  onOpenRemote: () => void;
  enabled?: boolean;
};

function isEditableTarget(target: EventTarget | null) {
  if (!target || !(target as HTMLElement).tagName) return false;
  const element = target as HTMLElement;
  const tag = element.tagName;
  return element.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function createLaunchpadHotkeyHandler({
  onToggleSession,
  onCopyLink,
  onToggleQr,
  onOpenHud,
  onOpenRemote,
  enabled = true,
}: LaunchpadHotkeyOptions) {
  return (event: KeyboardEvent) => {
    if (!enabled) return;
    if (shouldIgnoreHotkeyEvent(event)) return;
    if (isEditableTarget(event.target)) return;

    const key = event.key.toLowerCase();

    if (key === "s") {
      event.preventDefault();
      onToggleSession();
      return;
    }

    if (key === "l") {
      event.preventDefault();
      onCopyLink();
      return;
    }

    if (key === "q") {
      event.preventDefault();
      onToggleQr();
      return;
    }

    if (key === "h") {
      event.preventDefault();
      onOpenHud();
      return;
    }

    if (key === "r") {
      event.preventDefault();
      onOpenRemote();
    }
  };
}

export function useLaunchpadHotkeys(options: LaunchpadHotkeyOptions) {
  useEffect(() => {
    const handler = createLaunchpadHotkeyHandler(options);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [options]);
}
