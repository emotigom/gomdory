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
    path.join(
      root,
      "app",
      "dashboard",
      "boards",
      "[boardId]",
      "board",
      "TeacherBoardCanonicalClient.tsx",
    ),
    "utf8",
  );

  const studentTile = fs.readFileSync(
    path.join(root, "app", "_components", "CardTile.tsx"),
    "utf8",
  );

  const wallColumn = fs.readFileSync(
    path.join(root, "app", "_components", "WallColumn.tsx"),
    "utf8",
  );

  const uiTokens = fs.readFileSync(
    path.join(root, "app", "_components", "uiTokens.ts"),
    "utf8",
  );

  assert.match(teacher, /getCardColorToneClasses\(token\)/);
  assert.match(teacher, /setBoardWalls\(\(currentWalls\)/);
  assert.match(teacher, /setBoardWalls\(previousWalls\)/);
  assert.match(
    teacher,
    /data-card-color-tone=\{cardColorTone\(card\.card_color_token\)\}/,
  );

  assert.match(
    studentTile,
    /const cardColorTone = normalizeCardColorTone\(colorTone\);/,
  );
  assert.match(
    studentTile,
    /getCardColorToneClasses\(cardColorTone\)/,
  );
  assert.match(
    studentTile,
    /data-card-color-tone=\{cardColorTone\}/,
  );
  assert.match(
    studentTile,
    /: surface\.card/,
  );

  assert.match(
    wallColumn,
    /colorTone=\{card\.card_color_token\}/,
  );
  assert.match(
    wallColumn,
    /normalizeCardColorTone\(card\.card_color_token\)/,
  );

  assert.match(
    uiTokens,
    /card:\s*cn\([\s\S]*?bg-\[var\(--theme-card\)\]/,
  );
});
