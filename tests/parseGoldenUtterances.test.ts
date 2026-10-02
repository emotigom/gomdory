import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parseGoldenUtterances } from "../scripts/parse-golden-utterances";

test("parse-golden-utterances parses and matches JSON output count", async () => {
  const rootDir = process.cwd();
  const sourcePath = path.join(rootDir, "docs", "llm", "golden-utterances.md");
  const jsonPath = path.join(rootDir, "docs", "llm", "golden-utterances.json");

  const source = await fs.readFile(sourcePath, "utf-8");
  const parsed = parseGoldenUtterances(source);
  assert.equal(parsed.length, 80);

  const jsonRaw = await fs.readFile(jsonPath, "utf-8");
  const jsonParsed = JSON.parse(jsonRaw) as unknown[];
  assert.equal(jsonParsed.length, 80);
});
