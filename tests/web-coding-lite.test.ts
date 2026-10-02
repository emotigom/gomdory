import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  WEB_CODING_LITE_ACTIVITY_TYPE,
  WEB_CODING_LITE_CODE_MAX_LENGTH,
  buildInitialWebCodingLiteState,
  buildLesson2WebCodingLiteConfig,
  buildSavedWebCodingLiteState,
  isWebCodingLiteCompleted,
  markWebCodingLiteSubmitted,
  resolveWebCodingLiteHintsEnabled,
  summarizeWebCodingLiteForTeacher,
  withWebCodingLiteHintSettings,
} from "@/lib/lesson-activities/webCodingLite";
import { generateWebCodingHint } from "@/lib/lesson-activities/webCodingHints";
import {
  DEFAULT_MONACO_BASE_URL,
  getMonacoAssetPaths,
  normalizeMonacoBaseUrl,
} from "@/lib/lesson-activities/monacoAssets";

const root = process.cwd();
const read = (...segments: string[]) =>
  fs.readFileSync(path.join(root, ...segments), "utf8");

test("Web Studio Lite lesson 2 starter and initial state are classroom-ready", () => {
  const config = buildLesson2WebCodingLiteConfig();
  assert.equal(config.activityType, WEB_CODING_LITE_ACTIVITY_TYPE);
  assert.equal(config.version, 1);
  assert.equal(config.title, "선택: 웹 코딩 체험");
  assert.equal(config.hintsEnabled, true);
  assert.match(config.starter.html, /HTML\/CSS\/JS로 비슷한 판단 도우미를 만들어 볼 수 있어요/);
  assert.match(config.starter.html, /데이터가 많고 반복되는 일인가요/);
  assert.match(config.starter.html, /감정\/책임\/윤리 판단이 중요한가요/);
  assert.match(config.starter.js, /AI가 잘할 수 있어요/);
  assert.match(config.starter.js, /사람의 판단이 필요해요/);
  assert.match(config.starter.js, /AI와 사람이 함께하면 좋아요/);

  const state = buildInitialWebCodingLiteState(config);
  assert.equal(state.activityType, "web_coding_lite");
  assert.equal(state.html, config.starter.html);
  assert.equal(state.css, config.starter.css);
  assert.equal(state.js, config.starter.js);
  assert.equal(state.submitted, false);
  assert.equal(state.submittedAt, null);
  assert.equal(resolveWebCodingLiteHintsEnabled(config), true);
  assert.equal(resolveWebCodingLiteHintsEnabled({}), true);
  assert.equal(
    resolveWebCodingLiteHintsEnabled({ hintsEnabled: false }),
    false,
  );
  assert.equal(
    withWebCodingLiteHintSettings(config, false).hintsEnabled,
    false,
  );
});

test("Web Studio Lite length limits and submitted state are enforced in utilities", () => {
  const current = buildInitialWebCodingLiteState(
    buildLesson2WebCodingLiteConfig(),
  );
  const saved = buildSavedWebCodingLiteState(
    current,
    {
      html: "<h1>Hi</h1>",
      css: "body{}",
      js: "console.log('plain text only')",
    },
    "2026-05-15T00:00:00.000Z",
  );
  assert.equal(saved.savedAt, "2026-05-15T00:00:00.000Z");
  assert.equal(isWebCodingLiteCompleted(saved), false);
  const submitted = markWebCodingLiteSubmitted(
    saved,
    "2026-05-15T00:01:00.000Z",
  );
  assert.equal(isWebCodingLiteCompleted(submitted), true);
  assert.equal(WEB_CODING_LITE_CODE_MAX_LENGTH, 20_000);
  assert.throws(
    () =>
      buildSavedWebCodingLiteState(
        current,
        {
          html: "x".repeat(WEB_CODING_LITE_CODE_MAX_LENGTH + 1),
          css: "",
          js: "",
        },
        "now",
      ),
    /HTML 코드는 20000자 이내/,
  );
});

