import assert from "node:assert/strict";
import test from "node:test";

import {
  hasJt,
  isSampleLessonPath,
  parseBooleanEnvValue,
  shouldBlockWebllmDownload,
} from "@/lib/server/eduGating";

test("isSampleLessonPath matches only lesson 1..4", () => {
  assert.equal(isSampleLessonPath("/edu/lesson/1"), true);
  assert.equal(isSampleLessonPath("/edu/lesson/4/"), true);
  assert.equal(isSampleLessonPath("/edu/lesson/5"), false);
  assert.equal(isSampleLessonPath("/edu/lesson/2/extra"), false);
});

test("hasJt checks non-empty jt param", () => {
  assert.equal(hasJt(new URLSearchParams("jt=abc")), true);
  assert.equal(hasJt(new URLSearchParams("jt=   ")), false);
  assert.equal(hasJt(new URLSearchParams("code=abc")), false);
});

test("shouldBlockWebllmDownload blocks sample lesson without jt", () => {
  const blocked = new Request("https://www.gomdory.com/edu/lesson/2");
  const allowed = new Request("https://www.gomdory.com/edu/lesson/2?jt=share-token");
  const nonSample = new Request("https://www.gomdory.com/edu/lesson/7");

  assert.equal(shouldBlockWebllmDownload(blocked), true);
  assert.equal(shouldBlockWebllmDownload(allowed), false);
  assert.equal(shouldBlockWebllmDownload(nonSample), false);
});

test("parseBooleanEnvValue parses 1/0/true/false and fallback", () => {
  assert.equal(parseBooleanEnvValue("1", false), true);
  assert.equal(parseBooleanEnvValue("true", false), true);
  assert.equal(parseBooleanEnvValue("0", true), false);
  assert.equal(parseBooleanEnvValue("false", true), false);
  assert.equal(parseBooleanEnvValue("unknown", true), true);
  assert.equal(parseBooleanEnvValue(undefined, false), false);
});
