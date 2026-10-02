import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { scanRepository } from "./scan.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(SCRIPT_DIR, "baseline.json");
const ALLOWLIST_PATH = path.join(SCRIPT_DIR, "allowlist.json");

const DEFAULT_HARDCODED_API_V1_SCOPE = {
  includePatterns: ["app/**", "lib/**"],
  excludePatterns: ["lib/standards/**", "scripts/**", "docs/**"],
};

const DEFAULT_BASELINE = {
  generatedAt: null,
  items: {
    missing_route_file: [],
    missing_in_ssot: [],
    unsafe_api_path: [],
    hardcoded_api_v1: [],
  },
};

const loadAllowlist = async () => {
  try {
    const raw = await fs.readFile(ALLOWLIST_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      missingInSsot: [],
      missingRouteFile: [],
      hardcodedApiV1: DEFAULT_HARDCODED_API_V1_SCOPE,
    };
  }
};

const loadBaseline = async () => {
  try {
    const raw = await fs.readFile(BASELINE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return DEFAULT_BASELINE;
  }
};

const writeBaseline = async (baseline) => {
  await fs.writeFile(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
};

const keyForMissingRouteFile = (item) => `${item.kind}::${item.path}`;
const keyForMissingInSsot = (item) => `${item.kind}::${item.path}`;
const keyForUnsafeApiPath = (item) => `${item.file}::${item.value}`;
const keyForHardcodedApiV1 = (item) => `${item.file}::${item.value}`;

const toKeySet = (items, keyFn) => new Set(items.map((item) => keyFn(item)));

const diffNewItems = (current, baseline, keyFn) => {
  const baselineSet = toKeySet(baseline, keyFn);
  return current.filter((item) => !baselineSet.has(keyFn(item)));
};

const formatLimitedList = (items, format, limit = 8) => {
  const limited = items.slice(0, limit);
  const lines = limited.map((item) => `- ${format(item)}`);
  const remaining = items.length - limited.length;
  if (remaining > 0) {
    lines.push(`- ...and ${remaining} more`);
  }
  return lines.length ? lines.join("\n") : "- (none)";
};

const hasStrictFlag = (name) => {
  const value = process.env[name];
  return value === "1" || value === "true" || value === "yes";
};

const matchesPathPattern = (filePath, pattern) => {
  if (!pattern) return false;
  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3);
    return filePath.startsWith(base);
  }
  return filePath === pattern;
};

const resolveHardcodedApiV1Scope = (allowlist) => {
  const scoped = allowlist.hardcodedApiV1 || {};
  const includePatterns =
    Array.isArray(scoped.includePatterns) && scoped.includePatterns.length
      ? scoped.includePatterns
      : DEFAULT_HARDCODED_API_V1_SCOPE.includePatterns;
  const excludePatterns =
    Array.isArray(scoped.excludePatterns) && scoped.excludePatterns.length
      ? scoped.excludePatterns
      : DEFAULT_HARDCODED_API_V1_SCOPE.excludePatterns;
  return { includePatterns, excludePatterns };
};

const isHardcodedApiV1InScope = (filePath, scope) => {
  const includeMatch =
    !scope.includePatterns?.length ||
    scope.includePatterns.some((pattern) => matchesPathPattern(filePath, pattern));
  if (!includeMatch) return false;
  if (!scope.excludePatterns?.length) return true;
  return !scope.excludePatterns.some((pattern) => matchesPathPattern(filePath, pattern));
};

const runCheck = async ({ updateBaseline }) => {
  const report = await scanRepository({ writeReport: true });
  const allowlist = await loadAllowlist();
  const baseline = await loadBaseline();
  const hardcodedApiV1Scope = resolveHardcodedApiV1Scope(allowlist);
  const hardcodedApiV1Scoped = report.usage.hardcodedApiV1.filter((item) =>
    isHardcodedApiV1InScope(item.file, hardcodedApiV1Scope)
  );

  const currentItems = {
    missing_route_file: report.mismatches.missingRouteFile,
    missing_in_ssot: report.mismatches.missingInSsot,
    unsafe_api_path: report.usage.unsafeApiPaths,
    hardcoded_api_v1: hardcodedApiV1Scoped,
  };

  if (updateBaseline) {
    const nextBaseline = {
      generatedAt: new Date().toISOString(),
      items: currentItems,
    };
    await writeBaseline(nextBaseline);
    console.log("[selfcheck] baseline updated.");
    return { status: "updated" };
  }

  const missingRouteFileNew = diffNewItems(
    currentItems.missing_route_file,
    baseline.items.missing_route_file || [],
    keyForMissingRouteFile
  );
  const missingInSsotNew = diffNewItems(
    currentItems.missing_in_ssot,
    baseline.items.missing_in_ssot || [],
    keyForMissingInSsot
  );
  const unsafeApiPathNew = diffNewItems(
    currentItems.unsafe_api_path,
    baseline.items.unsafe_api_path || [],
    keyForUnsafeApiPath
  );
  const hardcodedApiV1New = diffNewItems(
    currentItems.hardcoded_api_v1,
    baseline.items.hardcoded_api_v1 || [],
    keyForHardcodedApiV1
  );

  const strictMissingInSsot = hasStrictFlag("SELFCHECK_STRICT_MISSING_IN_SSOT");
  const strictUnsafeApiPath = hasStrictFlag("SELFCHECK_STRICT_UNSAFE_API_PATH");

  const errors = [];
  const warnings = [];

  if (missingRouteFileNew.length) {
    errors.push({
      title: "missing_route_file",
      items: missingRouteFileNew,
      format: (item) => `${item.kind} ${item.path} (${item.builder})`,
    });
  }

  if (hardcodedApiV1New.length) {
    errors.push({
      title: "hardcoded_api_v1",
      items: hardcodedApiV1New,
      format: (item) => `${item.file}:${item.line} ${item.value}`,
    });
  }

  if (missingInSsotNew.length) {
    const collection = strictMissingInSsot ? errors : warnings;
    collection.push({
      title: "missing_in_ssot",
      items: missingInSsotNew,
      format: (item) => `${item.kind} ${item.path} (${item.file})`,
    });
  }

  if (unsafeApiPathNew.length) {
    const collection = strictUnsafeApiPath ? errors : warnings;
    collection.push({
      title: "unsafe_api_path",
      items: unsafeApiPathNew,
      format: (item) => `${item.file}:${item.line} ${item.value}`,
    });
  }

  if (!errors.length && !warnings.length) {
    console.log("[selfcheck] No new issues found.");
    return { status: "clean" };
  }

  if (warnings.length) {
    console.warn("[selfcheck] Warnings detected:");
    for (const warning of warnings) {
      console.warn(`\n## ${warning.title}`);
      console.warn(formatLimitedList(warning.items, warning.format));
    }
  }

  if (errors.length) {
    console.error("[selfcheck] Errors detected:");
    for (const error of errors) {
      console.error(`\n## ${error.title}`);
      console.error(formatLimitedList(error.items, error.format));
    }
    console.error("\n해결 순서:");
    console.error("1) routes.ts 등록 또는 allowlist 추가");
    console.error("2) 문자열 하드코딩 제거 → routes.ts 또는 unsafeApiPath 사용");
    console.error("3) baseline 업데이트는 정당한 사유가 있을 때만");
    return { status: "failed" };
  }

  return { status: "warn" };
};

const args = process.argv.slice(2);
const updateBaseline = args.includes("--update-baseline");

runCheck({ updateBaseline })
  .then((result) => {
    if (result.status === "failed") {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("[selfcheck] Failed", error);
    process.exit(1);
  });
