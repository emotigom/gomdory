import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const SELF_REPORT_PATH = path.join(REPO_ROOT, "docs", "security", "selfcheck-report.json");
const DUP_REPORT_PATH = path.join(REPO_ROOT, "docs", "security", "duplication-inventory.json");
const OUTPUT_PATH = path.join(REPO_ROOT, "docs", "standards", "ROUTES_MIGRATION_PLAN.md");
const ROUTES_PATH = path.join(REPO_ROOT, "lib", "standards", "routes.ts");

const TOP_FILE_LIMIT = 10;
const TOP_PATH_LIMIT = 20;
const TOP_CANDIDATE_LIMIT = 10;
const TOP_TODO_LIMIT = 10;

const fileExists = async (target) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

const loadJson = async (target) => JSON.parse(await fs.readFile(target, "utf8"));

const collectItems = (data) => {
  if (data?.usage) {
    return [
      ...(data.usage.unsafeApiPaths ?? []),
      ...(data.usage.hardcodedApiV1 ?? []),
      ...(data.usage.hardcodedApiPaths ?? []),
    ];
  }

  return [
    ...(data.hardcodedApiV1 ?? []),
    ...(data.hardcodedApiPaths ?? []),
    ...(data.unsafeApiPaths ?? []),
  ];
};

const normalizeApiV1Path = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/\/api\/v1\/[^\s"'`)]*/);
  return match ? match[0] : null;
};

