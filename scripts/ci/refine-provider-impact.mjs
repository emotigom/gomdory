#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { classifyProviderImpact } from "./select-provider-build.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLIENT_DIRECTIVE = /^\uFEFF?\s*(?:"use client"|'use client')\s*;/;

const failClosed = (reason, details = {}) => ({
  schemaVersion: 1,
  decision: "uncertain",
  needsCloudflarePackage: true,
  reason,
  proof: { stableClientBoundary: false, ...details },
});

const preserve = (decision, reason) => ({
  schemaVersion: 1,
  decision,
  needsCloudflarePackage: decision !== "not-required",
  reason,
  proof: { stableClientBoundary: false, reusedDependencyImpact: false },
});

const defaultReadAtRef = (ref, file, cwd = repoRoot) => {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], {
      cwd,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
};

export function refineProviderImpact({
  preliminaryDecision,
  changedPaths,
  impact,
  base,
  head,
  readAtRef = defaultReadAtRef,
  cwd = repoRoot,
}) {
  if (preliminaryDecision === "required") return preserve("required", "preliminary-required");
  if (preliminaryDecision === "not-required") return preserve("not-required", "preliminary-not-required");
  if (preliminaryDecision !== "uncertain") return failClosed("invalid-preliminary-decision");

  let classified;
  try {
    classified = classifyProviderImpact(changedPaths);
  } catch {
    return failClosed("changed-path-classification-failed");
  }

  if (classified.decision !== "uncertain") {
    return failClosed("preliminary-decision-disagrees-with-path-classifier");
  }
  if (!impact || typeof impact !== "object") return failClosed("dependency-impact-missing");
  if (impact.status !== "analyzed") return failClosed("dependency-impact-not-analyzed");
  if (impact.refs?.base !== base || impact.refs?.head !== head) return failClosed("dependency-impact-ref-mismatch");

  const uncertain = classified.uncertain;
  if (!uncertain.length) return failClosed("no-uncertain-source-to-refine");
  if (!uncertain.every((file) => /\.tsx?$/.test(file))) {
    return failClosed("uncertain-source-not-ts-client-candidate", { uncertain });
  }

  const seeds = Array.isArray(impact.seeds) ? impact.seeds : [];
  for (const file of uncertain) {
    const matching = seeds.filter((seed) => seed?.path === file);
    if (matching.length !== 1 || matching[0]?.side !== "head" || matching[0]?.status !== "M") {
      return failClosed("client-boundary-change-not-stable-modification", { file });
    }
  }

  const diagnostics = Array.isArray(impact.diagnostics) ? impact.diagnostics : [];
  const changedDiagnostics = diagnostics.filter((item) => uncertain.includes(item?.from));
  if (changedDiagnostics.length) {
    return failClosed("changed-client-source-has-dependency-uncertainty", {
      diagnosticCount: changedDiagnostics.length,
    });
  }

  for (const file of uncertain) {
    const baseSource = readAtRef(base, file, cwd);
    const headSource = readAtRef(head, file, cwd);
    if (typeof baseSource !== "string" || typeof headSource !== "string") {
      return failClosed("client-boundary-source-unreadable", { file });
    }
    if (!CLIENT_DIRECTIVE.test(baseSource) || !CLIENT_DIRECTIVE.test(headSource)) {
      return failClosed("stable-use-client-directive-not-proven", { file });
    }
  }

  return {
    schemaVersion: 1,
    decision: "not-required",
    needsCloudflarePackage: false,
    reason: "stable-client-boundary-proven",
    proof: {
      stableClientBoundary: true,
      reusedDependencyImpact: true,
      changedSources: [...uncertain],
      dependencyImpactStatus: impact.status,
      dependencyImpactPlanningMs: impact.planningMs ?? null,
    },
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
  const options = {
    preliminary: "",
    impactFile: "",
    filesFrom: "",
    base: "",
    head: "",
    json: false,
    githubOutput: false,
  };
  const take = (arg, index) => arg.includes("=")
    ? [arg.slice(arg.indexOf("=") + 1), index]
    : [argv[index + 1] ?? "", index + 1];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--github-output") options.githubOutput = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (/^--(?:preliminary|impact-file|files-from|base|head)(?:=|$)/.test(arg)) {
      const key = arg.match(/^--([\w-]+)/)?.[1];
      const [value, nextIndex] = take(arg, index);
      index = nextIndex;
      if (!value) throw new Error(`missing value for --${key}`);
      if (key === "impact-file") options.impactFile = value;
      else if (key === "files-from") options.filesFrom = value;
      else options[key] = value;
    } else throw new Error(`unknown option: ${arg}`);
  }

  return options;
}

function readJsonOrNull(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) {
      console.log("Usage: node scripts/ci/refine-provider-impact.mjs --preliminary <decision> --impact-file <path> --files-from <path> --base <sha> --head <sha> [--json] [--github-output]");
      return;
    }

    for (const key of ["preliminary", "impactFile", "filesFrom", "base", "head"]) {
      if (!options[key]) throw new Error(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`);
    }

    const changedPaths = fs.readFileSync(options.filesFrom, "utf8").split(/\r?\n/).filter(Boolean);
    const impact = readJsonOrNull(options.impactFile);
    const result = refineProviderImpact({
      preliminaryDecision: options.preliminary,
      changedPaths,
      impact,
      base: options.base,
      head: options.head,
    });

    if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else console.log(`[provider-impact-refine] decision=${result.decision} needs_cloudflare_package=${result.needsCloudflarePackage} reason=${result.reason}`);

    if (options.githubOutput) {
      if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required for --github-output");
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${githubOutputLines(result).join("\n")}\n`);
    }
  } catch (error) {
    console.error(`[provider-impact-refine] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
