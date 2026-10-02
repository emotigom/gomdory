import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const REPORT_PATH = path.join(REPO_ROOT, "docs", "security", "selfcheck-report.json");
const ROUTES_PATH = path.join(REPO_ROOT, "lib", "standards", "routes.ts");
const DEFAULT_LIMIT = 20;

const ALLOWED_MAPPINGS = [
  {
    value: "/api/v1/template-collections",
    builderCall: "routes.api.templateCollections.root()",
  },
  {
    value: String.raw`/api/v1/template-collections/\${slug}`,
    builderCall: "routes.api.templateCollections.bySlug(slug)",
  },
  {
    value: String.raw`/api/v1/templates/\${templateId}`,
    builderCall: "routes.api.templates.byId(templateId)",
  },
  {
    value: String.raw`/api/v1/templates/\${templateId}/copy`,
    builderCall: "routes.api.templates.copy(templateId)",
  },
  {
    value: String.raw`/api/v1/templates/\${templateId}/report`,
    builderCall: "routes.api.templates.report(templateId)",
  },
  {
    value: "/api/v1/billing/plan",
    builderCall: "routes.api.billing.plan()",
  },
  {
    value: "/api/v1/billing/upgrade-request",
    builderCall: "routes.api.billing.upgradeRequest()",
  },
  {
    value: "/api/v1/onboarding/demo",
    builderCall: "routes.api.onboarding.demo()",
  },
  {
    value: String.raw`/api/v1/boards/\${boardId}/share/ensure`,
    builderCall: "routes.api.boards.shareEnsure(boardId)",
  },
  {
    value: String.raw`/api/v1/boards/\${boardId}/share-settings`,
    builderCall: "routes.api.boards.shareSettings(boardId)",
  },
  {
    value: String.raw`/api/v1/files/\${fileId}/view`,
    builderCall: "routes.api.files.view(fileId)",
  },
  {
    value: String.raw`/api/v1/files/\${fileId}/download`,
    builderCall: "routes.api.files.download(fileId)",
  },
  {
    value: String.raw`/api/v1/share/\${code}/files/\${fileId}/download`,
    builderCall: "routes.api.share.files.download(code, fileId)",
  },
  {
    value: String.raw`/api/v1/s/\${code}/requests`,
    builderCall: "routes.api.s.requests(code)",
  },
  {
    value: "/api/v1/showcase/ensure",
    builderCall: "routes.api.showcase.ensure()",
  },
  {
    value: String.raw`/api/v1/showcase/\${token}/refresh`,
    builderCall: "routes.api.showcase.refresh(token)",
  },
  {
    value: String.raw`/api/v1/showcase/\${token}/revoke`,
    builderCall: "routes.api.showcase.revoke(token)",
  },
  {
    value: String.raw`/api/v1/showcase/\${token}/template`,
    builderCall: "routes.api.showcase.template(token)",
  },
  {
    value: "/api/v1/exhibits/ensure",
    builderCall: "routes.api.exhibits.ensure()",
  },
  {
    value: String.raw`/api/v1/exhibits/\${exhibitId}/refresh`,
    builderCall: "routes.api.exhibits.refresh(exhibitId)",
  },
  {
    value: String.raw`/api/v1/exhibits/\${exhibitId}/revoke`,
    builderCall: "routes.api.exhibits.revoke(exhibitId)",
  },
];

const ALLOWED_VALUE_MAP = new Map(ALLOWED_MAPPINGS.map((mapping) => [mapping.value, mapping]));

const parseArgs = () => {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const limitIndex = args.findIndex((arg) => arg === "--limit");
  let limit = DEFAULT_LIMIT;
  if (limitIndex !== -1) {
    const raw = args[limitIndex + 1];
    const parsed = Number(raw);
    if (!Number.isNaN(parsed) && parsed > 0) {
      limit = parsed;
    }
  }
  return {
    apply,
    dryRun: !apply,
    limit,
  };
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

const loadReport = async () => {
  const raw = await fs.readFile(REPORT_PATH, "utf8");
  return JSON.parse(raw);
};

const collectCandidates = (report) => {
  return (
    report?.usage?.hardcodedApiPaths ||
    report?.usage?.hardcodedApiV1 ||
    report?.suggestions?.hardcoded_api_paths?.candidates ||
    []
  );
};

const shouldAttemptValue = (value) => typeof value === "string" && ALLOWED_VALUE_MAP.has(value);

const applyFixes = async ({ apply, limit }) => {
  const report = await loadReport();
  const routesContent = await fs.readFile(ROUTES_PATH, "utf8");
  const routeMap = buildApiRouteMap(routesContent);

  const rawCandidates = collectCandidates(report);
  const candidates = rawCandidates.filter((item) => shouldAttemptValue(item.value));
  const limited = candidates.slice(0, limit);

  const pending = [];
  const manual = [];

  for (const item of limited) {
    const allowed = ALLOWED_VALUE_MAP.get(item.value);
    const builderCall = routeMap.get(item.value);
    if (!builderCall) {
      manual.push({ ...item, reason: "missing-builder" });
      continue;
    }
    if (allowed && builderCall !== allowed.builderCall) {
      manual.push({ ...item, reason: "builder-mismatch" });
      continue;
    }
    pending.push({ ...item, builderCall });
  }

  if (pending.length === 0) {
    console.log("[selfcheck] No safe hardcoded API paths to report.");
  } else {
    console.log("[selfcheck] Safe mappings (no auto-apply):");
    for (const item of pending) {
      console.log(`- ${item.file}:${item.line} ${item.value} -> ${item.builderCall}`);
    }
  }

  if (manual.length > 0) {
    console.log("\n[selfcheck] Manual review candidates:");
    for (const item of manual) {
      console.log(`- ${item.file}:${item.line} ${item.value} (${item.reason})`);
    }
  }

  const touchedFiles = Array.from(new Set(pending.map((item) => item.file)));
  console.log(
    `\n[selfcheck] Summary: ${pending.length} mappings reported (apply disabled for TS/TSX).`
  );
  if (apply) {
    console.log("[selfcheck] Apply is disabled. Use the ts-morph codemod instead.");
  }
  if (touchedFiles.length > 0) {
    console.log(`[selfcheck] Files: ${touchedFiles.join(", ")}`);
  }

  console.log("\n[selfcheck] Next steps:");
  console.log("- Run the codemod for safe auto-fixes:");
  console.log("  node scripts/codemod/wrap-api-v1.mjs --apply --include app/");
  console.log("- Review manual candidates that require hand edits.");
};

const main = async () => {
  const options = parseArgs();
  await applyFixes(options);
};

main().catch((error) => {
  console.error("[selfcheck] Failed", error);
  process.exit(1);
});
