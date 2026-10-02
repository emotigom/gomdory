import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("card attachments render image tile, file chip, and url link without summary fallback", () => {
  const source = read("app", "_components", "CardAttachments.tsx");
  assert.match(source, /className="group relative block aspect-\[4\/3\]/);
  assert.match(source, /resolveFileChipIcon/);
  assert.match(source, /formatCardUrlLabel/);
  assert.doesNotMatch(source, /첨부\s*\{attachments\.length\}/);
});

test("card attachment clicks stop propagation to card drag/select handlers", () => {
  const source = read("app", "_components", "CardAttachments.tsx");
  assert.match(source, /function stopClick\(event: MouseEvent<HTMLElement>, enabled: boolean\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
});

test("teacher board keeps file-drop overlay and wheel routing helpers scoped", () => {
  const source = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");
  assert.match(source, /data-board-runtime="teacher-board-canonical"/);
  assert.doesNotMatch(source, /document\.addEventListener\("wheel"/);
  assert.doesNotMatch(source, /window\.addEventListener\("wheel"/);
  assert.doesNotMatch(source, /preventDefault\(\)[\s\S]{0,120}wheel/i);
});

test("class route redirects to canonical /board route", () => {
  const source = read("app", "dashboard", "boards", "[boardId]", "class", "page.tsx");
  assert.match(source, /redirect\(`\/dashboard\/boards\/\$\{boardId\}\/board`\)/);
});

test("canonical teacher board keeps only a single stable smoke marker", () => {
  const boardSource = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");
  assert.match(boardSource, /data-board-runtime="teacher-board-canonical"/);
  assert.doesNotMatch(boardSource, /Runtime:\s*TeacherBoardMinimalClient/);
  assert.doesNotMatch(boardSource, /data-runtime-owner=/);
});

test("canonical teacher board explains empty sections without adding new handlers", () => {
  const boardSource = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");
  assert.match(boardSource, /boardWalls\.length === 0/);
  assert.match(boardSource, /아직 섹션이 없습니다/);
  assert.match(boardSource, /수업을 시작하기 전에 첫 섹션을 만들어 주세요/);
  assert.match(boardSource, /오늘의 질문, 사진 올리기, 교안 자료, 모둠별 정리/);
  assert.match(boardSource, /첫 섹션 만들기/);
  assert.match(boardSource, /onClick=\{\(\) => setAddingSection\(true\)\}/);
});

test("drag sensor config remains distance-based for mouse and delay-based for touch", () => {
  const source = read("lib", "board", "dragSensors.ts");
  assert.match(source, /distance:\s*4/);
  assert.doesNotMatch(source, /delay:\s*\d+[^\n]*mouse/i);
  assert.match(source, /delay:\s*320/);
  assert.match(source, /tolerance:\s*10/);
});


test("canonical teacher board keeps native scroll layout primitives", () => {
  const boardSource = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");
  assert.match(boardSource, /overflow-x-auto overflow-y-hidden/);
  assert.match(boardSource, /min-h-0 min-w-0/);
  assert.match(boardSource, /overflow-x-auto/);
  assert.match(boardSource, /overflow-y-hidden/);
  assert.match(boardSource, /flex-1 min-h-0 min-w-0/);
});

test("canonical teacher board columns avoid viewport-height stretch and clipped first column", () => {
  const boardSource = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");
  assert.match(boardSource, /data-board-scroll="horizontal"/);
  assert.match(boardSource, /overflow-x-auto overflow-y-hidden pl-1 pr-0 scroll-pl-1/);
  assert.match(boardSource, /styles\.wallTrack\} flex min-h-0 min-w-full w-max items-start gap-3 pb-2/);
  assert.match(boardSource, /min-h-\[18rem\] max-h-\[calc\(100vh-14rem\)\]/);
  assert.doesNotMatch(boardSource, /className="flex h-full min-h-0 min-w-full w-max gap-3 pb-2"/);
  assert.doesNotMatch(boardSource, /flex h-full min-h-0 w-\[clamp\(320px,28vw,420px\)\]/);
});

test("canonical teacher board wallpaper is not tiled and column outline uses theme token once", () => {
  const pageSource = read("app", "dashboard", "boards", "[boardId]", "board", "page.tsx");
  const boardSource = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");

  assert.match(pageSource, /background-repeat: no-repeat;/);
  assert.match(pageSource, /background-size: cover;/);
  assert.match(boardSource, /hud-section-shell hud-content-fill/);
  assert.doesNotMatch(boardSource, /hud-section-shell hud-content-fill[\s\S]{0,160}ring-1 ring-\[var\(--theme-border\)\]\/60/);
});

test("teacher board move controls keep visible labels and disabled hints", () => {
  const boardSource = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");
  assert.match(boardSource, /aria-label="섹션 위치 이동"/);
  assert.match(boardSource, /aria-label="카드 위치 이동"/);
  assert.match(boardSource, /aria-label="섹션 왼쪽으로 이동"/);
  assert.match(boardSource, /title=\{boardWalls\[0\]\?\.wall\.id === wall\.id \? "이미 첫 번째 섹션입니다" : "섹션을 왼쪽으로 이동"\}/);
  assert.match(boardSource, /aria-label="섹션 오른쪽으로 이동"/);
  assert.match(boardSource, /title=\{boardWalls\[boardWalls\.length - 1\]\?\.wall\.id === wall\.id \? "이미 마지막 섹션입니다" : "섹션을 오른쪽으로 이동"\}/);
  assert.match(boardSource, /aria-label="카드 위로 이동"/);
  assert.match(boardSource, /title=\{cardIndex === 0 \? "이미 첫 번째 카드입니다" : "카드를 위로 이동"\}/);
  assert.match(boardSource, /aria-label="카드 아래로 이동"/);
  assert.match(boardSource, /title=\{cardIndex === cards\.length - 1 \? "이미 마지막 카드입니다" : "카드를 아래로 이동"\}/);
});
