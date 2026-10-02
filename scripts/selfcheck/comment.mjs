import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const REPORT_JSON_PATH = path.join(REPO_ROOT, "docs", "security", "selfcheck-report.json");
const BASELINE_PATH = path.join(SCRIPT_DIR, "baseline.json");

const readJson = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const keyForMissingRouteFile = (item) => `${item.kind}::${item.path}`;
const keyForMissingInSsot = (item) => `${item.kind}::${item.path}`;
const keyForUnsafeApiPath = (item) => `${item.file}::${item.value}`;
const keyForHardcodedApiV1 = (item) => `${item.file}::${item.value}`;

const diffNewItems = (current, baseline, keyFn) => {
  const baselineSet = new Set((baseline || []).map((item) => keyFn(item)));
  return current.filter((item) => !baselineSet.has(keyFn(item)));
};

const formatLimitedList = (items, format, limit = 5) => {
  const sliced = items.slice(0, limit);
  const lines = sliced.map((item) => `- ${format(item)}`);
  const remaining = items.length - sliced.length;
  if (remaining > 0) {
    lines.push(`- ...and ${remaining} more`);
  }
  return lines.length ? lines.join("\n") : "- (none)";
};

const run = async () => {
  const report = await readJson(REPORT_JSON_PATH);
  if (!report) {
    console.error("[selfcheck:comment] Missing report JSON. Run npm run audit:selfcheck first.");
    process.exit(1);
  }

  const baseline = (await readJson(BASELINE_PATH)) || { items: {} };

  const currentItems = {
    missing_route_file: report.mismatches?.missingRouteFile || [],
    missing_in_ssot: report.mismatches?.missingInSsot || [],
    unsafe_api_path: report.usage?.unsafeApiPaths || [],
    hardcoded_api_v1: report.usage?.hardcodedApiV1 || [],
  };

  const newItems = {
    missing_route_file: diffNewItems(
      currentItems.missing_route_file,
      baseline.items?.missing_route_file || [],
      keyForMissingRouteFile
    ),
    missing_in_ssot: diffNewItems(
      currentItems.missing_in_ssot,
      baseline.items?.missing_in_ssot || [],
      keyForMissingInSsot
    ),
    unsafe_api_path: diffNewItems(
      currentItems.unsafe_api_path,
      baseline.items?.unsafe_api_path || [],
      keyForUnsafeApiPath
    ),
    hardcoded_api_v1: diffNewItems(
      currentItems.hardcoded_api_v1,
      baseline.items?.hardcoded_api_v1 || [],
      keyForHardcodedApiV1
    ),
  };

  const lines = [];
  lines.push("### Selfcheck Summary");
  lines.push("");
  if (report.metrics) {
    lines.push(`- Routes: ${report.metrics.routes_total} (API ${report.metrics.routes_api_total}, Page ${report.metrics.routes_page_total})`);
    lines.push(`- SSOT Routes: ${report.metrics.ssot_routes_total}`);
    lines.push(`- API calls detected: ${report.metrics.calls_total}`);
    lines.push(`- Missing route files: ${report.metrics.missing_route_file_count}`);
    lines.push(`- Missing in SSOT: ${report.metrics.missing_in_ssot_count}`);
    lines.push(`- Hardcoded /api/ paths: ${report.metrics.hardcoded_api_path_count}`);
    lines.push(`- unsafeApiPath usage: ${report.metrics.unsafe_api_path_count}`);
  }

  lines.push("");
  lines.push("### New Issues (vs baseline)");
  lines.push("");
  const totalNew = Object.values(newItems).reduce((acc, items) => acc + items.length, 0);
  if (!totalNew) {
    lines.push("- (none)");
  } else {
    lines.push("#### missing_route_file");
    lines.push(formatLimitedList(newItems.missing_route_file, (item) => `${item.kind} ${item.path} (${item.builder})`));
    lines.push("");
    lines.push("#### missing_in_ssot");
    lines.push(formatLimitedList(newItems.missing_in_ssot, (item) => `${item.kind} ${item.path} (${item.file})`));
    lines.push("");
    lines.push("#### unsafe_api_path");
    lines.push(formatLimitedList(newItems.unsafe_api_path, (item) => `${item.file}:${item.line} ${item.value}`));
    lines.push("");
    lines.push("#### hardcoded_api_v1");
    lines.push(formatLimitedList(newItems.hardcoded_api_v1, (item) => `${item.file}:${item.line} ${item.value}`));
  }

  lines.push("");
  lines.push("### Top Offenders (Top 5)");
  lines.push("");
  if (report.topOffenders?.files_by_issue_count?.length) {
    lines.push(formatLimitedList(report.topOffenders.files_by_issue_count, (item) => `${item.file} (${item.count})`, 5));
  } else {
    lines.push("- (none)");
  }

  lines.push("");
  lines.push("### Top Missing Routes (Top 5)");
  lines.push("");
  if (report.topOffenders?.missing_route_file?.length) {
    lines.push(formatLimitedList(report.topOffenders.missing_route_file, (item) => `${item.kind} ${item.path}`, 5));
  } else {
    lines.push("- (none)");
  }

  console.log(lines.join("\n"));
};

run().catch((error) => {
  console.error("[selfcheck:comment] Failed", error);
  process.exit(1);
});
