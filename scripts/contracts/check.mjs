import { promises as fs, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

require.extensions[".ts"] = (loadedModule, filename) => {
  const source = readFileSync(filename, "utf8");
  const { code } = esbuild.transformSync(source, {
    loader: "ts",
    format: "cjs",
    target: "es2020",
  });
  loadedModule._compile(code, filename);
};

const { api } = require("../../lib/contracts/api.ts");

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const REPORT_PATH = path.join(REPO_ROOT, "docs", "security", "selfcheck-report.json");
const BASELINE_PATH = path.join(SCRIPT_DIR, "baseline.json");
const LAST_CHECK_PATH = path.join(SCRIPT_DIR, "last-check.json");
const MAX_MISSING_OUTPUT = 50;

const args = new Set(process.argv.slice(2));
const updateBaseline = args.has("--update-baseline");
const failOnNewMissing = args.has("--fail-on-new-missing") || args.has("--missing-contract-error");

const isRoute = (value) => Boolean(value && typeof value === "object" && value.kind === "route");

const collectRoutes = (node, prefix = []) => {
  const routes = [];
  for (const [key, value] of Object.entries(node ?? {})) {
    if (isRoute(value)) {
      routes.push({ id: [...prefix, key].join("."), ...value });
    } else if (value && typeof value === "object") {
      routes.push(...collectRoutes(value, [...prefix, key]));
    }
  }
  return routes;
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const loadBaseline = async () => {
  try {
    const raw = await fs.readFile(BASELINE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      missing_in_contract: ensureArray(parsed.missing_in_contract),
      extra_in_contract: ensureArray(parsed.extra_in_contract),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const saveBaseline = async (baseline) => {
  await fs.writeFile(BASELINE_PATH, JSON.stringify(baseline, null, 2));
};

const saveLastCheck = async (result) => {
  await fs.writeFile(LAST_CHECK_PATH, JSON.stringify(result, null, 2));
};

const loadAppRoutes = async () => {
  const raw = await fs.readFile(REPORT_PATH, "utf8");
  const report = JSON.parse(raw);
  const apiRoutes = report?.routes?.appRouter?.api ?? [];
  return apiRoutes
    .map((route) => route.pathNormalized || route.path)
    .filter((route) => typeof route === "string" && route.startsWith("/api/v1/"));
};

const normalizePath = (value) => {
  if (typeof value !== "string") return value;
  return value.replace(/%3A/gi, ":");
};

const getContractPath = (route) => route.pathTemplate ?? route.path;

const contractEntries = collectRoutes(api).map((route) => {
  const pathValue = getContractPath(route);
  return {
    id: route.id,
    method: route.method,
    path: pathValue,
    normalizedPath: normalizePath(pathValue),
  };
});

const invalidPaths = [];
const encodedPlaceholderPattern = /%3A/i;
const invalidParamPattern = /\/:%/;

for (const route of contractEntries) {
  if (typeof route.path !== "string") continue;
  if (encodedPlaceholderPattern.test(route.path)) {
    invalidPaths.push({
      id: route.id,
      method: route.method,
      path: route.path,
      reason: "Encoded placeholder (%3A) is not allowed.",
    });
  }
  if (invalidParamPattern.test(route.path)) {
    invalidPaths.push({
      id: route.id,
      method: route.method,
      path: route.path,
      reason: "Invalid parameter pattern (/:%).",
    });
  }
}

const contractRoutes = contractEntries.map((route) => route.normalizedPath).filter(Boolean);
const appRoutes = (await loadAppRoutes()).map((route) => normalizePath(route));

const uniqueContractRoutes = [...new Set(contractRoutes)];
const contractSet = new Set(uniqueContractRoutes);
const appSet = new Set(appRoutes);

const extraInContract = uniqueContractRoutes.filter((route) => !appSet.has(route));
const missingInContract = appRoutes.filter((route) => !contractSet.has(route));

const baseline = await loadBaseline();
const baselineMissing = new Set(baseline?.missing_in_contract ?? []);
const baselineHasData = Boolean(baseline);

const missingInContractSet = new Set(missingInContract);
const newMissing = baselineHasData
  ? missingInContract.filter((route) => !baselineMissing.has(route))
  : missingInContract;
const resolvedMissing = baselineHasData
  ? [...baselineMissing].filter((route) => !missingInContractSet.has(route))
  : [];

const contractKeyCounts = contractEntries.reduce((acc, route) => {
  const key = `${route.method} ${route.path}`;
  acc.set(key, (acc.get(key) ?? 0) + 1);
  return acc;
}, new Map());
const duplicateContracts = [...contractKeyCounts.entries()].filter(([, count]) => count > 1);

await saveLastCheck({
  missing_in_contract: missingInContract,
  extra_in_contract: extraInContract,
  duplicate_contracts: duplicateContracts.map(([key, count]) => ({ key, count })),
  invalid_contract_paths: invalidPaths,
});

if (updateBaseline) {
  await saveBaseline({
    missing_in_contract: missingInContract,
    extra_in_contract: extraInContract,
  });
  console.log(
    `[contracts] Baseline updated with ${missingInContract.length} missing and ${extraInContract.length} extra contract routes.`,
  );
}

if (!baselineHasData && !updateBaseline) {
  console.warn(
    `[contracts] WARN: Baseline not found at ${path.relative(REPO_ROOT, BASELINE_PATH)}. Run "node scripts/contracts/check.mjs --update-baseline" to create it.`,
  );
}

if (duplicateContracts.length) {
  console.error("[contracts] ERROR: Duplicate contract routes detected:");
  duplicateContracts.forEach(([key, count]) => console.error(`  - ${key} (${count})`));
}

if (invalidPaths.length) {
  console.error("[contracts] ERROR: Invalid contract route paths detected:");
  invalidPaths.forEach((route) => {
    console.error(`  - ${route.method} ${route.path} (${route.id}): ${route.reason}`);
  });
}

if (extraInContract.length) {
  console.error("[contracts] ERROR: Contract routes without app router files:");
  extraInContract.forEach((route) => console.error(`  - ${route}`));
}

const printMissingRoutes = (routes, printer) => {
  const limited = routes.slice(0, MAX_MISSING_OUTPUT);
  limited.forEach((route) => printer(`  - ${route}`));
  const remaining = routes.length - limited.length;
  if (remaining > 0) {
    printer(`  ... and ${remaining} more`);
  }
};

if (!updateBaseline) {
  if (baselineHasData) {
    if (newMissing.length) {
      const level = failOnNewMissing ? "ERROR" : "WARN";
      const printer = failOnNewMissing ? console.error : console.warn;
      printer(`[contracts] ${level}: New app routes missing from contract registry:`);
      printMissingRoutes(newMissing, printer);
    }

    if (resolvedMissing.length) {
      console.log(
        `[contracts] Resolved missing routes since baseline: ${resolvedMissing.length}.`,
      );
    }
  } else if (missingInContract.length) {
    console.warn("[contracts] WARN: App routes missing from contract registry:");
    missingInContract.forEach((route) => console.warn(`  - ${route}`));
  }
}

if (duplicateContracts.length || invalidPaths.length || extraInContract.length) {
  process.exit(1);
}

if (failOnNewMissing && baselineHasData && newMissing.length) {
  process.exit(1);
}

console.log("[contracts] Contract check complete.");
