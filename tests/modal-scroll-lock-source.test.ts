import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helper = readFileSync("lib/ui/useModalScrollLock.ts", "utf8");
const gallery = readFileSync("app/s/[code]/_components/StudentAppGalleryPanel.tsx", "utf8");
const submit = readFileSync("app/s/[code]/_components/StudentAppSubmitPanel.tsx", "utf8");

test("modal scroll lock uses a ref count and restores exact inline styles and scroll position", () => {
  assert.match(helper, /let lockCount = 0/);
  assert.match(helper, /bodyCssText/);
  assert.match(helper, /documentElementCssText/);
  assert.match(helper, /window\.scrollTo\(0, saved\.scrollY\)/);
  assert.match(helper, /window\.innerWidth - root\.clientWidth/);
  assert.match(helper, /typeof window === "undefined"/);
  assert.match(helper, /data-modal-scroll-locked/);
  assert.match(helper, /modalScrollLockedAttribute/);
  assert.match(helper, /BOARD_SCROLLER_SELECTOR/);
  assert.match(helper, /element\.style\.overflow = "hidden"/);
  assert.match(helper, /element\.style\.touchAction = "none"/);
  assert.match(helper, /scrollTop: element\.scrollTop/);
  assert.match(helper, /element\.scrollLeft = scrollLeft/);
  assert.match(helper, /requestAnimationFrame/);
});

test("student gallery and coding modals share scroll lock and contained touch scrolling", () => {
  assert.match(gallery, /useModalScrollLock/);
  assert.match(submit, /useModalScrollLock/);
  assert.match(gallery, /touch-none/);
  assert.match(gallery, /touch-pan-y/);
  assert.match(submit, /touch-none/);
  assert.match(submit, /overflow-y-auto overscroll-contain touch-pan-y/);
  assert.match(gallery, /id="student-app-gallery-modal" data-modal-scroll-root="true"/);
  assert.match(gallery, /data-modal-scroll-container="true"/);
  assert.match(gallery, /data-modal-scroll-root="true" className="fixed inset-0 z-\[10001\]/);
  assert.match(submit, /id="student-app-submit-modal"\s*data-modal-scroll-root="true"/);
  assert.match(submit, /data-modal-scroll-container=\{displayMode !== "inline" \? "true" : undefined\}/);
});
