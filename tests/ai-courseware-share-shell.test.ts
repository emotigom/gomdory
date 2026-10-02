import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { evaluatePublishReadiness } from "../lib/edu/courseware/pageBuilder/aiCoursewarePublishReadiness";
import { sanitizeDraft } from "../lib/edu/courseware/pageBuilder/aiCoursewarePageSanitizer";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("canonical runtime markers remain", () => {
  const client = read("app", "edu", "lesson", "CoursewareStudioCanonicalClient.tsx");
  assert.match(client, /data-courseware-runtime="ai-courseware-canonical"/);
  assert.match(client, /data-marker-version="ai-courseware-v1"/);
});

test("presentation and share shell copy exists with local-only disclaimer", () => {
  const presentation = read("app", "edu", "lesson", "_components", "page-builder", "CoursewarePagePresentation.tsx");
  const share = read("app", "edu", "lesson", "_components", "page-builder", "CoursewareSharePanel.tsx");
  const qr = read("app", "edu", "lesson", "_components", "page-builder", "CoursewareQrCard.tsx");
  assert.match(presentation, /발표 모드/);
  assert.match(presentation, /지원하지 않는 블록이라 발표 화면에서 숨겼어요/);
  assert.match(presentation, /페이지 초안을 불러오지 못했어요/);
  assert.match(share, /card\.classroomNoticeKo/);
  assert.match(qr, /QR 공유 카드/);
});

test("publish readiness blocked/warning/ready branches", () => {
  const blocked = evaluatePublishReadiness({ lessonNumber: 24, titleKo: "", blocks: [] });
  assert.equal(blocked.status, "blocked");
  const warning = evaluatePublishReadiness({ lessonNumber: 24, titleKo: "제목", blocks: [{ type: "text", id: "t", order: 0, headingKo: "h", bodyKo: "b" }] });
  assert.equal(warning.status, "needs-attention");
  const ready = evaluatePublishReadiness({ lessonNumber: 30, titleKo: "발표", blocks: [{ type: "hero", id: "h", order: 0, headlineKo: "문제", subcopyKo: "결과를 충분히 설명합니다", primaryButtonLabelKo: "보기", primaryButtonUrl: "https://example.com" }, { type: "text", id: "t2", order: 1, headingKo: "배운 점", bodyKo: "충분한 길이의 회고와 정리 문장을 추가합니다." }, { type: "reflection", id: "r", order: 2, aiHelpedKo: "x", myDecisionKo: "y", nextImproveKo: "z" }, { type: "source-list", id: "s", order: 3, sources: [{ labelKo: "직접 작성", url: "https://example.com" }] }] }, { privacyAcknowledged: true });
  assert.equal(ready.status, "ready");
});

test("guardrails: no raw html/js, no webllm, no fetch, no dangerouslySetInnerHTML, api route exists for server-side publish", () => {
  const files = [
    read("app", "edu", "lesson", "_components", "page-builder", "CoursewarePagePresentation.tsx"),
    read("app", "edu", "lesson", "_components", "page-builder", "CoursewareSharePanel.tsx"),
    read("app", "edu", "lesson", "_components", "page-builder", "CoursewareQuickPageBuilder.tsx"),
  ].join("\n");
  assert.doesNotMatch(files, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(files, /webllm/i);
  assert.doesNotMatch(files, /fetch\(/);
  assert.doesNotMatch(files, /raw-html|raw-js|arbitrary-html/);
  assert.equal(sanitizeDraft({ blocks: [{ type: "unknown" }] })?.blocks.length, 0);
  assert.equal(fs.existsSync(path.join(process.cwd(), "app", "api", "edu", "courseware", "publish", "route.ts")), true);
});
