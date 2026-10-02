import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EXCLUDED_TESTS, PRIMARY_SUITES, TEST_GROUPS, TEST_MANIFEST_EXPECTATION, TEST_RUNNER_OVERRIDES } from "./test-manifest.mjs";
import { buildTestInventory, isGuardTest, isSourceTest, listTrackedTestFiles, normalizeTestPath } from "./test-discovery.mjs";

const TEST_MANIFEST_SOURCE_PATH = path.join("scripts", "qa", "check-test-manifest.mjs");

export const isTestManifestCliEntrypoint = ({ argvEntry, moduleUrl }) => {
  if (!argvEntry || !moduleUrl) return false;
  try {
    const sourcePath = path.resolve(process.cwd(), TEST_MANIFEST_SOURCE_PATH);
    return path.resolve(argvEntry) === sourcePath && fileURLToPath(moduleUrl) === sourcePath;
  } catch {
    return false;
  }
};

export const VALID_TEST_RUNNERS = new Set(["esbuild-node", "esbuild-ui", "direct-node"]);

export const validateTestRunnerOverrides = ({ trackedFiles, inventory, overrides = TEST_RUNNER_OVERRIDES, excludedTests = EXCLUDED_TESTS }) => {
  const errors = [];
  const trackedByPath = new Map(trackedFiles.map(normalizeTestPath).map((file) => [file.toLocaleLowerCase("en-US"), file]));
  const inventoryByPath = new Map(inventory.map((record) => [normalizeTestPath(record.path).toLocaleLowerCase("en-US"), record]));
  const excludedPaths = new Set(excludedTests.map((record) => normalizeTestPath(record.path).toLocaleLowerCase("en-US")));
  const seenPaths = new Map();
  for (const override of overrides) {
    const file = normalizeTestPath(override?.path);
    const caseKey = file.toLocaleLowerCase("en-US");
    if (!file) { errors.push("runner override lacks path"); continue; }
    if (seenPaths.has(caseKey)) errors.push(`duplicate runner override path by slash/case: ${seenPaths.get(caseKey)} and ${file}`);
    else seenPaths.set(caseKey, file);
    if (!trackedByPath.has(caseKey)) errors.push(`runner override references missing tracked test: ${file}`);
    if (!VALID_TEST_RUNNERS.has(override?.runner)) errors.push(`runner override has invalid runner for ${file}: ${override?.runner ?? "missing"}`);
    if (!override?.reason?.trim()) errors.push(`runner override lacks reason: ${file}`);
    if (excludedPaths.has(caseKey)) errors.push(`runner override applies to excluded test: ${file}`);
    const record = inventoryByPath.get(caseKey);
    if (record && !record.supported) errors.push(`runner override applies to unsupported test: ${file}`);
  }
  return errors;
};

