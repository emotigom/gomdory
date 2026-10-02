import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { AI_COURSEWARE_PAGE_TEMPLATES } from "../lib/edu/courseware/pageBuilder/aiCoursewarePageTemplates";
import { COURSEWARE_PAGE_BLOCK_TYPES } from "../lib/edu/courseware/pageBuilder/aiCoursewarePageTypes";
import { sanitizeDraft } from "../lib/edu/courseware/pageBuilder/aiCoursewarePageSanitizer";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("canonical runtime markers remain", () => {
  const client = read("app", "edu", "lesson", "CoursewareStudioCanonicalClient.tsx");
  assert.match(client, /data-courseware-runtime="ai-courseware-canonical"/);
  assert.match(client, /data-marker-version="ai-courseware-v1"/);
});

test("quick page builder only for web artifacts", () => {
  const workspace = read("app", "edu", "lesson", "_components", "CoursewareArtifactWorkspace.tsx");
  const builder = read("app", "edu", "lesson", "_components", "page-builder", "CoursewareQuickPageBuilder.tsx");
  assert.match(builder, /웹페이지 초안 만들기/);
  assert.match(workspace, /web-page-draft/);
});

test("block schema and templates are safe", () => {
  assert.equal(COURSEWARE_PAGE_BLOCK_TYPES.includes("hero"), true);
  assert.equal(AI_COURSEWARE_PAGE_TEMPLATES.length, 5);
  assert.equal(AI_COURSEWARE_PAGE_TEMPLATES.some((t) => t.initialBlocks.some((b) => (b as any).type === "raw-js")), false);
  assert.equal(AI_COURSEWARE_PAGE_TEMPLATES.some((t) => t.initialBlocks.some((b) => (b as any).type === "arbitrary-html")), false);
});

test("sanitize corrupt draft and unknown block defensively", () => {
  const sanitized = sanitizeDraft({ lessonNumber: 21, titleKo: "x", blocks: [{ type: "unknown" }, { type: "text", id: "t", order: 0, headingKo: "h", bodyKo: "b" }] });
  assert.ok(sanitized);
  assert.equal(sanitized?.blocks.length, 1);
});

test("no dangerouslySetInnerHTML or webllm or api routes", () => {
  const builder = read("app", "edu", "lesson", "_components", "page-builder", "CoursewareQuickPageBuilder.tsx");
  assert.doesNotMatch(builder, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(builder, /webllm/i);
  assert.doesNotMatch(builder, /fetch\(/);
});
