import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { EXCLUDED_TESTS, PRIMARY_SUITES, TEST_FILE_PATTERN, TEST_GROUPS, TEST_MANIFEST_VERSION, TEST_RUNNER_OVERRIDES } from "./test-manifest.mjs";

export const normalizeTestPath = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+/g, "/");
};

export const isTrackedTestFile = (value) => TEST_FILE_PATTERN.test(normalizeTestPath(value));
export const isSourceTest = (value) => /^(?:app|lib|scripts)\//.test(normalizeTestPath(value));
export const isUiTest = (value) => {
  const file = normalizeTestPath(value);
  return file.startsWith("tests/ui/") || /\.tsx$/i.test(file) || /(?:^|\/)[\w.-]+\.ui\.test\.[cm]?[jt]sx?$/i.test(file);
};
export const isGuardTest = (value) => /(?:^|\/)[\w.-]*(?:-guard|\.guard)\.test\.[cm]?[jt]sx?$/i.test(normalizeTestPath(value));
export const isSmokeContractTest = (value) => /(?:^|\/)(?:coach-healthcheck-smoke|smoke-[\w.-]+)\.test\.[cm]?[jt]sx?$/i.test(normalizeTestPath(value));
const isDefaultExcludedSmoke = (value) => path.posix.basename(normalizeTestPath(value)) === "coach-healthcheck-smoke.test.tsx";

const PRIVATE_ROOT_SOURCE_ONLY_TEST_PREFIXES = [
  "scripts/public-export/template/",
];

export const isPrivateRootRunnableTestFile = (value) => {
  const file = normalizeTestPath(value);
  if (!file) return false;
  return !PRIVATE_ROOT_SOURCE_ONLY_TEST_PREFIXES.some((prefix) =>
    file.startsWith(prefix),
  );
};

export const listTrackedTestFiles = (repoRoot) => {
  const result = spawnSync("git", ["ls-files", "*.test.ts", "*.test.tsx", "*.test.mjs", "*.test.cjs"], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`git ls-files failed: ${(result.stderr || "unknown error").trim()}`);
  return result.stdout
    .split(/\r?\n/)
    .map(normalizeTestPath)
    .filter(isPrivateRootRunnableTestFile)
    .sort((a, b) => a.localeCompare(b));
};

const keywordMatch = (file, patterns) => patterns.some((keyword) => file.toLowerCase().includes(keyword.toLowerCase()));

export const classifyPrimarySuite = (filePath, excluded = false) => {
  const file = normalizeTestPath(filePath);
  if (excluded || isGuardTest(file) || isDefaultExcludedSmoke(file)) return "QA-SUITE-011";
  if (isSourceTest(file)) return "QA-SUITE-010";
  if (isUiTest(file)) return "QA-SUITE-009";
  for (const suite of PRIMARY_SUITES.slice(0, 7)) {
    if (keywordMatch(file, suite.patterns)) return suite.id;
  }
  return "QA-SUITE-008";
};

const suiteGroup = new Map(PRIMARY_SUITES.map((suite) => [suite.id, suite.group]));
const knownGroupIds = new Set(TEST_GROUPS.map((group) => group.id));
const runnerOverridesByPath = new Map(TEST_RUNNER_OVERRIDES.map((record) => [normalizeTestPath(record.path), record]));

export const buildTestInventory = (trackedFiles) => {
  const excludedByPath = new Map(EXCLUDED_TESTS.map((record) => [normalizeTestPath(record.path), record]));
  const seenCase = new Map();
  const records = [];
  for (const rawPath of trackedFiles) {
    const file = normalizeTestPath(rawPath);
    if (!isTrackedTestFile(file)) continue;
    const caseKey = file.toLocaleLowerCase("en-US");
    if (seenCase.has(caseKey)) throw new Error(`Duplicate test path by slash/case: ${seenCase.get(caseKey)} and ${file}`);
    seenCase.set(caseKey, file);
    const excluded = excludedByPath.get(file);
    const primarySuite = classifyPrimarySuite(file, Boolean(excluded));
    if (excluded) {
      records.push({ ...excluded, path: file, primarySuite, supported: false, tags: [] });
      continue;
    }

    const tags = new Set(["all"]);
    if (isSourceTest(file)) tags.add("source");
    if (isSmokeContractTest(file)) tags.add("smoke-contract");
    if (isGuardTest(file)) tags.add("guards");
    else if (isUiTest(file) && !isDefaultExcludedSmoke(file)) tags.add("ui");
    else if (isDefaultExcludedSmoke(file)) tags.add("smoke-contract");
    else tags.add("node");
    const primaryGroup = suiteGroup.get(primarySuite);
    if (primaryGroup && knownGroupIds.has(primaryGroup) && !["ui", "guards", "source", "smoke-contract"].includes(primaryGroup)) tags.add(primaryGroup);
    const lower = file.toLowerCase();
    if (lower.includes("webllm")) tags.add("webllm");
    if (/(deploy|cloudflare|wrangler|worker|build-env)/.test(lower)) tags.add("deploy");
    if (/(doc|ssot|readiness|compliance|legal)/.test(lower)) tags.add("docs");
    if (/(auth|permission|ownership|turnstile|session|rls)/.test(lower)) tags.add("auth");
    if (/(storage|file|upload|attachment|r2|download)/.test(lower)) tags.add("storage");
    if (/(poll|stream|queue|job|retry|stale|abort|race|realtime)/.test(lower)) tags.add("async");
    if (/(route|api|middleware|public)/.test(lower)) tags.add("route");
    records.push({
      path: file,
      supported: true,
      primarySuite,
      tags: [...tags].sort(),
      runner: runnerOverridesByPath.get(file)?.runner ?? (isUiTest(file) ? "esbuild-ui" : file.endsWith(".cjs") ? "direct-node" : "esbuild-node"),
      setup: isUiTest(file) ? "tests/setup-ui-env.cjs" : "tests/setup-node-env.cjs",
    });
  }
  return records;
};

