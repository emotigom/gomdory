import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

const lowRiskOpsFiles = [
  "app/dashboard/ops/layout.tsx",
  "app/dashboard/ops/_components/OpsShellLayout.tsx",
  "app/dashboard/ops/page.tsx",
  "app/dashboard/ops/edu/page.tsx",
  "app/dashboard/ops/edu/OpsWebllmMitigationPanel.tsx",
  "app/dashboard/ops/not-found/page.tsx",
  "app/dashboard/ops/not-found/BrokenLinksTableClient.tsx",
  "app/dashboard/ops/not-found/MatchingPatternsDialog.tsx",
  "app/dashboard/ops/work-queue/workQueueClient.tsx",
  "app/dashboard/ops/homepage-style/HomepageStyleClient.tsx",
] as const;

const opsUsersActiveUiFiles = [
  "app/dashboard/ops/users/page.tsx",
  "app/dashboard/ops/users/ResetUiPrefsButton.tsx",
] as const;

const opsUsersInactiveOrAlternateFiles = [
  "app/dashboard/ops/users/OpsUsersClient.tsx",
  "app/dashboard/ops/users/UsersClient.tsx",
  "app/dashboard/ops/admin/users/page.tsx",
] as const;

const opsContentActiveUiFiles = ["app/dashboard/ops/content/page.tsx"] as const;

const opsContentAdjacentFiles = [
  "app/dashboard/ops/site-content/page.tsx",
  "app/dashboard/ops/site-content/SiteContentOpsClient.tsx",
  "lib/site-content/server.ts",
] as const;

const opsBannersActiveUiFiles = [
  "app/dashboard/ops/banners/OpsBannersClient.tsx",
] as const;

const opsBannersProtectedFiles = [
  "app/dashboard/ops/banners/page.tsx",
  "app/api/v1/ops/banner/route.ts",
  "app/api/v1/ops/banners/route.ts",
  "lib/ops/banners.ts",
  "lib/ops/banners.server.ts",
] as const;

const opsTemplatesActiveUiFiles = [
  "app/dashboard/ops/templates/OpsTemplatesClient.tsx",
] as const;

const opsTemplatesProtectedFiles = [
  "app/dashboard/ops/templates/page.tsx",
  "app/dashboard/templates/actions.ts",
  "app/dashboard/templates/community/actions.ts",
  "app/api/v1/templates/[id]/admin/route.ts",
  "app/api/v1/templates/[id]/copy/route.ts",
  "app/api/v1/templates/[id]/clone/route.ts",
  "app/api/v1/templates/[id]/import/route.ts",
  "app/api/v1/templates/[id]/install/route.ts",
  "app/api/v1/templates/[id]/route.ts",
  "app/api/v1/templates/publish/route.ts",
  "app/api/v1/templates/route.ts",
] as const;

const opsBillingActiveUiFiles = [
  "app/dashboard/ops/billing/OpsBillingClient.tsx",
] as const;

const opsBillingProtectedFiles = [
  "app/dashboard/ops/billing/page.tsx",
  "app/api/v1/ops/billing/requests/route.ts",
  "app/api/v1/ops/billing/requests/[id]/route.ts",
  "app/api/v1/ops/billing/users/[userId]/route.ts",
] as const;

const protectedExactFiles = [
  "app/dashboard/ops/adminActions.ts",
  "app/dashboard/ops/actions.ts",
  "app/dashboard/ops/users/actions.ts",
  "app/dashboard/ops/system-jobs/actions.ts",
  "app/dashboard/ops/trash/actions.ts",
  "app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx",
  "app/s/[code]/_components/StudentBoardMinimal.tsx",
] as const;

const protectedPrefixes = ["app/api/v1/ops/"] as const;