const buildApiRouteMap = (content) => {
  const map = new Map();
  const lines = content.split("\n");
  const stack = [];
  let inApi = false;

  const apiStartRegex = /^\s*export\s+const\s+api\s*=\s*\{\s*$/;
  const objectStartRegex = /^\s*(\w+)\s*:\s*\{\s*$/;
  const funcRegex =
    /^\s*(\w+)\s*:\s*\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>\s*apiPath\(\s*([`'"])([\s\S]*?)\3\s*\)/;
  const closingRegex = /^\s*}\s*,?\s*$/;
  const apiEndRegex = /^\s*}\s*as\s+const\s*;/;

  for (const line of lines) {
    if (!inApi) {
      if (apiStartRegex.test(line)) {
        inApi = true;
      }
      continue;
    }

    if (apiEndRegex.test(line)) {
      inApi = false;
      stack.length = 0;
      continue;
    }

    const objectStartMatch = line.match(objectStartRegex);
    if (objectStartMatch) {
      stack.push(objectStartMatch[1]);
      continue;
    }

    const funcMatch = line.match(funcRegex);
    if (funcMatch) {
      const name = funcMatch[1];
      const params = funcMatch[2].trim();
      const raw = funcMatch[4];
      const paramNames = params
        ? params
            .split(",")
            .map((param) => param.trim())
            .filter(Boolean)
            .map((param) => param.split(":")[0].split("=")[0].trim())
        : [];
      const builderPath = ["routes", "api", ...stack, name].join(".");
      const builderCall = `${builderPath}(${paramNames.join(", ")})`;
      map.set(raw, builderCall);
      continue;
    }

    if (closingRegex.test(line)) {
      if (stack.length > 0) {
        stack.pop();
      }
    }
  }

  return map;
};

const formatRow = (columns) => `| ${columns.join(" | ")} |`;

const main = async () => {
  const hasSelf = await fileExists(SELF_REPORT_PATH);
  const sourcePath = hasSelf ? SELF_REPORT_PATH : DUP_REPORT_PATH;
  const report = await loadJson(sourcePath);
  const items = collectItems(report);

  const fileCounts = new Map();
  for (const item of items) {
    if (!item?.file) continue;
    fileCounts.set(item.file, (fileCounts.get(item.file) ?? 0) + 1);
  }

  const topFiles = [...fileCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_FILE_LIMIT);

  const pathCounts = new Map();
  const pathExamples = new Map();
  for (const item of items) {
    const normalized = normalizeApiV1Path(item?.value);
    if (!normalized) continue;
    pathCounts.set(normalized, (pathCounts.get(normalized) ?? 0) + 1);
    if (!pathExamples.has(normalized)) {
      pathExamples.set(normalized, item);
    }
  }

  const topPaths = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_PATH_LIMIT)
    .map(([pathValue, count]) => ({
      pathValue,
      count,
      example: pathExamples.get(pathValue),
    }));

  const routesContent = await fs.readFile(ROUTES_PATH, "utf8");
  const routeMap = buildApiRouteMap(routesContent);
  const valueCounts = new Map();
  for (const item of items) {
    if (!item?.value) continue;
    valueCounts.set(item.value, (valueCounts.get(item.value) ?? 0) + 1);
  }

  const candidateValues = [...valueCounts.entries()]
    .filter(([value]) => routeMap.has(value))
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CANDIDATE_LIMIT)
    .map(([value, count]) => ({
      value,
      count,
      builder: routeMap.get(value),
      example: items.find((item) => item.value === value),
    }));

  const todoValues = [...valueCounts.entries()]
    .filter(([value]) => normalizeApiV1Path(value) && !routeMap.has(value))
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_TODO_LIMIT)
    .map(([value, count]) => ({
      value,
      count,
      example: items.find((item) => item.value === value),
    }));

  const lines = [];
  lines.push("# Routes Migration Plan (Auto-generated)");
  lines.push("");
  lines.push(`- Source: \`${path.relative(REPO_ROOT, sourcePath)}\``);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Top 10 files by issue count");
  lines.push("");
  lines.push(formatRow(["Rank", "File", "Issues"]));
  lines.push(formatRow(["---", "---", "---"]));
  topFiles.forEach(([file, count], index) => {
    lines.push(formatRow([String(index + 1), `\`${file}\``, String(count)]));
  });
  lines.push("");
  lines.push("## Top 20 hardcoded /api/v1 paths");
  lines.push("");
  lines.push(formatRow(["Rank", "Path", "Occurrences", "Example file"]));
  lines.push(formatRow(["---", "---", "---", "---"]));
  topPaths.forEach((entry, index) => {
    const example = entry.example ? `\`${entry.example.file}:${entry.example.line}\`` : "-";
    lines.push(formatRow([String(index + 1), `\`${entry.pathValue}\``, String(entry.count), example]));
  });
  lines.push("");
  lines.push("## 이번 PR에서 고칠 후보 10개 (routes builder + callsite 치환 대상)");
  lines.push("");
  lines.push(formatRow(["Rank", "Path", "Builder", "Occurrences", "Example"]));
  lines.push(formatRow(["---", "---", "---", "---", "---"]));
  candidateValues.forEach((entry, index) => {
    const example = entry.example ? `\`${entry.example.file}:${entry.example.line}\`` : "-";
    lines.push(
      formatRow([
        String(index + 1),
        `\`${entry.value}\``,
        entry.builder ? `\`${entry.builder}\`` : "-",
        String(entry.count),
        example,
      ]),
    );
  });
  lines.push("");
  lines.push("## TODO (복잡/동적 조합 - 수동 치환)");
  lines.push("");
  if (todoValues.length === 0) {
    lines.push("- 없음");
  } else {
    todoValues.forEach((entry) => {
      const example = entry.example ? `${entry.example.file}:${entry.example.line}` : "unknown";
      lines.push(`- ${entry.value} (${entry.count}x, ${example})`);
    });
  }
  lines.push("");
  lines.push("## Next commands");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run audit:routes:plan");
  lines.push("npm run selfcheck:fix:dry");
  lines.push("npm run audit:selfcheck");
  lines.push("npm run audit:duplication");
  lines.push("node scripts/selfcheck/check.mjs --update-baseline");
  lines.push("node scripts/duplication/check.mjs --update-baseline");
  lines.push("CI=1 npm run build");
  lines.push("npm run check:security");
  lines.push("```");
  lines.push("");

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");

  console.log(`[routes-plan] Wrote ${path.relative(REPO_ROOT, OUTPUT_PATH)} using ${path.relative(REPO_ROOT, sourcePath)}.`);
};

main().catch((error) => {
  console.error("[routes-plan] Failed", error);
  process.exit(1);
});
