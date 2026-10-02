import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import {
  buildTestInventory,
  isMeaningfulEmptyReason,
  listTrackedTestFiles,
  normalizeTestPath,
  readFilesFrom,
  selectTests,
  suggestCandidates,
  summarizeSelection,
} from "./qa/test-discovery.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const testOutputRoot = path.resolve(repoRoot, ".test-dist");
const serverOnlyShim = path.resolve(repoRoot, "tests/shims/server-only.ts");
const otelShim = path.resolve(repoRoot, "tests/shims/opentelemetry-api.ts");

const usage = `Usage: node scripts/run-tests.mjs [options]
  --group <group>       Select a manifest group
  --match <substring>   Select path substrings (comma-separated remains supported)
  --file <path>         Select an exact registered test; repeatable
  --files-from <path>   Read exact paths, ignoring blank lines and # comments
  --list                List selection without running tests
  --json                Emit only the result JSON on stdout
  --allow-empty         Permit an empty selector result with --empty-reason
  --empty-reason <text> Required meaningful reason for --allow-empty`;

export const parseRunTestsOptions = (argv, env = process.env) => {
  const options = { group: "", matches: [], files: [], filesFrom: [], list: false, json: false, allowEmpty: false, emptyReason: "" };
  const takeValue = (arg, index) => arg.includes("=") ? [arg.slice(arg.indexOf("=") + 1), index] : [argv[index + 1] ?? "", index + 1];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--list") options.list = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--allow-empty") options.allowEmpty = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (/^--(?:group|match|file|files-from|empty-reason)(?:=|$)/.test(arg)) {
      const key = arg.match(/^--([\w-]+)/)?.[1];
      const [value, nextIndex] = takeValue(arg, index);
      index = nextIndex;
      if (!value) throw new Error(`Missing value for --${key}`);
      if (key === "group") options.group = value;
      else if (key === "match") options.matches.push(...value.split(",").map((item) => item.trim()).filter(Boolean));
      else if (key === "file") options.files.push(value);
      else if (key === "files-from") options.filesFrom.push(value);
      else if (key === "empty-reason") options.emptyReason = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.group && env.TEST_MODE && ["node", "ui", "guards"].includes(env.TEST_MODE)) options.group = env.TEST_MODE;
  if (!options.group && env.RUN_SMOKE_ONLY === "1") options.group = "smoke-contract";
  if (!options.matches.length && env.TEST_MATCH?.trim()) options.matches.push(...env.TEST_MATCH.split(",").map((item) => item.trim()).filter(Boolean));
  return options;
};

const serverOnlyPlugin = { name: "server-only-stub", setup(buildContext) { buildContext.onResolve({ filter: /^server-only$/ }, () => ({ path: serverOnlyShim })); } };
const otelPlugin = { name: "otel-api-stub", setup(buildContext) { buildContext.onResolve({ filter: /^@opentelemetry\/api$/ }, () => ({ path: otelShim })); } };
const styleJsxSanitizerPlugin = {
  name: "style-jsx-sanitizer",
  setup(buildContext) {
    buildContext.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
      if (!args.path.startsWith(repoRoot)) return null;
      const source = await fs.promises.readFile(args.path, "utf8");
      const contents = source.replace(/<style\s+jsx\s+global(\s|>)/g, "<style$1").replace(/<style\s+global\s+jsx(\s|>)/g, "<style$1").replace(/<style\s+jsx(\s|>)/g, "<style$1").replace(/<style\s+global(\s|>)/g, "<style$1");
      const extension = path.extname(args.path).slice(1);
      return { contents, loader: extension === "tsx" ? "tsx" : extension === "ts" ? "ts" : extension === "jsx" ? "jsx" : "js" };
    });
  },
};

export const createRunOutputDirectory = (outputRoot = testOutputRoot) => {
  const root = path.resolve(outputRoot);
  fs.mkdirSync(root, { recursive: true });
  return fs.mkdtempSync(path.join(root, "run-"));
};

