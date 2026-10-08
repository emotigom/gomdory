import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("canonical board route uses TeacherBoardCanonicalClient", () => {
  const boardPage = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "page.tsx",
  );
  assert.match(
    boardPage,
    /import TeacherBoardCanonicalClient from "\.\/TeacherBoardCanonicalClient"/,
  );
  assert.doesNotMatch(boardPage, /TeacherBoardMinimalClient/);
});

test("legacy board routes redirect to canonical board", () => {
  const classPage = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "class",
    "page.tsx",
  );
  const gridPage = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "grid",
    "page.tsx",
  );
  assert.match(
    classPage,
    /redirect\(`\/dashboard\/boards\/\$\{boardId\}\/board`\)/,
  );
  assert.match(
    gridPage,
    /redirect\(`\/dashboard\/boards\/\$\{boardId\}\/board`\)/,
  );
});

test("dashboard board entrypoints use /board hrefs", () => {
  const boardList = read("app", "dashboard", "BoardList.tsx");
  const recentButton = read(
    "app",
    "dashboard",
    "DashboardRecentBoardButton.tsx",
  );
  const createBoard = read("app", "dashboard", "CreateBoardSection.tsx");
  assert.match(boardList, /boardBoardHref/);
  assert.doesNotMatch(boardList, /boardClassHref/);
  assert.match(recentButton, /boardBoardHref/);
  assert.doesNotMatch(
    recentButton,
    /\/dashboard\/boards\/\$\{[^}]+\}(?!\/board)/,
  );
  assert.match(createBoard, /boardBoardHref\(lastCreatedBoardId\)/);
  assert.doesNotMatch(createBoard, /boardClassHref/);
});

test("canonical client keeps native scroll layout and runtime marker", () => {
  const client = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );
  assert.match(client, /data-board-runtime="teacher-board-canonical"/);
  assert.match(client, /overflow-x-auto overflow-y-hidden/);
  assert.match(client, /useSetDashboardChrome/);
  assert.match(client, /mode: "board"/);
  assert.match(client, /대시보드/);
  assert.match(client, /BoardQuickActions/);
  assert.match(client, /보드/);
  assert.match(client, /파일/);
  assert.match(client, /설정/);
  assert.match(client, /공유/);
  assert.match(client, /flex-1 min-h-0 overflow-y-auto/);
  assert.match(client, /첫 섹션 만들기/);
  assert.match(client, /아직 섹션이 없습니다/);
  assert.match(client, /카드 추가/);
  assert.match(client, /파일 카드 추가|첨부/);
  assert.match(client, /type="file"/);

  assert.match(
    client,
    /routes\.api\.v1\("dashboard", "cards", cardId, "move"\)/,
  );
  assert.match(client, /위로 이동/);
  assert.match(client, /아래로 이동/);
  assert.match(client, /disabled=\{cardIndex === 0 \|\| Boolean\(movingTeacherCardId\)\}/);
  assert.match(client, /disabled=\{cardIndex === cards\.length - 1 \|\| Boolean\(movingTeacherCardId\)\}/);
});

