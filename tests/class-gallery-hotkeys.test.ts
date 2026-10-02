import "./shims/dom-globals";
import assert from "node:assert/strict";
import test from "node:test";

import { createGalleryHotkeyHandler } from "@/app/dashboard/classes/[classId]/gallery/galleryHotkeys";

test("gallery hotkey moves to next frame on ArrowRight", () => {
  let moved = 0;
  const handler = createGalleryHotkeyHandler({
    onPrev: () => {},
    onNext: () => {
      moved += 1;
    },
    onActivate: () => {},
    onFullscreenToggle: () => {},
  });

  handler({ key: "ArrowRight", preventDefault: () => undefined, target: null } as KeyboardEvent);

  assert.equal(moved, 1);
});
