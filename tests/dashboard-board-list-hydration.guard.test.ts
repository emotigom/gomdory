import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard board list waits for auth hydration and separates loading, error, and empty states", () => {
  const source = read("app", "dashboard", "_components", "DashboardBoardList.tsx");
  const page = read("app", "dashboard", "page.tsx");

  assert.match(source, /"ready_with_boards"/);
  assert.match(source, /"ready_empty"/);
  assert.match(source, /"auth_error"/);
  assert.match(source, /initialLoadSucceeded/);
  assert.match(page, /let boardListLoaded = false/);
  assert.match(page, /boards = await listBoardsForUser[\s\S]*boardListLoaded = true/);
  assert.match(page, /initialLoadSucceeded=\{boardListLoaded\}/);
  assert.match(source, /getSupabaseBrowserAccessToken/);
  assert.match(source, /subscribeSupabaseBrowserAuthState/);
  assert.match(source, /event === "SIGNED_IN" \|\| event === "TOKEN_REFRESHED" \|\| event === "INITIAL_SESSION"/);
  assert.match(source, /headers\.set\("Authorization", `Bearer \$\{accessToken\}`\)/);
  assert.match(source, /const token = await getSupabaseBrowserAccessToken\(\)/);
  assert.match(source, /if \(!token\) \{\s*markLoginRequired\(\);\s*return;\s*\}/s);
  assert.match(source, /fetch\(apiV1Path\("dashboard\/boards"\), \{\s*cache: "no-store"/s);
  assert.match(source, /보드 목록을 불러오는 중이에요\.\.\./);
  assert.match(source, /보드 목록을 불러오지 못했어요\./);
  assert.match(source, /다시 시도/);
  assert.match(source, /아직 만든 보드가 없습니다\./);
  assert.match(source, /새 보드 만들기/);
  assert.match(source, /listLoadState === "checking-auth" \|\| listLoadState === "loading"/);
  assert.match(source, /listLoadState === "error" \|\| listLoadState === "auth_error"/);
  assert.match(source, /listLoadState === "ready_empty"/);
  assert.match(source, /filteredBoards\.length === 0/);
  assert.doesNotMatch(source, /catch[\s\S]{0,240}setBoards\(\[\]\)/);
});

test("dashboard board list keeps phase 9 interaction polish scoped to the list surface", () => {
  const source = read("app", "dashboard", "_components", "DashboardBoardList.tsx");
  const createSection = read("app", "dashboard", "CreateBoardSection.tsx");
  const createForm = read("app", "dashboard", "CreateBoardForm.tsx");
  const globals = read("app", "globals.css");

  assert.match(source, /data-dashboard-board-list-scope/);
  assert.match(createSection, /data-dashboard-board-list-scope/);
  assert.match(source, /dashboard-board-list-card/);
  assert.match(source, /dashboard-board-list-control/);
  assert.match(source, /dashboard-board-list-icon-control/);
  assert.match(source, /dashboard-board-list-menu-item/);
  assert.match(createSection, /dashboard-board-list-control/);
  assert.match(createForm, /dashboard-board-list-control/);

  assert.match(globals, /\[data-dashboard-board-list-scope\] \.dashboard-board-list-card/);
  assert.match(globals, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*dashboard-board-list-card:hover/);
  assert.match(globals, /dashboard-board-list-control:focus-visible/);
  assert.match(globals, /dashboard-board-list-icon-control:focus-visible/);
  assert.match(globals, /dashboard-board-list-menu-item:focus-visible/);
  assert.match(globals, /:not\(:disabled\):not\(\[aria-disabled="true"\]\):not\(\[data-disabled="true"\]\):active/);
  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)[\s\S]*dashboard-board-list-card/);

  assert.doesNotMatch(globals, /(^|\n)\s*(button|a|\[role=["']button["']\])(?::|\s|\{)/);
  assert.doesNotMatch(globals, /\[data-dashboard-board-list-scope\][\s\S]{0,220}(TeacherBoardCanonicalClient|StudentBoardMinimal)/);
  assert.doesNotMatch(source, /TeacherBoardCanonicalClient|StudentBoardMinimal/);
});

test("dashboard board list keeps board action labels and open/create link contracts", () => {
  const source = read("app", "dashboard", "_components", "DashboardBoardList.tsx");

  assert.match(source, /aria-label=\{pinnedBoardSet\.has\(board\.id\) \? `\$\{board\.title\} 보드 고정 해제` : `\$\{board\.title\} 보드 고정`\}/);
  assert.match(source, /aria-label=\{`\$\{board\.title\} 보드 메뉴`\}/);
  assert.match(source, /aria-controls=\{`dashboard-board-menu-\$\{board\.id\}`\}/);
  assert.match(source, /id=\{`dashboard-board-menu-\$\{board\.id\}`\}/);
  assert.match(source, /aria-expanded=\{openBoardMenuId === board\.id\}/);
  assert.match(source, /aria-label=\{`\$\{board\.title\} 열기`\}/);
  assert.match(source, /href=\{`\/dashboard\/boards\/\$\{board\.id\}\/board`\}/);
  assert.match(source, /href="#dashboard-create-board"/);
  assert.match(source, /aria-controls="dashboard-board-list"/);
});

test("dashboard boards API GET is dynamic and preserves error and auth contracts", () => {
  const route = read("app", "api", "v1", "dashboard", "boards", "route.ts");

  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /export const revalidate = 0/);
  assert.match(route, /withNoStoreHeaders/);
  assert.match(route, /const noStore = withNoStoreHeaders\(\)/);
  assert.match(route, /function readBearerAccessToken\(request: NextRequest\): string \| null/);
  assert.match(route, /request\.headers\.get\("authorization"\)/);
  assert.match(route, /auth\?\.match\(\/\^Bearer\\s\+\(\.\+\)\$\/i\)/);
  assert.match(route, /bearerToken \? \{ authorization: `Bearer \$\{bearerToken\}` \} : undefined/s);
  assert.match(route, /await supabase\.auth\.getUser\(bearerToken\)/);
  assert.match(route, /"UNAUTHENTICATED"[\s\S]*401/);
  assert.match(route, /"INTERNAL_ERROR"[\s\S]*500/);
  assert.doesNotMatch(route, /catch[\s\S]{0,500}boards:\s*\[\]/);
  assert.match(route, /jsonOkWithRequestId\([\s\S]*requestContext\.requestId,\s*noStore/s);
  assert.match(route, /jsonErrorWithRequestId\([\s\S]*noStore/s);
});
