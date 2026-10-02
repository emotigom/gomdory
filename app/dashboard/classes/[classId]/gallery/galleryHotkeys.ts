import { shouldIgnoreHotkeyEvent } from "@/lib/keyboard";

export type GalleryHotkeyHandler = {
  onPrev: () => void;
  onNext: () => void;
  onActivate: () => void;
  onFullscreenToggle: () => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as { tagName?: string; isContentEditable?: boolean };
  const tagName = element.tagName?.toUpperCase();
  if (!tagName) return Boolean(element.isContentEditable);
  return ["INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(tagName) || Boolean(element.isContentEditable);
}

export function createGalleryHotkeyHandler(handlers: GalleryHotkeyHandler) {
  return function handleKeydown(event: KeyboardEvent) {
    if (shouldIgnoreHotkeyEvent(event)) return;
    if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) return;

    const key = event.key.toLowerCase();
    if (key === "arrowleft") {
      event.preventDefault();
      handlers.onPrev();
      return;
    }
    if (key === "arrowright") {
      event.preventDefault();
      handlers.onNext();
      return;
    }
    if (key === "enter") {
      event.preventDefault();
      handlers.onActivate();
      return;
    }
    if (key === "f") {
      event.preventDefault();
      handlers.onFullscreenToggle();
    }
  };
}
