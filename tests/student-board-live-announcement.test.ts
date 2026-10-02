import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyStudentBoardAnnouncement,
  snapshotStudentBoardAnnouncements,
  studentBoardAnnouncementMessage,
} from "../app/s/[code]/_components/studentBoardAnnouncement";

const snapshot = (cards: Array<{ id: string; isOwn?: boolean }>) =>
  snapshotStudentBoardAnnouncements(cards.map((card) => ({ id: card.id, isOwn: card.isOwn ?? false })));

test("student board announcement classifier suppresses initial, repeated, recreated, and order-only snapshots", () => {
  const first = snapshot([{ id: "remote-a" }, { id: "remote-b" }]);
  assert.deepEqual(classifyStudentBoardAnnouncement(null, first, new Set()), { type: "initial-snapshot" });
  assert.deepEqual(classifyStudentBoardAnnouncement(first, snapshot([{ id: "remote-a" }, { id: "remote-b" }]), new Set()), { type: "no-meaningful-change" });
  assert.deepEqual(classifyStudentBoardAnnouncement(first, snapshot([{ id: "remote-b" }, { id: "remote-a" }]), new Set()), { type: "no-meaningful-change" });
});

test("student board announcement classifier identifies remote additions and creates stable privacy-safe keys", () => {
  const change = classifyStudentBoardAnnouncement(snapshot([{ id: "remote-a" }]), snapshot([{ id: "remote-a" }, { id: "remote-b" }, { id: "remote-c" }]), new Set());
  assert.equal(change.type, "remote-card-added");
  assert.deepEqual(change.cardIds, ["remote-b", "remote-c"]);
  assert.match(change.key, /^remote-card-added:[a-f0-9]{8}$/);
  assert.equal(studentBoardAnnouncementMessage(change), "새 카드 2개가 추가되었습니다.");
  assert.doesNotMatch(JSON.stringify(change), /author|body|text|name/i);
});

test("student board announcement classifier suppresses own reconciliation and classifies distinct moderation transitions once", () => {
  assert.deepEqual(classifyStudentBoardAnnouncement(snapshot([]), snapshot([{ id: "own-a", isOwn: true }]), new Set()), { type: "own-action-reconciliation" });
  const hidden = classifyStudentBoardAnnouncement(snapshot([{ id: "remote-a" }]), snapshot([]), new Set());
  assert.equal(hidden.type, "remote-card-hidden");
  assert.deepEqual(hidden.cardIds, ["remote-a"]);
  assert.match(hidden.key, /^remote-card-hidden:[a-f0-9]{8}$/);
  const restored = classifyStudentBoardAnnouncement(snapshot([]), snapshot([{ id: "remote-a" }]), new Set(["remote-a"]));
  assert.equal(restored.type, "remote-card-restored");
  assert.deepEqual(restored.cardIds, ["remote-a"]);
  assert.match(restored.key, /^remote-card-restored:[a-f0-9]{8}$/);
  assert.notEqual(hidden.key, restored.key);
  assert.equal(studentBoardAnnouncementMessage(hidden), "카드가 숨겨졌습니다.");
  assert.equal(studentBoardAnnouncementMessage(restored), "카드가 다시 표시되었습니다.");
  assert.doesNotMatch(`${studentBoardAnnouncementMessage(hidden)} ${studentBoardAnnouncementMessage(restored)}`, /remote-a|author|body|text|name/i);
  assert.deepEqual(classifyStudentBoardAnnouncement(snapshot([]), snapshot([]), new Set(["remote-a"])), { type: "no-meaningful-change" });
  assert.deepEqual(classifyStudentBoardAnnouncement(snapshot([{ id: "remote-a" }]), snapshot([{ id: "remote-a" }]), new Set()), { type: "no-meaningful-change" });
});
