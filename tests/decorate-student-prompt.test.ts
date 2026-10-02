import assert from "node:assert/strict";
import test from "node:test";

import { routeDecorateIntent } from "@/lib/edu/lesson/decorateIntentRouter";
import { classifyDecorateStyleIntent } from "@/lib/edu/lesson/decorateStyleIntent";
import { interpretStudentDecoratePrompt } from "@/lib/edu/lesson/studentDecorateUi";

const interpret = (prompt: string) => {
  const intent = routeDecorateIntent(prompt);
  const style = classifyDecorateStyleIntent({ prompt, intent });
  return interpretStudentDecoratePrompt({ prompt, intent, styleIntent: style.styleIntent });
};

test("student prompt interpretation: background gradient request", () => {
  const result = interpret("배경을 빨강/파랑 그라데이션으로 바꿔줘");
  assert.equal(result.normalizedPromptClass, "background");
  assert.equal(result.primaryIntent, "color");
});

test("student prompt interpretation: button emphasis request", () => {
  const result = interpret("버튼을 더 눈에 띄게");
  assert.equal(result.normalizedPromptClass, "button");
  assert.equal(result.primaryIntent, "emphasis");
});

test("student prompt interpretation: headline emphasis request", () => {
  const result = interpret("제목을 더 크게 잘 보이게");
  assert.equal(result.normalizedPromptClass, "headline");
  assert.equal(result.styleIntent, "headline_emphasis");
});

test("student prompt interpretation: mixed headline + cta request prefers headline deterministically", () => {
  const prompt = "제목을 더 크게 하고 버튼도 눈에 띄게";
  const first = interpret(prompt);
  const second = interpret(prompt);
  assert.equal(first.styleIntent, "headline_emphasis");
  assert.deepEqual(second, first);
});

test("student prompt interpretation: empty prompt is safe and non-mutating", () => {
  const prompt = "";
  const before = prompt;
  const result = interpret(prompt);
  assert.equal(prompt, before);
  assert.equal(result.styleIntent, "none");
});

test("student prompt interpretation: mood + image slot request", () => {
  const mood = interpret("좀 더 귀엽게 말랑하게");
  assert.equal(mood.normalizedPromptClass, "mood");
  const image = interpret("사진 자리에 고양이 사진 넣어줘");
  assert.equal(image.normalizedPromptClass, "image");
});


test("student prompt interpretation: colloquial normalize patterns", () => {
  const pretty = interpret("예쁘게 바꿔줘");
  assert.equal(pretty.normalizedPromptClass, "mood");
  const bigger = interpret("제목 더 크게 해줘");
  assert.equal(bigger.normalizedPromptClass, "headline");
  const insert = interpret("사진 넣어줘");
  assert.equal(insert.normalizedPromptClass, "image");
});
