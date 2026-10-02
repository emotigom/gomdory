import test from "node:test";
import assert from "node:assert/strict";

import { formatBoardActivityLabel } from "@/lib/boards/activity";

test("formatBoardActivityLabel maps supported audit actions", () => {
  assert.equal(formatBoardActivityLabel("card_created"), "카드 생성");
  assert.equal(formatBoardActivityLabel("card_updated"), "카드 수정");
  assert.equal(formatBoardActivityLabel("card_attachment_added"), "파일 첨부");
  assert.equal(formatBoardActivityLabel("card_link_added"), "링크 추가");
});
