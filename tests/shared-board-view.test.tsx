import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

import ColumnsView from "@/app/s/[code]/_components/layouts/ColumnsView";
import GalleryView from "@/app/s/[code]/_components/layouts/GalleryView";
import StreamView from "@/app/s/[code]/_components/layouts/StreamView";
import WallView from "@/app/s/[code]/_components/layouts/WallView";
import CardPreviewModal from "@/app/s/[code]/_legacy/CardPreviewModal";
import { resolveSharedBoardView } from "@/lib/boards/resolveSharedBoardView";
import type { StudentBoardModel, StudentCard } from "@/lib/student/boardModel";

class MockEvent {
  type: string;
  bubbles: boolean;
  key?: string;
  shiftKey?: boolean;
  target: MockElement | null = null;

  constructor(type: string, options?: { bubbles?: boolean; key?: string; shiftKey?: boolean }) {
    this.type = type;
    this.bubbles = options?.bubbles ?? false;
    this.key = options?.key;
    this.shiftKey = options?.shiftKey;
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

const demoCard: StudentCard = {
  id: "card-1",
  kind: "note",
  title: "Demo text",
  text: "Demo text",
  createdAt: new Date().toISOString(),
  authorLabel: "학생",
  columnKey: "posts",
};

const demoModel: StudentBoardModel = {
  cards: [demoCard],
  pinnedCards: [],
  columns: [
    {
      key: "posts",
      title: "게시물",
      cards: [demoCard],
    },
  ],
};

const VIEW_COMPONENTS = {
  wall: WallView,
  columns: ColumnsView,
  gallery: GalleryView,
  stream: StreamView,
};

test("shared board view param renders the matched component", () => {
  (["wall", "columns", "gallery", "stream"] as const).forEach((viewParam) => {
    const view = resolveSharedBoardView(viewParam, null);
    const ViewComponent = VIEW_COMPONENTS[view];
    const html = renderToStaticMarkup(
      <ViewComponent
        model={demoModel}
        onOpen={() => {}}
        tvMode={false}
      />,
    );
    assert.ok(html.includes(`data-view="${view}"`));
  });
});

test("preview modal closes on Escape", async () => {
  // @ts-expect-error: test browser global
  const previousSelf = globalThis.self;
  const mockDocument = new MockDocument();
  const container = mockDocument.createElement("div");
  mockDocument.body.appendChild(container);

  const listeners = new Map<string, Array<(event: MockEvent) => void>>();
  const mockWindow = {
    document: mockDocument,
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
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    setTimeout,
    clearTimeout,
  } as unknown as Window;

  // @ts-expect-error: align browser globals for Next client effects
  globalThis.self = window;
  const root = createRoot(container as unknown as Element);
  let closed = false;

  await act(async () => {
    root.render(
      <SearchParamsContext.Provider value={new URLSearchParams()}>
        <CardPreviewModal
          items={[demoCard]}
          activeId={demoCard.id}
          onClose={() => {
            closed = true;
          }}
          onNext={() => {}}
          onPrev={() => {}}
          tvMode={false}
        />
      </SearchParamsContext.Provider>,
    );
  });

  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });

  assert.equal(closed, true);

  await act(async () => {
    root.unmount();
  });
  // @ts-expect-error: restore test browser global
  globalThis.self = previousSelf;
});