const nonOpsDashboardScopeFiles = [
  "app/dashboard/import/ImportBoardsShell.tsx",
  "app/dashboard/files/FileLibraryClient.tsx",
  "app/dashboard/storage/StorageUsagePageClient.tsx",
  "app/dashboard/billing/BillingPageClient.tsx",
  "app/dashboard/websites/_components/WebsiteStudioShell.tsx",
] as const;

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function changedFiles() {
  const unstaged = execFileSync("git", ["diff", "--name-only"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return Array.from(
    new Set(
      `${unstaged}\n${staged}\n${untracked}`
        .split(/\r?\n/)
        .map((file) => file.trim())
        .filter(Boolean),
    ),
  );
}

test("low-risk dashboard ops surfaces own ops-local interaction hooks", () => {
  const layout = read("app/dashboard/ops/layout.tsx");
  const css = read("app/globals.css");

  assert.match(layout, /data-dashboard-ops-scope/);
  assert.match(css, /\[data-dashboard-ops-scope\] \.dashboard-ops-card/);
  assert.match(css, /dashboard-ops-control:focus-visible/);
  assert.match(css, /dashboard-ops-input:focus-visible/);
  assert.match(css, /dashboard-ops-row:focus-within/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*dashboard-ops-control/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*dashboard-ops-control/);
  assert.match(css, /not\(:disabled\):not\(\[aria-disabled="true"\]\):not\(\[data-disabled="true"\]\):active/);

  for (const relativePath of lowRiskOpsFiles) {
    assert.match(
      read(relativePath),
      /data-dashboard-ops-scope|dashboard-ops-(?:card|row|control|input|text-link)/,
      `${relativePath} should use ops-local polish hooks`,
    );
  }
});

test("dashboard ops scope stays separate from other dashboard and public scopes", () => {
  const css = read("app/globals.css");
  const opsBlock = css.match(/\[data-dashboard-ops-scope\][\s\S]*?(?=\n\[data-dashboard-import-scope\])/)?.[0] ?? "";

  assert.ok(opsBlock.length > 0, "dashboard ops CSS block should exist");
  assert.doesNotMatch(opsBlock, /data-dashboard-(?:shell|board-list|storage|billing|files|websites|import)-scope/);
  assert.doesNotMatch(opsBlock, /dashboard-(?:shell|board-list|storage|billing|files|websites|import)-/);
  assert.doesNotMatch(opsBlock, /data-(?:auth|school|marketing|pricing|contact|templates|legal)-interaction-scope/);
  assert.doesNotMatch(opsBlock, /(^|\s)(button|a|\[role="button"\])\s*[:{,]/);
});

test("dashboard ops polish does not edit protected ops API, action, service-role, or board runtime files", () => {
  const changed = changedFiles();
  const forbidden = changed.filter(
    (file) => protectedPrefixes.some((prefix) => file.startsWith(prefix)) || protectedExactFiles.includes(file as never),
  );

  assert.deepEqual(forbidden, []);

  for (const relativePath of protectedExactFiles) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /data-dashboard-ops-scope|dashboard-ops-(?:card|row|control|input|text-link)/);
  }
});

test("ops users phase 17d source guard keeps polish on active users UI only", () => {
  const layout = read("app/dashboard/ops/layout.tsx");
  const usersPage = read("app/dashboard/ops/users/page.tsx");
  const resetButton = read("app/dashboard/ops/users/ResetUiPrefsButton.tsx");
  const css = read("app/globals.css");

  assert.match(layout, /data-dashboard-ops-scope/);
  assert.match(`${usersPage}\n${resetButton}`, /dashboard-ops-(?:card|row|control|input|text-link)/);
  assert.match(usersPage, /bulkUserBanAction/);
  assert.match(usersPage, /bulkUserUnbanAction/);
  assert.match(usersPage, /선택 사용자 정지/);
  assert.match(usersPage, /선택 사용자 정지 해제/);
  assert.match(resetButton, /previewResetUserUiPrefsByOpsAction/);
  assert.match(resetButton, /executeResetUserUiPrefsByOpsAction/);
  assert.match(resetButton, /preview/);
  assert.match(resetButton, /confirm \+ execute/);

  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-row:focus-within/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-input:focus-visible/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-control:focus-visible/);

  for (const relativePath of opsUsersInactiveOrAlternateFiles) {
    assert.doesNotMatch(
      read(relativePath),
      /dashboard-ops-users-|data-dashboard-ops-users-scope/,
      `${relativePath} should not receive /dashboard/ops/users-only polish hooks`,
    );
  }
});

