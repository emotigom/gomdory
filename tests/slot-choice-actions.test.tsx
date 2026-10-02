import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { SlotChoiceActions } from "@/app/edu/_components/SlotChoiceActions";

test("slot choice actions render buttons for lesson fallback", () => {
  const html = renderToStaticMarkup(
    <SlotChoiceActions
      lessonId="P2"
      onSelect={() => {
        return;
      }}
    />,
  );

  assert.match(html, /주제 바꾸기/);
  assert.match(html, /궁금한 질문 바꾸기/);
});
