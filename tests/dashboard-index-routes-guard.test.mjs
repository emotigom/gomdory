import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard boards index remains a thin alias to the board-list SSOT", () => {
  const source = read("app", "dashboard", "boards", "page.tsx");

  assert.match(source, /redirect\(routes\.page\.dashboard\.root\(\)\)/);
  assert.doesNotMatch(source, /requireUser|listBoardsForUser|DashboardBoardList/);
});

test("dashboard classes index follows the authenticated class data contract", () => {
  const source = read("app", "dashboard", "classes", "page.tsx");
  const requireIndex = source.indexOf("await requireUser(routes.page.dashboard.classes())");
  const listIndex = source.indexOf("await listClasses()");

  assert.ok(requireIndex >= 0, "classes index must require the signed-in user");
  assert.ok(listIndex > requireIndex, "class data must load after the auth redirect contract");
  assert.match(source, /data-dashboard-workshop-version="2"/);
  assert.match(source, /routes\.page\.dashboard\.classDetail\(classItem\.id\)/);
  assert.doesNotMatch(source, /DashboardPurposeHeader|backdrop-blur|bg-gradient/);
});

test("class creation keeps the existing API and opens the created class", () => {
  const source = read("app", "dashboard", "classes", "_components", "DashboardClassCreateForm.tsx");

  assert.match(source, /fetch\(apiV1Path\("classes"\)/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /router\.push\(routes\.page\.dashboard\.classDetail\(payload\.class\.id\)\)/);
  assert.match(source, /role="alert"/);
  assert.match(source, /data-dashboard-class-form/);
});
