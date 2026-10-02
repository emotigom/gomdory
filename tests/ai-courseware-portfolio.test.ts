import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { COURSEWARE_PORTFOLIO_STORAGE_KEY, makeEmptyPortfolio } from "../lib/edu/courseware/portfolio/aiCoursewarePortfolioStore";
import { buildPortfolioExportJson, buildShowcaseSummaryKo, isFinalReflectionComplete } from "../lib/edu/courseware/portfolio/aiCoursewarePortfolioSummary";

test("runtime markers remain unchanged", () => {
  const src = fs.readFileSync("app/edu/lesson/CoursewareStudioCanonicalClient.tsx", "utf8");
  assert.match(src, /data-courseware-runtime="ai-courseware-canonical"/);
});

test("portfolio storage key + corrupt data guard contracts", () => {
  assert.equal(COURSEWARE_PORTFOLIO_STORAGE_KEY, "gomdory.aiCourseware.portfolio.v1");
  const storeSrc = fs.readFileSync("lib/edu/courseware/portfolio/aiCoursewarePortfolioStore.ts", "utf8");
  assert.match(storeSrc, /corrupt-portfolio/);
});

test("portfolio summary includes highlights and revision count", () => {
  const p = makeEmptyPortfolio();
  p.selectedArtifactRefs = [{ refId: "a", lessonNumber: 29, artifactType: "portfolio-outline", artifactLabelKo: "목차", source: "manual" }];
  const summary = buildShowcaseSummaryKo(p, 2);
  assert.match(summary, /수정 기록 수: 2/);
  assert.match(summary, /하이라이트/);
});

test("final reflection required fields gate completion", () => {
  const p = makeEmptyPortfolio();
  assert.equal(isFinalReflectionComplete(p), false);
  p.finalReflection.aiHelpedKo = "초안";
  p.finalReflection.myDecisionKo = "수정";
  p.finalReflection.nextImproveKo = "개선";
  p.finalReflection.studentConfirmed = true;
  assert.equal(isFinalReflectionComplete(p), true);
});

test("portfolio panel + teacher panel copy exists without grading", () => {
  const panel = fs.readFileSync("app/edu/lesson/_components/portfolio/CoursewarePortfolioPanel.tsx", "utf8");
  assert.match(panel, /최종 포트폴리오 만들기/);
  assert.match(panel, /안전 점검 기록을 찾지 못했어요|수정 기록이 없어도 포트폴리오는 만들 수 있어요/);
  assert.doesNotMatch(panel, /dangerouslySetInnerHTML/);
  const teacher = fs.readFileSync("app/edu/lesson/teacher/_components/TeacherFinalShowcasePanel.tsx", "utf8");
  assert.match(teacher, /과정 증거/);
  assert.doesNotMatch(teacher, /채점|점수|rubric/i);
});

test("export excludes internal ids", () => {
  const p = makeEmptyPortfolio();
  p.selectedArtifactRefs = [{ refId: "secret", lessonNumber: 29, artifactType: "portfolio-outline", artifactLabelKo: "A", source: "manual" }];
  const out = buildPortfolioExportJson(p);
  assert.doesNotMatch(out, /"refId":/);
});
