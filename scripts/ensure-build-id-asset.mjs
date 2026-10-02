import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

const ROOT_DIR = process.cwd();
const NEXT_BUILD_ID_FILE = path.join(ROOT_DIR, ".next", "BUILD_ID");
const STATIC_DIR = path.join(ROOT_DIR, ".open-next", "assets", "_next", "static");
const OUTPUT_FILE = path.join(STATIC_DIR, "BUILD_ID");
const ROOT_OUTPUT_FILE = path.join(ROOT_DIR, ".open-next", "assets", "BUILD_ID");

function log(stage, detail) {
  console.log(
    JSON.stringify({
      stage,
      ...detail,
    }),
  );
}

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readBuildIdFromNext() {
  if (!(await fileExists(NEXT_BUILD_ID_FILE))) return null;
  const raw = await fs.readFile(NEXT_BUILD_ID_FILE, "utf8");
  const value = raw.trim();
  if (!value) return null;
  log("build_id_source", { source: ".next/BUILD_ID", value });
  return value;
}

async function findBuildIdFromAssets() {
  if (!(await fileExists(STATIC_DIR))) return null;

  const entries = await fs.readdir(STATIC_DIR, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    const manifestPath = path.join(STATIC_DIR, entry.name, "_buildManifest.js");
    const buildManifestPath = path.join(STATIC_DIR, entry.name, "build-manifest.json");

    if (await fileExists(manifestPath)) {
      const stat = await fs.stat(manifestPath);
      candidates.push({ name: entry.name, mtimeMs: stat.mtimeMs, source: "_buildManifest.js" });
      continue;
    }

    if (await fileExists(buildManifestPath)) {
      const stat = await fs.stat(buildManifestPath);
      candidates.push({ name: entry.name, mtimeMs: stat.mtimeMs, source: "build-manifest.json" });
    }
  }

  if (candidates.length === 0) return null;

  const latest = candidates.reduce((prev, current) => (current.mtimeMs > prev.mtimeMs ? current : prev));
  log("build_id_source", { source: ".open-next/assets", value: latest.name, manifest: latest.source });
  return latest.name;
}

async function ensureBuildIdFile(buildId) {
  await fs.mkdir(STATIC_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${buildId}\n`, "utf8");
  await fs.writeFile(ROOT_OUTPUT_FILE, `${buildId}\n`, "utf8");
  log("build_id_written", {
    files: [path.relative(ROOT_DIR, OUTPUT_FILE), path.relative(ROOT_DIR, ROOT_OUTPUT_FILE)],
    value: buildId,
  });
}

async function main() {
  log("ensure_build_id_start", { cwd: ROOT_DIR, script: path.relative(ROOT_DIR, __filename) });

  const fromNext = await readBuildIdFromNext();
  const buildId = fromNext ?? (await findBuildIdFromAssets());

  if (!buildId) {
    const error = new Error(
      "Unable to determine BUILD_ID. Expected .next/BUILD_ID or a directory with manifest files in .open-next/assets/_next/static.",
    );
    log("ensure_build_id_error", { message: error.message });
    throw error;
  }

  await ensureBuildIdFile(buildId);
  log("ensure_build_id_complete", { buildId });
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      stage: "ensure_build_id_failed",
      message: error.message,
    }),
  );
  process.exit(1);
});
