import assert from "node:assert/strict";
import test from "node:test";

import {
  assignRolesToParticipants,
  getEligibleParticipants,
  makePresentationOrder,
  normalizeStudentDrawParticipants,
  pickManyParticipants,
  pickOneParticipant,
  splitIntoGroups,
  type StudentDrawParticipant,
} from "@/lib/board/studentDrawGame";

const rng = () => 0.42;

function participant(id: string, name: string, excluded = false): StudentDrawParticipant {
  return { id, name, source: "submission", excluded };
}

test("student draw participant normalize falls back blank names and dedupes submissions", () => {
  const normalized = normalizeStudentDrawParticipants([
    { authorLabel: "민지", wallTitle: "작품 올리기", isFinalArtwork: false },
    { authorLabel: "민지", wallTitle: "최종 작품", isFinalArtwork: true },
    { authorLabel: "", cardId: "blank-1", wallTitle: "작품 올리기" },
  ]);

  const minji = normalized.find((item) => item.name === "민지");
  assert.equal(normalized.length, 2);
  assert.equal(minji?.submissionCount, 2);
  assert.equal(minji?.hasFinalSubmission, true);
  assert.ok(normalized.some((item) => item.name === "이름 없는 학생 1"));
});

test("student draw participant ids prefer author client id and keep anonymous fallbacks unique", () => {
  const normalized = normalizeStudentDrawParticipants([
    { authorClientId: "client-1", authorLabel: "민지", cardId: "card-a", wallTitle: "작품 올리기" },
    { authorClientId: "client-1", authorLabel: "민지 다른 이름", cardId: "card-b", wallTitle: "다른 칸" },
    { authorLabel: "익명 학생", cardId: "blank-1", wallTitle: "작품 올리기" },
    { authorLabel: "", cardId: "blank-2", wallTitle: "작품 올리기" },
  ]);

  assert.equal(normalized.length, 3);
  const minji = normalized.find((item) => item.id === "submission:client:client-1");
  assert.equal(minji?.submissionCount, 2);
  assert.deepEqual(
    normalized.filter((item) => item.name.startsWith("이름 없는 학생")).map((item) => item.name).sort(),
    ["이름 없는 학생 1", "이름 없는 학생 2"],
  );
});

test("excluded and already-picked students are removed from single draw", () => {
  const result = pickOneParticipant(
    [participant("a", "하늘"), participant("b", "민지"), participant("c", "지우", true)],
    { excludeAlreadyPicked: true, alreadyPickedIds: new Set(["a"]), rng },
  );

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.id, "b");
  assert.deepEqual(getEligibleParticipants([participant("x", "제외", true)]), []);
});

test("single draw safely reports no eligible students when already-picked exclusion empties candidates", () => {
  const result = pickOneParticipant(
    [participant("a", "하늘")],
    { excludeAlreadyPicked: true, alreadyPickedIds: new Set(["a"]), rng },
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /참가자가 부족/);
});

test("many draw returns unique participants and guards shortages", () => {
  const result = pickManyParticipants([participant("a", "하늘"), participant("b", "민지"), participant("c", "지우")], 2, rng);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(new Set(result.value.map((item) => item.id)).size, 2);

  const shortage = pickManyParticipants([participant("a", "하늘")], 2, rng);
  assert.equal(shortage.ok, false);
});

test("draw modes safely guard empty or fully excluded participant pools", () => {
  assert.equal(pickManyParticipants([], 1, rng).ok, false);
  assert.equal(makePresentationOrder([participant("x", "제외", true)], rng).ok, false);
  assert.equal(splitIntoGroups([participant("x", "제외", true)], 2, rng).ok, false);
  assert.equal(assignRolesToParticipants([participant("x", "제외", true)], ["발표"], rng).ok, false);
});

test("presentation order includes every eligible participant once", () => {
  const students = [participant("a", "하늘"), participant("b", "민지"), participant("c", "지우", true)];
  const result = makePresentationOrder(students, rng);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(new Set(result.value.map((item) => item.id)), new Set(["a", "b"]));
});

test("group split distributes participants evenly", () => {
  const result = splitIntoGroups(
    [participant("a", "A"), participant("b", "B"), participant("c", "C"), participant("d", "D"), participant("e", "E")],
    2,
    rng,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const sizes = result.value.map((group) => group.length).sort();
  assert.deepEqual(sizes, [2, 3]);
});

test("group split clamps group count when there are more groups than participants", () => {
  const result = splitIntoGroups([participant("a", "A"), participant("b", "B")], 5, rng);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.length, 2);
  assert.deepEqual(result.value.map((group) => group.length).sort(), [1, 1]);
});

test("role assignment does not duplicate students and guards too many roles", () => {
  const result = assignRolesToParticipants(
    [participant("a", "하늘"), participant("b", "민지"), participant("c", "지우")],
    ["발표 1번", "오늘의 MVP"],
    rng,
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(new Set(result.value.map((item) => item.participant.id)).size, 2);

  const shortage = assignRolesToParticipants([participant("a", "하늘")], ["발표 1번", "발표 2번"], rng);
  assert.equal(shortage.ok, false);
  if (!shortage.ok) assert.match(shortage.reason, /역할\/상품 수보다 참가자가 적어요/);
});