test("ops users phase 17d does not modify API/action/service-role/destructive logic sources", () => {
  const changed = changedFiles();
  const allowedChanged = new Set<string>([
    ...opsUsersActiveUiFiles,
    "app/globals.css",
    "tests/dashboard-ops-polish.guard.test.ts",
  ]);
  const forbidden = changed.filter(
    (file) =>
      (file.startsWith("app/api/v1/ops/") ||
        protectedExactFiles.includes(file as never) ||
        opsUsersInactiveOrAlternateFiles.includes(file as never)) &&
      !allowedChanged.has(file),
  );

  assert.deepEqual(forbidden, []);

  const usersPage = read("app/dashboard/ops/users/page.tsx");
  assert.match(usersPage, /createSupabaseAdminClient\(\)/);
  assert.match(usersPage, /admin\.auth\.admin\.listUsers\(\{ page: 1, perPage: 200 \}\)/);
  assert.match(usersPage, /from\("user_entitlements"\)\.select\("user_id, billing_status"\)/);
  assert.match(usersPage, /from\("user_ui_prefs"\)\s*\n\s*\.select\("user_id, class_prefs"\)/);
  assert.match(usersPage, /from\("audit_logs"\)\s*\n\s*\.select\("id, actor_user_id, action, request_id, created_at"\)/);

  const adminActions = read("app/dashboard/ops/adminActions.ts");
  const usersActions = read("app/dashboard/ops/users/actions.ts");
  assert.match(adminActions, /bulkUserBanAction/);
  assert.match(adminActions, /bulkUserUnbanAction/);
  assert.match(adminActions, /updateUserById/);
  assert.match(usersActions, /previewResetUserUiPrefsByOpsAction/);
  assert.match(usersActions, /executeResetUserUiPrefsByOpsAction/);
  assert.match(usersActions, /confirmToken/);
  assert.doesNotMatch(`${adminActions}\n${usersActions}`, /dashboard-ops-users-|data-dashboard-ops-users-scope/);
});

test("ops users phase 17d scope stays separate from other dashboard scopes", () => {
  const css = read("app/globals.css");
  const opsBlock = css.match(/\[data-dashboard-ops-scope\][\s\S]*?(?=\n\[data-dashboard-import-scope\])/)?.[0] ?? "";

  assert.ok(opsBlock.length > 0, "dashboard ops CSS block should exist");
  assert.doesNotMatch(opsBlock, /data-dashboard-(?:import|files|websites|storage|billing)-scope/);
  assert.doesNotMatch(opsBlock, /dashboard-(?:import|files|websites|storage|billing)-/);

  for (const relativePath of nonOpsDashboardScopeFiles) {
    assert.doesNotMatch(
      read(relativePath),
      /data-dashboard-ops-scope|dashboard-ops-(?:card|row|control|input|text-link|users-)/,
      `${relativePath} should not mix dashboard ops polish scope`,
    );
  }
});

test("ops content phase 17e source guard keeps polish on active content UI only", () => {
  const layout = read("app/dashboard/ops/layout.tsx");
  const contentPage = read("app/dashboard/ops/content/page.tsx");
  const css = read("app/globals.css");

  assert.match(layout, /data-dashboard-ops-scope/);
  assert.match(contentPage, /dashboard-ops-(?:card|row|control|input|text-link|content-)/);
  assert.match(contentPage, /bulkCardModerationAction/);
  assert.match(contentPage, /formAction=\{bulkCardModerationAction\}/);
  assert.match(contentPage, /name="operation" value="hide"/);
  assert.match(contentPage, /name="operation" value="delete"/);
  assert.match(contentPage, /name="operation" value="restore"/);
  assert.match(contentPage, />숨김</);
  assert.match(contentPage, />삭제</);
  assert.match(contentPage, />복구</);

  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-row:focus-within/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-input:focus-visible/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-control:focus-visible/);
  assert.doesNotMatch(css, /dashboard-ops-site-content-/);
});

