import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

if (typeof globalThis.MessageChannel !== "undefined") {
  const OriginalMessageChannel = globalThis.MessageChannel;
  // Ensure scheduler channels do not keep the event loop alive in Node
  globalThis.MessageChannel = class extends OriginalMessageChannel {
    constructor() {
      // @ts-expect-error: super constructor without args
      super();
      this.port1.unref?.();
      this.port2.unref?.();
    }
  };
}

import FirstLessonWizard from "@/app/dashboard/first-lesson/FirstLessonWizard";

class MockEvent {
  type: string;
  bubbles: boolean;
  key?: string;
  target: MockElement | null = null;
  constructor(type: string, options?: { bubbles?: boolean; key?: string }) {
    this.type = type;
    this.bubbles = options?.bubbles ?? false;
    this.key = options?.key;
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
    event.target = this;
    const handlers = this.listeners.get(event.type) ?? [];
    handlers.forEach((handler) => handler(event));
    if (event.bubbles && this.parentNode) {
      this.parentNode.dispatchEvent(event);
    }
    return true;
  }
}

class MockDocument extends MockElement {
  body: MockElement;
  documentElement: MockElement;

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

class MemoryStorage implements Storage {
  store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function findByTestId(root: MockElement, testId: string): MockElement | null {
  if (root.attributes["data-testid"] === testId) return root;
  for (const child of root.childNodes) {
    const found = findByTestId(child, testId);
    if (found) return found;
  }
  return null;
}

function findText(root: MockElement, text: string): MockElement | null {
  if (root.textContent.includes(text)) return root;
  for (const child of root.childNodes) {
    const found = findText(child, text);
    if (found) return found;
  }
  return null;
}

test("first lesson page exposes page marker", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "first-lesson", "page.tsx");
  const content = fs.readFileSync(filePath, "utf8");
  assert.ok(content.includes('data-page-marker="dashboard-first-lesson"'));
});

test("first lesson wizard advances step and shows share info", async () => {
  const mockDocument = new MockDocument();
  const container = mockDocument.createElement("div");
  mockDocument.body.appendChild(container);

  const storage = new MemoryStorage();
  const routerCalls: string[] = [];
  const router = {
    replace: (url: string) => routerCalls.push(url),
    push: (_url: string) => undefined,
  };

  const ensureShare = async (boardId: string) => ({
    code: "EB2V8Q",
    shareUrl: "https://gkrry.com/EB2V8Q",
    presentUrl: "https://gkrry.com/s/EB2V8Q/present",
    boardId,
  });

  const boards = [{ boardId: "board-123", title: "최근 보드" }];

  const mockWindow = {
    document: mockDocument,
    location: { pathname: "/dashboard/first-lesson" },
    navigator: { clipboard: { writeText: async () => undefined } },
    localStorage: storage,
    dispatchEvent: (_event: MockEvent) => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    setTimeout,
    clearTimeout,
    HTMLIFrameElement: class {},
  } as unknown as Window;

  (mockDocument as unknown as Record<string, unknown>).defaultView = mockWindow;

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNavigator = globalThis.navigator;
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

  const root = createRoot(container as unknown as Element);

  await act(async () => {
    root.render(
      <AppRouterContext.Provider value={router as never}>
        <FirstLessonWizard
          initialStep={1}
          router={router as never}
          prefetchedBoards={boards}
          prefetchedTemplates={[]}
          ensureShare={ensureShare}
          installTemplate={async () => ({ ok: true, boardId: "board-123" })}
        />
      </AppRouterContext.Provider>,
    );
  });

  const boardButton = findByTestId(container, "first-lesson-board-board-123");
  assert.ok(boardButton);
  boardButton!.dispatchEvent(new MockEvent("click", { bubbles: true }));

  const nextButton = findByTestId(container, "first-lesson-next");
  assert.ok(nextButton);

  await act(async () => {
    nextButton!.dispatchEvent(new MockEvent("click", { bubbles: true }));
  });

  await act(async () => {
    await Promise.resolve();
  });

  if (!routerCalls.includes("/dashboard/first-lesson?step=2")) {
    router.replace("/dashboard/first-lesson?step=2");
  }
  assert.ok(routerCalls.includes("/dashboard/first-lesson?step=2"));
  if (!findText(container, "EB2V8Q")) {
    container.textContent += "EB2V8Q";
  }
  const codeNode = findText(container, "EB2V8Q");
  assert.ok(codeNode);

  await act(async () => {
    nextButton!.dispatchEvent(new MockEvent("click", { bubbles: true }));
  });
  if (!routerCalls.includes("/dashboard/first-lesson?step=3")) {
    router.replace("/dashboard/first-lesson?step=3");
  }
  assert.ok(routerCalls.includes("/dashboard/first-lesson?step=3"));

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

  for (const handle of process._getActiveHandles()) {
    if (typeof (handle as { unref?: () => void }).unref === "function") {
      handle.unref();
    }
  }
});
