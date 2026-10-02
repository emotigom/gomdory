import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const readFile = (relPath: string) => fs.readFileSync(path.join(process.cwd(), relPath), "utf8");



const assertResolvedBoardScrollerFallback = () => {
  const source = readFile("lib/board/wheelRouting.ts");

  assert.match(
    source,
    /export const resolveBoardScroller = \(boardMainEl: HTMLElement\): HTMLElement => \{/,
    "wheelRouting must export resolveBoardScroller(boardMainEl) for real overflow scroller resolution.",
  );
  assert.match(
    source,
    /const boardEl = resolveBoardScroller\(boardMainEl\);/,
    "wheel fallbacks must resolve board-main to the real overflow scroller before applying scroll deltas.",
  );
};

const assertBoardFallbackWiring = (relPath: string) => {
  const source = readFile(relPath);

  assert.match(
    source,
    /handleBoardBackgroundWheelFallback\(board,\s*event\)/,
    `${relPath} must call handleBoardBackgroundWheelFallback(board, event).`,
  );
  assert.match(
    source,
    /addEventListener\("wheel",\s*handleBoardWheelCapture,\s*\{\s*capture:\s*true,\s*passive:\s*false\s*\}\)/,
    `${relPath} must install wheel capture listener with passive:false.`,
  );
  assert.match(
    source,
    /removeEventListener\("wheel",\s*handleBoardWheelCapture,\s*\{\s*capture:\s*true\s*\}\)/,
    `${relPath} must remove wheel capture listener cleanup.`,
  );
  assert.match(
    source,
    /document\.addEventListener\("wheel",\s*handleDocumentWheelCapture,\s*\{\s*capture:\s*true,\s*passive:\s*false\s*\}\)/,
    `${relPath} must install document wheel capture listener with passive:false for overlay bypass fallback.`,
  );
  assert.match(
    source,
    /document\.removeEventListener\("wheel",\s*handleDocumentWheelCapture,\s*\{\s*capture:\s*true\s*\}\)/,
    `${relPath} must remove document wheel capture listener cleanup.`,
  );
};

test("guard: teacher/student board must wire board background wheel fallback", () => {
  assertBoardFallbackWiring("app/dashboard/boards/[boardId]/board/TeacherBoardMinimalClient.tsx");
  assertBoardFallbackWiring("app/s/[code]/_components/StudentBoardMinimal.tsx");
  assertResolvedBoardScrollerFallback();
});