test("Web Studio Lite teacher summary counts saved and submitted states without code exposure", () => {
  const config = buildLesson2WebCodingLiteConfig();
  const base = buildInitialWebCodingLiteState(config);
  const saved = buildSavedWebCodingLiteState(
    base,
    { html: "<h1>Saved</h1>", css: "body{}", js: "" },
    "2026-05-15T00:00:00.000Z",
  );
  const submitted = markWebCodingLiteSubmitted(
    buildSavedWebCodingLiteState(
      base,
      { html: "<h1>Submitted</h1>", css: "main{}", js: "" },
      "2026-05-15T00:01:00.000Z",
    ),
    "2026-05-15T00:02:00.000Z",
  );
  const summary = summarizeWebCodingLiteForTeacher({
    activityRunId: "run-web",
    config,
    rows: [
      {
        id: "row-1",
        displayName: "학생 1",
        state: saved,
        status: "in_progress",
        updatedAt: "2026-05-15T00:00:00.000Z",
        submittedAt: null,
      },
      {
        id: "row-2",
        displayName: "학생 2",
        state: submitted,
        status: "completed",
        updatedAt: "2026-05-15T00:02:00.000Z",
        submittedAt: "2026-05-15T00:02:00.000Z",
      },
    ],
  });

  assert.equal(summary.hintsEnabled, true);
  assert.equal(summary.participantCount, 2);
  assert.equal(summary.savedCount, 2);
  assert.equal(summary.submittedCount, 1);
  assert.deepEqual(
    summary.recentSubmissions.map((item) => item.status),
    ["submitted", "saved"],
  );
  assert.equal(JSON.stringify(summary).includes("<h1>Submitted</h1>"), false);
});

test("lesson 2 creates reusable AI Judgment Sort and Web Studio Lite runs without duplicate run policy changes", () => {
  const progress = read("lib", "lesson-activities", "progress.ts");
  assert.match(progress, /getLessonTemplate\(params\.lessonTemplateId\)/);
  assert.match(progress, /WEB_CODING_LITE_ACTIVITY_TYPE/);
  assert.match(progress, /buildLesson2WebCodingLiteConfig/);
  assert.match(progress, /eq\("class_session_id", params\.classSessionId\)/);
  assert.match(progress, /eq\("activity_type", spec\.activityType\)/);
  assert.match(progress, /maybeSingle<LessonActivityRunRow>/);
});

test("share activity-state API supports Web Studio Lite own-state save and submit only", () => {
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
  assert.match(route, /activityType === "web_coding_lite"/);
  assert.match(route, /getOrCreateWebCodingLiteStateForParticipant/);
  assert.match(route, /updateWebCodingLiteState/);
  assert.match(route, /parseCodingStudioOperation/);
  assert.match(route, /지원하지 않는 웹 코딩 실습 요청입니다/);
  assert.match(route, /resolvePublicShareBoard\(code\)/);
  assert.match(progress, /participant_key_hash/);
  assert.match(route, /return headerKey \|\| bodyKey/);
  assert.match(progress, /\.eq\("participant_key_hash", participantKeyHash\)/);
  assert.match(progress, /\.eq\("board_id", params\.boardId\)/);
  assert.match(progress, /activityRun\.id !== params\.activityRunId/);
  assert.match(
    progress,
    /getActiveActivityRunForBoard\(params\.boardId, WEB_CODING_LITE_ACTIVITY_TYPE\)/,
  );
  assert.match(progress, /\.eq\("status", "active"\)/);
});

