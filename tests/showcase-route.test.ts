import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("student show route includes page marker and join block copy", () => {
  const shellPath = path.join(process.cwd(), "app", "s", "[code]", "_legacy", "SharedBoardShell.tsx");
  const topBarPath = path.join(process.cwd(), "components", "student", "show", "ShowcaseTopBar.tsx");
  const showPagePath = path.join(process.cwd(), "app", "s", "[code]", "show", "page.tsx");

  const shellContent = fs.readFileSync(shellPath, "utf8");
  const topBarContent = fs.readFileSync(topBarPath, "utf8");
  const showPageContent = fs.readFileSync(showPagePath, "utf8");

  assert.ok(shellContent.includes("student-show"));
  assert.ok(topBarContent.includes("gkrry.com"));
  assert.ok(showPageContent.includes("redirect(`/s/${code}`)"));
});
