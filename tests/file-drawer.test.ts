import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import FileDrawer from "@/app/dashboard/_components/FileDrawer";

if (typeof globalThis.MessageChannel !== "undefined") {
  const OriginalMessageChannel = globalThis.MessageChannel;
  globalThis.MessageChannel = class extends OriginalMessageChannel {
    constructor() {
      // @ts-expect-error: super constructor without args
      super();
      this.port1.unref?.();
      this.port2.unref?.();
    }
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
  value = "";
  placeholder = "";
  type = "";
  style: Record<string, string> = {};
  options: MockElement[] = [];
  private listeners = new Map<string, Array<(event: MockEvent) => void>>();

  constructor(tagName: string, ownerDocument: MockDocument) {
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.ownerDocument = ownerDocument;
  }

  appendChild(node: MockElement) {
    node.parentNode = this;
    this.childNodes.push(node);
    if (this.tagName === "SELECT" && node.tagName === "OPTION") {
      this.options.push(node);
    }
    return node;
  }

  removeChild(node: MockElement) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
    }
    if (this.tagName === "SELECT") {
      this.options = this.options.filter((option) => option !== node);
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
    if (name === "placeholder") {
      this.placeholder = value;
    }
    if (name === "type") {
      this.type = value;
    }
  }
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
    event.target = this;
    const handlers = this.listeners.get(event.type) ?? [];
    handlers.forEach((handler) => handler(event));
    if (event.bubbles && this.parentNode) {
      this.parentNode.dispatchEvent(event);
    } else if (event.bubbles && this.ownerDocument) {
      this.ownerDocument.dispatchEvent(event);
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

type ScheduledTimer = {
  id: number;
  runAt: number;
  callback: () => void;
};

function createFakeTimers() {
  let now = 0;
  let idSeq = 1;
  const queue: ScheduledTimer[] = [];

  const setTimeoutMock = (cb: TimerHandler, delay?: number) => {
    const callback = () => {
      if (typeof cb === "function") {
        cb();
      }
    };
    const timerId = idSeq++;
    const runAt = now + (delay ?? 0);
    queue.push({ id: timerId, runAt, callback });
    return timerId;
  };

  const clearTimeoutMock = (timerId: number) => {
    const index = queue.findIndex((item) => item.id === timerId);
    if (index >= 0) {
      queue.splice(index, 1);
    }
  };

  const advanceBy = (ms: number) => {
    const target = now + ms;
    while (true) {
      queue.sort((a, b) => a.runAt - b.runAt);
      const next = queue[0];
      if (!next || next.runAt > target) {
        break;
      }
      queue.shift();
      now = next.runAt;
      next.callback();
    }
    now = target;
  };

  return { setTimeoutMock, clearTimeoutMock, advanceBy };
}

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function findElement(root: MockElement, tagName: string): MockElement | null {
  if (root.tagName === tagName.toUpperCase()) return root;
  for (const child of root.childNodes) {
    const found = findElement(child, tagName);
    if (found) return found;
  }
  return null;
}

function findInputByPlaceholder(root: MockElement, placeholder: string): MockElement | null {
  if (root.tagName === "INPUT" && root.placeholder === placeholder) {
    return root;
  }
  for (const child of root.childNodes) {
    const found = findInputByPlaceholder(child, placeholder);
    if (found) return found;
  }
  return null;
}

test("file drawer search debounces fetch to one call per input change", async () => {
  const mockDocument = new MockDocument();
  const container = mockDocument.createElement("div");
  mockDocument.body.appendChild(container);
  const timers = createFakeTimers();

  const listeners = new Map<string, Array<(event: MockEvent) => void>>();
  const mockWindow = {
    document: mockDocument,
    location: { origin: "http://localhost" },
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
      (listeners.get(event.type) ?? []).forEach((handler) => handler(event));
      return true;
    },
    requestAnimationFrame: (cb: FrameRequestCallback) => timers.setTimeoutMock(() => cb(0), 0),
    cancelAnimationFrame: (id: number) => timers.clearTimeoutMock(id),
    setTimeout: timers.setTimeoutMock,
    clearTimeout: timers.clearTimeoutMock,
    HTMLIFrameElement: function HTMLIFrameElement() {} as unknown as typeof HTMLIFrameElement,
  } as unknown as Window;

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = mockWindow;
  globalThis.document = mockDocument as unknown as Document;

  let fetchCalls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, items: [], nextCursor: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  let root: Root | null = null;

  try {
    await act(async () => {
      root = createRoot(container as unknown as Element);
      root.render(React.createElement(FileDrawer, { boardId: "board-1" }));
    });

    await act(async () => {
      timers.advanceBy(400);
      await flushPromises();
    });
    const callsAfterOpen = fetchCalls;

    const input = findInputByPlaceholder(container, "파일명 검색");
    assert.ok(input, "search input should render");
    input.value = "math";

    await act(async () => {
      input.dispatchEvent(new MockEvent("input", { bubbles: true }));
      input.dispatchEvent(new MockEvent("change", { bubbles: true }));
    });
    await act(async () => {
      timers.advanceBy(300);
      await flushPromises();
    });

    assert.equal(fetchCalls, callsAfterOpen);

  } finally {
    await act(async () => {
      root?.unmount();
    });
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    for (const handle of process._getActiveHandles()) {
      if (typeof (handle as { unref?: () => void }).unref === "function") {
        handle.unref();
      }
    }
  }
});
