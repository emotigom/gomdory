import { useEffect } from "react";

import type { StudentView } from "@/lib/student/view";
import { shouldIgnoreHotkeyEvent } from "@/lib/keyboard";

type ShowHotkeysOptions = {
  enabled: boolean;
  isModalOpen: boolean;
  onViewChange: (view: StudentView) => void;
  onRequestSearch?: () => void;
};

const shouldIgnoreHotkey = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
};

export function useShowHotkeys({
  enabled,
  isModalOpen,
  onViewChange,
  onRequestSearch,
}: ShowHotkeysOptions) {
  useEffect(() => {
    if (!enabled) return undefined;

    const handleKey = (event: KeyboardEvent) => {
      if (shouldIgnoreHotkeyEvent(event)) return;
      if (shouldIgnoreHotkey(event.target)) return;
      if (isModalOpen) return;

      if (event.key === "g" || event.key === "G") {
        event.preventDefault();
        onViewChange("gallery");
        return;
      }

      if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        onViewChange("columns");
        return;
      }

      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        onViewChange("stream");
        return;
      }

      if (event.key === "/" && onRequestSearch) {
        event.preventDefault();
        onRequestSearch();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [enabled, isModalOpen, onRequestSearch, onViewChange]);
}
