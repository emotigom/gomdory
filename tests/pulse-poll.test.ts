import assert from "node:assert/strict";
import test from "node:test";

import { normalizePulseKind, PulseError } from "@/lib/data/pulse";
import { normalizePollOptions, normalizePollQuestion, PollError } from "@/lib/data/polls";

test("normalizePulseKind accepts known values", () => {
  assert.equal(normalizePulseKind("ok"), "ok");
  assert.equal(normalizePulseKind("unsure"), "unsure");
  assert.equal(normalizePulseKind("help"), "help");
});

test("normalizePulseKind rejects unknown values", () => {
  assert.throws(() => normalizePulseKind("maybe"), (error) => {
    assert.ok(error instanceof PulseError);
    assert.equal(error.code, "INVALID_KIND");
    return true;
  });
});

test("normalizePollQuestion trims and caps length", () => {
  const question = normalizePollQuestion("   긴 질문을 입력해요   ");
  assert.equal(question, "긴 질문을 입력해요");

  const longQuestion = "가".repeat(250);
  const trimmed = normalizePollQuestion(longQuestion);
  assert.equal(trimmed.length, 200);
});

test("normalizePollOptions validates option count and labels", () => {
  const options = normalizePollOptions([{ label: " A " }, { label: "B" }]);
  assert.equal(options.length, 2);
  assert.equal(options[0]?.label, "A");
});

test("normalizePollOptions rejects invalid payloads", () => {
  assert.throws(() => normalizePollOptions("not-array"), (error) => {
    assert.ok(error instanceof PollError);
    return true;
  });

  assert.throws(
    () => normalizePollOptions([{ label: "one" }]),
    (error) => error instanceof PollError && error.message.includes("2~6개"),
  );

  assert.throws(
    () =>
      normalizePollOptions([
        { id: "dup", label: "one" },
        { id: "dup", label: "two" },
      ]),
    (error) => error instanceof PollError && error.message.includes("중복"),
  );
});
