import assert from "node:assert/strict";
import { performance as nodePerformance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { MouseEvent as ReactMouseEvent } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { scheduleDashboardForceNavigationFallback } from "@/app/dashboard/forceNavigationFallback";
import { createDashboardHotkeyHandler } from "@/app/dashboard/useDashboardHotkeys";
import {
  DISMISSABLE_LAYER_ACTIVATION_MS,
  shouldDismissLayerPointerDown,
  shouldDismissOnKeyDown,
} from "@/app/_components/useDismissableLayer";
import { OnboardingChecklistModal } from "@/app/dashboard/_components/OnboardingChecklistModal";
import { FirstRunQuickstart } from "@/app/dashboard/_components/FirstRunQuickstart";

class StubElement extends EventTarget {
  name: string;
  parent: StubElement | null = null;
  children: StubElement[] = [];
  private attributes = new Map<string, string>();

  constructor(name: string) {
    super();
    this.name = name;
  }

  appendChild(child: StubElement) {
    child.parent = this;
    this.children.push(child);
  }

  contains(node: Element | null): boolean {
    if (!(node instanceof StubElement)) return false;
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.has(name) ? this.attributes.get(name) ?? null : null;
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  closest(selector: string) {
    if (selector === '[data-dismiss-ignore="true"]') {
      let current: StubElement | null = this;
      while (current) {
        if (current.getAttribute("data-dismiss-ignore") === "true") {
          return current as unknown as Element;
        }
        current = current.parent;
      }
    }
    return null;
  }
}

type StubMouseOptions = {
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  composed?: Array<EventTarget>;
  logs?: string[];
};

class StubMouseEvent {
  type: string;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  defaultPrevented = false;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  private composedPathValue: Array<EventTarget>;
  private logs: string[];

  constructor(type: string, target: EventTarget | null, options: StubMouseOptions = {}) {
    this.type = type;
    this.target = target;
    this.currentTarget = target;
    this.button = options.button ?? 0;
    this.metaKey = options.metaKey ?? false;
    this.ctrlKey = options.ctrlKey ?? false;
    this.shiftKey = options.shiftKey ?? false;
    this.altKey = options.altKey ?? false;
    this.composedPathValue = options.composed ?? (target ? [target] : []);
    this.logs = options.logs ?? [];
  }

  preventDefault() {
    this.defaultPrevented = true;
    this.logs.push(`${this.type}: preventDefault`);
  }

  composedPath() {
    return this.composedPathValue;
  }
}

function setupTestWindow(url: string) {
  const previousWindow = globalThis.window;
  const previousLocation = globalThis.location;
  const previousPerformance = globalThis.performance;
  const assignments: string[] = [];
  const urlObject = new URL(url);

  const location = {
    href: urlObject.toString(),
    pathname: urlObject.pathname,
    assign: (value: string | URL) => {
      const next = value.toString();
      assignments.push(next);
      const parsed = new URL(next, urlObject.toString());
      location.href = parsed.toString();
      location.pathname = parsed.pathname;
    },
  };

  // @ts-expect-error – partial window stub sufficient for tests
  globalThis.window = { location, setTimeout, clearTimeout };
  // @ts-expect-error – align with stubbed window
  globalThis.location = location;
  globalThis.performance = previousPerformance ?? nodePerformance;

  return {
    assignments,
    restore() {
      globalThis.window = previousWindow;
      globalThis.location = previousLocation;
      globalThis.performance = previousPerformance;
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("dashboard navigation fallback assigns when defaultPrevented", async () => {
  const logs: string[] = [];
  const { assignments, restore } = setupTestWindow("https://example.com/dashboard");
  const link = new StubElement("a");
  link.setAttribute("data-force-nav", "true");
  link.setAttribute("data-interactive", "true");

  const clickEvent = new StubMouseEvent("click", link, { logs });
  clickEvent.preventDefault();

  scheduleDashboardForceNavigationFallback(
    clickEvent as unknown as ReactMouseEvent<HTMLElement>,
    "/dashboard/boards/abc",
  );

  await sleep(10);

  restore();

  try {
    assert.equal(assignments.at(-1), "https://example.com/dashboard/boards/abc");
  } catch (error) {
    (error as Error).message += `\npreventDefault logs:\n${logs.join("\n")}`;
    throw error;
  }
});

test("first run quickstart renders when open", () => {
  const html = renderToStaticMarkup(
    <FirstRunQuickstart open onClose={() => {}} onComplete={() => {}} onRequestCreateBoard={() => {}} />,
  );

  assert.match(html, /1분 시작하기/);
  assert.match(html, /데모 보드 만들기/);
});

test("navigation fallback only applies on dashboard and _self links", async () => {
  const logs: string[] = [];
  const { assignments, restore } = setupTestWindow("https://example.com/profile");
  const link = new StubElement("a");
  link.setAttribute("data-force-nav", "true");
  link.setAttribute("data-interactive", "true");
  const clickEvent = new StubMouseEvent("click", link, { logs });
  clickEvent.preventDefault();

  scheduleDashboardForceNavigationFallback(
    clickEvent as unknown as ReactMouseEvent<HTMLElement>,
    "/dashboard/boards/xyz",
  );
  await sleep(20);
  assert.equal(assignments.length, 0);

  (globalThis.location as { pathname: string }).pathname = "/dashboard";
  link.setAttribute("target", "_blank");

  const blankEvent = new StubMouseEvent("click", link, { logs });
  blankEvent.preventDefault();
  scheduleDashboardForceNavigationFallback(
    blankEvent as unknown as ReactMouseEvent<HTMLElement>,
    "/dashboard/boards/xyz",
  );
  await sleep(20);

  restore();

  try {
    assert.equal(assignments.length, 0);
  } catch (error) {
    (error as Error).message += `\npreventDefault logs:\n${logs.join("\n")}`;
    throw error;
  }
});

test("onboarding checklist auto-opens when shouldAutoOpen is true", () => {
  const html = renderToStaticMarkup(
    createElement(OnboardingChecklistModal, {
      shouldAutoOpen: true,
      dismissed: false,
      onDismiss: () => {},
      onResetDismiss: () => {},
      mode: "clean",
      boardCount: 0,
      checklistState: {
        boardCreated: false,
        shareOpened: false,
        presentOpened: false,
      },
      onCreateBoard: () => {},
      onOpenSharePanel: () => {},
      onOpenPresentHud: () => {},
    }),
  );

  assert.match(html, /onboarding-checklist-modal/);
});

test("dismissable layer waits before closing and dismisses on outside click or ESC", () => {
  const logs: string[] = [];
  const layer = new StubElement("layer");
  const anchor = new StubElement("anchor");
  const outside = new StubElement("outside");
  const ignore = new StubElement("ignore");
  ignore.setAttribute("data-dismiss-ignore", "true");
  layer.appendChild(ignore);

  const shortEvent = new StubMouseEvent("pointerdown", outside, { logs });
  const afterShortDelay = shouldDismissLayerPointerDown(shortEvent as never, {
    openedAt: 0,
    currentTime: DISMISSABLE_LAYER_ACTIVATION_MS - 10,
    boundaryElements: [layer],
    anchorElement: anchor,
  });

  const longEvent = new StubMouseEvent("pointerdown", outside, { logs });
  const afterLongDelay = shouldDismissLayerPointerDown(longEvent as never, {
    openedAt: 0,
    currentTime: DISMISSABLE_LAYER_ACTIVATION_MS + 20,
    boundaryElements: [layer],
    anchorElement: anchor,
  });

  const insideEvent = new StubMouseEvent("pointerdown", layer, { logs });
  const insideDismiss = shouldDismissLayerPointerDown(insideEvent as never, {
    openedAt: 0,
    currentTime: DISMISSABLE_LAYER_ACTIVATION_MS + 20,
    boundaryElements: [layer],
    anchorElement: anchor,
  });

  const ignoreEvent = new StubMouseEvent("pointerdown", ignore, {
    composed: [ignore, layer],
    logs,
  });
  const ignoreDismiss = shouldDismissLayerPointerDown(ignoreEvent as never, {
    openedAt: 0,
    currentTime: DISMISSABLE_LAYER_ACTIVATION_MS + 20,
    boundaryElements: [layer],
    anchorElement: anchor,
  });

  const escapeDismiss = shouldDismissOnKeyDown({ key: "Escape" });
  const enterDismiss = shouldDismissOnKeyDown({ key: "Enter" });

  try {
    assert.equal(afterShortDelay, false, "layer should ignore dismiss within activation window");
    assert.equal(afterLongDelay, true, "layer should dismiss after activation window");
    assert.equal(insideDismiss, false, "layer should stay open when clicking inside");
    assert.equal(ignoreDismiss, false, "layer should stay open when clicking dismiss-ignore target");
    assert.equal(escapeDismiss, true, "Escape should trigger dismiss");
    assert.equal(enterDismiss, false, "other keys should not dismiss");
  } catch (error) {
    (error as Error).message += `\npreventDefault logs:\n${logs.join("\n")}`;
    throw error;
  }
});

test("dashboard hotkey opens create form and focuses title input", async () => {
  const boardFormPath = path.resolve(process.cwd(), "app/dashboard/BoardForm.tsx");
  const boardFormSource = fs.readFileSync(boardFormPath, "utf8");
  assert.ok(boardFormSource.includes('data-testid="board-title-input"'));

  type Focusable = { dataset: { testid: string }; focus: () => void };

  let createPanelOpen = false;
  let activeElement: Focusable | null = null;
  const titleInput: Focusable = {
    dataset: { testid: "board-title-input" },
    focus: () => {
      activeElement = titleInput;
    },
  };

  const openCreate = () => {
    createPanelOpen = true;
    setTimeout(() => {
      titleInput.focus();
    }, 0);
  };

  const focusCreate = () => {
    titleInput.focus();
  };

  const handler = createDashboardHotkeyHandler({
    mode: "clean",
    isCreateOpen: createPanelOpen,
    onOpenCreate: openCreate,
    onFocusCreate: focusCreate,
  });

  handler({
    key: "n",
    target: null,
    preventDefault: () => undefined,
  } as KeyboardEvent);

  await new Promise((resolve) => setTimeout(resolve, 0));

  const input = titleInput;
  assert.equal(input.dataset.testid, "board-title-input");
  assert.equal(createPanelOpen, true);
  assert.equal(activeElement, input);
});

test("dashboard hotkey ignores editable targets", () => {
  let openCalls = 0;
  const handler = createDashboardHotkeyHandler({
    mode: "clean",
    isCreateOpen: false,
    onOpenCreate: () => {
      openCalls += 1;
    },
    onFocusCreate: () => {},
  });

  handler({
    key: "n",
    target: { tagName: "INPUT", isContentEditable: false } as HTMLElement,
    preventDefault: () => {},
  } as KeyboardEvent);

  assert.equal(openCalls, 0);
});

test("class launchpad page includes marker attribute", () => {
  const filePath = path.join(
    process.cwd(),
    "app",
    "dashboard",
    "classes",
    "[classId]",
    "launch",
    "page.tsx",
  );
  const content = fs.readFileSync(filePath, "utf8");

  assert.ok(content.includes('data-page-marker="class-launchpad"'));
});
