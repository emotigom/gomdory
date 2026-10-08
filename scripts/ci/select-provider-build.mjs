#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const REQUIRED_EXACT = new Set([
  ".github/workflows/ci-preflight.yml",
  "build.sh",
  "cloudflare-env.d.ts",
  "middleware.ts",
  "next.config.ts",
  "open-next.config.ts",
  "package.json",
  "package-lock.json",
  "scripts/check-build-env.mjs",
  "scripts/deploy-timing.sh",
  "scripts/ensure-build-id-asset.mjs",
  "scripts/with-ci.mjs",
  "types/open-next-worker.d.ts",
  "wrangler.jsonc",
  "wrangler.preview.jsonc",
]);

const REQUIRED_PREFIXES = [
  "lib/cloudflare/",
  "lib/env/",
  "scripts/cf/",
  "worker/",
];

const SAFE_PREFIXES = [
  "docs/",
  "tests/",
];

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

const isProviderNeutralPath = (file) =>
  SAFE_PREFIXES.some((prefix) => file.startsWith(prefix))
  || file.endsWith(".md")
  || file.endsWith(".mdx")
  || file.endsWith(".css")
  || isTestOnlyPath(file);

const isDirectProviderAuthorityPath = (file) =>
  REQUIRED_EXACT.has(file)
  || REQUIRED_PREFIXES.some((prefix) => file.startsWith(prefix))
  || /^wrangler(?:\.[^/]+)?\.jsonc$/.test(file)
  || /^next\.config\.[cm]?[jt]s$/.test(file)
  || /^open-next\.config\.[cm]?[jt]s$/.test(file)
  || /^\.github\/workflows\//.test(file);

export function classifyProviderImpact(changedPaths) {
  const paths = [...new Set(changedPaths.map(normalizeRepoPath).filter(Boolean))].sort();
  if (!paths.length) throw new Error("provider impact selector requires at least one changed path");

  const required = paths.filter(isDirectProviderAuthorityPath);
  const neutral = paths.filter((file) => !required.includes(file) && isProviderNeutralPath(file));
  const uncertain = paths.filter((file) => !required.includes(file) && !neutral.includes(file));

  if (required.length) {
    return {
      schemaVersion: 1,
      decision: "required",
      needsCloudflarePackage: true,
      reason: "direct-provider-authority-changed",
      paths,
      required,
      neutral,
      uncertain,
    };
  }

  if (uncertain.length) {
    return {
      schemaVersion: 1,
      decision: "uncertain",
      needsCloudflarePackage: true,
      reason: "provider-impact-not-proven-neutral",
      paths,
      required,
      neutral,
      uncertain,
    };
  }

  return {
    schemaVersion: 1,
    decision: "not-required",
    needsCloudflarePackage: false,
    reason: "all-changes-provider-neutral",
    paths,
    required,
    neutral,
    uncertain,
  };
}

export function githubOutputLines(result) {
  return [
    `provider_impact_decision=${result.decision}`,
    `needs_cloudflare_package=${result.needsCloudflarePackage}`,
    `provider_impact_reason=${result.reason}`,
  ];
}

function parseOptions(argv) {
  const options = { files: [], filesFrom: [], json: false, githubOutput: false };
  const take = (arg, index) => arg.includes("=")
    ? [arg.slice(arg.indexOf("=") + 1), index]
    : [argv[index + 1] ?? "", index + 1];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--github-output") options.githubOutput = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (/^--(?:file|files-from)(?:=|$)/.test(arg)) {
      const key = arg.match(/^--([\w-]+)/)?.[1];
      const [value, nextIndex] = take(arg, index);
      index = nextIndex;
      if (!value) throw new Error(`missing value for --${key}`);
      if (key === "file") options.files.push(value);
      else options.filesFrom.push(value);
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  return options;
}

function readChangedPaths(options) {
  const files = [...options.files];
  for (const source of options.filesFrom) {
    const absolute = path.resolve(repoRoot, source);
    files.push(...fs.readFileSync(absolute, "utf8").split(/\r?\n/));
  }
  return files;
}

const usage = `Usage: node scripts/ci/select-provider-build.mjs [options]
  --file <path>       Add one changed repository path; repeatable
  --files-from <path> Read newline-separated changed paths
  --json              Emit the full decision as JSON
  --github-output     Append stable outputs to GITHUB_OUTPUT

Policy: required | not-required | uncertain. Uncertain is fail-closed and sets
needs_cloudflare_package=true. The selector uses Node stdlib only and performs
no installs, source parsing, network access, builds, or provider calls.`;

async function main() {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) {
      console.log(usage);
      return;
    }

    const result = classifyProviderImpact(readChangedPaths(options));

    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log(
        `[provider-impact] decision=${result.decision} needs_cloudflare_package=${result.needsCloudflarePackage} reason=${result.reason}`,
      );
      console.log(
        `[provider-impact] paths=${result.paths.length} required=${result.required.length} neutral=${result.neutral.length} uncertain=${result.uncertain.length}`,
      );
      if (result.required.length) console.log(`[provider-impact] required: ${result.required.join(", ")}`);
      if (result.uncertain.length) console.log(`[provider-impact] uncertain: ${result.uncertain.join(", ")}`);
    }

    if (options.githubOutput) {
      if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required for --github-output");
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${githubOutputLines(result).join("\n")}\n`);
    }
  } catch (error) {
    console.error(`[provider-impact] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
