import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync("app/s/[code]/_components/StudentAppSubmitPanel.tsx", "utf8");
const board = readFileSync("app/s/[code]/_components/StudentBoardMinimal.tsx", "utf8");

test("student submit panel supports button modal and inline coding modes", () => {
  assert.match(panel, /type DisplayMode = "button" \| "inline" \| "modal-host"/);
  assert.match(panel, /displayMode = "button"/);
  assert.match(panel, /data-student-app-submit-panel="trigger"/);
  assert.match(panel, /data-student-app-submit-panel="content"/);
  assert.match(panel, /if \(displayMode === "inline"\)/);
  assert.match(panel, /createPortal/);
  assert.match(panel, /document\.body/);
  assert.match(panel, /fixed inset-0/);
  assert.match(panel, /z-\[10000\]/);
  assert.match(panel, /isolate/);
  assert.match(panel, /pointer-events-auto/);
});

test("student submit modal closes only from explicit outside or close actions", () => {
  assert.match(panel, /type SubmitModalCloseReason = "backdrop" \| "escape" \| "close-button" \| "submit-success" \| "programmatic"/);
  assert.match(panel, /const closeSubmitModal = useCallback\(\(reason: SubmitModalCloseReason, event\?: SubmitModalCloseEvent\)/);
  assert.match(panel, /submitInFlightRef\.current \|\| busy/);
  assert.match(panel, /debugStudentModal = searchParams\.get\("debugStudentModal"\) === "1"/);
  assert.match(panel, /console\.info\("\[StudentAppSubmitPanel\] closeSubmitModal"/);
  assert.match(panel, /eventType: event\?\.type \?\? null/);
  assert.match(panel, /target: describeSubmitModalEventTarget\(event\?\.target \?\? null\)/);
  assert.match(panel, /currentTarget: describeSubmitModalEventTarget\(event\?\.currentTarget \?\? null\)/);
  assert.match(panel, /closeSubmitModal\("backdrop", event\)/);
  assert.match(panel, /closeSubmitModal\("escape", event\)/);
  assert.match(panel, /closeSubmitModal\("close-button", event\)/);
  assert.match(panel, /closeSubmitModal\("programmatic", event\)/);
  assert.doesNotMatch(panel, /closeSubmitModal\(\)/);
  assert.match(panel, /if \(event\.target !== event\.currentTarget\) return;/);
  assert.match(panel, /event\.preventDefault\(\);/);
  assert.match(panel, /event\.stopPropagation\(\);/);
  assert.doesNotMatch(panel, /handleSubmitModalBackdropPointerDown/);
  assert.doesNotMatch(panel, /nativeEvent\.composedPath/);
});

test("student submit modal content marker is separated from the trigger marker", () => {
  assert.match(panel, /data-student-coding-modal-content="true"/);
  assert.doesNotMatch(panel, /data-student-app-submit-panel=\{displayMode\}/);
  assert.doesNotMatch(panel, /student-coding-workspace[\s\S]{0,260}data-student-app-submit-panel="button"/);
});

test("student submit modal shell keeps backdrop and content as siblings", () => {
  const modalSource = panel.slice(panel.indexOf("const modal ="), panel.indexOf("if (displayMode === \"inline\")"));
  assert.match(modalSource, /id="student-app-submit-modal"[\s\S]*className=\{`fixed inset-0/);
  assert.doesNotMatch(modalSource, /id="student-app-submit-modal"[\s\S]{0,260}onClick=\{handleSubmitModalBackdropClick\}/);
  assert.match(modalSource, /data-student-submit-modal-backdrop="true"/);
  assert.match(modalSource, /pointer-events-none absolute inset-0 bg-slate-950\/72 backdrop-blur-md/);
  const contentWrapperMatch = modalSource.match(
    /data-student-submit-modal-backdrop="true"[\s\S]*\/>\s*<div\s+className="([^"]+)"\s+data-student-app-submit-panel="content"\s+data-student-coding-modal-content="true"\s+onClick=\{handleSubmitModalBackdropClick\}/,
  );
  assert.ok(contentWrapperMatch, "expected backdrop and modal content wrapper to remain siblings");

  const contentWrapperClasses = new Set(contentWrapperMatch[1].split(/\s+/).filter(Boolean));
  for (const className of ["relative", "z-10", "flex", "min-h-full", "items-center", "justify-center", "touch-pan-y"]) {
    assert.equal(contentWrapperClasses.has(className), true, `expected modal content wrapper class: ${className}`);
  }

  assert.doesNotMatch(modalSource, /onPointerDown=\{handleSubmitModalBackdrop/);
  assert.doesNotMatch(modalSource, /data-student-app-submit-panel="button"/);
});

test("student submit modal keeps touch scrolling inside its scroll panel", () => {
  const modalSource = panel.slice(panel.indexOf("const modal ="), panel.indexOf("if (displayMode === \"inline\")"));
  assert.match(modalSource, /className=\{`fixed inset-0[\s\S]*pointer-events-auto[\s\S]*touch-none/);
  assert.match(modalSource, /data-allow-wheel-overlay="student-app-submit-modal"/);
  assert.match(panel, /student-coding-workspace[\s\S]{0,280}overflow-y-auto[\s\S]{0,80}overscroll-contain[\s\S]{0,80}touch-pan-y/);
  assert.match(panel, /data-modal-scroll-container=\{displayMode !== "inline" \? "true" : undefined\}/);
});

test("student submit modal source keeps one reachable close control and dynamic viewport bounds", () => {
  const headerStart = panel.indexOf('<div className="sticky top-0');
  const headerSource = panel.slice(headerStart, panel.indexOf('\n\n      {showLesson13Launcher ? (', headerStart));
  assert.match(headerSource, /\{displayMode !== "inline" \? \(/);
  assert.match(headerSource, /min-h-11 min-w-11/);
  assert.match(headerSource, />\s*닫기\s*</);
  assert.equal((headerSource.match(/>\s*닫기\s*</g) ?? []).length, 1);
  assert.match(panel, /student-coding-workspace max-h-\[[^\]]+\][\s\S]{0,120}overflow-y-auto/);
  assert.match(panel, /sticky top-0 z-20[\s\S]*bg-\[var\(--workspace-panel\)\]/);
  assert.match(panel, /max-h-\[calc\(100dvh_-_max\(1\.25rem,env\(safe-area-inset-top\)_\+_env\(safe-area-inset-bottom\)\)\)\]/);
  assert.match(panel, /w-full max-w-\[1240px\]/);
  assert.match(panel, /pt-\[max\(0\.625rem,env\(safe-area-inset-top\)\)\]/);
  assert.match(panel, /pb-\[max\(0\.625rem,env\(safe-area-inset-bottom\)\)\]/);
});

test("student submit modal uses a stable board host while the expandable trigger may remount", () => {
  assert.match(panel, /const submitModalOpenByBoard = new Map<string, boolean>\(\)/);
  assert.match(panel, /const submitModalListenersByBoard = new Map<string, Set<\(open: boolean\) => void>>\(\)/);
  assert.match(panel, /function getSubmitModalStateKey\(boardId: string, shareCode\?: string \| null\)/);
  assert.match(panel, /useState\(\(\) => submitModalOpenByBoard\.get\(submitModalStateKey\) === true\)/);
  assert.match(panel, /function setSubmitModalState\(stateKey: string, nextOpen: boolean\)/);
  assert.match(panel, /subscribeToSubmitModalState\(submitModalStateKey, setOpen\)/);
  assert.match(panel, /setOpen\(\(currentOpen\) => \(currentOpen === storedOpen \? currentOpen : storedOpen\)\)/);
  assert.match(panel, /displayMode === "modal-host" && open && mounted/);
  assert.match(panel, /stable modal host mount/);
  assert.match(panel, /stable modal host unmount/);
  assert.match(panel, /modal host preserved while trigger unmounted/);
  assert.match(panel, /console\.info\("\[StudentAppSubmitPanel\] modal open"/);
  assert.match(panel, /console\.info\("\[StudentAppSubmitPanel\] mount"/);
  assert.match(panel, /console\.info\("\[StudentAppSubmitPanel\] unmount"/);
  assert.match(board, /isStudentAppSubmitModalOpenForDebug/);
  assert.match(board, /new URLSearchParams\(window\.location\.search\)\.get\("debugStudentModal"\) === "1"/);
  assert.match(board, /console\.info\("\[StudentAppSubmitPanel\] sync applied while modal open"/);
  assert.match(board, /applyServerColumns\(payload\.model\.columns\)/);
  assert.match(board, /<StudentAppSubmitPanel boardId=\{boardId\} shareCode=\{shareCode\} displayMode="modal-host" \/>/);
  assert.match(board, /<HoverExpandBar[\s\S]*<StudentAppSubmitPanel boardId=\{boardId\} shareCode=\{shareCode\} \/>/);
  assert.doesNotMatch(board, /<StudentAppSubmitPanel[^>]+key=/);
});

test("student submit panel exposes tabbed HTML CSS JS editing and preview", () => {
  for (const text of [
    "학생 코딩 화면",
    "HTML/CSS/JS 코드 편집",
    "index.html",
    "style.css",
    "script.js",
    "학생 앱 미리보기",
    "수업 템플릿을 불러오거나 코드를 입력하면 여기에 결과가 보여요.",
    "HTML/CSS/JS를 수정하고 오른쪽 미리보기로 확인한 뒤 제출해요.",
  ]) {
    assert.equal(panel.includes(text), true);
  }
  assert.match(panel, /type SourceFileKey = "html" \| "css" \| "js"/);
  assert.match(panel, /const \[activeFile, setActiveFile\]/);
  assert.match(panel, /role="tablist"/);
  assert.match(panel, /role="tab"/);
  assert.match(panel, /value=\{sourceFiles\[activeFile\]\}/);
  assert.match(panel, /updateSourceFile\(activeFile, event\.target\.value\)/);
  assert.match(panel, /sourceFilesToManualFiles\(sourceFiles\)/);
  assert.match(panel, /buildLocalPreviewDocument\(previewManualFiles\)/);
  assert.match(panel, /sandbox="allow-scripts"/);
  assert.match(panel, /maxLength=\{40\}/);
  assert.match(panel, /maxLength=\{500\}/);
});

test("student submit panel exposes lesson-specific full screen preview links without changing iframe sandbox", () => {
  for (const text of [
    "lessonStudentPreviewAction",
    "lessonStudentPreviewAction.description",
    "lessonStudentPreviewAction.label",
    "lessonStudentPreviewAction.note",
  ]) {
    assert.equal(panel.includes(text), true);
  }

  assert.match(panel, /href=\{lessonStudentPreviewAction\.href\}/);
  assert.match(panel, /target="_blank"/);
  assert.match(panel, /rel="noopener noreferrer"/);
  assert.match(panel, /sandbox="allow-scripts"/);
  assert.doesNotMatch(panel, /allow-same-origin/);
});

test("student submit panel exposes lesson 11 3D work mode without live 3D preview changes", () => {
  for (const text of [
    "LESSON_11_3D_DOCK_MODE_SRC",
    "/lesson-kits/html/lesson-11-ai-3d-mission-room/index.html?mode=play&dock=1",
    "3D 작업 모드",
    "3D 작업 화면",
    "3D 작업 모드는 기본 예제 화면이에요.",
    "내 수정 내용은 이 3D 작업 화면에 바로 반영되지 않아요.",
    "내가 바꾼 코드는 코딩 화면 미리보기와 제출물에서 확인해요.",
    "3D 작업 모드 닫기",
  ]) {
    assert.equal(panel.includes(text), true);
  }

  assert.match(panel, /data-lesson-11-work-mode/);
  assert.match(panel, /src=\{LESSON_11_3D_DOCK_MODE_SRC\}/);
  assert.match(panel, /setWorkModeRevision/);
  assert.doesNotMatch(panel, /allow-same-origin/);
});

test("student submit panel provides classroom layout controls and Korean copy", () => {
  for (const text of [
    "밝은 테마",
    "어두운 테마",
    "코드와 미리보기 너비 조절",
    "미리보기 새로고침",
    "코드 비우기",
    "제출하기",
    "파일 요약",
    "최근 제출 상태",
  ]) {
    assert.equal(panel.includes(text), true);
  }
  assert.match(panel, /const \[theme, setTheme\]/);
  assert.match(panel, /useState<"dark" \| "light">\("light"\)/);
  assert.match(panel, /if \(savedTheme === "dark" \|\| savedTheme === "light"\) setTheme\(savedTheme\)/);
  assert.match(panel, /const \[splitPercent, setSplitPercent\]/);
  assert.match(panel, /THEME_STORAGE_KEY/);
  assert.match(panel, /SPLIT_STORAGE_KEY/);
  assert.match(panel, /role="separator"/);
  assert.match(panel, /aria-orientation="vertical"/);
  assert.match(panel, /onPointerDown=\{handleDividerPointerDown\}/);
  assert.match(panel, /data-theme=\{theme\}/);
});

test("student submit panel shows file-level validation guidance and shared limits", () => {
  assert.match(panel, /checkStudentAppFileRule/);
  assert.match(panel, /현재 용량 \/ 최대 용량/);
  assert.match(panel, /현재 파일 수 \/ 최대 파일 수/);
  assert.match(panel, /submissionIssues/);
  assert.match(panel, /slice\(0, 5\)/);
  assert.match(panel, /학생이 할 수 있는 해결/);
});

test("student submit panel preserves static-only submission and ZIP import behavior", () => {
  assert.match(panel, /apiV1Path\("student-apps\/submit"\)/);
  assert.match(panel, /apiV1Path\("student-apps\/submissions\/status"\)/);
  assert.match(panel, /gomdory:student-app-submissions:/);
  assert.match(panel, /gomdory:student-app-author-id:/);
  assert.match(panel, /gomdory:student-app-draft/);
  assert.match(panel, /DRAFT_STORAGE_VERSION/);
  assert.match(panel, /parseDraftSourceFiles/);
  assert.match(panel, /SUBMISSION_NETWORK_ERROR_MESSAGE/);
  assert.equal(panel.includes("작성 내용은 이 브라우저에 남아 있어요"), true);
  assert.equal(panel.includes("Wi-Fi가 불안정해도 작성 중인 코드는 이 브라우저에 임시 저장됩니다."), true);
  assert.match(panel, /authorClientId:\s*getAuthorClientId\(\)/);
  assert.match(panel, /saveSubmissionStatusCapability/);
  assert.match(panel, /shareContext: shareCode \?\? accessCode/);
  assert.match(panel, /const canPoll = typeof statusCapability !== "string"/);
  assert.match(panel, /source:\s*"manual_files"/);
  assert.match(panel, /filesToStudentAppManualFiles\(selectedFiles\)/);
  assert.match(panel, /importStudentStaticSiteZip/);
  assert.match(panel, /ZIP 파일 자체가 아니라 압축 안의 정적 파일을 제출해요/);
  assert.match(panel, /이미지·음원\(MIDI 포함\)·폰트/);
  assert.match(panel, /React\/Vite\/Next\.js 빌드는 실행하지 않아요/);
  assert.match(panel, /autoPublish\?:\s*\{[^}]*publicUrl\?: unknown/);
  assert.match(panel, /const publicUrl = payload\.ok === true \? payload\.autoPublish\?\.publicUrl : undefined/);
  assert.match(panel, /typeof publicUrl === "string" && publicUrl\.trim\(\)/);
  assert.match(panel, /setPublishedUrl\(publicUrl\)/);
  assert.doesNotMatch(panel, /r2Prefix|r2Key|router\.refresh|adm-zip|yauzl|npm install|next build|vite build/i);
  assert.doesNotMatch(panel, /window\.open/);
});

test("student submit panel safely handles non-JSON server failures", () => {
  assert.match(panel, /response\.headers\.get\("content-type"\)/);
  assert.match(panel, /contentType\.includes\("application\/json"\)/);
  assert.match(panel, /response\.status >= 500/);
  assert.match(panel, /파일 전체를 20MB 이하로 줄인 뒤 다시 제출해 주세요/);
});
