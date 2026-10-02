import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const routeSource = readFileSync("app/api/v1/dashboard/walls/[wallId]/cards/route.ts", "utf8");
const cardsDataSource = readFileSync("lib/data/cards.ts", "utf8");

function extractBalancedSource(source: string, startIndex: number, open: string, close: string) {
  const openIndex = source.indexOf(open, startIndex);
  if (openIndex === -1) {
    return "";
  }

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    if (source[index] === close) depth -= 1;
    if (depth === 0) return source.slice(openIndex, index + 1);
  }

  return "";
}

function extractFunctionSource(source: string, functionName: string) {
  const match = new RegExp(`export\\s+async\\s+function\\s+${functionName}\\s*\\(`).exec(source);
  if (!match || match.index === undefined) {
    return "";
  }

  const parameterStart = source.indexOf("(", match.index);
  const parameters = extractBalancedSource(source, match.index, "(", ")");
  const bodyStart = parameters ? source.indexOf("{", parameterStart + parameters.length) : -1;
  const body = bodyStart === -1 ? "" : extractBalancedSource(source, bodyStart, "{", "}");
  return body && bodyStart !== -1 ? source.slice(match.index, bodyStart + body.length) : "";
}

function extractCallSource(source: string, functionName: string) {
  const callIndex = source.indexOf(`${functionName}(`);
  return callIndex === -1 ? "" : extractBalancedSource(source, callIndex, "(", ")");
}

function hasOrderByPositionEnabled(callSource: string) {
  return /\borderByPosition\s*:\s*true\b/.test(callSource);
}

function hasPositionNormalization(source: string) {
  return /\.map\s*\(\s*\(\s*card\s*\)\s*=>\s*\(\s*\{\s*position\s*:\s*null\s*,\s*\.\.\.card\s*,?\s*\}\s*\)\s*\)/.test(source);
}

test("dashboard wall cards route accepts explicit positive integer limits including smoke limit=1", () => {
  assert.match(routeSource, /function parseCardsLimit/);
  assert.match(routeSource, /Number\.parseInt\(normalizedLimit,\s*10\)/);
  assert.match(routeSource, /limit < 1 \|\| limit > MAX_CARDS_LIMIT/);
  assert.match(routeSource, /limit: limitResult\.limit/);
  assert.doesNotMatch(routeSource, /Math\.min\(Math\.max\(Number\(limitParam\),\s*1\),\s*200\)/);
});

test("dashboard wall cards route returns empty card lists as success and separates load errors from bad requests", () => {
  assert.match(routeSource, /const cards = result\.items\.map/);
  assert.match(routeSource, /items: cards/);
  assert.match(routeSource, /cards,/);
  assert.match(routeSource, /code: "cards_load_failed"/);
  assert.match(routeSource, /status: 500/);
});

test("dashboard wall cards route delegates with orderByPosition: true", () => {
  assert.match(
    routeSource,
    /import\s*\{[^}]*\blistWallCardsPaginated\b[^}]*\}\s*from\s*["']@\/lib\/data\/cards["']/s,
    "route must import listWallCardsPaginated from the cards data helper",
  );

  const getSource = extractFunctionSource(routeSource, "GET");
  const helperCall = extractCallSource(getSource, "listWallCardsPaginated");
  assert.ok(helperCall, "route GET handler must call listWallCardsPaginated");
  assert.match(helperCall, /\bwallId\s*:\s*wall\.id\b/, "helper call must use the resolved wall id");
  assert.ok(hasOrderByPositionEnabled(helperCall), "helper call must set orderByPosition to boolean true");
});

test("dashboard wall cards route exposes card position", () => {
  assert.match(
    routeSource,
    /const\s+cards\s*=\s*result\.items\.map\s*\(\s*\(\s*card\s*\)\s*=>\s*\(\s*\{[\s\S]*?\bposition\s*:\s*card\.position\b/,
    "route card DTO must expose position: card.position",
  );
});

test("dashboard wall cards position ordering is owned by the data helper", () => {
  const helperSource = extractFunctionSource(cardsDataSource, "listWallCardsPaginated");
  assert.ok(helperSource, "cards data source must define listWallCardsPaginated");

  const positionOrder = /\.order\s*\(\s*["']position["']\s*,\s*\{(?=[^}]*\bascending\s*:\s*true)(?=[^}]*\bnullsFirst\s*:\s*false)[^}]*\}\s*\)/.exec(helperSource);
  assert.ok(positionOrder, "data helper must order position ascending with nulls last");

  const stableOrder = /\.order\s*\(\s*["']created_at["']\s*,\s*\{\s*ascending\s*:\s*false\s*\}\s*\)\s*\.order\s*\(\s*["']id["']\s*,\s*\{\s*ascending\s*:\s*false\s*\}\s*\)/.exec(helperSource);
  assert.ok(stableOrder, "data helper must order created_at then id descending for stable pagination");
  assert.ok(
    positionOrder.index < stableOrder.index,
    "position ordering must precede created_at and id stable ordering",
  );
});

test("dashboard wall cards data helper retains the missing-position-column fallback", () => {
  const helperSource = extractFunctionSource(cardsDataSource, "listWallCardsPaginated");
  assert.match(
    helperSource,
    /if\s*\(\s*error\s*&&\s*options\.orderByPosition\s*&&\s*isMissingCardPositionColumnError\s*\(\s*error\s*\)\s*\)/,
    "fallback must only run for a missing position column when position ordering was requested",
  );
  assert.match(helperSource, /buildQuery\s*\(\s*CARD_SELECT_FIELDS_WITHOUT_POSITION\s*,\s*false\s*\)/);
  assert.match(
    helperSource,
    /CARD_SELECT_FIELDS_WITHOUT_POSITION[\s\S]*?\.order\s*\(\s*["']created_at["']\s*,\s*\{\s*ascending\s*:\s*false\s*\}\s*\)[\s\S]*?\.order\s*\(\s*["']id["']\s*,\s*\{\s*ascending\s*:\s*false\s*\}\s*\)[\s\S]*?\.limit\s*\(\s*limit\s*\+\s*1\s*\)/,
    "fallback must retain created_at/id ordering and limit + 1 pagination",
  );
});

test("dashboard wall cards data helper normalizes missing position without overwriting real values", () => {
  const helperSource = extractFunctionSource(cardsDataSource, "listWallCardsPaginated");
  assert.ok(
    hasPositionNormalization(helperSource),
    "position normalization must put position: null before ...card",
  );
});

test("dashboard wall cards guard helpers reject missing position delegation and destructive normalization", () => {
  assert.equal(
    hasOrderByPositionEnabled("listWallCardsPaginated({ wallId, limit })"),
    false,
    "a route call without orderByPosition: true must fail",
  );
  assert.equal(
    hasPositionNormalization("const rows = data.map((card) => ({ position: null, ...card }));"),
    true,
  );
  assert.equal(
    hasPositionNormalization("const rows = data.map((card) => ({ ...card, position: null }));"),
    false,
    "normalization must not overwrite a real position",
  );
});