export const selectTests = (inventory, selectors = {}) => {
  const { group, matches = [], requestedFiles = [] } = selectors;
  const groups = new Set(TEST_GROUPS.map((item) => item.id));
  if (group && !groups.has(group)) return { error: `Unknown test group: ${group}`, code: "UNKNOWN_GROUP", selected: [] };
  const supported = inventory.filter((record) => record.supported);
  let selected = group ? supported.filter((record) => record.tags.includes(group)) : [...supported];
  const normalizedMatches = matches.map((item) => item.trim()).filter(Boolean);
  if (normalizedMatches.length) selected = selected.filter((record) => normalizedMatches.some((token) => record.path.includes(token)));
  const normalizedRequested = [...new Set(requestedFiles.map(normalizeTestPath).filter(Boolean))];
  if (normalizedRequested.length) {
    const byPath = new Map(inventory.map((record) => [record.path, record]));
    for (const file of normalizedRequested) {
      const record = byPath.get(file);
      if (!record) return { error: `Requested test is not registered: ${file}`, code: "UNKNOWN_FILE", selected: [] };
      if (!record.supported) return { error: `Requested test is excluded (${record.status}): ${file}\n${record.reason}`, code: "EXCLUDED_FILE", selected: [] };
    }
    const requestedSet = new Set(normalizedRequested);
    selected = selected.filter((record) => requestedSet.has(record.path));
  }
  return { selected: [...new Map(selected.map((record) => [record.path, record])).values()].sort((a, b) => a.path.localeCompare(b.path)) };
};

export const readFilesFrom = (repoRoot, filePath) => fs.readFileSync(path.resolve(repoRoot, filePath), "utf8")
  .split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).map(normalizeTestPath);

export const isMeaningfulEmptyReason = (reason) => {
  const value = typeof reason === "string" ? reason.trim() : "";
  return value.length >= 8 && !/^(?:optional|none|skip)$/i.test(value);
};

export const summarizeSelection = (inventory, selected, selectors = {}, extra = {}) => {
  const count = (key) => Object.fromEntries([...selected.reduce((map, record) => map.set(key(record), (map.get(key(record)) || 0) + 1), new Map())].sort());
  const tagCounts = {};
  for (const record of selected) for (const tag of record.tags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  const excluded = inventory.filter((record) => !record.supported);
  return {
    schemaVersion: 1,
    status: extra.status ?? "selected",
    selector: selectors.selectorDescription ?? "all supported tests",
    group: selectors.group ?? null,
    requestedFiles: selectors.requestedFiles ?? [],
    selectedCount: selected.length,
    selectedFiles: selected.map((record) => record.path),
    countsByPrimarySuite: count((record) => record.primarySuite),
    countsByTag: Object.fromEntries(Object.entries(tagCounts).sort()),
    sourceTestCount: selected.filter((record) => isSourceTest(record.path)).length,
    excludedCount: excluded.length,
    excludedFiles: excluded.map((record) => ({ path: record.path, status: record.status, reason: record.reason })),
    allowEmpty: Boolean(extra.allowEmpty),
    emptyReason: extra.emptyReason ?? null,
    manifestVersion: TEST_MANIFEST_VERSION,
  };
};

export const suggestCandidates = (inventory, value) => {
  const needle = normalizeTestPath(value).toLowerCase();
  const groupHints = TEST_GROUPS.map((group) => group.id).filter((id) => id.includes(needle) || needle.includes(id));
  const fileHints = inventory.map((record) => record.path).filter((file) => file.toLowerCase().includes(needle.split("/").at(-1) || needle)).slice(0, 5);
  return [...groupHints, ...fileHints].slice(0, 5);
};
