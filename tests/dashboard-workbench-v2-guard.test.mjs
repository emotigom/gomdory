import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const page = read("app/dashboard/page.tsx");
const createSection = read("app/dashboard/CreateBoardSection.tsx");
const createForm = read("app/dashboard/CreateBoardForm.tsx");
const boardList = read("app/dashboard/_components/DashboardBoardList.tsx");
const dashboardUi = read("app/dashboard/_components/dashboardUi.tsx");
const telemetry = read("app/dashboard/_components/AiTelemetryWidget.tsx");
const nav = read("app/dashboard/_components/HermesDashboardNav.tsx");
const topControls = read("app/dashboard/_components/DashboardTopRightControls.tsx");
const styles = read("app/globals.css");

test("dashboard home reads as one workshop desk", () => {
  assert.match(page, /data-dashboard-workshop-version="2"/);
  assert.match(page, /dashboard-workbench-hero/);
  assert.match(page, /내 수업 작업대/);
  assert.match(page, /dashboard-board-register/);
  assert.match(page, /내가 만든 보드/);
  assert.match(page, /<details className="dashboard-ai-drawer[^"]*">/);

  for (const marker of [
    ".dashboard-workbench-hero",
    ".dashboard-create-sheet",
    ".dashboard-board-register",
    ".dashboard-ai-drawer",
  ]) {
    assert.match(styles, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("board creation uses direct classroom language", () => {
  assert.match(createSection, /보드 한 장 펴기/);
  assert.match(createSection, /새 보드 펼치기/);
  assert.match(createSection, /웹사이트 만들기/);
  assert.match(createForm, /학생에게 보일 안내/);
  assert.match(createForm, /이 보드로 시작/);
  assert.doesNotMatch(createSection, /보드 목록에 더 집중할 수 있도록|다음 추천 단계|새 제작 경로/);
});

test("board list avoids nested and dead controls", () => {
  assert.doesNotMatch(boardList, /<Link[^>]*>[\s\S]{0,160}<DashboardButton/);
  assert.doesNotMatch(boardList, /DashboardIconButton/);
  assert.doesNotMatch(boardList, /text-cyan-100|text-rose-300/);
  assert.match(boardList, /<label className="flex min-w-0 flex-1 cursor-pointer/);
  assert.match(boardList, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.doesNotMatch(boardList, /ReactKeyboardEvent/);
  assert.match(boardList, /aria-controls=\{`dashboard-board-menu-/);
  assert.match(boardList, /aria-label=\{`\$\{board\.title\} 열기`\}/);
  assert.match(boardList, /htmlFor="dashboard-bulk-delete-confirmation"/);
  assert.match(boardList, /htmlFor="dashboard-rename-title"/);
  assert.match(boardList, /dashboardGlassButtonClass\("secondary"/);
});

test("shared dashboard controls carry the paper-workshop hooks", () => {
  for (const marker of [
    "dashboard-tool-button",
    "dashboard-paper-panel",
    "dashboard-pencil-note",
    "dashboard-modal-sheet",
    "dashboard-toast-slip",
  ]) {
    assert.match(dashboardUi, new RegExp(marker));
  }
  assert.match(dashboardUi, /dialog\.addEventListener\("keydown"/);
  assert.match(dashboardUi, /previousFocus\?\.focus\(\)/);
  assert.match(dashboardUi, /role="status" aria-live="polite"/);
});

test("AI status stays understandable and out of the main flow", () => {
  assert.match(telemetry, /AI 사용 기록/);
  assert.match(telemetry, /반별 연결 상태/);
  assert.match(telemetry, /기기에서 처리/);
  assert.match(telemetry, /온라인으로 전환/);
  assert.match(telemetry, /role="group" aria-label="조회 기간"/);
  assert.match(telemetry, /aria-pressed=\{active\}/);
  assert.match(telemetry, /role="region" aria-labelledby="dashboard-ai-connection-heading"/);
  assert.doesNotMatch(telemetry, /AI 텔레메트리|로컬\/폴백|RID:|>p50 /);
});

test("dashboard navigation uses links rather than incomplete tab widgets", () => {
  for (const source of [nav, topControls]) {
    assert.match(source, /aria-current=\{active \? "page" : undefined\}/);
    assert.doesNotMatch(source, /role="tablist"|role="tab"|aria-selected=\{active\}/);
  }
});
