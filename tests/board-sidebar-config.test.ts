import assert from "node:assert/strict";
import test from "node:test";

import { parseBoardSidebarConfig } from "@/lib/site-content/boardSidebarConfig";

test("parseBoardSidebarConfig accepts valid payload", () => {
  const parsed = parseBoardSidebarConfig(
    JSON.stringify({
      tabs: [
        {
          id: "lesson",
          label: "수업",
          contentBlocks: [
            {
              id: "lesson_tip",
              title: "오늘 수업",
              body: "짧은 안내 텍스트",
              links: [{ label: "사용법", href: "/community?tab=usage" }],
            },
          ],
          items: [
            { type: "action", id: "eduLessonLink", label: "EDU 4교시 링크 만들기" },
            { type: "action", id: "eduPracticeTemplate", label: "4교시 실습 템플릿 생성" },
            { type: "link", label: "사용법", href: "/community?tab=usage" },
          ],
        },
      ],
    }),
  );

  assert.ok(parsed);
  assert.equal(parsed?.tabs.length, 1);
  assert.equal(parsed?.tabs[0]?.items.length, 3);
  assert.equal(parsed?.tabs[0]?.contentBlocks.length, 1);
});

test("parseBoardSidebarConfig rejects unknown action id", () => {
  const parsed = parseBoardSidebarConfig(
    JSON.stringify({
      tabs: [
        {
          id: "lesson",
          label: "수업",
          items: [{ type: "action", id: "unknownAction", label: "실패" }],
        },
      ],
    }),
  );

  assert.equal(parsed, null);
});

test("parseBoardSidebarConfig rejects invalid link href for fallback", () => {
  const parsed = parseBoardSidebarConfig(
    JSON.stringify({
      tabs: [
        {
          id: "lesson",
          label: "수업",
          items: [{ type: "link", label: "bad", href: "javascript:alert(1)" }],
        },
      ],
    }),
  );

  assert.equal(parsed, null);
});

test("parseBoardSidebarConfig rejects duplicate tab ids for fallback", () => {
  const parsed = parseBoardSidebarConfig(
    JSON.stringify({
      tabs: [
        { id: "lesson", label: "수업", items: [] },
        { id: "lesson", label: "중복", items: [] },
      ],
    }),
  );

  assert.equal(parsed, null);
});


test("parseBoardSidebarConfig rejects too long content block body", () => {
  const parsed = parseBoardSidebarConfig(
    JSON.stringify({
      tabs: [
        {
          id: "lesson",
          label: "수업",
          contentBlocks: [
            {
              id: "lesson_tip",
              title: "오늘 수업",
              body: "a".repeat(601),
              links: [],
            },
          ],
          items: [],
        },
      ],
    }),
  );

  assert.equal(parsed, null);
});

test("parseBoardSidebarConfig rejects invalid content block href", () => {
  const parsed = parseBoardSidebarConfig(
    JSON.stringify({
      tabs: [
        {
          id: "lesson",
          label: "수업",
          contentBlocks: [
            {
              id: "lesson_tip",
              title: "오늘 수업",
              body: "짧은 안내",
              links: [{ label: "외부", href: "http://example.com" }],
            },
          ],
          items: [],
        },
      ],
    }),
  );

  assert.equal(parsed, null);
});

test("parseBoardSidebarConfig rejects too many content blocks per tab", () => {
  const parsed = parseBoardSidebarConfig(
    JSON.stringify({
      tabs: [
        {
          id: "lesson",
          label: "수업",
          contentBlocks: [
            { id: "b1", title: "제목1", body: "본문1", links: [] },
            { id: "b2", title: "제목2", body: "본문2", links: [] },
            { id: "b3", title: "제목3", body: "본문3", links: [] },
          ],
          items: [],
        },
      ],
    }),
  );

  assert.equal(parsed, null);
});
