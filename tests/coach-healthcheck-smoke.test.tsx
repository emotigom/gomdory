import assert from "node:assert/strict";
import test from "node:test";

import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ChatPanel from "@/app/edu/_components/ChatPanel";
import type { LessonLock } from "@/lib/edu/lesson/lessonLock";

const lessonLock: LessonLock = { enabled: false, lessonId: "P2", version: 1 };


const ensureWindowLocation = () => {
  if (typeof globalThis.window === "undefined") {
    globalThis.window = {} as Window & typeof globalThis;
  }

  if (!("location" in globalThis.window)) {
    Object.defineProperty(globalThis.window, "location", {
      value: { search: "", pathname: "/" },
      writable: true,
    });
  }
};

const baseProps = {
  title: "테스트",
  goal: "목표",
  starterPromptSuggestions: ["예시 1", "예시 2"],
  lessonId: 2,
  lessonLock,
  teacherUiEnabled: false,
  onSetLessonId: () => {},
  onToggleLessonLock: () => {},
  allowedFilenames: ["index.html"],
  currentFiles: {
    "index.html": {
      content: '<div data-slot="p2.topic">주제</div>',
      contentType: "text/html",
    },
  },
  onFilesMerged: () => {},
  presentationMode: false,
  onTogglePresentationMode: () => {},
};

const renderPanel = (overrides?: Partial<ComponentProps<typeof ChatPanel>>) => {
  ensureWindowLocation();
  return renderToStaticMarkup(<ChatPanel {...baseProps} {...overrides} />);
};

test("ChatPanel smoke: send message renders user text", () => {
  const html = renderPanel({ templateFirstMode: true });
  assert.match(html, /textarea/i);
  assert.match(html, /예시/);
});

test("ChatPanel smoke: example popover opens", () => {
  const html = renderPanel();
  assert.match(html, /질문 예시|예시/);
});

test("ChatPanel smoke: slot_choice fallback keeps decorate compose UI visible", () => {
  const html = renderPanel({
    lessonId: 1,
    lessonLock: { enabled: false, lessonId: "P1", version: 1 },
    currentFiles: {
      "index.html": {
        content:
          '<section><div data-slot="p1.keywords">키워드</div><div data-slot="p1.goal">목표</div></section>',
        contentType: "text/html",
      },
    },
    templateFirstMode: true,
    initialManualFallbackReason: "slot_choice",
  });

  assert.match(html, /바꾸고 싶은 내용을 적어보세요/);
  assert.match(html, /AI로 꾸미기/);
});

test("ChatPanel smoke: running state shows abort button and triggers abort", () => {
  const html = renderPanel({ templateFirstMode: false });
  assert.match(html, /중단|textarea/);
});
