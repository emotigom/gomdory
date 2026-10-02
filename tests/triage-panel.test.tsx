import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import TriagePanel from "@/app/dashboard/boards/[boardId]/class/_components/TriagePanel";

class MockEvent {
  type: string;
  bubbles: boolean;
  target: MockElement | null = null;
  currentTarget: MockElement | null = null;
  propagationStopped = false;

  constructor(type: string, options?: { bubbles?: boolean }) {
    this.type = type;
    this.bubbles = options?.bubbles ?? false;
  }

  stopPropagation() {
    this.propagationStopped = true;
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
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
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
    this.attributes.set(name, value);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
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
    if (
      event.bubbles &&
      !event.propagationStopped &&
      this.parentNode
    ) {
      this.parentNode.dispatchEvent(event);
    } else if (
      event.bubbles &&
      !event.propagationStopped &&
      this.ownerDocument &&
      this.ownerDocument !== (this as unknown as MockDocument)
    ) {
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

function findByTestId(node: MockElement, testId: string): MockElement | null {
  if (node.attributes.get("data-testid") === testId) {
    return node;
  }
  for (const child of node.childNodes) {
    const found = findByTestId(child, testId);
    if (found) return found;
  }
  return null;
}

function collectText(node: MockElement): string {
  let result = node.textContent ?? "";
  node.childNodes.forEach((child) => {
    result += collectText(child);
  });
  return result;
}

function findButtonsByText(
  node: MockElement,
  text: string,
  result: MockElement[] = [],
): MockElement[] {
  if (
    node.nodeName === "BUTTON" &&
    collectText(node).includes(text)
  ) {
    result.push(node);
  }

  for (const child of node.childNodes) {
    findButtonsByText(child, text, result);
  }

  return result;
}

function findByText(node: MockElement, text: string): MockElement | null {
  if (collectText(node).includes(text)) {
    return node;
  }
  for (const child of node.childNodes) {
    const found = findByText(child, text);
    if (found) return found;
  }
  return null;
}

async function flushUiWork() {
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  await Promise.resolve();
}

const baseItem = {
  id: "action-1",
  boardId: "00000000-0000-4000-8000-000000000000",
  kind: "question" as const,
  text: "테스트 질문",
  createdAt: new Date("2024-01-01T10:00:00Z").toISOString(),
  status: "pending" as const,
  pinned: false,
};

test("triage panel renders pending entry and updates optimistically", async () => {
  const mockDocument = new MockDocument();
  const container = mockDocument.createElement("div");
  mockDocument.body.appendChild(container);

  const listeners = new Map<string, Array<(event: MockEvent) => void>>();
  const mockWindow = {
    document: mockDocument,
    location: { origin: "http://localhost" },
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
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
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number,
    cancelAnimationFrame: (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
    setTimeout,
    clearTimeout,
  } as unknown as Window;

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (url.includes("/triage?")) {
      return {
        ok: true,
        headers: new Headers(),
        json: async () => ({ ok: true, items: [baseItem] }),
      } as Response;
    }
    return {
      ok: true,
      headers: new Headers(),
      json: async () => ({ ok: true, item: { ...baseItem, status: "approved" } }),
    } as Response;
  };

  globalThis.window = mockWindow as Window & typeof globalThis;
  globalThis.document = mockDocument as unknown as Document;

  const root = createRoot(container as unknown as Element);

  try {
    await act(async () => {
      root.render(
        createElement(TriagePanel, {
          boardId: "00000000-0000-4000-8000-000000000000",
        }),
      );
      await flushUiWork();
    });

    const badge = findByTestId(container, "triage-status-action-1");
    assert.ok(badge);
    assert.ok(collectText(badge).includes("대기"));

    const approveButtons = findButtonsByText(container, "승인");
    assert.ok(
      approveButtons.length >= 2,
      "expected approved tab and item approve action",
    );
    const approveButton = approveButtons.at(-1);
    assert.ok(approveButton);

    await act(async () => {
      approveButton.dispatchEvent(new MockEvent("click", { bubbles: true }));
      await flushUiWork();
    });

    assert.equal(findByTestId(container, "triage-status-action-1"), null);

    const approvedTab = findButtonsByText(container, "승인").at(0);
    assert.ok(approvedTab);

    await act(async () => {
      approvedTab.dispatchEvent(new MockEvent("click", { bubbles: true }));
      await flushUiWork();
    });

    const updatedBadge = findByTestId(container, "triage-status-action-1");
    assert.ok(updatedBadge);
    assert.ok(collectText(updatedBadge).includes("승인"));
  } finally {
    await act(async () => {
      root.unmount();
    });
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  }
});

test("triage panel rolls back on failure and shows toast", async () => {
  const mockDocument = new MockDocument();
  const container = mockDocument.createElement("div");
  mockDocument.body.appendChild(container);

  const listeners = new Map<string, Array<(event: MockEvent) => void>>();
  const mockWindow = {
    document: mockDocument,
    location: { origin: "http://localhost" },
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
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
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number,
    cancelAnimationFrame: (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
    setTimeout,
    clearTimeout,
  } as unknown as Window;

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (url.includes("/triage?")) {
      return {
        ok: true,
        headers: new Headers(),
        json: async () => ({ ok: true, items: [baseItem] }),
      } as Response;
    }
    return {
      ok: false,
      headers: new Headers(),
      json: async () => ({ ok: false, error: { message: "실패" } }),
    } as Response;
  };

  globalThis.window = mockWindow as Window & typeof globalThis;
  globalThis.document = mockDocument as unknown as Document;

  const root = createRoot(container as unknown as Element);

  try {
    await act(async () => {
      root.render(
        createElement(TriagePanel, {
          boardId: "00000000-0000-4000-8000-000000000000",
        }),
      );
      await flushUiWork();
    });

    const approveButtons = findButtonsByText(container, "승인");
    assert.ok(approveButtons.length >= 2);
    const approveButton = approveButtons.at(-1);
    assert.ok(approveButton);

    await act(async () => {
      approveButton.dispatchEvent(new MockEvent("click", { bubbles: true }));
      await flushUiWork();
    });

    const rollbackBadge = findByTestId(container, "triage-status-action-1");
    assert.ok(rollbackBadge);
    assert.ok(collectText(rollbackBadge).includes("대기"));

    const toast = findByText(container, "실패, 다시 시도");
    assert.ok(toast);
  } finally {
    await act(async () => {
      root.unmount();
    });
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  }
});
