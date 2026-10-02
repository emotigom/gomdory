import assert from "node:assert/strict";
import test, { after } from "node:test";
import React, { useState } from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { GalleryCard } from "@/components/gallery/GalleryCard";

type TimerHandle = ReturnType<typeof setTimeout>;

function createTimerMocks() {
  const timeouts: TimerHandle[] = [];
  const intervals: TimerHandle[] = [];

  return {
    setTimeout: (...args: Parameters<typeof setTimeout>) => {
      const id = setTimeout(...args);
      timeouts.push(id);
      return id;
    },
    clearTimeout: (id: TimerHandle) => {
      clearTimeout(id);
    },
    setInterval: (...args: Parameters<typeof setInterval>) => {
      const id = setInterval(...args);
      intervals.push(id);
      return id;
    },
    clearInterval: (id: TimerHandle) => {
      clearInterval(id);
    },
    dispose: () => {
      while (timeouts.length) {
        clearTimeout(timeouts.pop() as TimerHandle);
      }
      while (intervals.length) {
        clearInterval(intervals.pop() as TimerHandle);
      }
    },
  };
}

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

  click() {
    this.dispatchEvent(new MockEvent("click", { bubbles: true }));
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

function findAllInteractive(root: MockElement, attribute: string): MockElement[] {
  const results: MockElement[] = [];
  if (root.attributes[attribute]) {
    results.push(root);
  }
  for (const child of root.childNodes) {
    results.push(...findAllInteractive(child, attribute));
  }
  return results;
}

function findByTestId(root: MockElement, value: string): MockElement | null {
  if (root.attributes["data-testid"] === value) return root;
  for (const child of root.childNodes) {
    const found = findByTestId(child, value);
    if (found) return found;
  }
  return null;
}

function findByText(root: MockElement, text: string): MockElement | null {
  if (root.textContent.includes(text)) return root;
  for (const child of root.childNodes) {
    const found = findByText(child, text);
    if (found) return found;
  }
  return null;
}

test("gallery card only activates CTA buttons", async () => {
  const mockDocument = new MockDocument();
  const container = mockDocument.createElement("div");
  mockDocument.body.appendChild(container);
  const timers = createTimerMocks();

  const mockWindow = {
    document: mockDocument,
    location: { origin: "http://localhost" },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    requestAnimationFrame: (cb: FrameRequestCallback) =>
      timers.setTimeout(() => cb(0), 0) as unknown as number,
    cancelAnimationFrame: (id: number) => timers.clearTimeout(id as unknown as TimerHandle),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
    Node: MockElement,
    Element: MockElement,
    HTMLIFrameElement: function HTMLIFrameElementMock() {},
  } as unknown as Window & { HTMLIFrameElement: typeof HTMLIFrameElement };
  (mockDocument as unknown as { defaultView?: Window }).defaultView = mockWindow;
  (mockDocument as unknown as { defaultView?: Window }).defaultView = mockWindow;

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  const previousElement = globalThis.Element;
  const previousIFrame = (globalThis as unknown as { HTMLIFrameElement?: unknown }).HTMLIFrameElement;
  globalThis.window = mockWindow as Window & typeof globalThis;
  globalThis.document = mockDocument as unknown as Document;
  globalThis.Node = MockElement as unknown as typeof Node;
  globalThis.Element = MockElement as unknown as typeof Element;
  (globalThis as unknown as { HTMLIFrameElement: unknown }).HTMLIFrameElement =
    mockWindow.HTMLIFrameElement;

  let previewCount = 0;
  let primaryCount = 0;

  const template = {
    id: "t-1",
    title: "갤러리 카드",
    description: "CTA-only 테스트",
    tags: ["math", "science", "stem"],
    coverUrl: null,
    installCount: 10,
    createdAt: new Date().toISOString(),
    accessLevel: "free" as const,
    isFeatured: false,
    featuredRank: null,
    gradeBand: "elem" as const,
    subject: "math",
  };

  function Wrapper() {
    const [locked, setLocked] = useState(false);
    return (
      <GalleryCard
        template={template}
        locked={locked}
        onPreview={() => {
          previewCount += 1;
        }}
        onPrimary={() => {
          primaryCount += 1;
          setLocked(true);
        }}
      />
    );
  }

  const root = createRoot(container as unknown as Element);
  await act(async () => {
    root.render(<Wrapper />);
  });

  const article = container.childNodes.find((node) => (node as MockElement).tagName === "ARTICLE") as MockElement;
  assert.ok(article);

  await act(async () => {
    article.dispatchEvent(new MockEvent("click", { bubbles: true }));
  });
  assert.equal(previewCount, 0);
  assert.equal(primaryCount, 0);

  const previewButton = findByTestId(container, "gallery-preview-t-1");
  const installButton = findByTestId(container, "gallery-install-t-1");
  assert.ok(previewButton);
  assert.ok(installButton);
  assert.equal(typeof (previewButton as MockElement).click, "function");
  assert.equal(typeof (installButton as MockElement).click, "function");
  const interactive = findAllInteractive(container, "data-interactive");
  assert.ok(interactive.length >= 2);

  await act(async () => {
    root.unmount();
  });
  timers.dispose();
  globalThis.window = previousWindow;
  globalThis.document = previousDocument;
  globalThis.Node = previousNode as typeof Node;
  globalThis.Element = previousElement as typeof Element;
  (globalThis as unknown as { HTMLIFrameElement?: unknown }).HTMLIFrameElement = previousIFrame;
});

after(() => {
  setTimeout(() => {
    process.exit(process.exitCode ?? 0);
  }, 0);
});

test("gallery card disables motion when prefers-reduced-motion is set", async () => {
  const mockDocument = new MockDocument();
  const container = mockDocument.createElement("div");
  mockDocument.body.appendChild(container);
  const timers = createTimerMocks();

  const mockWindow = {
    document: mockDocument,
    location: { origin: "http://localhost" },
    matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    requestAnimationFrame: (cb: FrameRequestCallback) =>
      timers.setTimeout(() => cb(0), 0) as unknown as number,
    cancelAnimationFrame: (id: number) => timers.clearTimeout(id as unknown as TimerHandle),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
    Node: MockElement,
    Element: MockElement,
    HTMLIFrameElement: function HTMLIFrameElementMock() {},
  } as unknown as Window & { HTMLIFrameElement: typeof HTMLIFrameElement };

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  const previousElement = globalThis.Element;
  const previousIFrame = (globalThis as unknown as { HTMLIFrameElement?: unknown }).HTMLIFrameElement;
  globalThis.window = mockWindow as Window & typeof globalThis;
  globalThis.document = mockDocument as unknown as Document;
  globalThis.Node = MockElement as unknown as typeof Node;
  globalThis.Element = MockElement as unknown as typeof Element;
  (globalThis as unknown as { HTMLIFrameElement: unknown }).HTMLIFrameElement =
    mockWindow.HTMLIFrameElement;

  const template = {
    id: "t-2",
    title: "정적 카드",
    description: null,
    tags: [],
    coverUrl: null,
    installCount: 0,
    createdAt: new Date().toISOString(),
    accessLevel: "free" as const,
    isFeatured: false,
    featuredRank: null,
  };

  const root = createRoot(container as unknown as Element);
  await act(async () => {
    root.render(
      <GalleryCard
        template={template}
        onPreview={() => {}}
        onPrimary={() => {}}
      />,
    );
  });

  const card = container.childNodes.find((node) => (node as MockElement).tagName === "ARTICLE") as MockElement;
  assert.ok(card);
  assert.equal(card.attributes["data-motion"], "static");

  await act(async () => {
    root.unmount();
  });
  timers.dispose();
  globalThis.window = previousWindow;
  globalThis.document = previousDocument;
  globalThis.Node = previousNode as typeof Node;
  globalThis.Element = previousElement as typeof Element;
  (globalThis as unknown as { HTMLIFrameElement?: unknown }).HTMLIFrameElement = previousIFrame;
});
