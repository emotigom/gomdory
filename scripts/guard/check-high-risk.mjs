import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const listPath = path.join(repoRoot, "scripts", "guard", "high-risk-files.ts");

const REQUIRED_ACK =
  "PROTECTED_SCOPE_ACK: current Issue/request explicitly authorizes these protected repository changes; merge does not authorize external effects.";

const fail = (message) => {
  console.error(`[guard] FAIL: ${message}`);
  process.exit(1);
};

const git = (...args) =>
  execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const extractList = (source, name) => {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`, "m"));
  if (!match) throw new Error(`Cannot find ${name} in ${listPath}`);

  const values = [];
  for (const item of match[1].matchAll(/"([^"]+)"/g)) {
    values.push(item[1]);
  }
  return values;
};

const splitLines = (value) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const getChangedFiles = () => {
  const explicitBase = process.env.GOM_PR_DIFF_BASE;
  const explicitHead = process.env.GOM_PR_DIFF_HEAD || "HEAD";

  if (explicitBase) {
    return splitLines(git("diff", "--name-only", explicitBase, explicitHead));
  }

  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    execFileSync("git", ["fetch", "origin", baseRef, "--depth=200"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    const mergeBase = git("merge-base", `origin/${baseRef}`, "HEAD");
    return splitLines(git("diff", "--name-only", mergeBase, "HEAD"));
  }

  return splitLines(git("diff", "--name-only", "HEAD~1", "HEAD"));
};

const matchesRisk = (file, pattern) =>
  pattern.endsWith("/") ? file.startsWith(pattern) : file === pattern;

const hasProtectedScopeAck = () => {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return false;

  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  return String(event?.pull_request?.body ?? "").includes(REQUIRED_ACK);
};

const main = () => {
  const source = fs.readFileSync(listPath, "utf8");
  const highRiskFiles = extractList(source, "HIGH_RISK_FILES");
  const changed = getChangedFiles();
  const matched = changed.filter((file) =>
    highRiskFiles.some((pattern) => matchesRisk(file, pattern)),
  );

  if (matched.length === 0) {
    console.log("[guard] OK: no protected repository files changed.");
    return;
  }

  console.log("[guard] Protected repository files changed:");
  for (const file of matched) console.log(` - ${file}`);

  const isPr = process.env.GITHUB_EVENT_NAME === "pull_request" || Boolean(process.env.GITHUB_BASE_REF);
  if (!isPr) {
    console.log("[guard] Non-PR event: protected scope requires explicit review before merge.");
    return;
  }

  if (!hasProtectedScopeAck()) {
    fail(`missing protected-scope acknowledgement in PR body. Add exactly:\n${REQUIRED_ACK}`);
  }

  console.log("[guard] OK: protected scope acknowledgement found.");
};

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
