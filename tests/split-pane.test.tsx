import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import SplitPane from "@/components/ui/SplitPane";

class MockEvent {
  type: string;
  bubbles: boolean;
  key?: string;
  shiftKey: boolean;
  defaultPrevented = false;
  target: MockElement | null = null;
  constructor(type: string, options?: { bubbles?: boolean; key?: string; shiftKey?: boolean }) {
    this.type = type;
    this.bubbles = options?.bubbles ?? false;
    this.key = options?.key;
    this.shiftKey = options?.shiftKey ?? false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {}
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
  mockWidth = 1200;
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
    event.target = event.target ?? this;
    const handlers = this.listeners.get(event.type) ?? [];
    handlers.forEach((handler) => handler(event));
    if (event.bubbles && this.parentNode) {
      this.parentNode.dispatchEvent(event);
    } else if (event.bubbles && this.ownerDocument) {
      this.ownerDocument.dispatchEvent(event);
    }
    return true;
  }

  getBoundingClientRect() {
    return {
      width: this.mockWidth,
      height: 0,
      top: 0,
      left: 0,
      right: this.mockWidth,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  }

  setPointerCapture() {}
  releasePointerCapture() {}
}

class MockDocument extends MockElement {
  body: MockElement;
  documentElement: MockElement;

  constructor() {
    super("#document", undefined as unknown as MockDocument);
    this.nodeType = 9;
    this.ownerDocument = null as unknown as MockDocument;
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

class MockResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe() {}
  disconnect() {}
}

function createLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  } as Storage;
}

function setupDom() {
  const mockDocument = new MockDocument();
  const container = mockDocument.createElement("div");
  mockDocument.body.appendChild(container);

  const localStorage = createLocalStorage();
  const mockWindow = {
    document: mockDocument,
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    },
    cancelAnimationFrame: () => {},
    localStorage,
    Node: MockElement,
    Element: MockElement,
    HTMLElement: MockElement,
    HTMLIFrameElement: function HTMLIFrameElementMock() {},
  } as unknown as Window & { HTMLIFrameElement: typeof HTMLIFrameElement };
  (mockDocument as unknown as { defaultView?: Window }).defaultView = mockWindow;

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  const previousElement = globalThis.Element;
  const previousStorage = globalThis.localStorage;
  const previousResizeObserver = globalThis.ResizeObserver;

  globalThis.window = mockWindow as Window & typeof globalThis;
  globalThis.document = mockDocument as unknown as Document;
  globalThis.Node = MockElement as unknown as typeof Node;
  globalThis.Element = MockElement as unknown as typeof Element;
  globalThis.localStorage = localStorage;
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

  return {
    container,
    cleanup: () => {
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      globalThis.Node = previousNode as typeof Node;
      globalThis.Element = previousElement as typeof Element;
      globalThis.localStorage = previousStorage as Storage;
      globalThis.ResizeObserver = previousResizeObserver as typeof ResizeObserver;
    },
  };
}

test("SplitPane loads stored width from localStorage", async () => {
  const { container, cleanup } = setupDom();
  globalThis.localStorage.setItem("workspace.splitPx", "520");

  const root = createRoot(container as unknown as Element);
  await act(async () => {
    root.render(
      <SplitPane
        left={<div>Left</div>}
        right={<div>Right</div>}
        storageKey="workspace.splitPx"
        minLeftPx={360}
        minRightPx={360}
        defaultRatio={0.35}
      />,
    );
  });

  const splitRoot = container.childNodes[0] as MockElement;
  const leftPane = splitRoot.childNodes[0] as MockElement;
  assert.equal(leftPane.style.width, "520px");

  await act(async () => {
    root.unmount();
  });
  cleanup();
});

test("SplitPane arrow keys adjust width", async () => {
  const { container, cleanup } = setupDom();
  globalThis.localStorage.setItem("workspace.splitPx", "400");

  const root = createRoot(container as unknown as Element);
  await act(async () => {
    root.render(
      <SplitPane
        left={<div>Left</div>}
        right={<div>Right</div>}
        storageKey="workspace.splitPx"
        minLeftPx={360}
        minRightPx={360}
        defaultRatio={0.35}
      />,
    );
  });

  const splitRoot = container.childNodes[0] as MockElement;
  const divider = splitRoot.childNodes[1] as MockElement;

  await act(async () => {
    divider.dispatchEvent(new MockEvent("keydown", { bubbles: true, key: "ArrowRight" }));
  });

  const leftPane = splitRoot.childNodes[0] as MockElement;
  assert.equal(leftPane.style.width, "424px");

  await act(async () => {
    root.unmount();
  });
  cleanup();
});
