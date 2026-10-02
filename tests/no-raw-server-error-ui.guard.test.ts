import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const TARGET_UI_FILES = [
  "app/_components/ComposeCardPanel.tsx",
  "app/_components/CardAttachments.tsx",
  "app/(marketing)/community/CommunityPostComposer.tsx",
  "app/(marketing)/community/CommunityBoardList.tsx",
] as const;

const DENIED_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "JSON.stringify(err)", pattern: /JSON\.stringify\(\s*err\s*\)/ },
  {
    label: "direct err.message render without safe mapping",
    pattern: /set(?:Error|ErrorMessage)\([^\n]*\berr\.message\b[^\n]*\)/,
  },
  {
    label: "direct error.message render without safe mapping",
    pattern: /set(?:Error|ErrorMessage)\([^\n]*\berror\.message\b[^\n]*\)/,
  },
  { label: "raw Postgres prefix: null value in column", pattern: /null value in column/i },
  { label: "raw Postgres prefix: violates not-null constraint", pattern: /violates not-null constraint/i },
];

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

test("compose/upload surfaces block raw server error strings in UI", () => {
  for (const file of TARGET_UI_FILES) {
    const source = read(file);
    for (const denied of DENIED_PATTERNS) {
      assert.doesNotMatch(source, denied.pattern, `${file} must not include ${denied.label}`);
    }
  }
});
