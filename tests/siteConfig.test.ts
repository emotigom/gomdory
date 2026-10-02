import assert from "node:assert/strict";
import test from "node:test";

import {
  isBlockedHost,
  isSensitivePath,
  isShortHost,
  isStudentPath,
  isTeacherHost,
  SHORT_PREFERRED_HOST,
} from "@/lib/http/siteConfig";

test("host classification recognizes short and teacher hosts", () => {
  assert.equal(SHORT_PREFERRED_HOST, "www.gkrry.com");
  assert.equal(isShortHost("g.gkrry.com"), false);
  assert.equal(isShortHost("gkrry.com"), true);
  assert.equal(isTeacherHost("www.gomdory.com"), true);
});

test("path classification recognizes student and sensitive paths", () => {
  assert.equal(isStudentPath("/s/abc"), true);
  assert.equal(isStudentPath("/k/ABCD"), true);
  assert.equal(isStudentPath("/x/demo"), true);
  assert.equal(isStudentPath("/6h9k2m"), true);
  assert.equal(isStudentPath("/6h9k2m/present"), true);
  assert.equal(isStudentPath("/6h9k2m/slides"), true);
  assert.equal(isSensitivePath("/dashboard"), true);
  assert.equal(isSensitivePath("/templates"), true);
});

test("blocked host detection rejects gomdori domains", () => {
  assert.equal(isBlockedHost("gomdori.com"), true);
});
