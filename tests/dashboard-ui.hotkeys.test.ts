import assert from "node:assert/strict";
import test from "node:test";

import { createDashboardHotkeyHandler } from "@/app/dashboard/useDashboardHotkeys";

function ensureDom() {
  if (typeof globalThis.document === "undefined") {
    // @ts-expect-error: minimal document shim for tests
    globalThis.document = {
      activeElement: null,
      defaultView: globalThis.window,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      createElement: () => ({ ownerDocument: globalThis.document }),
    };
  }
  if (typeof globalThis.window === "undefined") {
    // @ts-expect-error: minimal window shim for tests
    globalThis.window = { document: globalThis.document };
  } else if (!(globalThis.window as Window & { document?: Document }).document) {
    (globalThis.window as Window & { document?: Document }).document = globalThis.document as Document;
  }
  if (!(globalThis.document as Document & { defaultView?: Window }).defaultView) {
    (globalThis.document as Document & { defaultView?: Window }).defaultView =
      globalThis.window as unknown as Window;
  }
}

function createFocusableElement(tagName = "INPUT") {
  const element = {
    tagName,
    focus: () => {
      if (globalThis.document) {
        (globalThis.document as Document).activeElement = element as unknown as Element;
      }
    },
  };
  return element;
}

test("pressing N focuses the create board input", () => {
  ensureDom();
  const input = createFocusableElement("INPUT");

  const handler = createDashboardHotkeyHandler({
    mode: "clean",
    isCreateOpen: true,
    onOpenCreate: () => undefined,
    onFocusCreate: () => {
      input.focus();
    },
  });

  const event = {
    key: "n",
    target: { tagName: "DIV" },
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    preventDefault: () => undefined,
  } as unknown as KeyboardEvent;

  handler(event);

  assert.equal(globalThis.document.activeElement, input as unknown as Element);
});

test("dashboard hotkeys ignore events from editable targets", () => {
  ensureDom();
  let opened = false;

  const handler = createDashboardHotkeyHandler({
    mode: "clean",
    isCreateOpen: false,
    onOpenCreate: () => {
      opened = true;
    },
    onFocusCreate: () => undefined,
  });

  const event = {
    key: "n",
    target: { tagName: "INPUT", isContentEditable: false },
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    preventDefault: () => undefined,
  } as unknown as KeyboardEvent;

  handler(event);

  assert.equal(opened, false);
});
