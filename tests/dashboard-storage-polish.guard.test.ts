import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard storage page owns a dedicated interaction scope", () => {
  const page = read("app", "dashboard", "storage", "page.tsx");
  const client = read("app", "dashboard", "storage", "StorageUsagePageClient.tsx");
  const coupon = read("app", "dashboard", "storage", "CouponRedeemPanel.tsx");
  const css = read("app", "globals.css");

  assert.match(page, /data-page-marker="dashboard-storage"/);
  assert.match(client, /data-dashboard-storage-scope/);
  assert.match(client, /dashboard-storage-card/);
  assert.match(client, /dashboard-storage-row/);
  assert.match(client, /dashboard-storage-control/);
  assert.match(client, /dashboard-storage-empty-state/);
  assert.match(coupon, /dashboard-storage-input/);
  assert.match(coupon, /dashboard-storage-control/);

  assert.match(css, /\[data-dashboard-storage-scope\] \.dashboard-storage-card/);
  assert.match(css, /dashboard-storage-control:focus-visible/);
  assert.match(css, /dashboard-storage-input:focus-visible/);
  assert.match(css, /dashboard-storage-row:focus-within/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*dashboard-storage-control/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*dashboard-storage-control/);
  assert.match(css, /not\(:disabled\):not\(\[aria-disabled="true"\]\):not\(\[data-disabled="true"\]\):active/);
});

test("dashboard storage polish keeps action labels and link text visible", () => {
  const client = read("app", "dashboard", "storage", "StorageUsagePageClient.tsx");
  const coupon = read("app", "dashboard", "storage", "CouponRedeemPanel.tsx");
  const detail = read("app", "dashboard", "storage", "StorageUsageDetailClient.tsx");

  assert.match(client, /새로고침/);
  assert.match(client, /새 보드 만들기/);
  assert.match(client, /Pro 안내/);
  assert.match(client, /파일 관리/);
  assert.match(client, /보드 열기/);
  assert.match(coupon, /쿠폰 코드를 입력하세요/);
  assert.match(coupon, /loading \? "적용 중\.\.\." : "적용"/);

  assert.match(detail, /링크 복사/);
  assert.match(detail, /삭제/);
  assert.match(detail, /저장/);
  assert.match(detail, /더 불러오기/);
});

test("dashboard storage scope stays separate from shell, board-list, public scopes, and protected runtime", () => {
  const css = read("app", "globals.css");
  const storageBlock = css.match(/\[data-dashboard-storage-scope\][\s\S]*?(?=\nhtml\[data-theme="hud"\] \.hud-top-chrome::before)/)?.[0] ?? "";
  const client = read("app", "dashboard", "storage", "StorageUsagePageClient.tsx");
  const coupon = read("app", "dashboard", "storage", "CouponRedeemPanel.tsx");

  assert.ok(storageBlock.length > 0, "dashboard storage CSS block should exist");
  assert.doesNotMatch(storageBlock, /data-dashboard-shell-scope|dashboard-shell-/);
  assert.doesNotMatch(storageBlock, /data-dashboard-board-list-scope|dashboard-board-list-/);
  assert.doesNotMatch(storageBlock, /data-(?:auth|school|marketing|pricing|contact|templates|legal)-interaction-scope/);
  assert.doesNotMatch(storageBlock, /(^|\s)(button|a|\[role="button"\])\s*[:{,]/);

  const storageSources = `${client}\n${coupon}`;
  assert.doesNotMatch(storageSources, /TeacherBoardCanonicalClient|StudentBoardMinimal/);
  assert.doesNotMatch(storageSources, /files\/\$\{fileId\}\/delete|files\/\$\{fileId\}\/view|files\?\$\{params\.toString\(\)\}/);
});

test("dashboard storage polish does not touch API, upload/delete, or protected board files", () => {
  const protectedFiles = [
    "app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx",
    "app/s/[code]/_components/StudentBoardMinimal.tsx",
    "app/api/v1/storage/summary/route.ts",
    "app/api/v1/storage/quota/route.ts",
    "app/api/v1/storage/usage/route.ts",
    "app/api/v1/storage/refresh/route.ts",
    "app/api/v1/storage/savings/route.ts",
    "app/api/v1/files/route.ts",
  ];

  for (const file of protectedFiles) {
    const source = read(...file.split(path.sep));
    assert.doesNotMatch(source, /data-dashboard-storage-scope|dashboard-storage-control|dashboard-storage-card/);
  }
});
