import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSimilarityText, similarityPercent, updateSimilaritySnapshot } from "@/lib/student-records/similarity";

test("bigram Dice normalizes whitespace and distinguishes text", () => {
  assert.equal(similarityPercent("동일 문구", "동일 문구"), 100);
  assert.equal(similarityPercent("동일\n\t문구", " 동일   문구 "), 100);
  assert.equal(normalizeSimilarityText(" a\n b "), "a b");
  assert.ok(similarityPercent("완전히 다른 문장", "xyz qwerty") < 20);
});

test("bigram Dice gives high, medium, and low scores without self comparison", () => {
  const same = "토론에서 근거를 들어 자신의 의견을 설명함.";
  const partlyChanged = "토론에서 사례를 들어 자신의 의견을 설명함.";
  const different = "실험 도구를 정리하고 관찰 결과를 표로 기록함.";
  assert.ok(similarityPercent(same, same) >= 80);
  assert.ok(similarityPercent(same, partlyChanged) >= 40);
  assert.ok(similarityPercent(same, different) < 40);
  const one = updateSimilaritySnapshot(undefined, [{ rowId: "only", text: same }]);
  assert.equal(one.pairs.size, 0);
  assert.equal(one.maxima.only, 0);
});

test("pair cache only recomputes pairs touching a changed row", () => {
  const rows = Array.from({ length: 200 }, (_, index) => ({ rowId: `row-${index}`, text: `관찰 문구 ${index} 내용` }));
  const initial = updateSimilaritySnapshot(undefined, rows);
  assert.equal(initial.calculations, 19_900);
  const changed = updateSimilaritySnapshot(initial, rows.map((row, index) => index === 17 ? { ...row, text: `${row.text} 수정` } : row));
  assert.equal(changed.calculations, 199);
  const unchanged = updateSimilaritySnapshot(changed, rows.map((row, index) => index === 17 ? { ...row, text: `${row.text} 수정` } : row));
  assert.equal(unchanged.calculations, 0);
});

test("editing a teacher-reviewed result immediately recalculates its pairs", () => {
  const first = updateSimilaritySnapshot(undefined, [{ rowId: "a", text: "관찰 내용을 근거로 의견을 설명함." }, { rowId: "b", text: "관찰 내용을 근거로 의견을 설명함." }]);
  assert.equal(first.maxima.a, 100);
  const edited = updateSimilaritySnapshot(first, [{ rowId: "a", text: "실험 결과를 표로 정리하여 발표함." }, { rowId: "b", text: "관찰 내용을 근거로 의견을 설명함." }]);
  assert.equal(edited.calculations, 1);
  assert.ok(edited.maxima.a < 80);
  assert.ok(edited.maxima.b < 80);
});

test("empty text and self pairs do not create similarity maxima", () => {
  const result = updateSimilaritySnapshot(undefined, [{ rowId: "a", text: "" }, { rowId: "b", text: "같음" }, { rowId: "c", text: "같음" }]);
  assert.equal(result.maxima.a, 0); assert.equal(result.maxima.b, 100); assert.equal(result.maxima.c, 100);
});

test("deleted pair cache entries are removed", () => {
  const first = updateSimilaritySnapshot(undefined, [{ rowId: "a", text: "가" }, { rowId: "b", text: "나" }, { rowId: "c", text: "다" }]);
  const next = updateSimilaritySnapshot(first, [{ rowId: "a", text: "가" }, { rowId: "b", text: "나" }]);
  assert.equal(next.pairs.size, 1); assert.equal(next.calculations, 0);
});