test("ops content phase 17e does not modify API/action/service-role/destructive logic sources", () => {
  const changed = changedFiles();
  const allowedChanged = new Set<string>([
    ...opsContentActiveUiFiles,
    "tests/dashboard-ops-polish.guard.test.ts",
  ]);
  const forbidden = changed.filter(
    (file) =>
      (file.startsWith("app/api/v1/ops/") ||
        protectedExactFiles.includes(file as never) ||
        opsContentAdjacentFiles.includes(file as never)) &&
      !allowedChanged.has(file),
  );

  assert.deepEqual(forbidden, []);

  const contentPage = read("app/dashboard/ops/content/page.tsx");
  assert.match(contentPage, /createSupabaseAdminClient\(\)/);
  assert.match(contentPage, /from\("cards"\)\s*\n\s*\.select\("id, wall_id, text, created_at, is_hidden, deleted_at"\)/);
  assert.match(contentPage, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(contentPage, /\.limit\(120\)/);
  assert.match(contentPage, /from\("walls"\)\.select\("id, board_id"\)\.in\("id", wallIds\)/);
  assert.match(contentPage, /query\.eq\("is_hidden", true\)\.is\("deleted_at", null\)/);
  assert.match(contentPage, /query\.not\("deleted_at", "is", null\)/);
  assert.match(contentPage, /query\.eq\("is_hidden", false\)\.is\("deleted_at", null\)/);

  const adminActions = read("app/dashboard/ops/adminActions.ts");
  assert.match(adminActions, /bulkCardModerationAction/);
  assert.match(adminActions, /buildSoftDeletePayload/);
  assert.match(adminActions, /operation === "hide"/);
  assert.match(adminActions, /operation === "delete"/);
  assert.match(adminActions, /operation === "restore"/);
  assert.doesNotMatch(adminActions, /dashboard-ops-content-|data-dashboard-ops-content-scope/);
});

test("ops content phase 17e scope stays separate from site-content and other dashboard scopes", () => {
  const css = read("app/globals.css");
  const opsBlock = css.match(/\[data-dashboard-ops-scope\][\s\S]*?(?=\n\[data-dashboard-import-scope\])/)?.[0] ?? "";

  assert.ok(opsBlock.length > 0, "dashboard ops CSS block should exist");
  assert.doesNotMatch(opsBlock, /data-dashboard-(?:import|files|websites|storage|billing)-scope/);
  assert.doesNotMatch(opsBlock, /dashboard-(?:import|files|websites|storage|billing)-/);

  for (const relativePath of [...opsContentAdjacentFiles, ...nonOpsDashboardScopeFiles]) {
    assert.doesNotMatch(
      read(relativePath),
      /data-dashboard-ops-content-scope|dashboard-ops-content-/,
      `${relativePath} should not mix /dashboard/ops/content-only polish scope`,
    );
  }
});

test("ops banners phase 17f source guard keeps polish on active banners client only", () => {
  const layout = read("app/dashboard/ops/layout.tsx");
  const bannersPage = read("app/dashboard/ops/banners/page.tsx");
  const bannersClient = read("app/dashboard/ops/banners/OpsBannersClient.tsx");
  const css = read("app/globals.css");

  assert.match(layout, /data-dashboard-ops-scope/);
  assert.match(bannersClient, /dashboard-ops-(?:card|row|control|input|text-link|banners-)/);
  assert.doesNotMatch(bannersPage, /dashboard-ops-banners-|data-dashboard-ops-banners-scope/);
  assert.match(bannersClient, /fetch\(routes\.api\.ops\.banners\(\), \{\s*\n\s*method: "PUT"/);
  assert.match(bannersClient, /body: JSON\.stringify\(form\)/);
  assert.match(bannersClient, /normalizeOpsBannerInput\(form\)/);
  assert.doesNotMatch(bannersClient, /formAction=|delete|삭제/);

  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-card:focus-within/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-row:focus-within/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-input:focus-visible/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-control:focus-visible/);
});

test("ops banners phase 17f does not modify API/action/service-role/destructive logic sources", () => {
  const changed = changedFiles();
  const allowedChanged = new Set<string>([
    ...opsBannersActiveUiFiles,
    "tests/dashboard-ops-polish.guard.test.ts",
  ]);
  const forbidden = changed.filter(
    (file) =>
      (file.startsWith("app/api/v1/ops/") ||
        protectedExactFiles.includes(file as never) ||
        opsBannersProtectedFiles.includes(file as never)) &&
      !allowedChanged.has(file),
  );

  assert.deepEqual(forbidden, []);

  const bannersPage = read("app/dashboard/ops/banners/page.tsx");
  assert.match(bannersPage, /requireUser\(routes\.page\.dashboard\.opsBanners\(\)\)/);
  assert.match(bannersPage, /isOpsAdmin\(user\.email\)/);
  assert.match(bannersPage, /createSupabaseAdminClient\(\)/);
  assert.match(
    bannersPage,
    /from\("ops_banners" as never\)\s*\n\s*\.select\("message, href, label, level, enabled, starts_at, ends_at" as never\)/,
  );
  assert.match(bannersPage, /\.order\("updated_at", \{ ascending: false \}\)/);
  assert.match(bannersPage, /\.limit\(1\)/);
  assert.match(bannersPage, /\.maybeSingle\(\)/);

  const bannersApi = read("app/api/v1/ops/banners/route.ts");
  const activeBannerApi = read("app/api/v1/ops/banner/route.ts");
  const bannerLogic = read("lib/ops/banners.ts");
  const bannerServer = read("lib/ops/banners.server.ts");
  assert.match(bannersApi, /normalizeOpsBannerInput/);
  assert.match(bannersApi, /from\("ops_banners" as never\)/);
  assert.match(activeBannerApi, /getActiveBanner/);
  assert.match(bannerServer, /createSupabaseAdminClient/);
  assert.match(bannerServer, /from\("ops_banners" as never\)/);
  assert.doesNotMatch(`${bannersApi}\n${activeBannerApi}\n${bannerLogic}\n${bannerServer}`, /dashboard-ops-banners-|data-dashboard-ops-banners-scope/);
});

test("ops banners phase 17f scope stays separate from other dashboard scopes", () => {
  const css = read("app/globals.css");
  const opsBlock = css.match(/\[data-dashboard-ops-scope\][\s\S]*?(?=\n\[data-dashboard-import-scope\])/)?.[0] ?? "";

  assert.ok(opsBlock.length > 0, "dashboard ops CSS block should exist");
  assert.doesNotMatch(opsBlock, /data-dashboard-(?:import|files|websites|storage|billing)-scope/);
  assert.doesNotMatch(opsBlock, /dashboard-(?:import|files|websites|storage|billing)-/);

  for (const relativePath of nonOpsDashboardScopeFiles) {
    assert.doesNotMatch(
      read(relativePath),
      /data-dashboard-ops-banners-scope|dashboard-ops-banners-/,
      `${relativePath} should not mix /dashboard/ops/banners-only polish scope`,
    );
  }
});

test("ops templates phase 17g source guard keeps polish on active templates client only", () => {
  const layout = read("app/dashboard/ops/layout.tsx");
  const templatesPage = read("app/dashboard/ops/templates/page.tsx");
  const templatesClient = read("app/dashboard/ops/templates/OpsTemplatesClient.tsx");
  const css = read("app/globals.css");

  assert.match(layout, /data-dashboard-ops-scope/);
  assert.match(templatesClient, /dashboard-ops-(?:card|row|control|input|text-link|templates-)/);
  assert.doesNotMatch(templatesPage, /dashboard-ops-templates-|data-dashboard-ops-templates-scope/);
  assert.match(templatesClient, /const handleSave = async \(template: OpsTemplate, next: Partial<OpsTemplate>\)/);
  assert.match(templatesClient, /fetch\(apiV1Path\(`templates\/\$\{template\.id\}\/admin`\), \{\s*\n\s*method: "PATCH"/);
  assert.match(templatesClient, /visibility: next\.visibility \?\? template\.visibility/);
  assert.match(templatesClient, /pro_only: next\.proOnly \?\? template\.proOnly/);
  assert.match(templatesClient, /picks_rank: next\.picksRank \?\? template\.picksRank/);
  assert.doesNotMatch(templatesClient, /formAction=|method: "DELETE"|deleteTemplate|duplicateTemplate|clone|copy|install|publish/);

  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-card:focus-within/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-row:focus-within/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-input:focus-visible/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-control:focus-visible/);
});

test("ops templates phase 17g does not modify API/action/service-role/save/destructive sources", () => {
  const changed = changedFiles();
  const allowedChanged = new Set<string>([
    ...opsTemplatesActiveUiFiles,
    "tests/dashboard-ops-polish.guard.test.ts",
  ]);
  const forbidden = changed.filter(
    (file) =>
      (file.startsWith("app/api/v1/ops/") ||
        file.startsWith("app/api/v1/templates/") ||
        protectedExactFiles.includes(file as never) ||
        opsTemplatesProtectedFiles.includes(file as never)) &&
      !allowedChanged.has(file),
  );

  assert.deepEqual(forbidden, []);

  const templatesPage = read("app/dashboard/ops/templates/page.tsx");
  assert.match(templatesPage, /requireUser\("\/dashboard\/ops\/templates"\)/);
  assert.match(templatesPage, /isOpsAdmin\(user\.email\)/);
  assert.match(templatesPage, /createSupabaseAdminClient\(\)/);
  assert.match(
    templatesPage,
    /from\("templates"\)\s*\n\s*\.select\("template_id, title, visibility, pro_only, picks_rank, stats, moderation"\)/,
  );
  assert.match(templatesPage, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(templatesPage, /\.limit\(100\)/);

  const templatesAdminApi = read("app/api/v1/templates/[id]/admin/route.ts");
  const dashboardTemplateActions = read("app/dashboard/templates/actions.ts");
  const communityTemplateActions = read("app/dashboard/templates/community/actions.ts");
  assert.match(templatesAdminApi, /requireUserApi/);
  assert.match(templatesAdminApi, /isOpsOwner/);
  assert.match(templatesAdminApi, /\.update\(payload\)/);
  assert.doesNotMatch(
    `${templatesAdminApi}\n${dashboardTemplateActions}\n${communityTemplateActions}`,
    /dashboard-ops-templates-|data-dashboard-ops-templates-scope/,
  );
});

test("ops templates phase 17g scope stays separate from other dashboard scopes", () => {
  const css = read("app/globals.css");
  const opsBlock = css.match(/\[data-dashboard-ops-scope\][\s\S]*?(?=\n\[data-dashboard-import-scope\])/)?.[0] ?? "";

  assert.ok(opsBlock.length > 0, "dashboard ops CSS block should exist");
  assert.doesNotMatch(opsBlock, /data-dashboard-(?:import|files|websites|storage|billing)-scope/);
  assert.doesNotMatch(opsBlock, /dashboard-(?:import|files|websites|storage|billing)-/);

  for (const relativePath of nonOpsDashboardScopeFiles) {
    assert.doesNotMatch(
      read(relativePath),
      /data-dashboard-ops-templates-scope|dashboard-ops-templates-/,
      `${relativePath} should not mix /dashboard/ops/templates-only polish scope`,
    );
  }
});

test("ops billing phase 17h source guard keeps polish on active billing client only", () => {
  const layout = read("app/dashboard/ops/layout.tsx");
  const billingPage = read("app/dashboard/ops/billing/page.tsx");
  const billingClient = read("app/dashboard/ops/billing/OpsBillingClient.tsx");
  const css = read("app/globals.css");

  assert.match(layout, /data-dashboard-ops-scope/);
  assert.match(billingClient, /dashboard-ops-(?:card|row|control|input|text-link|billing-)/);
  assert.doesNotMatch(billingPage, /dashboard-ops-billing-|data-dashboard-ops-billing-scope/);
  assert.match(billingClient, /const updateStatus = async \(id: string, status: string\)/);
  assert.match(billingClient, /apiFetch\(apiV1Path\(`ops\/billing\/requests\/\$\{id\}`\), \{\s*\n\s*method: "PATCH"/);
  assert.match(billingClient, /body: JSON\.stringify\(\{ status \}\)/);
  assert.match(billingClient, /const fetchPlan = async \(\)/);
  assert.match(billingClient, /apiFetch\(apiV1Path\(`ops\/billing\/users\/\$\{planForm\.userId\}`\)\)/);
  assert.match(billingClient, /const savePlan = async \(\)/);
  assert.match(billingClient, /body: JSON\.stringify\(\{\s*\n\s*plan: planForm\.plan/);
  assert.doesNotMatch(billingClient, /formAction=|method: "DELETE"|coupon|redeem|issue|institutionBilling/);

  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-card:focus-within/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-row:focus-within/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-input:focus-visible/);
  assert.match(css, /\[data-dashboard-ops-scope\][\s\S]*dashboard-ops-control:focus-visible/);
});

test("ops billing phase 17h does not modify API/action/service-role/payment/destructive sources", () => {
  const changed = changedFiles();
  const allowedChanged = new Set<string>([
    ...opsBillingActiveUiFiles,
    "tests/dashboard-ops-polish.guard.test.ts",
  ]);
  const forbidden = changed.filter(
    (file) =>
      (file.startsWith("app/api/v1/ops/") ||
        protectedExactFiles.includes(file as never) ||
        opsBillingProtectedFiles.includes(file as never)) &&
      !allowedChanged.has(file),
  );

  assert.deepEqual(forbidden, []);

  const billingPage = read("app/dashboard/ops/billing/page.tsx");
  assert.match(billingPage, /requireUser\("\/dashboard\/ops\/billing"\)/);
  assert.match(billingPage, /isOpsAdmin\(user\.email\)/);
  assert.match(billingPage, /createSupabaseAdminClient\(\)/);
  assert.match(
    billingPage,
    /from\("upgrade_requests"\)\s*\n\s*\.select\("request_id, created_at, user_id, org_name, contact_email, seats, message, status, meta"\)/,
  );
  assert.match(billingPage, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(billingPage, /\.limit\(200\)/);

  const billingRequestApi = read("app/api/v1/ops/billing/requests/[id]/route.ts");
  const billingUsersApi = read("app/api/v1/ops/billing/users/[userId]/route.ts");
  const billingRequestsReadApi = read("app/api/v1/ops/billing/requests/route.ts");
  assert.match(billingRequestApi, /requireUserApi/);
  assert.match(billingRequestApi, /isOpsAdmin/);
  assert.match(billingRequestApi, /status/);
  assert.match(billingRequestApi, /\.update\(\{ status: status as "new" \| "contacted" \| "approved" \| "rejected" \}\)/);
  assert.match(billingUsersApi, /requireUserApi/);
  assert.match(billingUsersApi, /isOpsAdmin/);
  assert.match(billingUsersApi, /plan/);
  assert.match(billingUsersApi, /\.upsert/);
  assert.match(billingRequestsReadApi, /withOps/);
  assert.doesNotMatch(
    `${billingRequestApi}\n${billingUsersApi}\n${billingRequestsReadApi}`,
    /dashboard-ops-billing-|data-dashboard-ops-billing-scope|dashboard-billing-scope/,
  );
});

test("ops billing phase 17h scope stays separate from public dashboard billing scopes", () => {
  const css = read("app/globals.css");
  const opsBlock = css.match(/\[data-dashboard-ops-scope\][\s\S]*?(?=\n\[data-dashboard-import-scope\])/)?.[0] ?? "";

  assert.ok(opsBlock.length > 0, "dashboard ops CSS block should exist");
  assert.doesNotMatch(opsBlock, /data-dashboard-(?:import|files|websites|storage|billing)-scope/);
  assert.doesNotMatch(opsBlock, /dashboard-(?:import|files|websites|storage|billing)-/);

  for (const relativePath of nonOpsDashboardScopeFiles) {
    assert.doesNotMatch(
      read(relativePath),
      /data-dashboard-ops-billing-scope|dashboard-ops-billing-/,
      `${relativePath} should not mix /dashboard/ops/billing-only polish scope`,
    );
  }
});

test("low-risk ops long text surfaces include overflow defenses", () => {
  const notFound = read("app/dashboard/ops/not-found/page.tsx");
  const brokenLinks = read("app/dashboard/ops/not-found/BrokenLinksTableClient.tsx");
  const edu = read("app/dashboard/ops/edu/page.tsx");
  const homepage = read("app/dashboard/ops/homepage-style/HomepageStyleClient.tsx");
  const workQueue = read("app/dashboard/ops/work-queue/workQueueClient.tsx");

  assert.match(notFound, /break-all/);
  assert.match(brokenLinks, /break-all/);
  assert.match(edu, /truncate|break-words|break-all/);
  assert.match(homepage, /minmax\(0,2fr\)|break-all|break-words/);
  assert.match(workQueue, /whitespace-pre-wrap break-words/);
});
