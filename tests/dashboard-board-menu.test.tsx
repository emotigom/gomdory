import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { createRoot } from "react-dom/client";

import DashboardBoardList from "@/app/dashboard/_components/DashboardBoardList";

if (typeof globalThis.IS_REACT_ACT_ENVIRONMENT === "undefined") {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

if (typeof globalThis.HTMLIFrameElement === "undefined") {
  globalThis.HTMLIFrameElement = class {} as typeof HTMLIFrameElement;
}

class MockEvent {
  type: string;
  bubbles: boolean;
  target: MockElement | null = null;
  currentTarget: MockElement | null = null;
  defaultPrevented = false;
  key = "";
  shiftKey = false;
  constructor(type: string, options?: { bubbles?: boolean }) {
    this.type = type;
    this.bubbles = options?.bubbles ?? false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    // noop for mock
  }
}

class MockElement {
  tagName: string;
  nodeName: string;
  nodeType = 1;
  childNodes: MockElement[] = [];
  parentNode: MockElement | null = null;
  ownerDocument: MockDocument;
  textContent = "";
  attributes: Record<string, string> = {};
  style: Record<string, string> = {};
  private listeners = new Map<string, Array<(event: MockEvent) => void>>();

  constructor(tagName: string, ownerDocument: MockDocument) {
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.ownerDocument = ownerDocument;
  }

  appendChild(node: MockElement) {
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  removeChild(node: MockElement) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
    }
    node.parentNode = null;
    return node;
  }

  insertBefore(node: MockElement, before: MockElement | null) {
    if (!before) {
      return this.appendChild(node);
    }
    const index = this.childNodes.indexOf(before);
    if (index >= 0) {
      node.parentNode = this;
      this.childNodes.splice(index, 0, node);
      return node;
    }
    return this.appendChild(node);
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }

  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }

  addEventListener(type: string, handler: (event: MockEvent) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(handler);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, handler: (event: MockEvent) => void) {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(
      type,
      list.filter((item) => item !== handler),
    );
  }

  dispatchEvent(event: MockEvent) {
    if (!event.target) {
      event.target = this;
    }
    event.currentTarget = this;
    const handlers = this.listeners.get(event.type) ?? [];
    handlers.forEach((handler) => handler(event));
    if (event.bubbles && this.parentNode) {
      this.parentNode.dispatchEvent(event);
    }
    return true;
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  querySelectorAll(selector: string): MockElement[] {
    const supported = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    assert.equal(selector, supported, "mock only implements the modal's focusable-selector contract");
    const result: MockElement[] = [];
    const visit = (parent: MockElement) => {
      for (const child of parent.childNodes) {
        const attributes = child.attributes;
        const enabledControl = ["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(child.tagName)
          && !("disabled" in attributes);
        const linkedAnchor = child.tagName === "A" && "href" in attributes;
        const tabStop = "tabindex" in attributes && String(attributes.tabindex) !== "-1";
        if (enabledControl || linkedAnchor || tabStop) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }

  getBoundingClientRect() {
    return {
      top: 0,
      left: 0,
      bottom: 40,
      right: 40,
      width: 40,
      height: 40,
    };
  }
}

class MockDocument extends MockElement {
  body: MockElement;
  documentElement: MockElement;
  activeElement: MockElement | null = null;

  constructor() {
    super("#document", undefined as unknown as MockDocument);
    this.nodeType = 9;
    this.ownerDocument = this;
    this.documentElement = new MockElement("html", this);
    this.body = new MockElement("body", this);
    this.appendChild(this.documentElement);
    this.documentElement.appendChild(this.body);
  }

  createElement(tag: string) {
    return new MockElement(tag, this);
  }

  createElementNS(_namespace: string, tag: string) {
    return new MockElement(tag, this);
  }

  createTextNode(text: string) {
    const node = new MockElement("#text", this);
    node.textContent = text;
    node.nodeType = 3;
    return node;
  }

  createComment(text: string) {
    const node = new MockElement("#comment", this);
    node.textContent = text;
    node.nodeType = 8;
    return node;
  }
}

if (typeof globalThis.Element === "undefined") {
  globalThis.Element = MockElement as unknown as typeof Element;
}

if (typeof globalThis.HTMLElement === "undefined") {
  globalThis.HTMLElement = MockElement as unknown as typeof HTMLElement;
}

if (typeof globalThis.Node === "undefined") {
  globalThis.Node = MockElement as unknown as typeof Node;
}

function findByTestId(root: MockElement, testId: string): MockElement | null {
  if (root.attributes["data-testid"] === testId) return root;
  for (const child of root.childNodes) {
    const found = findByTestId(child, testId);
    if (found) return found;
  }
  return null;
}

function findByAriaLabel(root: MockElement, label: string): MockElement | null {
  if (root.attributes["aria-label"] === label) return root;
  for (const child of root.childNodes) {
    const found = findByAriaLabel(child, label);
    if (found) return found;
  }
  return null;
}

function collectTestIds(root: MockElement, results: string[] = []) {
  const testId = root.attributes["data-testid"];
  if (testId) {
    results.push(testId);
  }
  for (const child of root.childNodes) {
    collectTestIds(child, results);
  }
  return results;
}

test("dashboard board menu supports rename and copy link", async () => {
  const mockDocument = new MockDocument();
  const container = mockDocument.createElement("div");
  mockDocument.body.appendChild(container);

  const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const clipboardWrites: string[] = [];

  const mockWindow = {
    document: mockDocument,
    innerWidth: 1200,
    innerHeight: 800,
    navigator: {
      maxTouchPoints: 0,
      clipboard: {
        writeText: async (value: string) => {
          clipboardWrites.push(value);
        },
      },
    },
    matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    setTimeout,
    clearTimeout,
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
  } as unknown as Window;

  (mockDocument as unknown as Record<string, unknown>).defaultView = mockWindow;

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNavigator = globalThis.navigator;
  const previousFetch = globalThis.fetch;
  const previousPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousSupabaseUrl = process.env.SUPABASE_URL;
  // @ts-expect-error test env
  const previousSelf = globalThis.self;

  // @ts-expect-error test env
  globalThis.window = mockWindow;
  // @ts-expect-error test env
  globalThis.document = mockDocument as unknown as Document;
  // @ts-expect-error test env
  globalThis.navigator = mockWindow.navigator;
  // @ts-expect-error test env
  globalThis.self = mockWindow;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ input, init });
    if (init?.method !== "PATCH") {
      return new Response(
        JSON.stringify({
          boards: [{ id: "board-123", title: "테스트 보드", created_at: "2025-01-01T00:00:00Z" }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const root = createRoot(container as unknown as Element);

  await act(async () => {
    root.render(
      <DashboardBoardList
        initialBoards={[{ id: "board-123", title: "테스트 보드", created_at: "2025-01-01T00:00:00Z" }]}
      />,
    );
  });

  const menuButton = findByAriaLabel(container, "테스트 보드 보드 메뉴");
  assert.ok(menuButton, "menu button should render");

  await act(async () => {
    menuButton!.dispatchEvent(new MockEvent("click", { bubbles: true }));
  });

  const renameMenuItem = findByTestId(mockDocument.body, "dashboard-board-rename-open-board-123");
  assert.ok(
    renameMenuItem,
    `rename menu item should render (found: ${collectTestIds(mockDocument.body).join(", ")})`,
  );

  await act(async () => {
    renameMenuItem!.dispatchEvent(new MockEvent("click", { bubbles: true }));
  });

  const renameModal = findByTestId(mockDocument.body, "dashboard-board-rename-modal");
  assert.ok(renameModal, "rename modal should render");

  let dialog: MockElement | null = renameModal;
  while (dialog && dialog.getAttribute("role") !== "dialog") dialog = dialog.parentNode;
  assert.ok(dialog, "rename modal remains inside an accessible dialog");
  const focusable = dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
  assert.ok(focusable.length >= 2, "dialog exposes real input/button focus targets");
  assert.equal(mockDocument.activeElement, focusable[0], "dialog focuses its first control on open");
  // Invoke the native dialog listener directly. This minimal DOM does not model
  // React/browser input-event propagation; real keyboard propagation remains browser QA.
  const backwards = new MockEvent("keydown");
  backwards.key = "Tab";
  backwards.shiftKey = true;
  dialog.dispatchEvent(backwards);
  assert.equal(backwards.defaultPrevented, true);
  assert.equal(mockDocument.activeElement, focusable.at(-1), "Shift+Tab wraps to the last control");
  const forwards = new MockEvent("keydown");
  forwards.key = "Tab";
  dialog.dispatchEvent(forwards);
  assert.equal(forwards.defaultPrevented, true);
  assert.equal(mockDocument.activeElement, focusable[0], "Tab wraps to the first control");

  const renameSaveButton = findByTestId(mockDocument.body, "dashboard-board-rename-save");
  assert.ok(renameSaveButton, "rename save button should render");

  await act(async () => {
    renameSaveButton!.dispatchEvent(new MockEvent("click", { bubbles: true }));
  });

  const renameRequests = fetchCalls.filter((call) => call.init?.method === "PATCH");
  assert.equal(renameRequests.length, 1);

  let copyMenuItem = findByTestId(mockDocument.body, "dashboard-board-copy-link-board-123");
  if (!copyMenuItem) {
    await act(async () => {
      menuButton!.dispatchEvent(new MockEvent("click", { bubbles: true }));
    });
    copyMenuItem = findByTestId(mockDocument.body, "dashboard-board-copy-link-board-123");
  }

  assert.ok(copyMenuItem, "copy link menu item should render");

  await act(async () => {
    copyMenuItem!.dispatchEvent(new MockEvent("click", { bubbles: true }));
  });

  assert.equal(clipboardWrites[0], "/dashboard/boards/board-123/board");

  await act(async () => {
    root.unmount();
  });

  globalThis.window = previousWindow;
  // @ts-expect-error test env
  globalThis.document = previousDocument;
  // @ts-expect-error test env
  globalThis.navigator = previousNavigator;
  // @ts-expect-error test env
  globalThis.self = previousSelf;
  globalThis.fetch = previousFetch;
  if (previousPublicSupabaseUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = previousPublicSupabaseUrl;
  if (previousSupabaseUrl) process.env.SUPABASE_URL = previousSupabaseUrl;

  for (const handle of process._getActiveHandles()) {
    if (typeof (handle as { unref?: () => void }).unref === "function") {
      handle.unref();
    }
  }
});
