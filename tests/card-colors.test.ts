import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { CARD_COLOR_TOKENS, isCardColorToken } from "@/lib/types/cards";
import {
  CARD_COLOR_OPTIONS,
  getCardColorClass,
  getCardColorToneClasses,
} from "@/lib/ui/cardColors";

const root = process.cwd();

test("getCardColorClass falls back to default for null/undefined", () => {
  assert.equal(getCardColorClass(undefined), "bg-white border-slate-200");
  assert.equal(getCardColorClass(null), "bg-white border-slate-200");
});

test("getCardColorClass resolves known tokens", () => {
  assert.match(getCardColorClass("green"), /bg-emerald-50/);
  assert.match(getCardColorClass("purple"), /bg-violet-50/);
  assert.match(getCardColorClass("sky"), /bg-sky-50/);
  assert.match(getCardColorClass("orange"), /bg-orange-50/);
});

test("getCardColorToneClasses returns tone bg and border classes", () => {
  const pink = getCardColorToneClasses("pink");

  assert.match(pink, /bg-pink-50/);
  assert.match(pink, /border-pink-300/);
  assert.doesNotMatch(pink, /bg-white border-slate-200/);
});

test("card color tokens are constrained to the supported tone list", () => {
  assert.deepEqual(CARD_COLOR_TOKENS, [
    "default",
    "gray",
    "yellow",
    "pink",
    "green",
    "purple",
    "sky",
    "orange",
  ]);
  assert.deepEqual(
    CARD_COLOR_OPTIONS.map((option) => option.token),
    CARD_COLOR_TOKENS,
  );
  assert.equal(isCardColorToken("#ff00aa"), false);
  assert.equal(isCardColorToken("bg-red-500"), false);
  assert.equal(isCardColorToken("mint"), false);
  assert.equal(isCardColorToken("violet"), false);
});

test("teacher and student card renderers apply card color classes", () => {
  const teacher = fs.readFileSync(
    path.join(root, "app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx"),
    "utf8",
  );
  const studentBoard = fs.readFileSync(
    path.join(root, "components", "student", "board", "StudentBoardCard.tsx"),
    "utf8",
  );
  const studentTile = fs.readFileSync(
    path.join(root, "components", "student", "BoardCardTile.tsx"),
    "utf8",
  );
  const normalizer = fs.readFileSync(path.join(root, "lib", "student", "normalizeStudentItems.ts"), "utf8");
  const globalStyles = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");

  assert.match(teacher, /getCardColorToneClasses\(token\)/);
  assert.match(teacher, /setBoardWalls\(\(currentWalls\)/);
  assert.match(teacher, /setBoardWalls\(previousWalls\)/);
  assert.match(teacher, /data-card-color-tone=\{cardColorTone\(card\.card_color_token\)\}/);
  assert.match(studentBoard, /data-card-color-tone=\{cardColorTone\}/);
  assert.match(studentTile, /data-card-color-tone=\{cardColorTone\}/);
  assert.match(studentBoard, /cardColorTone === "default"[\s\S]{0,120}bg-white\/95/);
  assert.match(studentTile, /cardColorTone === "default"[\s\S]{0,120}theme-card-panel/);
  assert.match(globalStyles, /\.theme-card-panel[\s\S]{0,240}background: var\(--theme-card\)/);
  assert.doesNotMatch(studentBoard, /getCardColorToneClasses\(cardColorTone\)[\s\S]{0,120}bg-white\/95/);
  assert.doesNotMatch(studentTile, /getCardColorToneClasses\(cardColorTone\)[\s\S]{0,120}theme-card-panel/);
  assert.match(normalizer, /cardColorToken: card\.cardColorToken/);
});
