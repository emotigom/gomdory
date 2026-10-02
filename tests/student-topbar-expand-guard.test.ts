import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const boardSource = fs.readFileSync(path.join(process.cwd(), "app", "s", "[code]", "_components", "StudentBoardMinimal.tsx"), "utf8");
const barSource = fs.readFileSync(path.join(process.cwd(), "app", "_components", "HoverExpandBar.tsx"), "utf8");

test("student topbar wiring keeps ids and non-blocking portal hit testing", () => {
  assert.match(boardSource, /rootTestId="student-topbar-root"/);
  assert.match(boardSource, /toggleTestId="student-topbar-toggle"/);
  assert.match(boardSource, /expandedTestId="student-topbar-expanded"/);
  assert.match(boardSource, /panelContainerClassName="pointer-events-none"/);
  const outerPointerNoneIndex = barSource.indexOf(
    '"pointer-events-none fixed z-[1100]',
  );
  const innerPointerAutoIndex = barSource.indexOf(
    '"pointer-events-auto flex h-auto w-full',
  );
  assert.ok(outerPointerNoneIndex >= 0);
  assert.ok(innerPointerAutoIndex > outerPointerNoneIndex);
  assert.match(barSource, /"pointer-events-none fixed z-\[1100\][^"]*"/);
  assert.match(barSource, /"pointer-events-auto flex h-auto w-full[^"]*"/);
  const expandedContentIndex = boardSource.indexOf("expandedContent={");
  const boardOuterPointerNoneIndex = boardSource.indexOf(
    'className="pointer-events-none flex w-full justify-center',
    expandedContentIndex,
  );
  const workbenchMarkerIndex = boardSource.indexOf(
    'data-student-topbar-workbench="true"',
    boardOuterPointerNoneIndex,
  );
  const boardInnerPointerAutoIndex = boardSource.indexOf(
    'className="pointer-events-auto flex w-fit',
    workbenchMarkerIndex,
  );
  assert.ok(expandedContentIndex >= 0);
  assert.ok(boardOuterPointerNoneIndex > expandedContentIndex);
  assert.ok(workbenchMarkerIndex > boardOuterPointerNoneIndex);
  assert.ok(boardInnerPointerAutoIndex > workbenchMarkerIndex);
});

test("hover bar supports click toggle, escape/outside close, and delayed close", () => {
  assert.match(barSource, /setOpenMode\(\(prev\) => \(prev === "closed" \? "pinned" : "closed"\)\)/);
  assert.match(barSource, /event\.key === "Escape"/);
  assert.match(barSource, /document\.addEventListener\("pointerdown"/);
  assert.match(barSource, /setTimeout\(\(\) => \{/);
  assert.match(barSource, /, 220\)/);
  assert.match(barSource, /createPortal\(/);
  assert.match(barSource, /fixed z-\[1100\]/);
});


test("panel controls remain interactive and theme storage stays share-scoped", () => {
  assert.match(boardSource, /aria-label="보기 테마 선택"/);
  assert.match(
    boardSource,
    /expandedContent=\{[\s\S]*?pointer-events-auto flex w-fit[\s\S]*?aria-label="보기 테마 선택"/,
  );
  assert.match(boardSource, /gomdory:guest-view-theme:\$\{shareCode\}/);
});


test("student topbar theme selector includes high-contrast option", () => {
  assert.match(boardSource, /<option value=\"high-contrast\">고대비/);
});
