import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { useEffect } from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { usePresentGuide } from "@/app/s/[code]/present/usePresentGuide";

class MockEvent {
  type: string;
  bubbles: boolean;
  target: MockElement | null = null;

  constructor(type: string, options?: { bubbles?: boolean }) {
    this.type = type;
    this.bubbles = options?.bubbles ?? false;
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

  setAttribute() {}
  removeAttribute() {}

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
    const handlers = this.listeners.get(event.type) ?? [];
    handlers.forEach((handler) => handler(event));
    if (event.bubbles && this.parentNode) {
      this.parentNode.dispatchEvent(event);
    } else if (event.bubbles && this.ownerDocument !== this) {
      this.ownerDocument.dispatchEvent(event);
    }
    return true;
  }

  querySelectorAll() {
    return [] as MockElement[];
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

function collectText(node: MockElement): string {
  let result = node.textContent ?? "";
  node.childNodes.forEach((child) => {
    result += collectText(child);
  });
  return result;
}

function findButtonByText(node: MockElement, text: string): MockElement | null {
  if (node.nodeName === "BUTTON" && collectText(node).includes(text)) {
    return node;
  }
  for (const child of node.childNodes) {
    const found = findButtonByText(child, text);
    if (found) return found;
  }
  return null;
}

function GuideHarness({ onOpen }: { onOpen: (open: boolean) => void }) {
  const { open, dismiss } = usePresentGuide("TEST123", { openDelayMs: 5, autoCloseMs: 2000 });

  useEffect(() => {
    onOpen(open);
  }, [onOpen, open]);

  return open ? <button type="button" onClick={dismiss}>닫기</button> : <span>닫힘</span>;
}

test("present page redirects to the shared board", () => {
  const content = fs.readFileSync(path.join(process.cwd(), "app/s/[code]/present/page.tsx"), "utf8");
  assert.match(content, /redirect\(`\/s\/\$\{code\}`\)/);
});

test("guide overlay opens and dismissal is persisted", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  // @ts-expect-error: track HTMLElement
  const originalHTMLElement = globalThis.HTMLElement;
  // @ts-expect-error: track Node
  const originalNode = globalThis.Node;
  // @ts-expect-error: track Document ctor
  const originalDocumentCtor = globalThis.Document;
  // @ts-expect-error: track HTMLIFrameElement
  const originalHTMLIFrameElement = globalThis.HTMLIFrameElement;
  const mockDocument = new MockDocument();
  const container = mockDocument.createElement("div");
  mockDocument.body.appendChild(container);

  const listeners = new Map<string, Array<(event: MockEvent) => void>>();
  const mockWindow = {
    document: mockDocument,
    localStorage: {
      store: new Map<string, string>(),
      getItem(key: string) {
        return this.store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.store.set(key, value);
      },
      removeItem(key: string) {
        this.store.delete(key);
      },
    },
    matchMedia: () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
    addEventListener: (type: string, handler: (event: MockEvent) => void) => {
      const list = listeners.get(type) ?? [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener: (type: string, handler: (event: MockEvent) => void) => {
      const list = listeners.get(type);
      if (!list) return;
      listeners.set(
        type,
        list.filter((item) => item !== handler),
      );
    },
    dispatchEvent: (event: MockEvent) => {
      const list = listeners.get(event.type) ?? [];
      list.forEach((handler) => handler(event));
      return true;
    },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
  };

  // @ts-expect-error: align mock document view
  mockDocument.defaultView = mockWindow;

  (mockWindow as unknown as Record<string, unknown>).HTMLElement = MockElement;
  (mockWindow as unknown as Record<string, unknown>).Node = MockElement;
  (mockWindow as unknown as Record<string, unknown>).Document = MockDocument;
  (mockWindow as unknown as Record<string, unknown>).HTMLIFrameElement = class {};

  // @ts-expect-error: assign mock window/document for test
  globalThis.window = mockWindow;
  // @ts-expect-error: assign mock document for test
  globalThis.document = mockDocument;
  // @ts-expect-error: define HTMLElement for react checks
  globalThis.HTMLElement = MockElement;
  // @ts-expect-error: define Node for react checks
  globalThis.Node = MockElement;
  // @ts-expect-error: define Document for react checks
  globalThis.Document = MockDocument as unknown as typeof Document;
  // @ts-expect-error: define HTMLIFrameElement for react checks
  globalThis.HTMLIFrameElement = class {} as unknown as typeof HTMLIFrameElement;

  let openState = false;
  const root = createRoot(container as unknown as Element);
  await act(async () => {
    root.render(<GuideHarness onOpen={(next) => (openState = next)} />);
  });

  await act(async () => {
    await new Promise((resolve) => mockWindow.setTimeout(resolve, 20));
  });

  assert.equal(openState, true);

  const closeButton = findButtonByText(container, "닫기");
  assert.ok(closeButton);
  closeButton.dispatchEvent(new MockEvent("click", { bubbles: true }));

  await act(async () => {
    await new Promise((resolve) => mockWindow.setTimeout(resolve, 0));
  });

  assert.equal(mockWindow.localStorage.getItem("presentGuideDismissed:TEST123"), "1");

  await act(async () => {
    root.unmount();
  });
  if (originalWindow === undefined) {
    // @ts-expect-error: cleanup test window
    delete globalThis.window;
  } else {
    // @ts-expect-error: restore window
    globalThis.window = originalWindow;
  }
  if (originalDocument === undefined) {
    // @ts-expect-error: cleanup test document
    delete globalThis.document;
  } else {
    // @ts-expect-error: restore document
    globalThis.document = originalDocument;
  }
  if (originalHTMLElement === undefined) {
    // @ts-expect-error: cleanup HTMLElement
    delete globalThis.HTMLElement;
  } else {
    // @ts-expect-error: restore HTMLElement
    globalThis.HTMLElement = originalHTMLElement;
  }
  if (originalNode === undefined) {
    // @ts-expect-error: cleanup Node
    delete globalThis.Node;
  } else {
    // @ts-expect-error: restore Node
    globalThis.Node = originalNode;
  }
  if (originalDocumentCtor === undefined) {
    // @ts-expect-error: cleanup Document ctor
    delete globalThis.Document;
  } else {
    // @ts-expect-error: restore Document ctor
    globalThis.Document = originalDocumentCtor;
  }
  if (originalHTMLIFrameElement === undefined) {
    // @ts-expect-error: cleanup HTMLIFrameElement
    delete globalThis.HTMLIFrameElement;
  } else {
    // @ts-expect-error: restore HTMLIFrameElement
    globalThis.HTMLIFrameElement = originalHTMLIFrameElement;
  }
  if (typeof globalThis.window !== "undefined") {
    const existing = (globalThis.window as unknown as Record<string, unknown>).HTMLIFrameElement;
    if (!existing) {
      // @ts-expect-error: ensure iframe element exists for downstream tests
      (globalThis.window as unknown as Record<string, unknown>).HTMLIFrameElement = class {};
    }
  }
});
