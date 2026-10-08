import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const APP_DIR = path.join(REPO_ROOT, "app");
const ROUTES_SSOT_PATH = path.join(REPO_ROOT, "lib", "standards", "routes.ts");
const ALLOWLIST_PATH = path.join(SCRIPT_DIR, "allowlist.json");

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
  "public",
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const API_PATH_EXCLUDE_PREFIXES = ["lib/standards/", "scripts/", "docs/"];
const DTO_SCAN_SCOPE = {
  includePrefixes: ["app/api/", "app/dashboard/", "lib/data/", "lib/hooks/"],
  excludePrefixes: [
    "scripts/",
    "docs/",
    "lib/contracts/",
    "lib/api/client.generated.ts",
    "lib/standards/",
  ],
};

const FIELD_VARIANTS = [
  { camel: "boardId", snake: "board_id" },
  { camel: "wallId", snake: "wall_id" },
  { camel: "shareCode", snake: "share_code" },
  { camel: "sessionId", snake: "session_id" },
  { camel: "fileId", snake: "file_id" },
  { camel: "requestId", snake: "request_id" },
  { camel: "cardId", snake: "card_id" },
  { camel: "classId", snake: "class_id" },
  { camel: "userId", snake: "user_id" },
  { camel: "token", snake: "token" },
];

const toPosixPath = (value) => value.split(path.sep).join("/");

const shouldIgnoreDir = (entry) => IGNORED_DIRS.has(entry);

const isSourceFile = (filePath) => SOURCE_EXTENSIONS.has(path.extname(filePath));

const isExcludedByPrefix = (relativePath, prefixes) =>
  prefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(prefix));

const isInScope = (relativePath, scope) => {
  const included = scope.includePrefixes.some(
    (prefix) => relativePath === prefix || relativePath.startsWith(prefix)
  );
  if (!included) return false;
  return !scope.excludePrefixes.some(
    (prefix) => relativePath === prefix || relativePath.startsWith(prefix)
  );
};

const getLineNumber = (content, index) => {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === "\n") line += 1;
  }
  return line;
};

const walk = async (dir, result = []) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldIgnoreDir(entry.name)) continue;
      await walk(fullPath, result);
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
};

const normalizeRoutePath = (segments) => {
  const filtered = segments.filter((segment) => {
    if (!segment) return false;
    if (segment.startsWith("@")) return false;
    if (segment.startsWith("(") && segment.endsWith(")")) return false;
    return true;
  });
  if (filtered.length === 0) return "/";
  return `/${filtered.join("/")}`;
};

const parseApiRoutePath = (filePath) => {
  const relative = path.relative(APP_DIR, filePath);
  const parts = toPosixPath(relative).split("/");
  const trimmed = parts.slice(0, -1);
  return normalizeRoutePath(trimmed);
};

const parsePageRoutePath = (filePath) => {
  const relative = path.relative(APP_DIR, filePath);
  const parts = toPosixPath(relative).split("/");
  const trimmed = parts.slice(0, -1);
  return normalizeRoutePath(trimmed);
};

const loadAllowlist = async () => {
  try {
    const raw = await fs.readFile(ALLOWLIST_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      apiV1Hardcoded: [],
      snakeCaseKeys: [],
      hardcodedApiPaths: [],
      fieldVariantKeys: [],
      unsafeApiPaths: [],
      snakeCaseResponseKeys: [],
    };
  }
};

const collectApiRoutes = async (routeFiles) => {
  const apiRoutes = [];
  for (const filePath of routeFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const methods = new Set();
    const regex = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      methods.add(match[1]);
    }
    const routePath = parseApiRoutePath(filePath);
    apiRoutes.push({
      path: routePath,
      file: toPosixPath(path.relative(REPO_ROOT, filePath)),
      methods: Array.from(methods),
    });
  }
  return apiRoutes;
};

const collectPageRoutes = async (pageFiles) => {
  return pageFiles.map((filePath) => ({
    path: parsePageRoutePath(filePath),
    file: toPosixPath(path.relative(REPO_ROOT, filePath)),
  }));
};

const extractStringLiteralMatches = (content, regex) => {
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push({ value: match[2], index: match.index });
  }
  return matches;
};

const collectHardcodedApiPaths = (content, regex, filePath, allowlist, allowlistKey) => {
  return extractStringLiteralMatches(content, regex).map(({ value, index }) => {
    const line = getLineNumber(content, index);
    const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
    const key = `${relative}::${value}`;
    const allowed = (allowlist[allowlistKey] || []).includes(key);
    return { file: relative, value, line, allowed };
  });
};

