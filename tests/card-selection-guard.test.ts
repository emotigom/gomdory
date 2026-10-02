import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("CardTile keeps text selectable for card body content", () => {
  const content = read("app", "_components", "CardTile.tsx");
  assert.match(content, /card body content must remain text-selectable/i);
  assert.match(content, /select-text/);
  assert.doesNotMatch(content, /card-tile[^\n]*select-none/);
});

test("WallColumn keeps fade affordance as shadow instead of absolute overlay", () => {
  const content = read("app", "_components", "WallColumn.tsx");
  assert.match(content, /use inset shadow hints instead of absolute overlays/i);
  assert.match(content, /style=\{scrollEdgeShadow \? \{ boxShadow: scrollEdgeShadow \} : undefined\}/);
  assert.doesNotMatch(content, /absolute[^\n]*bg-gradient-to-b from-white\/80 via-white\/50 to-transparent/);
  assert.doesNotMatch(content, /absolute[^\n]*bg-gradient-to-t from-white\/80 via-white\/50 to-transparent/);
});

test("WallColumn guards card click while selecting text", () => {
  const content = read("app", "_components", "WallColumn.tsx");
  assert.match(content, /card click should not fire while users are dragging to select\/copy text/i);
  const guardCount = (content.match(/if \(hasTextSelection\(\)\) return;/g) ?? []).length;
  assert.ok(guardCount >= 2, "expected hasTextSelection guard in teacher and student click handlers");
});
