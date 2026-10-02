import { useEffect } from "react";

import type { LessonId } from "@/lib/edu/lesson/lessonLock";
import { shouldIgnoreHotkeyEvent } from "@/lib/keyboard";

type TeacherHotkeyOptions = {
  enabled: boolean;
  onSetLessonId: (id: LessonId) => void;
  onToggleLessonLock: () => void;
  onGenerate: () => void;
  onToggleAutosave: () => void;
  onAbortAll: () => void;
  onResetEngine: () => void;
  onHardReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePresentationMode: () => void;
  onExportDiagnostics: () => void;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
};

const allowedWhileEditing = new Set(["1", "2", "3", "4", "g", "l", "p"]);

export function useTeacherHotkeys(options: TeacherHotkeyOptions) {
  useEffect(() => {
    if (!options.enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (shouldIgnoreHotkeyEvent(event)) return;
      if (!event.altKey || event.metaKey || event.ctrlKey) return;

      const key = event.key.toLowerCase();
      const editing = isEditableTarget(event.target);

      if (editing && !allowedWhileEditing.has(key)) {
        return;
      }

      let handled = true;
      switch (key) {
        case "1":
          options.onSetLessonId("P1");
          break;
        case "2":
          options.onSetLessonId("P2");
          break;
        case "3":
          options.onSetLessonId("P3");
          break;
        case "4":
          options.onSetLessonId("P4");
          break;
        case "l":
          options.onToggleLessonLock();
          break;
        case "g":
          options.onGenerate();
          break;
        case "s":
          options.onToggleAutosave();
          break;
        case "a":
          options.onAbortAll();
          break;
        case "r":
          options.onResetEngine();
          break;
        case "backspace":
          options.onHardReset();
          break;
        case "z":
          if (event.shiftKey) {
            options.onRedo();
          } else {
            options.onUndo();
          }
          break;
        case "p":
          options.onTogglePresentationMode();
          break;
        case "e":
          options.onExportDiagnostics();
          break;
        default:
          handled = false;
          break;
      }

      if (handled && !editing) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [options]);
}
