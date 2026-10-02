import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { evaluatePublishReadiness } from "../lib/edu/courseware/pageBuilder/aiCoursewarePublishReadiness";
import { validateCoursewareSnapshotForPublish } from "../lib/edu/courseware/publish/aiCoursewarePublishValidator";
import { buildCoursewarePublishedSnapshot } from "../lib/edu/courseware/publish/aiCoursewarePublishSnapshot";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
const readyDraft: any = { pageId: "p1", lessonNumber: 30, titleKo: "발표", descriptionKo: "desc", templateId: "t", blocks: [{ type: "hero", id: "h", order: 0, headlineKo: "문제", subcopyKo: "충분한 설명", primaryButtonLabelKo: "보기", primaryButtonUrl: "https://example.com" }, { type: "reflection", id: "r", order: 1, aiHelpedKo: "도움", myDecisionKo: "판단", nextImproveKo: "개선" }, { type: "source-list", id: "s", order: 2, sources: [{ labelKo: "직접 작성", url: "https://example.com" }] }] };
const safety = { targetType: "page-draft", targetId: "p1", checkedIds: ["privacy-no-personal-info","privacy-no-face-or-location","copyright-images-ok","copyright-text-ok","source-links-added","ai-use-disclosed","ai-output-reviewed","no-dangerous-advice","no-medical-legal-financial-claim","respectful-language"], completedAt: new Date().toISOString() } as any;

test("publish validation blocks unsafe and allows safe", () => {
  const readiness = evaluatePublishReadiness(readyDraft, { privacyAcknowledged: true });
  assert.equal(validateCoursewareSnapshotForPublish({ pageDraft: null as any, readiness, safetyAcknowledgement: safety }).ok, false);
  const blockedReadiness = evaluatePublishReadiness({ ...readyDraft, blocks: [{ type: "raw-html", id: "x", order: 0, html: "<script>x</script>" }] }, { privacyAcknowledged: true });
  assert.equal(validateCoursewareSnapshotForPublish({ pageDraft: readyDraft, readiness: blockedReadiness, safetyAcknowledgement: safety }).ok, false);
  assert.equal(validateCoursewareSnapshotForPublish({ pageDraft: readyDraft, readiness, safetyAcknowledgement: safety }).ok, true);
});

test("snapshot excludes internals and generates unguessable shareId", () => {
  const readiness = evaluatePublishReadiness(readyDraft, { privacyAcknowledged: true });
  const snapshot = buildCoursewarePublishedSnapshot({ pageDraft: readyDraft, readiness, safetyAcknowledgement: safety });
  assert.match(snapshot.shareId, /^[a-f0-9]{32}$/);
  assert.equal((snapshot as any).ownerId, undefined);
  assert.equal((snapshot as any).localStorageId, undefined);
});

test("publish route uses server-only flag and public page guardrails/noindex exist", () => {
  const route = read("app", "api", "edu", "courseware", "publish", "route.ts");
  const repo = read("lib", "edu", "courseware", "publish", "aiCoursewarePublishRepository.ts");
  const page = read("app", "edu", "courseware", "p", "[shareId]", "page.tsx");
  const rendered = read("app", "edu", "courseware", "p", "[shareId]", "PublishedCoursewarePage.tsx");
  assert.doesNotMatch(route, /NEXT_PUBLIC_ENABLE_COURSEWARE_PUBLIC_PUBLISH/);
  assert.match(repo, /requireServiceRoleKey: true/);
  assert.match(page, /index: false/);
  assert.match(rendered, /발표용 페이지입니다/);
  assert.doesNotMatch(rendered, /dangerouslySetInnerHTML|webllm|localStorage/i);
});
