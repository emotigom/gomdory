#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { classifyProviderImpact } from "./select-provider-build.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const normalizeRepoPath = (value) => String(value ?? "")
  .trim()
  .replaceAll("\\", "/")
  .replace(/\/+/g, "/")
  .replace(/^\.\//, "")
  .replace(/^\/+/, "");

const isTestOnlyPath = (file) =>
  /(?:^|\/)tests?\//.test(file)
  || /\.test\.(?:[cm]?[jt]sx?)$/.test(file)
  || /\.spec\.(?:[cm]?[jt]sx?)$/.test(file);

const isSkipOnlyPath = (file) =>
  file.startsWith("docs/")
  || file.endsWith(".md")
  || file.endsWith(".mdx")
  || isTestOnlyPath(file);

const git = (cwd, args) => execFileSync("git", args, {
  cwd,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
  stdio: ["ignore", "pipe", "pipe"],
}).trim();

const resolveCommit = (cwd, ref) => {
  try {
    return git(cwd, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]);
  } catch {
    return null;
  }
};

const readDiffPaths = ({ cwd = repoRoot, baseRef, headRef }) => {
  const base = resolveCommit(cwd, baseRef);
  const head = resolveCommit(cwd, headRef);
  if (!base || !head) return { ok: false, reason: "git-ref-unavailable", base, head, paths: [] };

  let mergeBase;
  try {
    mergeBase = git(cwd, ["merge-base", base, head]);
  } catch {
    return { ok: false, reason: "merge-base-unavailable", base, head, paths: [] };
  }

  try {
    const output = git(cwd, ["diff", "--name-only", "--no-renames", mergeBase, head, "--"]);
    const paths = [...new Set(output.split(/\r?\n/).map(normalizeRepoPath).filter(Boolean))].sort();
    return { ok: true, reason: "git-diff-ready", base, head, mergeBase, paths };
  } catch {
    return { ok: false, reason: "git-diff-failed", base, head, mergeBase, paths: [] };
  }
};

export function planCloudflareBranchBuild({
  changedPaths,
  diffReady = true,
  diffReason = "git-diff-ready",
}) {
  if (!diffReady) {
    return {
      schemaVersion: 1,
      action: "full-preview",
      providerDecision: "uncertain",
      needsCloudflarePackage: true,
      reason: diffReason || "git-diff-unavailable",
      paths: [],
    };
  }

  const paths = [...new Set(changedPaths.map(normalizeRepoPath).filter(Boolean))].sort();
  if (!paths.length) {
    return {
      schemaVersion: 1,
      action: "skip",
      providerDecision: "not-required",
      needsCloudflarePackage: false,
      reason: "no-effective-changes",
      paths,
    };
  }

  let provider;
  try {
    provider = classifyProviderImpact(paths);
  } catch {
    return {
      schemaVersion: 1,
      action: "full-preview",
      providerDecision: "uncertain",
      needsCloudflarePackage: true,
      reason: "provider-classification-failed",
      paths,
    };
  }

  if (provider.needsCloudflarePackage) {
    return {
      schemaVersion: 1,
      action: "full-preview",
      providerDecision: provider.decision,
      needsCloudflarePackage: true,
      reason: provider.reason,
      paths,
    };
  }

  if (paths.every(isSkipOnlyPath)) {
    return {
      schemaVersion: 1,
      action: "skip",
      providerDecision: provider.decision,
      needsCloudflarePackage: false,
      reason: "all-changes-non-runtime",
      paths,
    };
  }

  return {
    schemaVersion: 1,
    action: "next-only",
    providerDecision: provider.decision,
    needsCloudflarePackage: false,
    reason: "provider-neutral-runtime-output",
    paths,
  };
}

export function discoverAndPlanCloudflareBranchBuild({
  cwd = repoRoot,
  baseCandidates = [],
  headRef = "HEAD",
} = {}) {
  const candidates = [...new Set(baseCandidates.filter(Boolean))];
  for (const baseRef of candidates) {
    const diff = readDiffPaths({ cwd, baseRef, headRef });
    if (!diff.ok) continue;
    return {
      ...planCloudflareBranchBuild({ changedPaths: diff.paths }),
      git: {
        baseRef,
        base: diff.base,
        head: diff.head,
        mergeBase: diff.mergeBase,
      },
    };
  }

  return {
    ...planCloudflareBranchBuild({
      changedPaths: [],
      diffReady: false,
      diffReason: "no-local-base-ref",
    }),
    git: {
      baseCandidates: candidates,
      headRef,
    },
  };
}

function parseOptions(argv) {
  const options = { base: [], head: "", json: false, actionOnly: false };
  const take = (arg, index) => arg.includes("=")
    ? [arg.slice(arg.indexOf("=") + 1), index]
    : [argv[index + 1] ?? "", index + 1];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--action-only") options.actionOnly = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (/^--(?:base|head)(?:=|$)/.test(arg)) {
      const key = arg.match(/^--([\w-]+)/)?.[1];
      const [value, nextIndex] = take(arg, index);
      index = nextIndex;
      if (!value) throw new Error(`missing value for --${key}`);
      if (key === "base") options.base.push(value);
      else options.head = value;
    } else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

const usage = `Usage: node scripts/ci/cloudflare-branch-build-plan.mjs [options]
  --base <ref>   Add a local base candidate; repeatable
  --head <ref>   Head ref; defaults to CF_PAGES_COMMIT_SHA or HEAD
  --json         Emit JSON only
  --action-only  Emit only skip | next-only | full-preview

No network fetches are performed. Missing local Git evidence fails closed to
full-preview.`;

async function main() {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) {
      console.log(usage);
      return;
    }

    const headRef = options.head || process.env.CF_PAGES_COMMIT_SHA || "HEAD";
    const baseCandidates = options.base.length
      ? options.base
      : [process.env.GOM_CLOUDFLARE_DIFF_BASE, "origin/main", "main"].filter(Boolean);

    const plan = discoverAndPlanCloudflareBranchBuild({ baseCandidates, headRef });
    if (options.actionOnly) process.stdout.write(`${plan.action}\n`);
    else if (options.json) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    else console.log(`[cloudflare-branch-plan] action=${plan.action} provider=${plan.providerDecision} reason=${plan.reason} paths=${plan.paths.length}`);
  } catch (error) {
    console.error(`[cloudflare-branch-plan] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
