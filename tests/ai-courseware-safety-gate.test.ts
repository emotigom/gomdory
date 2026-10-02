import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { evaluatePublishReadiness } from "../lib/edu/courseware/pageBuilder/aiCoursewarePublishReadiness";
import { COURSEWARE_SAFETY_CHECKLIST, REQUIRED_SAFETY_CHECK_IDS } from "../lib/edu/courseware/safety/aiCoursewareSafetyChecklist";
import { evaluateCoursewarePublishGate } from "../lib/edu/courseware/safety/aiCoursewarePublishGate";
import { COURSEWARE_SAFETY_STORAGE_KEY } from "../lib/edu/courseware/safety/aiCoursewareSafetyStore";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("canonical runtime markers remain", () => {
  const client = read("app", "edu", "lesson", "CoursewareStudioCanonicalClient.tsx");
  assert.match(client, /data-courseware-runtime="ai-courseware-canonical"/);
  assert.match(client, /data-marker-version="ai-courseware-v1"/);
});

test("required safety checklist labels and storage key exist", () => {
  assert.ok(REQUIRED_SAFETY_CHECK_IDS.includes("privacy-no-personal-info"));
  assert.ok(COURSEWARE_SAFETY_CHECKLIST.some((item) => item.labelKo.includes("개인정보")));
  assert.equal(COURSEWARE_SAFETY_STORAGE_KEY, "gomdory.aiCourseware.safetyChecks.v1");
});

test("gate blocks on unsafe url, needs attention on missing checks, ready when complete", () => {
  const unsafe = evaluatePublishReadiness({ lessonNumber: 24, titleKo: "x", blocks: [{ type: "hero", id: "h", order: 0, headlineKo: "h", subcopyKo: "x", primaryButtonLabelKo: "x", primaryButtonUrl: "https://local.invalid" }] });
  const blocked = evaluateCoursewarePublishGate({ readiness: unsafe, checklist: { targetType: "page-draft", targetId: "p", checkedIds: REQUIRED_SAFETY_CHECK_IDS, updatedAt: new Date().toISOString(), source: "local-safety-check", version: 1 }, targetType: "page-draft" });
  assert.equal(blocked.status, "blocked");

  const base = evaluatePublishReadiness({ lessonNumber: 30, titleKo: "발표", blocks: [{ type: "hero", id: "h", order: 0, headlineKo: "문제", subcopyKo: "결과를 충분히 설명합니다", primaryButtonLabelKo: "보기", primaryButtonUrl: "https://example.com" }, { type: "text", id: "t2", order: 1, headingKo: "배운 점", bodyKo: "충분한 길이의 회고와 정리 문장을 추가합니다." }, { type: "reflection", id: "r", order: 2, aiHelpedKo: "x", myDecisionKo: "y", nextImproveKo: "z" }, { type: "source-list", id: "s", order: 3, sources: [{ labelKo: "직접 작성", url: "https://example.com" }] }] }, { privacyAcknowledged: true });
  const needs = evaluateCoursewarePublishGate({ readiness: base, checklist: null, targetType: "page-draft" });
  assert.equal(needs.status, "needs-attention");
  const ready = evaluateCoursewarePublishGate({ readiness: base, checklist: { targetType: "page-draft", targetId: "p", checkedIds: REQUIRED_SAFETY_CHECK_IDS, updatedAt: new Date().toISOString(), source: "local-safety-check", version: 1 }, targetType: "page-draft" });
  assert.equal(ready.status, "ready");
});

test("teacher-review-needed creates warning", () => {
  const readyReadiness = { status: "ready", checks: [] } as any;
  const gate = evaluateCoursewarePublishGate({ readiness: readyReadiness, checklist: { targetType: "page-draft", targetId: "p", checkedIds: [...REQUIRED_SAFETY_CHECK_IDS, "teacher-review-needed"], updatedAt: new Date().toISOString(), source: "local-safety-check", version: 1 }, targetType: "presentation" });
  assert.equal(gate.status, "needs-attention");
});

test("guards: guards: no webllm/raw html or dangerouslySetInnerHTML in safety surfaces", () => {
  const files = [read("app", "edu", "lesson", "_components", "safety", "CoursewareSafetyChecklistPanel.tsx"), read("app", "edu", "lesson", "_components", "page-builder", "CoursewareQuickPageBuilder.tsx")].join("\n");
  assert.doesNotMatch(files, /dangerouslySetInnerHTML|webllm|raw-html|raw-js/i);
  assert.equal(fs.existsSync(path.join(process.cwd(), "app", "api", "edu", "courseware", "publish", "route.ts")), true);
});
