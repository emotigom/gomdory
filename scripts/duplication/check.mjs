import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { scanRepository } from "./scan.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(SCRIPT_DIR, "baseline.json");
const ROUTES_SSOT_FILE = "lib/standards/routes.ts";

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const shouldUpdateBaseline = args.has("--update-baseline");
const unsafeModeArg = rawArgs.find((arg) => arg.startsWith("--unsafe-api-path="));
const unsafeMode =
  unsafeModeArg?.split("=")[1] ?? process.env.UNSAFE_API_PATH_MODE ?? "warn";

const loadBaseline = async () => {
  const raw = await fs.readFile(BASELINE_PATH, "utf8");
  return JSON.parse(raw);
};

const toKey = (item, field) => `${item.file}::${item[field]}`;
const isInAppCodeScope = (file) =>
  (file.startsWith("app/") || file.startsWith("lib/")) && !file.startsWith("lib/standards/");

const buildBaseline = (report) => ({
  generatedAt: new Date().toISOString(),
  hardcodedApiV1: report.hardcodedApiV1
    .filter((item) => !item.allowed && isInAppCodeScope(item.file))
    .map((item) => toKey(item, "value")),
  snakeCaseKeys: report.snakeCaseKeys.filter((item) => !item.allowed).map((item) => toKey(item, "key")),
  snakeCaseResponseKeys: report.snakeCaseResponseKeys.filter((item) => !item.allowed).map((item) => toKey(item, "key")),
  hardcodedApiPaths: report.hardcodedApiPaths.filter((item) => !item.allowed).map((item) => toKey(item, "value")),
  unsafeApiPaths: report.unsafeApiPaths.filter((item) => !item.allowed).map((item) => toKey(item, "value")),
  fieldVariants: report.fieldVariants
    .filter((item) => !item.allowed && isInAppCodeScope(item.file))
    .map((item) => `${item.file}::${item.variant}`),
  duplicateApiEndpoints: report.duplicates.apiRoutes.map((item) => item.endpoint),
});

const diffNewEntries = (current, baseline) => {
  const baselineSet = new Set(baseline);
  return current.filter((entry) => !baselineSet.has(entry));
};

const formatList = (items) => items.map((item) => `  - ${item}`).join("\n");

const run = async () => {
  const report = await scanRepository({ writeInventory: false });
  const baselineData = buildBaseline(report);

  if (shouldUpdateBaseline) {
    await fs.writeFile(BASELINE_PATH, `${JSON.stringify(baselineData, null, 2)}\n`, "utf8");
    console.log("[duplication:check] Baseline updated.");
    return;
  }

  let baseline;
  try {
    baseline = await loadBaseline();
  } catch (error) {
    console.error("[duplication:check] Missing baseline.json. Run: node scripts/duplication/check.mjs --update-baseline");
    process.exit(1);
  }

  const errors = [];
  const warnings = [];

  const newHardcodedApiV1 = diffNewEntries(
    baselineData.hardcodedApiV1,
    baseline.hardcodedApiV1 || []
  );
  if (newHardcodedApiV1.length) {
    errors.push("New hardcoded /api/v1/ paths detected:");
    errors.push(formatList(newHardcodedApiV1));
  }

  const newDuplicateEndpoints = diffNewEntries(
    baselineData.duplicateApiEndpoints,
    baseline.duplicateApiEndpoints || []
  );
  if (newDuplicateEndpoints.length) {
    errors.push("New duplicate API endpoints detected:");
    errors.push(formatList(newDuplicateEndpoints));
  }

  const newSnakeCaseKeys = diffNewEntries(
    baselineData.snakeCaseKeys,
    baseline.snakeCaseKeys || []
  );
  if (newSnakeCaseKeys.length) {
    warnings.push("New snake_case keys in API routes detected:");
    warnings.push(formatList(newSnakeCaseKeys));
  }

  const newSnakeCaseResponseKeys = diffNewEntries(
    baselineData.snakeCaseResponseKeys,
    baseline.snakeCaseResponseKeys || []
  );
  if (newSnakeCaseResponseKeys.length) {
    errors.push("New snake_case keys near API response DTOs detected:");
    errors.push(formatList(newSnakeCaseResponseKeys));
  }

  const newHardcodedApiPaths = diffNewEntries(
    baselineData.hardcodedApiPaths,
    baseline.hardcodedApiPaths || []
  );
  if (newHardcodedApiPaths.length) {
    warnings.push("New hardcoded /api/ paths detected (verify routes.ts usage):");
    warnings.push(formatList(newHardcodedApiPaths));
  }

  const newFieldVariants = diffNewEntries(
    baselineData.fieldVariants,
    baseline.fieldVariants || []
  );
  if (newFieldVariants.length) {
    warnings.push("New mixed field variants detected:");
    warnings.push(formatList(newFieldVariants));
  }

  const newUnsafeApiPaths = diffNewEntries(
    baselineData.unsafeApiPaths,
    baseline.unsafeApiPaths || []
  );
  if (newUnsafeApiPaths.length) {
    const ssotUnsafe = newUnsafeApiPaths.filter((entry) =>
      entry.startsWith(`${ROUTES_SSOT_FILE}::`)
    );
    const otherUnsafe = newUnsafeApiPaths.filter(
      (entry) => !entry.startsWith(`${ROUTES_SSOT_FILE}::`)
    );
    if (ssotUnsafe.length) {
      errors.push("unsafeApiPath usage detected in routes.ts (SSOT must be safe):");
      errors.push(formatList(ssotUnsafe));
    }
    if (otherUnsafe.length) {
      const header = "New unsafeApiPath usages detected (migrate to routes.ts):";
      if (unsafeMode === "error") {
        errors.push(header);
        errors.push(formatList(otherUnsafe));
      } else {
        warnings.push(header);
        warnings.push(formatList(otherUnsafe));
      }
    }
  }

  if (warnings.length) {
    console.warn("[duplication:check] Warnings:\n" + warnings.join("\n"));
  }

  if (errors.length) {
    console.error("[duplication:check] Errors:\n" + errors.join("\n"));
    console.error("[duplication:check] Run `npm run audit:duplication` to see the latest inventory.");
    process.exit(1);
  }

  console.log("[duplication:check] OK");
};

run().catch((error) => {
  console.error("[duplication:check] Failed", error);
  process.exit(1);
});