test("canonical card action menu is readable, accessible, and complete", () => {
  const client = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );
  const moreMenu = read("app", "_components", "MoreMenu.tsx");
  const page = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "page.tsx",
  );

  assert.match(client, /label="카드 메뉴 열기"/);
  assert.match(moreMenu, /aria-haspopup="menu"/);
  assert.match(moreMenu, /aria-expanded=\{isOpen\}/);
  assert.match(client, /role="menuitem"/);
  assert.match(client, /bg-slate-950/);
  assert.match(client, /text-slate-100/);
  assert.match(client, /border-cyan-300\/20/);
  assert.doesNotMatch(client, /카드 메뉴 열기[\s\S]{0,500}bg-white\/95/);
  assert.match(client, /triggerClassName="h-7 w-7/);
  assert.match(client, /closeOnSelect/);
  assert.match(moreMenu, /useDismissableLayer/);
  const dismissableLayer = read("app", "_components", "useDismissableLayer.ts");
  assert.match(dismissableLayer, /document\.addEventListener\("pointerdown"/);
  assert.match(dismissableLayer, /document\.addEventListener\("keydown"/);
  assert.match(dismissableLayer, /shouldDismissOnKeyDown/);

  assert.match(client, /편집/);
  assert.match(client, /크게 보기/);
  assert.match(client, /카드 색상 변경/);
  assert.match(client, /첨부 추가/);
  assert.match(client, /위로 이동/);
  assert.match(client, /아래로 이동/);
  assert.match(client, /삭제/);
  assert.match(client, /text-rose-300/);
  assert.match(client, /CARD_COLOR_OPTIONS/);
  assert.match(client, /getCardColorToneClasses/);
  assert.match(client, /data-card-color-tone=\{cardColorTone\(card\.card_color_token\)\}/);
  assert.doesNotMatch(client, /UNSUPPORTED_CARD_COLOR_OPTIONS/);
  assert.match(
    client,
    /routes\.api\.v1\("dashboard", "cards", cardId, "color"\)|updateCardColor/,
  );
  assert.match(page, /canSoftDelete\(boardRole, boardPolicy\)/);
  assert.match(client, /canDeleteCards \? \(/);
  assert.match(client, /card\.owner_id !== currentUserId/);
});

test("canonical client renders image\/file\/url attachments without filtering attachment-only cards", () => {
  const client = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );

  const snapshot = read(
    "lib",
    "board",
    "teacherBoardSnapshot.ts",
  );

  assert.match(
    client,
    /type TeacherBoardAttachment as BoardAttachment/,
  );

  assert.match(
    snapshot,
    /kind:\s*"image"\s*\|\s*"file"\s*\|\s*"url"\s*\|\s*"audio"\s*\|\s*"video"\s*\|\s*"document"/,
  );

  assert.match(client, /attachment\.kind === "image"/);
  assert.match(client, /return "file";/);
  assert.match(client, /contentType\.startsWith\("audio\/"\)/);
  assert.match(client, /contentType\.startsWith\("video\/"\)/);
  assert.match(client, /contentType\.includes\("pdf"\)/);
  assert.match(client, /return \(/);
  assert.match(client, /AttachmentViewer/);
  assert.match(client, /selectedAttachment[\s\S]*<AttachmentViewer/);
  assert.doesNotMatch(client, /첨부\s*N/);
  assert.doesNotMatch(client, /visibleCards/);
});

test("canonical client has no wheel capture or preventDefault hacks", () => {
  const client = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );
  assert.doesNotMatch(client, /document\.addEventListener\("wheel"/);
  assert.doesNotMatch(client, /window\.addEventListener\("wheel"/);
  assert.doesNotMatch(
    client,
    /(?:wheel|touchmove|mousewheel)[\s\S]{0,200}preventDefault\(|preventDefault\([\s\S]{0,200}(?:wheel|touchmove|mousewheel)/,
  );
  assert.doesNotMatch(client, /__gomdoryInspectBoardScroll/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_BOARD_RUNTIME_DEBUG/);
  assert.doesNotMatch(client, /DndContext|DragOverlay|dragScroll|wheelRouting/);
});

test("right rail file panel does not render signed url fields", () => {
  const client = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );
  assert.doesNotMatch(client, /uploadUrl/);
  assert.doesNotMatch(client, /signedUrl/);
  assert.doesNotMatch(client, /X-Amz-Signature/);
  assert.doesNotMatch(client, /invite token|share token/i);
});

test("share panel exposes guest-safe QR/code entry and safe management link", () => {
  const client = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );
  const modal = read("app", "dashboard", "_components", "ShareGuideModal.tsx");
  const combined = `${client}\n${modal}`;

  assert.match(client, /onClick=\{\(\) => setQrOpen\(true\)\}[\s\S]*?QR 열기/);
  assert.match(client, /buildStudentUrl\(shareEntryPath\)/);
  assert.match(read("lib", "http", "publicLinks.ts"), /normalizeProto\(SHORT_BASE_URL, proto\)/);
  assert.match(read("lib", "http", "siteConfig.ts"), /DEFAULT_SHORT_URL\s*=\s*["']https:\/\/www\.gkrry\.com["']/);
  assert.match(client, /<ShareGuideModal/);
  assert.match(modal, /학생 입장 안내/);
  assert.match(modal, /www\.gkrry\.com 접속/);
  assert.match(modal, /입장 코드/);
  assert.match(modal, /\{displayCode \|\| "------"\}/);
  assert.match(modal, /toDataURL\(shareUrl,\s*\{\s*margin: 2,\s*width: 340/s);
  assert.match(modal, /aria-label="학생 입장 안내 닫기"/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /StudentEntryIcon icon=\{step\.icon\}/);
  assert.match(modal, /select-all whitespace-nowrap font-mono/);
  assert.doesNotMatch(combined, /student-entry-preview\.png/);
  assert.doesNotMatch(combined, /student-entry-modal-shell\.png/);
  assert.doesNotMatch(combined, /student-entry-qr-panel\.png/);
  assert.doesNotMatch(combined, /student-entry-step-card\.png/);
  assert.doesNotMatch(combined, /student-entry-code-panel\.png/);
  assert.doesNotMatch(combined, /icon-(globe|keyboard|door|phone)-cyan\.png/);
  assert.strictEqual(
    (modal.match(/aria-label="학생 입장 안내 닫기"/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(client, /Persistent Board Code/);
  assert.doesNotMatch(client, /Share URL Preview/);
  assert.doesNotMatch(client, /BOARD SHARE CENTER/);
  assert.doesNotMatch(client, /Board Share Center/);
  assert.doesNotMatch(client, /VIEWER SHARE/);
  assert.match(client, /게스트는 카드 조회\/작성\/첨부 가능, 보드 설정\/삭제 권한은/);
  assert.match(client, /href=\{`\/dashboard\/boards\/\$\{boardId\}\/edit`\}/);
  assert.doesNotMatch(client, /OWNER \/ ADMIN/);
  assert.doesNotMatch(
    client,
    /href=\{`\/dashboard\/boards\/\$\{boardId\}\/(class|grid)\`\}/,
  );
});

test("top chrome and canonical HUD hover panels are reachable overlays that do not animate layout height", () => {
  const topBar = read("app", "_components", "HoverExpandBar.tsx");
  const client = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );

  assert.match(topBar, /rootTestId = "hover-expand-bar"/);
  assert.match(topBar, /expandedTestId = "hover-expand-panel"/);
  assert.match(topBar, /data-testid=\{rootTestId\}/);
  assert.match(topBar, /data-testid=\{expandedTestId\}/);
  assert.match(topBar, /const expanded = openMode !== "closed" \|\| \(resolvedActivationMode === "hover" && focused\)/);
  assert.match(topBar, /clearCloseTimer\(\)/);
  assert.match(topBar, /aria-expanded=\{expanded\}/);
  assert.match(topBar, /setOpenMode\(\(prev\) => \(prev === "closed" \? "pinned" : "closed"\)\)/);
  assert.match(
    topBar,
    /createPortal\(/,
  );
  assert.match(
    topBar,
    /pointer-events-none fixed z-\[1100\] flex justify-center bg-transparent transition-\[opacity,transform\]/,
  );
  assert.match(topBar, /max-w-\[var\(--bar-panel-max-width\)\]/);
  assert.match(
    topBar,
    /pointer-events-auto flex h-auto w-full/,
  );
  assert.match(topBar, /transition-\[opacity,transform\]/);
  assert.match(
    topBar,
    /expanded \? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"/,
  );
  assert.match(topBar, /resolvedActivationMode === "hover"/);
  assert.doesNotMatch(
    topBar,
    /transition-\[max-height\]|max-h-0|group-hover:max-h/,
  );

  assert.match(client, /data-testid="canonical-board-hud"/);
  assert.match(client, /data-testid="canonical-board-hud-panel"/);
  assert.match(client, /sticky top-2 z-40 overflow-visible/);
  assert.doesNotMatch(
    client,
    /group hud-top-chrome hud-content-fill sticky top-2/,
  );
  assert.match(client, /absolute left-0 right-0 top-full z-\[79\] h-3/);
  assert.match(client, /absolute left-0 right-0 top-\[calc\(100%-2px\)\]/);
  assert.match(client, /transition-\[opacity,transform\]/);
  assert.match(client, /pointer-events-none -translate-y-3 opacity-0/);
  assert.match(client, /group-focus-within:pointer-events-auto/);
  assert.match(client, /입장 코드/);
  assert.match(
    client,
    /gkrry\.com → 코드 입력 → 바로 참여/,
  );
  assert.match(client, /\$\{styles\.boardHeader\} group hud-top-chrome sticky top-2 z-40 overflow-visible/);
});

test("canonical right rail is a compact desktop trigger and accessible responsive overlay", () => {
  const client = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");
  assert.match(client, /const \[rightRailOpen, setRightRailOpen\] = useState\(false\)/);
  assert.match(client, /rightRailCloseTimer/);
  assert.match(client, /}, 350\)/);
  assert.match(client, /data-testid="canonical-right-rail"/);
  assert.match(client, /pointer-events-none fixed inset-0[^"\n]*lg:right-3[^"\n]*lg:top-1\/2/);
  assert.match(client, /min-h-40 w-14/);
  assert.match(client, /aria-expanded=\{rightRailOpen\}/);
  assert.match(client, /aria-controls="canonical-right-rail-panel"/);
  assert.match(client, /rightRailOpen \? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"/);
  assert.match(client, /data-testid="canonical-mobile-tools-backdrop"[\s\S]*?onClick=\{\(\) => closeRightRail\(\)\}/);
  const panel = client.slice(client.indexOf('data-testid="canonical-right-rail-panel"'), client.indexOf('data-testid="canonical-right-rail-panel"') + 2000);
  assert.match(panel, /role="dialog"/);
  assert.match(panel, /aria-modal="true"/);
  assert.match(panel, /aria-labelledby="canonical-right-rail-title"/);
  assert.match(panel, /aria-hidden=\{!rightRailOpen\}/);
  assert.match(panel, /inert=\{!rightRailOpen\}/);
  assert.match(panel, /onKeyDown=\{handleRightRailKeyDown\}/);
  assert.match(panel, /data-state=\{rightRailOpen \? "open" : "closed"\}/);
  assert.match(panel, /max-h-\[calc\(100dvh-1\.5rem\)\]/);
  assert.match(panel, /lg:max-h-\[calc\(100vh-96px\)\]/);
  assert.match(panel, /lg:w-\[min\(20rem,calc\(100vw-2rem\)\)\]/);
  assert.match(panel, /pointer-events-auto visible[^"\n]*opacity-100/);
  assert.match(panel, /pointer-events-none invisible[^"\n]*opacity-0/);
  assert.match(client, /onMouseEnter=\{openRightRail\}/);
  assert.match(client, /onMouseLeave=\{closeRightRailSoon\}/);
  assert.match(client, /onFocusCapture=\{clearRightRailCloseTimer\}/);
  assert.match(client, /onBlurCapture=\{\(event\) =>/);
  assert.match(client, /role="tablist" aria-label="수업 진행 도구 메뉴"/);
  assert.match(client, /role="tab"/);
  assert.match(client, /role="tabpanel"/);
  assert.doesNotMatch(client, /xl:pr-\[19rem\]|w-\[288px\]/);
});

test("canonical board avoids page-level horizontal overflow and bottom whitespace", () => {
  const client = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );

  assert.match(client, /min-h-\[calc\(100vh-32px\)\]/);
  assert.match(client, /max-w-full flex-col gap-3 overflow-x-clip/);
  assert.match(client, /data-testid="canonical-board-content"/);
  assert.match(
    client,
    /className=\{`\$\{styles\.wallScroller\} flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-hidden pl-1 pr-0 scroll-pl-1`\}/,
  );
  assert.match(client, /flex min-h-0 min-w-full w-max items-start gap-3 pb-2/);
  assert.match(client, /min-h-\[18rem\] max-h-\[calc\(100vh-14rem\)\]/);
  assert.match(client, /w-\[clamp\(320px,28vw,420px\)\]/);
  assert.match(client, /data-board-scroll="horizontal"/);
  assert.doesNotMatch(client, /w-screen/);
});

test("canonical board server ensures a persistent share code before rendering", () => {
  const page = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "page.tsx",
  );
  const share = read("lib", "data", "share.ts");

  assert.match(page, /ensureBoardShareCode\(board\.id\)/);
  assert.match(page, /boardAccessCode=\{boardAccessCode\}/);
  assert.match(share, /export async function ensureBoardShareCode/);
  assert.match(share, /for \(let attempt = 0; attempt < 8; attempt \+= 1\)/);
  assert.match(share, /isUniqueConstraintError/);
  assert.doesNotMatch(share, /randomBytes|node:crypto|require\("crypto"\)/);
});

test("share ensure API allows any board role that can view the board", () => {
  const route = read(
    "app",
    "api",
    "v1",
    "boards",
    "[boardId]",
    "share",
    "ensure",
    "route.ts",
  );
  assert.match(route, /if \(!boardRole\)/);
  assert.doesNotMatch(route, /boardRole === "viewer"/);
  assert.doesNotMatch(route, /공유 링크를 만들 권한이 없습니다/);
});

test("public share route uses modern guest HUD without owner controls", () => {
  const page = read("app", "s", "[code]", "page.tsx");
  const client = read(
    "app",
    "s",
    "[code]",
    "_components",
    "StudentBoardMinimal.tsx",
  );
  const shareAccess = read("lib", "share", "public", "access.ts");
  const shareData = read("lib", "data", "share.ts");
  const joinByCode = read("app", "_components", "JoinByCode.tsx");
  const globals = read("app", "globals.css");

  assert.match(page, /resolvePublicShareBoard\(code\)/);
  assert.match(page, /normalizedCode = resolved\.normalizedCode/);
  assert.match(page, /data-page-marker="student-board"/);
  assert.match(page, /data-page-marker="student-board-error"/);
  assert.match(page, /공유 코드를 찾을 수 없어요/);
  assert.match(page, /코드 다시 입력/);
  assert.match(
    shareAccess,
    /const normalizedCode = normalizeShareCode\(code\)/,
  );
  assert.match(shareData, /\.eq\("share_code", normalized\)/);
  assert.match(joinByCode, /form\.action = "\/s\/enter"/);

  assert.match(client, /data-board-runtime="student-share-modern"/);
  assert.match(client, /data-public-guest-board="modern-hud"/);
  assert.match(client, /bg-\[var\(--theme-bg\)\]/);
  assert.match(client, /참여자/);
  assert.match(client, /routes\.api\.v1\("share", shareCode/);
  assert.match(client, /mode="student"/);
  assert.match(globals, /\[data-public-guest-board="modern-hud"\]/);

  assert.doesNotMatch(
    client,
    /보드 설정 열기|교사 설정 열기|보드 관리 열기|rotate|share code rotation/i,
  );
  assert.doesNotMatch(
    client,
    /routes\.api\.v1\("dashboard", "boards", boardId/,
  );
  assert.doesNotMatch(client, /ensureBoardShareCode/);
});

test("public frontend asset URLs use custom domains instead of R2 bucket names", () => {
  const frontendSources = [
    read("app", "globals.css"),
    read("app", "s", "[code]", "page.tsx"),
    read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx"),
    read("app", "dashboard", "_components", "ShareGuideModal.tsx"),
  ].join("\n");

  assert.doesNotMatch(
    frontendSources,
    /gom-public-assets|edu-webllm-models|gom-edu-projects/,
  );
  assert.match(frontendSources, /https:\/\/assets\.gomdory\.com\/assets\//);
});

test("canonical board exposes safe lesson practice launcher without QR share changes", () => {
  const client = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );
  const launcher = read(
    "components",
    "lesson-activities",
    "LessonActivityLauncher.tsx",
  );
  const registry = read("lib", "lesson-activities", "registry.ts");

  assert.match(
    client,
    /import LessonActivityLauncher from "@\/components\/lesson-activities\/LessonActivityLauncher"/,
  );
  assert.match(client, /openLessonTools\("header"\)[\s\S]*?수업 활동 열기/);
  assert.match(
    client,
    /<LessonActivityLauncher[\s\S]*boardId=\{boardId\}[\s\S]*initialActiveSession=\{initialActiveLessonSession\}[\s\S]*\/>/,
  );
  assert.match(registry, /lesson_01_ai_intro_python_first_steps/);
  assert.match(registry, /lesson_02_ai_judgment_if_else/);
  assert.match(launcher, /학생 화면에 표시 중/);
  assert.match(launcher, /수업 실습을 시작하지 못했어요\./);
  assert.match(launcher, /setPendingAction\(null\)/);
  assert.match(launcher, /fetch\(/);
  assert.match(client, /onClick=\{\(\) => setQrOpen\(true\)\}[\s\S]*?QR 열기/);
  assert.match(client, /buildStudentUrl\(shareEntryPath\)/);
  assert.match(read("lib", "http", "publicLinks.ts"), /normalizeProto\(SHORT_BASE_URL, proto\)/);
  assert.match(read("lib", "http", "siteConfig.ts"), /DEFAULT_SHORT_URL\s*=\s*["']https:\/\/www\.gkrry\.com["']/);
});

test("student guest route is wired for future activity panel without changing share resolution", () => {
  const page = read("app", "s", "[code]", "page.tsx");
  const panel = read(
    "components",
    "lesson-activities",
    "StudentActivityPanel.tsx",
  );
  const placeholders = read(
    "components",
    "lesson-activities",
    "ActivityPlaceholders.tsx",
  );

  assert.match(page, /resolvePublicShareBoard\(code\)/);
  assert.match(page, /getActiveLessonSessionForBoard\(board\.id\)/);
  const workspace = read(
    "app",
    "s",
    "[code]",
    "_components",
    "StudentLessonWorkspace.tsx",
  );
  const teacherClient = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );
  assert.match(page, /if \(activeLessonSession\)/);
  assert.match(
    page,
    /<StudentLessonWorkspace activeLesson=\{activeLessonSession\} board=\{boardProps\} \/>/,
  );
  assert.match(page, /<StudentBoardMinimal \{\.\.\.boardProps\} \/>/);
  assert.match(workspace, /data-testid="student-lesson-workspace"/);
  assert.match(workspace, /data-testid="student-lesson-activity-main"/);
  assert.match(workspace, /보드 보기/);
  assert.match(workspace, /max-w-\[1680px\]/);
  assert.doesNotMatch(teacherClient, /StudentActivityPanel/);
  assert.match(panel, /data-testid="student-activity-panel"/);
  assert.match(panel, /max-w-\[1680px\]/);
  assert.match(panel, /student-selected-activity/);
  assert.match(panel, /오늘의 실습/);
  assert.match(panel, /student-activity-switcher/);
  assert.doesNotMatch(panel, /fixed right-3|w-\[min\(390px/);
  assert.match(panel, /AiBingoActivity/);
  assert.match(placeholders, /AI 판단 카드 분류 — 준비 중/);
  assert.match(placeholders, /웹 코딩 실습 — 준비 중/);
  assert.doesNotMatch(
    page,
    /rotateShareCode|enableSharing|ensureBoardShareCode/,
  );
});
