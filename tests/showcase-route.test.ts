import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("student show route redirects to the canonical student board route", () => {
  const showPagePath = path.join(
    process.cwd(),
    "app",
    "s",
    "[code]",
    "show",
    "page.tsx",
  );

  const showPageContent = fs.readFileSync(showPagePath, "utf8");

  assert.match(showPageContent, /from "next\/navigation"/);
  assert.match(showPageContent, /redirect\(`\/s\/\$\{code\}`\)/);
  assert.doesNotMatch(
    showPageContent,
    /SharedBoardShell|ShowcaseTopBar|components\/student|_legacy/,
  );
});