export const validateTestManifest = ({ trackedFiles, inventory, groups = TEST_GROUPS, suites = PRIMARY_SUITES, excludedTests = EXCLUDED_TESTS, testRunnerOverrides = TEST_RUNNER_OVERRIDES, packageScripts = {} }) => {
  const errors = [];
  const normalizedTracked = trackedFiles.map(normalizeTestPath);
  const groupIds = new Set(groups.map((group) => group.id));
  const suiteIds = new Set(suites.map((suite) => suite.id));
  const recordsByPath = new Map();
  for (const record of inventory) {
    const file = normalizeTestPath(record.path);
    if (recordsByPath.has(file.toLowerCase())) errors.push(`duplicate path registration: ${file}`);
    recordsByPath.set(file.toLowerCase(), record);
    if (!suiteIds.has(record.primarySuite)) errors.push(`invalid primary Suite for ${file}: ${record.primarySuite ?? "missing"}`);
    for (const tag of record.tags || []) if (!groupIds.has(tag)) errors.push(`unknown group tag ${tag} on ${file}`);
    if (!record.supported && (!record.status || !record.reason?.trim())) errors.push(`excluded record lacks status/reason: ${file}`);
  }
  for (const file of normalizedTracked) if (!recordsByPath.has(file.toLowerCase())) errors.push(`unclassified tracked test: ${file}`);
  for (const record of inventory) if (!normalizedTracked.includes(record.path)) errors.push(`manifest record references missing tracked test: ${record.path}`);
  for (const excluded of excludedTests) if (!normalizedTracked.includes(normalizeTestPath(excluded.path))) errors.push(`excluded test is missing: ${excluded.path}`);
  errors.push(...validateTestRunnerOverrides({ trackedFiles, inventory, overrides: testRunnerOverrides, excludedTests }));

  const supported = inventory.filter((record) => record.supported);
  const excluded = inventory.filter((record) => !record.supported);
  for (const group of groups.filter((item) => item.executable)) {
    const count = supported.filter((record) => record.tags.includes(group.id)).length;
    if (count === 0) errors.push(`executable group is empty: ${group.id}`);
    if (count < group.minimumExpectedFiles) errors.push(`group ${group.id} has ${count}, below minimum ${group.minimumExpectedFiles}`);
  }
  if (supported.some((record) => !record.tags.includes("all"))) errors.push("all group does not include every supported test");
  if (supported.some((record) => isSourceTest(record.path) !== record.tags.includes("source"))) errors.push("source group does not exactly match supported source tests");
  if (supported.some((record) => isGuardTest(record.path) !== record.tags.includes("guards"))) errors.push("guards group does not exactly match guard test files");
  if (supported.some((record) => record.path.toLowerCase().includes("webllm") !== record.tags.includes("webllm"))) errors.push("webllm group does not exactly match WebLLM test paths");
  if (excluded.some((record) => record.tags.includes("all"))) errors.push("excluded test appears in all group");

  const groupScriptContract = { "test:node": "node", "test:ui": "ui", "test:guards": "guards", "test:webllm": "webllm", "test:source": "source" };
  for (const [script, group] of Object.entries(groupScriptContract)) {
    if (packageScripts[script] && !new RegExp(`--group(?:=|\\s+)${group}(?:\\s|$)`).test(packageScripts[script])) errors.push(`${script} does not reference manifest group ${group}`);
  }
  return { errors, counts: { tracked: normalizedTracked.length, supported: supported.length, excluded: excluded.length } };
};

if (isTestManifestCliEntrypoint({ argvEntry: process.argv[1], moduleUrl: import.meta.url })) {
  try {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const trackedFiles = listTrackedTestFiles(repoRoot);
    const inventory = buildTestInventory(trackedFiles);
    const packageScripts = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")).scripts || {};
    const result = validateTestManifest({ trackedFiles, inventory, packageScripts });
    const supported = inventory.filter((record) => record.supported);
    const counts = {
      ...result.counts,
      source: supported.filter((record) => record.tags.includes("source")).length,
      unclassified: trackedFiles.filter((file) => !inventory.some((record) => normalizeTestPath(record.path).toLowerCase() === normalizeTestPath(file).toLowerCase())).length,
      "duplicate-primary": 0,
      missing: inventory.filter((record) => !trackedFiles.some((file) => normalizeTestPath(file) === normalizeTestPath(record.path))).length,
    };
    for (const [key, expected] of Object.entries(TEST_MANIFEST_EXPECTATION)) {
      if (counts[key] !== expected) result.errors.push(`manifest expectation ${key}=${expected}, actual=${counts[key]}`);
    }
    console.log(`[test-manifest] tracked=${result.counts.tracked} supported=${result.counts.supported} excluded=${result.counts.excluded}`);
    for (const group of TEST_GROUPS) console.log(`[test-manifest] group ${group.id}=${supported.filter((record) => record.tags.includes(group.id)).length}`);
    for (const suite of PRIMARY_SUITES) console.log(`[test-manifest] suite ${suite.id}=${supported.filter((record) => record.primarySuite === suite.id).length}`);
    if (result.errors.length) {
      for (const error of result.errors) console.error(`[test-manifest] ERROR ${error}`);
      process.exit(3);
    }
    console.log(`[test-manifest] OK: unclassified=${counts.unclassified} duplicate-primary=${counts["duplicate-primary"]} missing=${counts.missing}`);
  } catch (error) {
    console.error(`[test-manifest] ERROR ${error instanceof Error ? error.message : String(error)}`);
    process.exit(3);
  }
}