const collectSnakeCaseKeys = (content, filePath, allowlist) => {
  const regex = /['"`]([a-z]+_[a-z0-9_]+)['"`]/g;
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    const line = getLineNumber(content, match.index);
    const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
    const allowKey = `${relative}::${key}`;
    const allowed = (allowlist.snakeCaseKeys || []).includes(allowKey);
    matches.push({ file: relative, key, line, allowed });
  }
  return matches;
};

const collectUnsafeApiPaths = (content, filePath, allowlist) => {
  const regex = /unsafeApiPath\s*\(\s*(['"`])([^'"`]+)\1/g;
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const value = match[2];
    if (!value.startsWith("/api/")) continue;
    const line = getLineNumber(content, match.index);
    const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
    const allowKey = `${relative}::${value}`;
    const allowed = (allowlist.unsafeApiPaths || []).includes(allowKey);
    matches.push({ file: relative, value, line, allowed });
  }
  return matches;
};

// Inspect response payload expressions, not a character window around a helper
// name. Nearby DB writes, log payloads and error-code strings are not DTO keys.
export const collectSnakeCaseResponseKeys = (content, filePath, allowlist = {}) => {
  const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
  const payloadArgument = new Map([["jsonOk", 0], ["jsonOkWithRequestId", 0], ["jsonError", 3], ["jsonErrorWithRequestId", 4]]);
  if (!/\bjson(?:Ok|Error)(?:WithRequestId)?\s*\(/.test(content)) return [];
  const absoluteFilePath = path.resolve(filePath);
  const canonicalCompilerPath = (value) => {
    const resolved = path.resolve(value);
    return ts.sys.useCaseSensitiveFileNames
      ? resolved
      : resolved.toLowerCase();
  };
  const targetCompilerPath = canonicalCompilerPath(absoluteFilePath);

  const parsedSource = ts.createSourceFile(
    absoluteFilePath,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  if (parsedSource.parseDiagnostics.length) {
    throw new Error(
      `Cannot inspect response DTO keys in malformed source: ${relative}`,
    );
  }

  // A single-file, no-resolve checker binds local aliases with correct lexical
  // scope. Imported application modules are never read or executed.
  const options = { noLib: true, noResolve: true, allowJs: true };
  const host = {
    ...ts.createCompilerHost(options),
    getSourceFile: (name) =>
      canonicalCompilerPath(name) === targetCompilerPath
        ? parsedSource
        : undefined,
    readFile: (name) =>
      canonicalCompilerPath(name) === targetCompilerPath
        ? content
        : undefined,
    fileExists: (name) =>
      canonicalCompilerPath(name) === targetCompilerPath,
    writeFile: () => {},
  };

  const program = ts.createProgram(
    [absoluteFilePath],
    options,
    host,
  );
  const source = program.getSourceFile(absoluteFilePath);

  if (!source) {
    throw new Error(
      `Cannot bind response DTO source: ${relative}`,
    );
  }

  const checker = program.getTypeChecker();
  const matches = [];
  const seen = new Set();
  const inspected = new Set();
  const inspect = (node) => {
    if (!node || inspected.has(node)) return;
    inspected.add(node);
    if (ts.isIdentifier(node)) {
      const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
      if (declaration && ts.isVariableDeclaration(declaration)) inspect(declaration.initializer);
    } else if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) { inspect(property.expression); continue; }
        const name = property.name;
        const literalName = name && ts.isComputedPropertyName(name) ? name.expression : name;
        const key = literalName && (ts.isIdentifier(literalName) && !ts.isComputedPropertyName(name)
          || ts.isStringLiteral(literalName) || ts.isNoSubstitutionTemplateLiteral(literalName)) ? literalName.text : null;
        const line = source.getLineAndCharacterOfPosition(property.getStart(source)).line + 1;
        const allowKey = `${relative}::${key}`;
        const dedupeKey = `${allowKey}::${line}`;
        if (key && /^[a-z]+_[a-z0-9_]+$/.test(key) && !seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          matches.push({ file: relative, key, line, allowed: (allowlist.snakeCaseResponseKeys || []).includes(allowKey) });
        }
        if (ts.isPropertyAssignment(property)) inspect(property.initializer);
        else if (ts.isShorthandPropertyAssignment(property)) {
          const declaration = checker.getShorthandAssignmentValueSymbol(property)?.valueDeclaration;
          if (declaration && ts.isVariableDeclaration(declaration)) inspect(declaration.initializer);
        }
      }
    } else if (ts.isArrayLiteralExpression(node)) node.elements.forEach(inspect);
    else if (ts.isConditionalExpression(node)) { inspect(node.whenTrue); inspect(node.whenFalse); }
    else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node) || ts.isSpreadElement(node)) inspect(node.expression);
  };
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : "";
      if (payloadArgument.has(name)) inspect(node.arguments[payloadArgument.get(name)]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return matches;
};