test("Web Studio Lite Monaco asset config defaults to jsDelivr and normalizes custom bases", () => {
  assert.equal(
    DEFAULT_MONACO_BASE_URL,
    "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/",
  );
  assert.equal(normalizeMonacoBaseUrl(undefined), DEFAULT_MONACO_BASE_URL);
  assert.equal(
    normalizeMonacoBaseUrl("https://assets.gomdory.com/assets/monaco/vX"),
    "https://assets.gomdory.com/assets/monaco/vX/",
  );
  assert.equal(
    normalizeMonacoBaseUrl("/assets/monaco/vX"),
    "/assets/monaco/vX/",
  );

  const paths = getMonacoAssetPaths(
    "https://assets.gomdory.com/assets/monaco/vX",
  );
  assert.equal(
    paths.loaderUrl,
    "https://assets.gomdory.com/assets/monaco/vX/loader.js",
  );
  assert.equal(
    paths.workerMainUrl,
    "https://assets.gomdory.com/assets/monaco/vX/base/worker/workerMain.js",
  );
  assert.equal(paths.amdVsPath, "https://assets.gomdory.com/assets/monaco/vX");
});

test("Web Studio Lite local hint engine returns progressive safe hints", () => {
  const config = buildLesson2WebCodingLiteConfig();

  const emptyHtml = generateWebCodingHint({
    html: "",
    css: "",
    js: "console.log('hi')",
    hintLevel: 1,
  });
  assert.equal(emptyHtml.category, "html");
  assert.match(emptyHtml.message, /HTML|제목|미리보기/);

  const emptyJs = generateWebCodingHint({
    html: '<button onclick="decide()">확인</button><p id="result">대기</p>',
    css: "",
    js: "",
    hintLevel: 1,
  });
  assert.equal(emptyJs.category, "js");
  assert.match(emptyJs.message, /JavaScript|버튼/);

  const nullRuntime = generateWebCodingHint({
    html: "<button>확인</button>",
    css: "",
    js: "document.getElementById('missing').textContent = 'x'",
    runtimeError: "Cannot read properties of null (reading 'textContent')",
    hintLevel: 2,
  });
  assert.equal(nullRuntime.category, "runtime");
  assert.match(nullRuntime.message, /id|querySelector|getElementById/);

  const undefinedRuntime = generateWebCodingHint({
    html: config.starter.html,
    css: config.starter.css,
    js: "decid('data')",
    runtimeError: "decid is not defined",
    hintLevel: 1,
  });
  assert.equal(undefinedRuntime.category, "runtime");
  assert.match(undefinedRuntime.message, /선언|이름/);

  const lesson2NoIfElse = generateWebCodingHint({
    html: config.starter.html,
    css: config.starter.css,
    js: "function decide(type) { const result = document.querySelector('#result'); result.textContent = type; }",
    activityTemplateId: "lesson-2-ai-judgment",
    hintLevel: 3,
  });
  assert.equal(lesson2NoIfElse.category, "concept");
  assert.match(lesson2NoIfElse.message, /if|else|true\/false/);

  const levels = [1, 2, 3].map((hintLevel) =>
    generateWebCodingHint({
      html: "",
      css: "",
      js: "",
      hintLevel: hintLevel as 1 | 2 | 3,
    }),
  );
  assert.deepEqual(
    levels.map((hint) => hint.level),
    [1, 2, 3],
  );
  assert.deepEqual(
    levels.map((hint) => hint.canShowNextHint),
    [true, true, false],
  );

  const combinedMessages =
    levels.map((hint) => hint.message).join("\n") + lesson2NoIfElse.message;
  assert.doesNotMatch(
    combinedMessages,
    /function decide|<main class=|Paste this full code|붙여넣/,
  );
});