export const cleanupRunOutputDirectory = (runOutputDirectory, outputRoot = testOutputRoot, remove = fs.rmSync) => {
  const root = path.resolve(outputRoot);
  const runDirectory = path.resolve(runOutputDirectory);
  const relative = path.relative(root, runDirectory);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || path.dirname(relative) !== "." || !path.basename(runDirectory).startsWith("run-")) {
    throw new Error(`[run-tests] refusing to clean output directory outside this invocation: ${runDirectory}`);
  }
  remove(runDirectory, { recursive: true, force: false });
};

export const resolveBundledOutputPath = (runOutputDirectory, record) => {
  const relative = path.parse(record.path);
  const isEsm = record.runner === "esbuild-ui" || record.path.endsWith(".mjs");
  return path.join(runOutputDirectory, relative.dir, `${relative.name}.${isEsm ? "mjs" : "cjs"}`);
};

const bundleTest = async (record, runOutputDirectory) => {
  const input = path.resolve(repoRoot, record.path);
  const isEsm = record.runner === "esbuild-ui" || record.path.endsWith(".mjs");
  const outfile = resolveBundledOutputPath(runOutputDirectory, record);
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  await build({
    entryPoints: [input], outfile, bundle: true, platform: "node", format: isEsm ? "esm" : "cjs", target: "node20", sourcemap: "inline",
    tsconfig: path.resolve(repoRoot, "tsconfig.json"), external: ["server-only"], loader: { ".ts": "tsx", ".tsx": "tsx" }, jsx: "automatic",
    banner: isEsm ? { js: 'import { createRequire as __createRequire } from "node:module";const require = __createRequire(import.meta.url);' } : undefined,
    plugins: [serverOnlyPlugin, otelPlugin, ...(record.runner === "esbuild-ui" ? [styleJsxSanitizerPlugin] : [])],
  });
  return outfile;
};

const writeJson = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

