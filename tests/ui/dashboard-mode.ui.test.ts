import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ModeShell from "@/app/dashboard/_components/ModeShell";
import { createDashboardHotkeyHandler } from "@/app/dashboard/useDashboardHotkeys";

test("mode shell renders mode badge and title", () => {
  const modes = [
    { mode: "clean", label: "수업 시작" },
    { mode: "focus", label: "수업 진행" },
    { mode: "manage", label: "보드 관리" },
  ] as const;

  for (const { mode, label } of modes) {
    const html = renderToStaticMarkup(
      createElement(
        ModeShell,
        {
          mode,
          title: `${mode}-title`,
          description: `${mode}-desc`,
          rightActions: null,
          modeSwitcher: null,
        },
        createElement("div", null, "content"),
      ),
    );

    assert.ok(html.includes(label));
    assert.ok(html.includes(`${mode}-title`));
  }
});

test("dashboard hotkeys route to clean actions", () => {
  let opened = false;
  let focused = false;
  let searchFocused = false;

  const handler = createDashboardHotkeyHandler({
    mode: "clean",
    isCreateOpen: false,
    onOpenCreate: () => {
      opened = true;
    },
    onFocusCreate: () => {
      focused = true;
    },
    onFocusSearch: () => {
      searchFocused = true;
    },
  });

  handler({ key: "n", target: null, preventDefault: () => undefined } as KeyboardEvent);
  handler({ key: "/", target: null, preventDefault: () => undefined } as KeyboardEvent);

  assert.equal(opened, true);
  assert.equal(focused, false);
  assert.equal(searchFocused, true);
});

test("dashboard hotkeys toggle manage selections", () => {
  let selectAllCount = 0;
  let clearCount = 0;

  const handler = createDashboardHotkeyHandler({
    mode: "manage",
    isCreateOpen: false,
    onOpenCreate: () => undefined,
    onFocusCreate: () => undefined,
    onSelectAll: () => {
      selectAllCount += 1;
    },
    onClearSelection: () => {
      clearCount += 1;
    },
  });

  handler({ key: "a", target: null, preventDefault: () => undefined, metaKey: false, ctrlKey: false } as KeyboardEvent);
  handler({ key: "Escape", target: null, preventDefault: () => undefined } as KeyboardEvent);

  assert.equal(selectAllCount, 1);
  assert.equal(clearCount, 1);
});