test("Web Studio Lite UI uses real controls and a sandboxed iframe without allow-same-origin", () => {
  const panel = read(
    "components",
    "lesson-activities",
    "StudentActivityPanel.tsx",
  );
  const activity = read(
    "components",
    "lesson-activities",
    "WebCodingLiteActivity.tsx",
  );
  const shell = read(
    "components",
    "lesson-activities",
    "CodingActivityWorkspace.tsx",
  );
  const editor = read("components", "lesson-activities", "CodeEditorPane.tsx");
  const teacher = read(
    "components",
    "lesson-activities",
    "WebCodingLiteTeacherSummary.tsx",
  );
  const board = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );
  assert.match(panel, /<WebCodingLiteActivity[\s\S]*shareCode=\{shareCode\}/);
  assert.match(activity, /웹 코딩 실습실/);
  assert.match(
    activity,
    /HTML, CSS, JavaScript를 수정하고 결과를 바로 확인해 보세요/,
  );
  assert.match(activity, /CodeEditorPane/);
  assert.match(activity, /CodingActivityWorkspace/);
  assert.match(shell, /w-full min-w-0 max-w-\[1680px\] overflow-x-clip/);
  assert.match(activity, /data-testid="coding-workspace-main-grid"/);
  assert.match(activity, /ResizableSplitPane/);
  assert.match(activity, /defaultLeftPercent=\{58\}/);
  assert.match(activity, /storageKey="gomdory:web-coding-lite:split-pane"/);
  assert.match(editor, /data-testid="web-coding-lite-textarea-fallback"/);
  assert.match(editor, /loadMonaco/);
  assert.match(editor, /typeof window === "undefined"/);
  assert.match(editor, /MonacoEnvironment/);
  assert.match(editor, /getConfiguredMonacoBaseUrl/);
  assert.match(editor, /getMonacoAssetPaths/);
  assert.match(editor, /MONACO_LOAD_TIMEOUT_MS = 10_000/);
  assert.match(editor, /minimap: \{ enabled: false \}/);
  assert.match(editor, /wordWrap: "on"/);
  assert.match(editor, /automaticLayout: true/);
  assert.match(editor, /tabSize: 2/);
  assert.match(editor, /readOnly/);
  assert.match(editor, /간단 편집기/);
  assert.match(editor, /고급 편집기/);
  assert.match(editor, /setMonacoFailed\(true\)/);
  assert.match(editor, /고급 편집기를 불러오는 중…/);
  assert.match(editor, /고급 편집기를 불러오지 못해 간단 편집기로 열었어요/);
  assert.match(editor, /고급 편집기 다시 시도/);
  assert.match(editor, /MONACO_EDITOR_MODE_STORAGE_KEY/);
  assert.match(editor, /window\.localStorage\.setItem/);
  assert.match(activity, /onSaveShortcut=\{saveFromShortcut\}/);
  assert.match(activity, /onPreviewShortcut=\{runPreview\}/);
  assert.match(activity, /key === "s"/);
  assert.match(activity, /key === "enter"/);
  assert.match(activity, /HTML/);
  assert.match(activity, /CSS/);
  assert.match(activity, /JS/);
  assert.match(activity, /저장/);
  assert.match(activity, /제출하기/);
  assert.match(activity, /처음 코드로 되돌릴까요/);
  assert.match(activity, /web-coding-lite-preview-error/);
  assert.match(activity, /미리보기 새로고침/);
  assert.match(activity, /힌트 보기/);
  assert.match(activity, /다음 힌트/);
  assert.match(activity, /resolveWebCodingLiteHintsEnabled/);
  assert.match(activity, /web-coding-lite-hints-disabled/);
  assert.match(activity, /현재 수업에서는 선생님이 힌트를 꺼두었어요/);
  assert.match(activity, /web-coding-lite-hint-panel/);
  assert.match(activity, /missionDefaultOpen=\{false\}/);
  assert.match(activity, /오류 메시지: \{runtimeError\}/);
  assert.doesNotMatch(activity, /dangerouslySetInnerHTML/);
  assert.match(activity, /제출 후에도 수업이 끝나기 전까지 수정할 수 있어요/);
  assert.match(activity, /sandbox="allow-scripts"/);
  assert.doesNotMatch(activity, /allow-same-origin/);
  assert.doesNotMatch(
    activity,
    /allow-popups|allow-forms|allow-top-navigation/,
  );
  assert.match(activity, /event\.source !== iframeRef\.current\.contentWindow/);
  assert.match(activity, /setPreviewKey/);
  assert.doesNotMatch(activity, /eval\(/);
  assert.doesNotMatch(activity, /parent\.eval|window\.parent\.eval/);
  assert.match(teacher, /savedCount/);
  assert.match(teacher, /submittedCount/);
  assert.match(teacher, /저장됨/);
  assert.match(teacher, /제출됨/);
  assert.match(teacher, /학생 화면 열기/);
  assert.match(teacher, /제출물 보기/);
  assert.match(teacher, /학생 힌트: \{hintsEnabled \? "켜짐" : "꺼짐"\}/);
  assert.match(teacher, /힌트 끄기/);
  assert.match(teacher, /힌트 켜기/);
  assert.match(teacher, /학생들이 힌트를 볼 수 있어요/);
  assert.match(teacher, /학생 화면에서 힌트가 숨겨져요/);
  assert.match(teacher, /routes\.api\.boards\.webStudioSettings/);
  assert.match(teacher, /WebCodingLiteSubmissionGallery/);
  assert.match(board, /WebCodingLiteTeacherSummary/);
});