const main = async () => {
  let options;
  try { options = parseRunTestsOptions(process.argv.slice(2)); }
  catch (error) { console.error(`[run-tests] ${error.message}\n${usage}`); process.exit(2); }
  if (options.help) { console.log(usage); return; }

  const inventory = buildTestInventory(listTrackedTestFiles(repoRoot));
  const requestedFiles = [...options.files];
  try { for (const file of options.filesFrom) requestedFiles.push(...readFilesFrom(repoRoot, file)); }
  catch (error) { console.error(`[run-tests] unable to read --files-from: ${error.message}`); process.exit(2); }
  const hasSelector = Boolean(options.group || options.matches.length || requestedFiles.length || options.filesFrom.length);
  const selectorDescription = [options.group && `group=${options.group}`, options.matches.length && `match=${options.matches.join(",")}`, requestedFiles.length && `files=${requestedFiles.length}`].filter(Boolean).join("; ") || "all supported tests";
  const selectors = { group: options.group || undefined, matches: options.matches, requestedFiles, selectorDescription };
  const selection = selectTests(inventory, selectors);
  if (selection.error) {
    const hints = suggestCandidates(inventory, options.group || requestedFiles[0] || options.matches[0] || "");
    const summary = summarizeSelection(inventory, [], selectors, { status: "selector-error", allowEmpty: options.allowEmpty, emptyReason: options.emptyReason || null });
    summary.error = selection.error; summary.suggestions = hints;
    if (options.json) writeJson(summary); else console.error(`[run-tests] ${selection.error}\n[run-tests] supported=${inventory.filter((item) => item.supported).length} excluded=${inventory.filter((item) => !item.supported).length}${hints.length ? `\n[run-tests] suggestions: ${hints.join(", ")}` : ""}`);
    process.exit(2);
  }

  if (selection.selected.length === 0 && hasSelector) {
    if (!options.allowEmpty || !isMeaningfulEmptyReason(options.emptyReason)) {
      const reasonHelp = options.allowEmpty ? "--empty-reason must be a concrete explanation of at least 8 characters" : "use --allow-empty only with a concrete --empty-reason";
      const hints = suggestCandidates(inventory, options.group || requestedFiles[0] || options.matches[0] || "");
      const summary = summarizeSelection(inventory, [], selectors, { status: "empty-selection-error", allowEmpty: options.allowEmpty, emptyReason: options.emptyReason || null });
      summary.error = `No tests selected; ${reasonHelp}`; summary.suggestions = hints;
      if (options.json) writeJson(summary); else console.error(`[run-tests] selector selected 0 tests: ${selectorDescription}\n[run-tests] supported=${inventory.filter((item) => item.supported).length} excluded=${inventory.filter((item) => !item.supported).length}\n[run-tests] ${reasonHelp}${hints.length ? `\n[run-tests] suggestions: ${hints.join(", ")}` : ""}`);
      process.exit(2);
    }
    const summary = summarizeSelection(inventory, [], selectors, { status: "skipped-empty", allowEmpty: true, emptyReason: options.emptyReason.trim() });
    if (options.json) writeJson(summary); else console.error(`[run-tests] skipped-empty: ${options.emptyReason.trim()}`);
    return;
  }

  const listSummary = summarizeSelection(inventory, selection.selected, selectors, { status: options.list ? "listed" : "selected", allowEmpty: options.allowEmpty, emptyReason: options.emptyReason || null });
  if (options.list) {
    if (options.json) writeJson(listSummary);
    else {
      console.log(`[run-tests] group=${options.group || "all"} selector=${selectorDescription} selected=${listSummary.selectedCount} source=${listSummary.sourceTestCount} excluded=${listSummary.excludedCount}`);
      console.log(`[run-tests] primary Suites: ${Object.entries(listSummary.countsByPrimarySuite).map(([key, value]) => `${key}=${value}`).join(" ")}`);
      for (const file of listSummary.selectedFiles) console.log(file);
    }
    return;
  }

  let exitCode = 0;
  const failedTestFiles = [];
  let runOutputDirectory;
  try {
    for (const record of selection.selected) {
      let testPath = path.resolve(repoRoot, record.path);
      if (record.runner !== "direct-node") {
        runOutputDirectory ??= createRunOutputDirectory();
        testPath = await bundleTest(record, runOutputDirectory);
      }
      const result = spawnSync(process.execPath, ["-r", path.resolve(repoRoot, record.setup), "--test", testPath], {
        cwd: repoRoot,
        encoding: options.json ? "utf8" : undefined,
        stdio: options.json ? ["ignore", "pipe", "pipe"] : "inherit",
        env: { ...process.env, TEST_MODE: record.runner === "esbuild-ui" ? "ui" : "node", TEST_NETWORK_GUARD: process.env.TEST_NETWORK_GUARD ?? "1" },
        windowsHide: true,
      });
      if (options.json) { if (result.stdout) process.stderr.write(result.stdout); if (result.stderr) process.stderr.write(result.stderr); }
      if (result.status !== 0) {
        failedTestFiles.push(record.path);
        if (exitCode === 0) exitCode = result.status ?? 1;
        if (options.group !== "guards" || result.status === null) break;
      }
    }
  } catch (error) {
    exitCode = 1;
    console.error(error);
  } finally {
    if (runOutputDirectory) {
      try { cleanupRunOutputDirectory(runOutputDirectory); }
      catch (error) {
        console.error(`[run-tests] output cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
        if (exitCode === 0) exitCode = 1;
      }
    }
  }
  if (options.json) writeJson(summarizeSelection(inventory, selection.selected, selectors, { status: exitCode === 0 ? "passed" : "failed", allowEmpty: options.allowEmpty, emptyReason: options.emptyReason || null }));
  if (!options.json && exitCode !== 0) {
    const failedSummary = failedTestFiles.length > 0 ? failedTestFiles.join(", ") : "test runner";
    console.error(`[run-tests] failed: ${failedSummary}. Inspect the first \"not ok\" block above for details.`);
  }
  process.exit(exitCode);
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(repoRoot, "scripts/run-tests.mjs")) await main();
