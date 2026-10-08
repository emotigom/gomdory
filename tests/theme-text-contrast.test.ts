import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { GOM_THEME_IDS, GOM_THEMES } from "@/lib/theme/themes";
import { contrastRatio, overOpaque, parseSrgbColor } from "./helpers/textContrast";

// Product palette targets, not a claim of site-wide WCAG conformance.
const textFloors = {
  "--theme-text": 7,
  "--theme-text-muted": 5.5,
  "--theme-text-subtle": 5,
} as const;
const surfaces = [
  "--theme-bg", "--theme-bg-elevated", "--theme-surface",
  "--theme-surface-muted", "--theme-card", "--theme-card-muted",
] as const;

const css = fs.readFileSync("app/globals.css", "utf8");

// Inspect flat exact-root declarations, including later same-selector overrides.
// Decorative root blocks may coexist with the palette. This is not a general
// CSS/cascade evaluator; rendered/conditional contrast needs a browser run.
function declaredThemeColors(id: string, sourceCss = css): Map<string, string> {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^html\\[data-gom-theme="${escaped}"\\]\\s*\\{([^{}]*)\\}`, "gm");
  const blocks = [...sourceCss.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(pattern)];
  assert.ok(blocks.length > 0, `${id}: missing explicit, flat theme palette block`);
  const declarations = new Map<string, string>();
  for (const block of blocks) {
    const localKeys = new Set<string>();
    for (const match of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
      assert.ok(!localKeys.has(match[1]), `${id}: duplicate declaration within one block: ${match[1]}`);
      localKeys.add(match[1]);
      declarations.set(match[1], match[2].trim());
    }
  }
  return declarations;
}

test("CSS parity reader retains the palette across separate decorative root blocks", () => {
  const fixture = [
    'html[data-gom-theme="sample"] { --decoration: #123456; }',
    ':root,',
    'html[data-gom-theme="sample"] { --theme-bg: #ffffff; --theme-text-subtle: #596270; }',
    'html[data-gom-theme="sample"] { --other-decoration: #fedcba; }',
    'html[data-gom-theme="sample"] .card { --theme-text-subtle: #ffffff; }',
  ].join("\n");
  const declarations = declaredThemeColors("sample", fixture);
  assert.equal(declarations.get("--theme-bg"), "#ffffff");
  assert.equal(declarations.get("--theme-text-subtle"), "#596270");
});

test("CSS parity reader does not hide later root color overrides or invalid declarations", () => {
  const fixture = [
    'html[data-gom-theme="sample"] { --theme-text-subtle: #596270; }',
    'html[data-gom-theme="sample"] { --theme-text-subtle: #ffffff; }',
  ].join("\n");
  assert.equal(declaredThemeColors("sample", fixture).get("--theme-text-subtle"), "#ffffff");
  assert.throws(() => declaredThemeColors("missing", fixture), /missing explicit/);
  assert.throws(() => declaredThemeColors("sample",
    'html[data-gom-theme="sample"] { --theme-text-subtle: #596270; --theme-text-subtle: #ffffff; }'), /duplicate declaration/);
});

test("contrast math has the known 21:1 and 1:1 anchors", () => {
  assert.equal(contrastRatio("#000", "#fff"), 21);
  assert.equal(contrastRatio("#ffffff", "#000000"), 21);
  assert.equal(contrastRatio("#596270", "#596270"), 1);
  assert.equal(contrastRatio("transparent", "#fff"), 1);
});

test("contrast math parses supported sRGB formats and composites alpha without rounding", () => {
  assert.deepEqual(parseSrgbColor("#abc"), [170, 187, 204, 1]);
  assert.deepEqual(parseSrgbColor("#abcd"), [170, 187, 204, 221 / 255]);
  assert.deepEqual(parseSrgbColor("#10203080"), [16, 32, 48, 128 / 255]);
  assert.deepEqual(parseSrgbColor("rgb(16 32 48 / 50%)"), [16, 32, 48, 0.5]);
  assert.deepEqual(parseSrgbColor("rgba(16, 32, 48, .5)"), [16, 32, 48, 0.5]);
  const halfWhite = overOpaque([255, 255, 255, 0.5], [0, 0, 0, 1]);
  assert.deepEqual(halfWhite, [127.5, 127.5, 127.5, 1]);
  const ratio = contrastRatio("rgb(255 255 255 / 50%)", "#000");
  assert.ok(Math.abs(ratio - 5.280822809644651) < 1e-12);
  assert.equal(
    contrastRatio("#000", "rgba(255,255,255,.5)", "#000"),
    contrastRatio("#000", "rgb(127.5 127.5 127.5)"),
  );
});

test("unknown colors, malformed channels and missing backdrops cannot pass", () => {
  for (const color of ["", "#12", "#gggggg", "rgb(256 0 0)", "rgba(0,0,0,2)",
    "rgb(1 2 3 /)", "rgb(1,2,3 / .5)", "rgb(NaN 0 0)", "var(--unknown)",
    "oklch(.5 .1 30)", "linear-gradient(black,white)"]) {
    assert.throws(() => parseSrgbColor(color), color);
  }
  assert.throws(() => contrastRatio("#fff", "rgba(0,0,0,.5)"), /backdrop/);
  assert.throws(() => contrastRatio("#fff", "rgba(0,0,0,.5)", "transparent"), /opaque/);
  assert.throws(() => contrastRatio("#fff", "#000", "unknown"), /Unsupported/);
  assert.throws(() => overOpaque([NaN, 0, 0, 1], [0, 0, 0, 1]), /Invalid/);
});

test("original subtle failures remain below the unrounded accessibility threshold", () => {
  for (const [ink, surface] of [
    ["#667080", "#f5f0e6"], ["#667080", "#eee7d9"], ["#667080", "#f8f2e7"],
    ["#64748b", "#fbf7ef"], ["#64748b", "#f3efe6"], ["#64748b", "#f8f3ea"],
  ]) assert.ok(contrastRatio(ink, surface) < 4.5, `${ink} on ${surface}`);
  const nearBoundary = contrastRatio("#667080", "#f8f2e7");
  assert.equal(nearBoundary.toFixed(1), "4.5");
  assert.ok(nearBoundary < 4.5, "formatting must never promote a failing ratio");
});

for (const id of GOM_THEME_IDS) {
  test(`theme contrast: ${id} keeps readable text across its six base surfaces`, () => {
    const tokens = GOM_THEMES[id].tokens;
    for (const surface of surfaces) {
      for (const role of Object.keys(textFloors) as Array<keyof typeof textFloors>) {
        const ratio = contrastRatio(tokens[role], tokens[surface], tokens["--theme-bg"]);
        assert.ok(ratio >= textFloors[role], `${id} ${role} on ${surface}: ${ratio} < ${textFloors[role]}`);
      }
    }
  });

  test(`theme CSS: ${id} declares the same foreground/background colors as the palette`, () => {
    const declarations = declaredThemeColors(id);
    const tokens = GOM_THEMES[id].tokens;
    const keys = [...surfaces, ...(Object.keys(textFloors) as Array<keyof typeof textFloors>)];
    for (const key of keys) {
      assert.ok(declarations.has(key), `${id}: missing CSS declaration ${key}`);
      assert.deepEqual(parseSrgbColor(declarations.get(key)!), parseSrgbColor(tokens[key]), `${id} ${key}: CSS/palette drift`);
    }
  });
}