const collectFieldVariants = (content, filePath, allowlist) => {
  const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
  const occurrences = [];
  for (const variant of FIELD_VARIANTS) {
    const camelRegex = new RegExp(`\\b${variant.camel}\\b`, "g");
    const snakeRegex = new RegExp(`\\b${variant.snake}\\b`, "g");
    let match;
    while ((match = camelRegex.exec(content)) !== null) {
      const allowKey = `${variant.camel}::${relative}`;
      const allowed = (allowlist.fieldVariantKeys || []).includes(allowKey);
      occurrences.push({
        field: variant.camel,
        variant: variant.camel,
        file: relative,
        line: getLineNumber(content, match.index),
        allowed,
      });
    }
    while ((match = snakeRegex.exec(content)) !== null) {
      const allowKey = `${variant.snake}::${relative}`;
      const allowed = (allowlist.fieldVariantKeys || []).includes(allowKey);
      occurrences.push({
        field: variant.camel,
        variant: variant.snake,
        file: relative,
        line: getLineNumber(content, match.index),
        allowed,
      });
    }
  }
  return occurrences;
};

const extractStandardsApiPaths = async () => {
  try {
    const content = await fs.readFile(ROUTES_SSOT_PATH, "utf8");
    const regex = /['"`]\/(api\/[^'"`]+)['"`]/g;
    const matches = new Set();
    let match;
    while ((match = regex.exec(content)) !== null) {
      matches.add(`/${match[1]}`);
    }
    return matches;
  } catch {
    return new Set();
  }
};

const findDuplicateApiRoutes = (apiRoutes) => {
  const map = new Map();
  for (const route of apiRoutes) {
    const methods = route.methods.length ? route.methods : ["UNKNOWN"];
    for (const method of methods) {
      const key = `${method} ${route.path}`;
      const existing = map.get(key) || [];
      existing.push(route.file);
      map.set(key, existing);
    }
  }
  const duplicates = [];
  for (const [key, files] of map.entries()) {
    if (files.length > 1) {
      duplicates.push({ endpoint: key, files });
    }
  }
  return duplicates;
};

export const scanRepository = async ({ writeInventory = false } = {}) => {
  const allowlist = await loadAllowlist();
  const files = await walk(REPO_ROOT);
  const routeFiles = files.filter((filePath) =>
    toPosixPath(filePath).includes("/app/api/") && filePath.endsWith("/route.ts")
  );
  const pageFiles = files.filter((filePath) => filePath.endsWith("/page.tsx"));
  const apiRoutes = await collectApiRoutes(routeFiles);
  const pageRoutes = await collectPageRoutes(pageFiles);
  const standardsApiPaths = await extractStandardsApiPaths();

  const hardcodedApiV1 = [];
  const hardcodedApiPaths = [];
  const snakeCaseKeys = [];
  const fieldVariants = [];
  const unsafeApiPaths = [];
  const snakeCaseResponseKeys = [];

  for (const filePath of files) {
    if (!isSourceFile(filePath)) continue;
    const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
    const isApiPathExcluded = isExcludedByPrefix(relative, API_PATH_EXCLUDE_PREFIXES);
    const isDtoScanTarget = isInScope(relative, DTO_SCAN_SCOPE);
    const content = await fs.readFile(filePath, "utf8");
    if (!isApiPathExcluded) {
      const apiV1Matches = collectHardcodedApiPaths(
        content,
        /(['"`])(\/api\/v1\/[^'"`]*)\1/g,
        filePath,
        allowlist,
        "apiV1Hardcoded"
      );
      hardcodedApiV1.push(...apiV1Matches);

      const apiMatches = collectHardcodedApiPaths(
        content,
        /(['"`])(\/api\/[^'"`]*)\1/g,
        filePath,
        allowlist,
        "hardcodedApiPaths"
      ).map((item) => ({
        ...item,
        inStandards: standardsApiPaths.has(item.value),
      }));
      hardcodedApiPaths.push(...apiMatches);
    }

    unsafeApiPaths.push(...collectUnsafeApiPaths(content, filePath, allowlist));

    if (isDtoScanTarget) {
      snakeCaseKeys.push(...collectSnakeCaseKeys(content, filePath, allowlist));
      snakeCaseResponseKeys.push(...collectSnakeCaseResponseKeys(content, filePath, allowlist));
    }

    if (isDtoScanTarget) {
      fieldVariants.push(...collectFieldVariants(content, filePath, allowlist));
    }
  }

  const duplicates = {
    apiRoutes: findDuplicateApiRoutes(apiRoutes),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    routes: {
      api: apiRoutes.sort((a, b) => a.path.localeCompare(b.path)),
      pages: pageRoutes.sort((a, b) => a.path.localeCompare(b.path)),
    },
    hardcodedApiV1,
    hardcodedApiPaths,
    snakeCaseKeys,
    unsafeApiPaths,
    snakeCaseResponseKeys,
    fieldVariants,
    duplicates,
  };

  if (writeInventory) {
    await writeInventoryFiles(report);
  }

  return report;
};

export const writeInventoryFiles = async (report) => {
  const docsDir = path.join(REPO_ROOT, "docs", "security");
  await fs.mkdir(docsDir, { recursive: true });
  const jsonPath = path.join(docsDir, "duplication-inventory.json");
  const reportDir = path.join(REPO_ROOT, ".cache", "audit");
  await fs.mkdir(reportDir, { recursive: true });
  const mdPath = path.join(reportDir, "duplication-inventory.md");

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const summaryLines = [];
  summaryLines.push(`# Duplication Inventory`);
  summaryLines.push("");
  summaryLines.push(`- Generated: ${report.generatedAt}`);
  summaryLines.push(`- API routes: ${report.routes.api.length}`);
  summaryLines.push(`- Page routes: ${report.routes.pages.length}`);
  summaryLines.push(`- Hardcoded /api/v1/: ${report.hardcodedApiV1.length}`);
  summaryLines.push(`- Snake_case keys in API routes: ${report.snakeCaseKeys.length}`);
  summaryLines.push(`- unsafeApiPath usages: ${report.unsafeApiPaths.length}`);
  summaryLines.push(`- snake_case keys near response DTOs: ${report.snakeCaseResponseKeys.length}`);
  summaryLines.push("");

  const formatList = (items, format) =>
    items.length
      ? items.map((item) => `- ${format(item)}`).join("\n")
      : "- (none)";

  summaryLines.push("## API Routes");
  summaryLines.push(formatList(report.routes.api, (item) => `${item.path} (${item.methods.join(", ") || "-"})`));
  summaryLines.push("");

  summaryLines.push("## Page Routes");
  summaryLines.push(formatList(report.routes.pages, (item) => item.path));
  summaryLines.push("");

  summaryLines.push("## Hardcoded /api/v1/ Usage");
  summaryLines.push(formatList(report.hardcodedApiV1, (item) => `${item.file}:${item.line} → ${item.value}`));
  summaryLines.push("");

  summaryLines.push("## Hardcoded /api/ Usage (All)");
  summaryLines.push(formatList(report.hardcodedApiPaths, (item) => `${item.file}:${item.line} → ${item.value}`));
  summaryLines.push("");

  summaryLines.push("## snake_case Keys in API Routes");
  summaryLines.push(formatList(report.snakeCaseKeys, (item) => `${item.file}:${item.line} → ${item.key}`));
  summaryLines.push("");

  summaryLines.push("## unsafeApiPath Usage");
  summaryLines.push(formatList(report.unsafeApiPaths, (item) => `${item.file}:${item.line} → ${item.value}`));
  summaryLines.push("");

  summaryLines.push("## snake_case Keys near API Responses");
  summaryLines.push(formatList(report.snakeCaseResponseKeys, (item) => `${item.file}:${item.line} → ${item.key}`));
  summaryLines.push("");

  summaryLines.push("## Field Variant Occurrences");
  summaryLines.push(formatList(report.fieldVariants, (item) => `${item.file}:${item.line} → ${item.variant}`));
  summaryLines.push("");

  summaryLines.push("## Duplicate API Endpoints");
  summaryLines.push(formatList(report.duplicates.apiRoutes, (item) => `${item.endpoint} (${item.files.join(", ")})`));
  summaryLines.push("");

  await fs.writeFile(mdPath, `${summaryLines.join("\n")}\n`, "utf8");
};

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  scanRepository({ writeInventory: true }).catch((error) => {
    console.error("[duplication:scan] Failed", error);
    process.exit(1);
  });
}