test("Web Studio Lite teacher submission gallery and API are teacher-only and sandboxed", () => {
  const progress = read("lib", "lesson-activities", "progress.ts");
  const route = read(
    "app",
    "api",
    "v1",
    "boards",
    "[boardId]",
    "lesson-session",
    "web-studio",
    "submissions",
    "route.ts",
  );
  const gallery = read(
    "components",
    "lesson-activities",
    "WebCodingLiteSubmissionGallery.tsx",
  );
  const shareRoute = read(
    "app",
    "api",
    "v1",
    "share",
    "[code]",
    "activity-state",
    "route.ts",
  );

  assert.match(progress, /updateWebCodingLiteHintSettingsForBoard/);
  assert.match(progress, /lesson_activity_runs/);
  assert.match(progress, /config: nextConfig/);
  assert.match(progress, /assertCanManageWebCodingLiteSettings/);
  assert.match(progress, /canEditBoard\(role\)/);

  const settingsRoute = read(
    "app",
    "api",
    "v1",
    "boards",
    "[boardId]",
    "lesson-session",
    "web-studio",
    "settings",
    "route.ts",
  );
  assert.match(settingsRoute, /PATCH/);
  assert.match(settingsRoute, /requireUserApi/);
  assert.match(settingsRoute, /isValidBoardId\(boardId\)/);
  assert.match(settingsRoute, /typeof body\?\.hintsEnabled !== "boolean"/);
  assert.match(settingsRoute, /updateWebCodingLiteHintSettingsForBoard/);
  assert.match(settingsRoute, /403/);

  assert.match(progress, /getWebCodingLiteSubmissionsForBoard/);
  assert.match(progress, /assertCanReviewWebCodingLiteSubmissions/);
  assert.match(progress, /canEditBoard\(role\)/);
  assert.match(
    progress,
    /getLatestActivityRunForBoard\(boardId, WEB_CODING_LITE_ACTIVITY_TYPE\)/,
  );
  assert.match(progress, /studentLabel: `익명 학생 \$\{index \+ 1\}`/);
  assert.match(progress, /html: state\.html/);
  assert.match(progress, /css: state\.css/);
  assert.match(progress, /js: state\.js/);
  assert.match(progress, /counts: buildCodeCounts/);
  assert.match(
    progress,
    /.select\("id, state, status, updated_at, submitted_at"\)/,
  );

  assert.match(route, /requireUserApi/);
  assert.match(route, /isValidBoardId\(boardId\)/);
  assert.match(route, /getWebCodingLiteSubmissionsForBoard/);
  assert.match(route, /403/);

  assert.match(gallery, /routes\.api\.boards\.webStudioSubmissionCard/);

  assert.match(gallery, /웹 코딩 제출물/);
  assert.match(gallery, /아직 제출된 코드가 없어요/);
  assert.match(gallery, /HTML/);
  assert.match(gallery, /CSS/);
  assert.match(gallery, /JS/);
  assert.match(gallery, /미리보기/);
  assert.match(gallery, /발표 보기/);
  assert.match(gallery, /보드 카드로 보내기/);
  assert.match(gallery, /이전 제출물/);
  assert.match(gallery, /다음 제출물/);
  assert.match(gallery, /보드 카드로 보냈어요/);
  assert.match(gallery, /보드 카드 생성에 실패했어요/);
  assert.match(gallery, /저장됨/);
  assert.match(gallery, /제출됨/);
  assert.match(gallery, /새로고침/);
  assert.match(gallery, /닫기/);
  assert.match(gallery, /<pre/);
  assert.match(gallery, /sandbox="allow-scripts"/);
  assert.doesNotMatch(gallery, /allow-same-origin/);
  assert.doesNotMatch(gallery, /allow-popups|allow-forms|allow-top-navigation/);
  assert.match(gallery, /event\.source === iframeRef\.current\.contentWindow/);
  assert.match(
    gallery,
    /event\.source === presentationIframeRef\.current\.contentWindow/,
  );
  assert.doesNotMatch(gallery, /eval\(/);

  assert.match(shareRoute, /getOrCreateWebCodingLiteStateForParticipant/);
  assert.match(shareRoute, /x-gomdory-participant-key/);
});

test("Web Studio Lite docs cover teacher-only gallery limitations and no migration", () => {
  const docs = read("docs", "QA_TEACHER_BOARD.md");
  const migrationFiles = fs.readdirSync(
    path.join(root, "supabase", "migrations"),
  );
  assert.match(docs, /student_activity_states\.state/);
  assert.match(docs, /no server-side code execution|서버/);
  assert.match(docs, /Monaco is lazy-loaded|Monaco is optional\/lazy/);
  assert.match(
    docs,
    /textarea fallback remains|textarea fallback remains first-class|first-class safe baseline/,
  );
  assert.match(docs, /jsDelivr/);
  assert.match(docs, /MONACO_BASE_URL/);
  assert.match(docs, /assets\.gomdory\.com\/assets\/monaco\/vX/);
  assert.match(
    docs,
    /restricted school networks|제한된 학교 네트워크|restricted school/,
  );
  assert.match(docs, /Infinite loops|무한 반복|infinite loops/);
  assert.match(docs, /allow-same-origin/);
  assert.match(docs, /no npm\/package support|npm\/package/);
  assert.match(
    docs,
    /teacher-only Web Studio submission gallery|교사 전용.*제출물/,
  );
  assert.match(docs, /full code is teacher-only|전체 코드.*교사/);
  assert.match(
    docs,
    /discussion\/archive card|토론\/아카이브 카드|discussion card/,
  );
  assert.match(docs, /full code remains teacher-only|전체 코드.*교사/);
  assert.match(docs, /Hint Coach MVP|힌트 코치/);
  assert.match(docs, /rule-based\/local|로컬.*규칙|외부 AI 호출 없음/);
  assert.match(
    docs,
    /teacher toggle|교사 토글|teacher control|turn Web Studio hints on\/off/,
  );
  assert.match(docs, /lesson_activity_runs\.config/);
  assert.match(docs, /students may need refresh|refresh|새로고침/);
  assert.match(docs, /persisted hint analytics|힌트.*분석/);
  assert.match(docs, /draggable divider|드래그.*크기 조절/);
  assert.match(docs, /local-only|로컬 전용/);
  assert.match(docs, /mobile.*stack|모바일.*세로/);
  assert.equal(
    migrationFiles.some((file) => /web_coding_lite/i.test(file)),
    false,
  );
});
