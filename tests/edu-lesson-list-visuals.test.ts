import assert from "node:assert/strict";
import test from "node:test";

import {
  getLessonCardA11yLabel,
  getLessonIconName,
  getLessonIconSymbol,
  getLessonVisualVariant,
} from "@/app/edu/lesson/lessonListUi";

test("lesson icon and visual variant metadata map core lessons and free mode", () => {
  assert.equal(getLessonIconName({ id: 1, title: "1교시" }), "profile");
  assert.equal(getLessonIconName({ id: 2, title: "2교시" }), "search");
  assert.equal(getLessonIconName({ id: 3, title: "3교시" }), "game");
  assert.equal(getLessonIconName({ id: 4, title: "4교시" }), "gallery");
  assert.equal(getLessonIconName({ id: 0, title: "자유모드" }), "sparkles");

  assert.equal(getLessonVisualVariant({ id: 1, title: "1교시" }), "identity");
  assert.equal(getLessonVisualVariant({ id: 2, title: "2교시" }), "explore");
  assert.equal(getLessonVisualVariant({ id: 3, title: "3교시" }), "play");
  assert.equal(getLessonVisualVariant({ id: 4, title: "4교시" }), "showcase");
  assert.equal(getLessonVisualVariant({ id: 0, title: "자유모드" }), "free");
});

test("unknown lesson ids use safe visual fallbacks", () => {
  assert.equal(getLessonIconName({ id: 99, title: "99교시" }), "default");
  assert.equal(getLessonVisualVariant({ id: 99, title: "99교시" }), "default");
  assert.equal(getLessonIconSymbol("default"), "•");
});

test("free mode keeps distinct visual identity and stable a11y label", () => {
  assert.equal(getLessonIconSymbol(getLessonIconName({ id: 0, title: "" })), "✧");

  const label = getLessonCardA11yLabel({
    lesson: { id: 0, title: "" },
    progressState: "visited",
    isFreeMode: true,
  });
  assert.equal(label, "자유모드 · 빈 페이지 - 방문함 - 빈 캔버스에서 자유 시작 - 원하는 내용을 처음부터 자유롭게 만들 수 있어요.");
});
