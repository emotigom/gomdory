import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HARD_CODED_API_V1 = "/api/v1/";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const BASELINE_PATH = path.resolve(SCRIPT_DIR, "no-hardcoded-api-v1.baseline.json");

const SOURCE_DIRS = [path.join(REPO_ROOT, "app"), path.join(REPO_ROOT, "lib")];
const EXCLUDED_DIRS = [
  path.join(REPO_ROOT, "lib", "standards"),
  path.join(REPO_ROOT, "scripts"),
  path.join(REPO_ROOT, "docs"),
];
const EXCLUDED_FILES = [path.join(REPO_ROOT, "lib", "api", "client.generated.ts")];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const normalizePath = (value) => value.split(path.sep).join("/");

const isExcluded = (fullPath) =>
  EXCLUDED_FILES.includes(fullPath) || EXCLUDED_DIRS.some((dir) => fullPath.startsWith(dir + path.sep));

const countOccurrences = (value, needle) => {
  let count = 0;
  let index = value.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = value.indexOf(needle, index + needle.length);
  }
  return count;
};

const literalRegex = /(["'`])(?:\\.|(?!\1)[^\\])*?\1/gs;

const countApiV1InLiterals = (content) => {
  let total = 0;
  let match;
  while ((match = literalRegex.exec(content))) {
    const literal = match[0].slice(1, -1);
    total += countOccurrences(literal, HARD_CODED_API_V1);
  }
  return total;
};

const walk = async (dir, files = []) => {
  if (isExcluded(dir)) return files;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (isExcluded(fullPath)) continue;
    if (entry.isDirectory()) {
      await walk(fullPath, files);
    } else if (entry.isFile()) {
      if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }
  return files;
};

const buildBaseline = async () => {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    try {
      await fs.access(dir);
      await walk(dir, files);
    } catch {
      continue;
    }
  }

  const baselineEntries = {};
  let totalOccurrences = 0;

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const count = countApiV1InLiterals(content);
    if (count > 0) {
      const relativePath = normalizePath(path.relative(REPO_ROOT, filePath));
      baselineEntries[relativePath] = count;
      totalOccurrences += count;
    }
  }

  const sortedEntries = Object.fromEntries(
    Object.entries(baselineEntries).sort(([a], [b]) => a.localeCompare(b)),
  );

  await fs.writeFile(BASELINE_PATH, `${JSON.stringify(sortedEntries, null, 2)}\n`);

  console.log(
    `[no-hardcoded-api-v1] files: ${Object.keys(sortedEntries).length}, occurrences: ${totalOccurrences}`,
  );
};

await buildBaseline();
