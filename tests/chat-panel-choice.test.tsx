import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import ChatPanel from "@/app/edu/_components/ChatPanel";
import type { LessonLock } from "@/lib/edu/lesson/lessonLock";

const ensureWindowLocation = () => {
  if (typeof globalThis.window === "undefined") {
    globalThis.window = {} as Window & typeof globalThis;
  }
  if (!("location" in window)) {
    Object.defineProperty(window, "location", {
      value: { search: "" },
      writable: true,
    });
  }
};

test("ChatPanel shows student decorate suggestions when slot choice fallback is active", () => {
  ensureWindowLocation();
  const lessonLock: LessonLock = { enabled: false, lessonId: "P1", version: 1 };
  const html = renderToStaticMarkup(
    <ChatPanel
      title="테스트"
      goal="목표"
      starterPromptSuggestions={[]}
      lessonId={1}
      lessonLock={lessonLock}
      teacherUiEnabled={false}
      onSetLessonId={() => {}}
      onToggleLessonLock={() => {}}
      allowedFilenames={["index.html"]}
      currentFiles={{
        "index.html": { content: "<html></html>", contentType: "text/html" },
      }}
      onFilesMerged={() => {}}
      presentationMode={false}
      onTogglePresentationMode={() => {}}
      templateFirstMode
      initialManualFallbackReason="slot_choice"
    />,
  );

  assert.match(html, /student-decorate-suggestions/);
  assert.match(html, /AI로 꾸미기/);
  assert.match(html, /제목을 더 크게 보여줘/);
});
