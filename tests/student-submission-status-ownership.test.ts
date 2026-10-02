import assert from "node:assert/strict";
import test from "node:test";

import { hashSubmissionStatusCapability } from "@/lib/student-apps/submissionStatusCapability";
import { MAX_STATUS_SUBMISSIONS, parseSubmissionStatusRequest, selectOwnedSubmissionStatuses, type OwnedSubmissionStatusRow } from "@/lib/student-apps/submissionStatusAccess";

const capability = "a".repeat(43);
const otherCapability = "b".repeat(43);
const owner = "1".repeat(64);
const ownSubmissionId = "11111111-1111-4111-8111-111111111111";
const foreignSubmissionId = "22222222-2222-4222-8222-222222222222";
const row = (overrides: Partial<OwnedSubmissionStatusRow> = {}): OwnedSubmissionStatusRow => ({
  id: ownSubmissionId,
  title: "Submission",
  status: "submitted",
  teacher_note: null,
  reviewed_at: null,
  archived_at: null,
  created_at: "2026-07-12T00:00:00.000Z",
  version: 1,
  is_latest: true,
  ownership_version: 1,
  owner_participant_hash: owner,
  status_capability_hash: hashSubmissionStatusCapability(capability),
  ...overrides,
});

test("status ownership regression: a known foreign ID is excluded while the owned pair succeeds", () => {
  const parsed = parseSubmissionStatusRequest({ boardId: "board-a", submissions: [
    { submissionId: ownSubmissionId, statusCapability: capability },
    { submissionId: foreignSubmissionId, statusCapability: otherCapability },
  ] });
  assert.equal(parsed.kind, "valid");
  if (parsed.kind !== "valid") return;
  // The database query is owner-scoped, so foreign rows never enter this candidate list.
  const result = selectOwnedSubmissionStatuses([row()], parsed.submissions, 1);
  assert.deepEqual(result.map((item) => item.id), [ownSubmissionId]);
});

test("wrong capabilities and legacy ownership rows fail closed without leaking proof material", () => {
  const parsed = parseSubmissionStatusRequest({ boardId: "board-a", submissions: [{ submissionId: ownSubmissionId, statusCapability: otherCapability }] });
  assert.equal(parsed.kind, "valid");
  if (parsed.kind !== "valid") return;
  for (const unsafe of [
    row({ ownership_version: null }),
    row({ owner_participant_hash: null }),
    row({ status_capability_hash: null }),
    row({ ownership_version: 99 }),
  ]) assert.deepEqual(selectOwnedSubmissionStatuses([unsafe], parsed.submissions, 1), []);
});

test("request parsing rejects malformed or ambiguous proof pairs and fails closed for legacy IDs", () => {
  assert.deepEqual(parseSubmissionStatusRequest({ submissionIds: [foreignSubmissionId] }), { kind: "legacy" });
  assert.equal(parseSubmissionStatusRequest({ submissions: [{ submissionId: "not-a-uuid", statusCapability: capability }] }).kind, "invalid");
  assert.equal(parseSubmissionStatusRequest({ submissions: [
    { submissionId: ownSubmissionId, statusCapability: capability },
    { submissionId: ownSubmissionId, statusCapability: otherCapability },
  ] }).kind, "invalid");
  const deduplicated = parseSubmissionStatusRequest({ submissions: [
    { submissionId: ownSubmissionId, statusCapability: capability },
    { submissionId: ownSubmissionId, statusCapability: capability },
  ] });
  assert.equal(deduplicated.kind, "valid");
  if (deduplicated.kind === "valid") assert.equal(deduplicated.submissions.length, 1);
  assert.deepEqual(parseSubmissionStatusRequest({ submissions: Array.from({ length: MAX_STATUS_SUBMISSIONS + 1 }, () => ({ submissionId: ownSubmissionId, statusCapability: capability })) }), { kind: "invalid", code: "too_many_submissions" });
});
