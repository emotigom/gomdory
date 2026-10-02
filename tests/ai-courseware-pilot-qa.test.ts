import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { buildPilotQaDemoData } from "../lib/edu/courseware/qa/aiCoursewareDemoData";
import { buildReadinessReport, PILOT_QA_LOCAL_KEYS, PILOT_QA_ROUTES } from "../lib/edu/courseware/qa/aiCoursewarePilotQaChecks";
import { isCoursewareLocalStorageKey, resetPilotQaAllLocalData } from "../lib/edu/courseware/qa/aiCoursewareLocalReset";

test("QA marker and required routes exist", () => {
  const src = fs.readFileSync("app/edu/lesson/qa/CoursewarePilotQaClient.tsx", "utf8");
  assert.match(src, /data-courseware-pilot-qa="ai-courseware-pilot-qa"/);
  assert.match(src, /data-marker-version="ai-courseware-qa-v1"/);
  assert.match(src, /useState\(\(\) => inspectPilotQaLocalData\(null\)\)/);
  assert.match(src, /useEffect\(\(\) => \{[\s\S]*?inspectPilotQaLocalData\(window\.localStorage\)[\s\S]*?setCheckedAt\(new Date\(\)\.toISOString\(\)\)/);
  assert.doesNotMatch(src, /inspectPilotQaLocalData\(typeof window/);
  assert.match(src, /공용 기기를 다음 반이 쓰기 전에는 Courseware 로컬 데이터를 초기화하세요/);
  assert.match(src, /필요한 결과물은 먼저 복사하거나 JSON으로 보관하세요/);
  assert.deepEqual(PILOT_QA_ROUTES.map((r) => r.path), ["/edu/lesson", "/edu/lesson/teacher", "/edu/lesson/join", "/edu/courseware/p/[shareId]"]);
});

test("localStorage keys are referenced", () => {
  const keys = PILOT_QA_LOCAL_KEYS.map((v) => v.key);
  assert.ok(keys.includes("gomdory.aiCourseware.localDrafts.v1"));
  assert.ok(keys.includes("gomdory.aiCourseware.pageDrafts.v1"));
  assert.ok(keys.includes("gomdory.aiCourseware.safetyChecks.v1"));
});

test("demo data is local-safe and excludes publish snapshot/raw html/js", () => {
  const demo = buildPilotQaDemoData();
  const txt = JSON.stringify(demo);
  assert.doesNotMatch(txt, /publicPublish|publishedSnapshot|service_role|<script|javascript:/i);
  assert.doesNotMatch(txt, /@gmail\.com|010-\d{4}-\d{4}|주민등록|studentName/);
});

test("reset helper clears fixed and dynamic Courseware keys only", () => {
  const keys = [
    ...PILOT_QA_LOCAL_KEYS.map((item) => item.key),
    "gomdory.aiCourseware.spine.v1",
    "gomdory.aiCourseware.day.3.default.v1",
    "gomdory.courseware.interactive.v1",
    "edu:courseware:day:3:flow:v2",
    "edu:courseware:notebook:day:3:scene:code:version:v2",
    "gomdoriy-day01-ai-bingo-v1",
    "unrelated.preference",
  ];
  const remaining = new Set(keys);
  const fake = {
    get length() { return remaining.size; },
    key: (index: number) => [...remaining][index] ?? null,
    removeItem: (key: string) => remaining.delete(key),
  };

  resetPilotQaAllLocalData(fake);

  assert.deepEqual([...remaining], ["unrelated.preference"]);
  assert.equal(isCoursewareLocalStorageKey("gomdory.aiCourseware.spine.v1"), true);
  assert.equal(isCoursewareLocalStorageKey("edu:courseware:day:16:flow:v2"), true);
  assert.equal(isCoursewareLocalStorageKey("unrelated.preference"), false);
});

test("readiness report includes fallback plans and qa code has no dangerous html", () => {
  const report = buildReadinessReport({ checkedAt: "2026-05-03T00:00:00.000Z", feature: { publicPublishEnabled: false, classSessionsEnabled: false, aiHelperEnabled: false }, localStatusSummary: "ok" });
  assert.match(report, /template fallback/);
  assert.match(report, /presentation\/share shell/);
  assert.match(report, /manual link collector/);
  const src = fs.readFileSync("app/edu/lesson/qa/CoursewarePilotQaClient.tsx", "utf8");
  assert.doesNotMatch(src, /dangerouslySetInnerHTML|WebLLM/i);
});
