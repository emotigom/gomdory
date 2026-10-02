import assert from "node:assert/strict";
import test from "node:test";

import { hashStudentSubmissionParticipantSubject, trustedParticipantOwnershipFromSession } from "@/lib/edu/joinSession";

test("trusted participant hash is keyed, board-scoped, and independent of client fields", () => {
  const secret = "unit-test-owner-secret-at-least-32-bytes";
  const participantSubject = "server-created-subject";
  const boardOne = hashStudentSubmissionParticipantSubject({ boardId: "board-1", participantSubject, secret });
  const boardTwo = hashStudentSubmissionParticipantSubject({ boardId: "board-2", participantSubject, secret });

  assert.match(boardOne ?? "", /^[a-f0-9]{64}$/);
  assert.notEqual(boardOne, boardTwo);
  assert.notEqual(boardOne, hashStudentSubmissionParticipantSubject({ boardId: "board-1", participantSubject: "author_client_id", secret }));
  assert.notEqual(boardOne, hashStudentSubmissionParticipantSubject({ boardId: "board-1", participantSubject: "share-code", secret }));
});

test("trusted participant hash fails closed without a server secret", () => {
  assert.equal(hashStudentSubmissionParticipantSubject({ boardId: "board-1", participantSubject: "server-created-subject", secret: "" }), null);
  assert.equal(hashStudentSubmissionParticipantSubject({ boardId: "board-1", participantSubject: "server-created-subject", secret: "too-short" }), null);
});

test("trusted participant hash uses collision-safe canonical framing", () => {
  const secret = "unit-test-owner-secret-at-least-32-bytes";
  assert.notEqual(
    hashStudentSubmissionParticipantSubject({ boardId: "board:a", participantSubject: "subject", secret }),
    hashStudentSubmissionParticipantSubject({ boardId: "board", participantSubject: "a:subject", secret }),
  );
});

test("ownership context rejects legacy, expired, and cross-board sessions", () => {
  const hash = "a".repeat(64);
  const valid = { boardId: "board-1", shareCode: "share-1", expiresAt: "2027-01-01T00:00:00.000Z", participantSubjectHash: hash };
  assert.deepEqual(trustedParticipantOwnershipFromSession(valid, "board-1", Date.parse("2026-01-01T00:00:00.000Z")), { ownershipVersion: 1, participantOwnerHash: hash });
  assert.equal(trustedParticipantOwnershipFromSession(valid, "board-2", Date.parse("2026-01-01T00:00:00.000Z")), null);
  assert.equal(trustedParticipantOwnershipFromSession({ ...valid, expiresAt: "2025-01-01T00:00:00.000Z" }, "board-1", Date.parse("2026-01-01T00:00:00.000Z")), null);
  assert.equal(trustedParticipantOwnershipFromSession({ ...valid, expiresAt: "not-a-date" }, "board-1", Date.parse("2026-01-01T00:00:00.000Z")), null);
  assert.equal(trustedParticipantOwnershipFromSession({ ...valid, expiresAt: null }, "board-1", Date.parse("2026-01-01T00:00:00.000Z")), null);
  assert.equal(trustedParticipantOwnershipFromSession({ ...valid, participantSubjectHash: null }, "board-1", Date.parse("2026-01-01T00:00:00.000Z")), null);
});
