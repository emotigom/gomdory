import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  AI_BINGO_BOARD_SIZE,
  AI_BINGO_REASON_MAX_LENGTH,
  buildInitialAiBingoState,
  buildLesson1AiBingoConfig,
  calculateAiBingoLines,
  deterministicAiBingoTileIds,
  normalizeAiBingoReason,
} from "@/lib/lesson-activities/aiBingo";

const root = process.cwd();
const read = (...segments: string[]) =>
  fs.readFileSync(path.join(root, ...segments), "utf8");

test("lesson 1 AI Bingo config is a fixed 3x3 board with the final deck tile set", () => {
  const config = buildLesson1AiBingoConfig();
  assert.equal(config.boardSize, AI_BINGO_BOARD_SIZE);
  assert.deepEqual(
    config.tilePool.map((tile) => tile.label),
    [
      "음성 인식",
      "얼굴 인식",
      "번역 앱",
      "영상 추천",
      "자율주행",
      "챗봇",
      "스팸 필터",
      "의료 진단 AI",
      "게임 AI",
    ],
  );
  assert.ok(
    config.tilePool.every(
      (tile) =>
        typeof tile.explanation === "string" && tile.explanation.length > 0,
    ),
  );
});

test("AI Bingo deterministic shuffle is stable per run and participant", () => {
  const config = buildLesson1AiBingoConfig();
  const first = deterministicAiBingoTileIds(config, "run-1", "participant-a");
  const second = deterministicAiBingoTileIds(config, "run-1", "participant-a");
  const different = deterministicAiBingoTileIds(
    config,
    "run-1",
    "participant-b",
  );
  assert.deepEqual(first, second);
  assert.equal(first.length, 9);
  assert.deepEqual(
    first,
    config.tilePool.map((tile) => tile.id),
  );
  assert.deepEqual(different, first);
});

test("AI Bingo completion is calculated from rows, columns, and diagonals", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  assert.deepEqual(calculateAiBingoLines(ids, ["a", "b", "c"]), [[0, 1, 2]]);
  assert.deepEqual(calculateAiBingoLines(ids, ["a", "d", "g"]), [[0, 3, 6]]);
  assert.deepEqual(calculateAiBingoLines(ids, ["a", "e", "i"]), [[0, 4, 8]]);
  assert.deepEqual(calculateAiBingoLines(ids, ["c", "e", "g"]), [[2, 4, 6]]);
});

test("AI Bingo state starts with persisted layout and empty selections", () => {
  const state = buildInitialAiBingoState(
    buildLesson1AiBingoConfig(),
    "run-2",
    "participant-a",
  );
  assert.equal(state.tileIds.length, 9);
  assert.deepEqual(state.selections, {});
  assert.equal(state.completed, false);
});

test("AI Bingo reason normalization keeps text plain and bounded by API policy", () => {
  assert.equal(normalizeAiBingoReason("  추천을   배워요\n"), "추천을 배워요");
  assert.equal(AI_BINGO_REASON_MAX_LENGTH, 160);
});

test("successor baseline preserves generic activity run and state tables", () => {
  const migration = read(
    "supabase",
    "migrations",
    "20260929093150_successor_baseline.sql",
  );
  assert.match(migration, /create table public\.lesson_activity_runs/);
  assert.match(migration, /create table public\.student_activity_states/);
  assert.match(migration, /participant_key_hash text not null/);
  assert.match(migration, /student_activity_states_run_participant_unique/);
  assert.match(migration, /config jsonb default '\{\}'::jsonb not null/);
  assert.match(migration, /state jsonb(?: default '\{\}'::jsonb)? not null/);
  assert.match(migration, /lesson_activity_runs_service_role_all/);
  assert.match(migration, /student_activity_states_service_role_all/);
  assert.match(
    migration,
    /alter table public\.lesson_activity_runs enable row level security/,
  );
  assert.match(migration, /lesson_activity_runs_board_status_idx/);
  assert.match(migration, /student_activity_states_activity_run_idx/);
});

test("student activity API protects guest state updates with share board and participant key validation", () => {
  const route = read(
    "app",
    "api",
    "v1",
    "share",
    "[code]",
    "activity-state",
    "route.ts",
  );
  const progress = read("lib", "lesson-activities", "progress.ts");
  assert.match(route, /resolvePublicShareBoard\(code\)/);
  assert.match(route, /x-gomdory-participant-key/);
  assert.match(route, /upsertAiBingoSelection/);
  assert.match(progress, /hashParticipantKey/);
  assert.match(progress, /participant_key_hash/);
  assert.match(progress, /onConflict: "activity_run_id,participant_key_hash"/);
  assert.match(progress, /tileExistsInAiBingoConfig/);
  assert.match(progress, /reason\.length > AI_BINGO_REASON_MAX_LENGTH/);
  assert.match(progress, /activityRun\.id !== params\.activityRunId/);
  assert.match(progress, /\.eq\("board_id", params\.boardId\)/);
});

test("student and teacher UI render real AI Bingo Arena while lesson 2 placeholders remain", () => {
  const panel = read(
    "components",
    "lesson-activities",
    "StudentActivityPanel.tsx",
  );
  const bingo = read("components", "lesson-activities", "AiBingoActivity.tsx");
  const teacher = read(
    "components",
    "lesson-activities",
    "AiBingoTeacherSummary.tsx",
  );
  const placeholders = read(
    "components",
    "lesson-activities",
    "ActivityPlaceholders.tsx",
  );
  assert.match(panel, /<AiBingoActivity[\s\S]*shareCode=\{shareCode\}/);
  assert.match(bingo, /AI 빙고 아레나/);
  assert.match(
    bingo,
    /AI는 사람이 모든 규칙을 하나하나 정해 준 프로그램과 달라요/,
  );
  assert.match(bingo, /많은 데이터에서 패턴을 찾아 판단하거나 추천해요/);
  assert.match(bingo, /mx-auto w-full min-w-0 max-w-5xl/);
  assert.match(bingo, /max-w-4xl grid-cols-3/);
  assert.match(bingo, /왜 AI라고 생각했나요\?/);
  assert.match(bingo, /role="dialog"/);
  assert.match(bingo, /빙고 완성! 선생님 화면에 기록됐어요/);
  assert.match(bingo, /focus-visible:ring-4/);
  assert.match(teacher, /lessonTitle/);
  assert.match(teacher, /participantCount/);
  assert.match(teacher, /completedCount/);
  assert.match(teacher, /학생 화면 열기/);
  assert.match(panel, /<AiJudgmentSortActivity shareCode=\{shareCode\}/);
  assert.match(placeholders, /웹 코딩 실습 — 준비 중/);
});

test("Cloudflare build does not add public live-site checks", () => {
  const packageJson = read("package.json");
  assert.doesNotMatch(
    packageJson,
    /RUN_PUBLIC_SMOKE=1 npm run test:smoke:public.*build:opennext/,
  );
});
