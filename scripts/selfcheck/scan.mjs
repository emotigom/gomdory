import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const APP_DIR = path.join(REPO_ROOT, "app");
const ROUTES_SSOT_PATH = path.join(REPO_ROOT, "lib", "standards", "routes.ts");
const ALLOWLIST_PATH = path.join(SCRIPT_DIR, "allowlist.json");
const REPORT_MD_PATH = path.join(REPO_ROOT, ".cache", "audit", "selfcheck-report.md");
const REPORT_JSON_PATH = path.join(REPO_ROOT, "docs", "security", "selfcheck-report.json");
const DEFAULT_LIMIT = 20;
const DEFAULT_HARDCODED_API_V1_SCOPE = {
  includePatterns: ["app/**", "lib/**"],
  excludePatterns: ["lib/standards/**", "scripts/**", "docs/**"],
};

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
const DTO_SCAN_SCOPE = {
  includePrefixes: ["app/api/", "app/dashboard/", "lib/data/", "lib/hooks/"],
  excludePrefixes: ["lib/contracts/", "lib/api/client.generated.ts", "lib/standards/"],
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

const isInScope = (relativePath, scope) => {
  const included = scope.includePrefixes.some(
    (prefix) => relativePath === prefix || relativePath.startsWith(prefix)
  );
  if (!included) return false;
  return !scope.excludePrefixes.some(
    (prefix) => relativePath === prefix || relativePath.startsWith(prefix)
  );
};

const normalizeRouteSegments = (segments) => {
  const filtered = segments.filter((segment) => {
    if (!segment) return false;
    if (segment.startsWith("@")) return false;
    if (segment.startsWith("(") && segment.endsWith(")")) return false;
    return true;
  });
  if (filtered.length === 0) return "/";
  const normalized = filtered.map((segment) => {
    if (segment.startsWith("[[...") && segment.endsWith("]]")) {
      const name = segment.slice(5, -2);
      return `:${name}*`;
    }
    if (segment.startsWith("[...") && segment.endsWith("]")) {
      const name = segment.slice(4, -1);
      return `:${name}*`;
    }
    if (segment.startsWith("[") && segment.endsWith("]")) {
      const name = segment.slice(1, -1);
      return `:${name}`;
    }
    return segment;
  });
  return `/${normalized.join("/")}`;
};

const parseRoutePath = (filePath) => {
  const relative = path.relative(APP_DIR, filePath);
  const parts = toPosixPath(relative).split("/");
  const trimmed = parts.slice(0, -1);
  return normalizeRouteSegments(trimmed);
};

const collectRouteFiles = (files, { isApi }) =>
  files.filter((filePath) => {
    const ext = path.extname(filePath);
    if (!SOURCE_EXTENSIONS.has(ext)) return false;
    const posix = toPosixPath(filePath);
    if (isApi) {
      return posix.includes("/app/api/") && /\/route\.(ts|tsx|js|jsx|mjs|cjs)$/.test(posix);
    }
    return /\/page\.(ts|tsx|js|jsx|mjs|cjs)$/.test(posix) && posix.includes("/app/");
  });

const stripCommentsAndStrings = (content) => {
  let result = "";
  let index = 0;
  let state = "code";

  while (index < content.length) {
    const char = content[index];
    const next = content[index + 1];

    if (state === "code") {
      if (char === "/" && next === "/") {
        result += "  ";
        index += 2;
        state = "lineComment";
      } else if (char === "/" && next === "*") {
        result += "  ";
        index += 2;
        state = "blockComment";
      } else if (char === "'" || char === '"' || char === "`") {
        result += " ";
        index += 1;
        state = char;
      } else {
        result += char;
        index += 1;
      }
      continue;
    }

    if (state === "lineComment") {
      result += char === "\n" ? "\n" : " ";
      index += 1;
      if (char === "\n") state = "code";
      continue;
    }

    if (state === "blockComment") {
      if (char === "*" && next === "/") {
        result += "  ";
        index += 2;
        state = "code";
      } else {
        result += char === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    result += char === "\n" ? "\n" : " ";
    index += 1;
    if (char === "\\" && index < content.length) {
      result += content[index] === "\n" ? "\n" : " ";
      index += 1;
    } else if (char === state) {
      state = "code";
    }
  }

  return result;
};

export const collectRouteMethods = (content) => {
  const methods = new Set();
  const source = stripCommentsAndStrings(content);
  const regex = /export\s+(?:(?:async)\s+)?(?:const|function)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    methods.add(match[1]);
  }
  return Array.from(methods);
};

const collectApiRoutes = async (routeFiles) => {
  const apiRoutes = [];
  for (const filePath of routeFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const routePath = parseRoutePath(filePath);
    apiRoutes.push({
      path: routePath,
      pathNormalized: routePath,
      file: toPosixPath(path.relative(REPO_ROOT, filePath)),
      methods: collectRouteMethods(content),
    });
  }
  return apiRoutes;
};

const collectPageRoutes = (pageFiles) =>
  pageFiles.map((filePath) => {
    const routePath = parseRoutePath(filePath);
    return {
      path: routePath,
      pathNormalized: routePath,
      file: toPosixPath(path.relative(REPO_ROOT, filePath)),
    };
  });

const loadAllowlist = async () => {
  try {
    const raw = await fs.readFile(ALLOWLIST_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      missingInSsot: [],
      missingRouteFile: [],
      hardcodedApiV1: DEFAULT_HARDCODED_API_V1_SCOPE,
    };
  }
};

const matchesPathPattern = (filePath, pattern) => {
  if (!pattern) return false;
  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3);
    return filePath.startsWith(base);
  }
  return filePath === pattern;
};

const resolveHardcodedApiV1Scope = (allowlist) => {
  const scoped = allowlist.hardcodedApiV1 || {};
  const includePatterns =
    Array.isArray(scoped.includePatterns) && scoped.includePatterns.length
      ? scoped.includePatterns
      : DEFAULT_HARDCODED_API_V1_SCOPE.includePatterns;
  const excludePatterns =
    Array.isArray(scoped.excludePatterns) && scoped.excludePatterns.length
      ? scoped.excludePatterns
      : DEFAULT_HARDCODED_API_V1_SCOPE.excludePatterns;
  return { includePatterns, excludePatterns };
};

const isHardcodedApiV1InScope = (filePath, scope) => {
  const includeMatch =
    !scope.includePatterns?.length ||
    scope.includePatterns.some((pattern) => matchesPathPattern(filePath, pattern));
  if (!includeMatch) return false;
  if (!scope.excludePatterns?.length) return true;
  return !scope.excludePatterns.some((pattern) => matchesPathPattern(filePath, pattern));
};

const normalizeSsotPath = (pathValue) => {
  if (!pathValue.startsWith("/")) return `/${pathValue}`;
  return pathValue;
};

const parseSsotRoutes = async () => {
  const content = await fs.readFile(ROUTES_SSOT_PATH, "utf8");
  const entries = [];
  const collect = (kind, regex) => {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const builder = match[1];
      const params = match[2];
      const raw = match[4];
      const dynamic = raw.includes("${");
      const pathNormalized = normalizeSsotPath(
        raw.replace(/\$\{[^}]+\}/g, ":param").replace(/\/+$/, "")
      );
      entries.push({
        kind,
        builder,
        params,
        path: raw,
        pathNormalized,
        dynamic,
        comparable: !params.includes("..."),
      });
    }
  };

  collect(
    "api",
    /(\w+)\s*:\s*\(([^)]*)\)\s*=>\s*apiPath\(\s*([`'"])([\s\S]*?)\3\s*\)/g
  );
  collect(
    "api",
    /(\w+)\s*:\s*\(([^)]*)\)\s*=>\s*apiPath\(\s*apiV1Path\(\s*([`'"])([\s\S]*?)\3\s*\)\s*\)/g
  );
  collect(
    "page",
    /(\w+)\s*:\s*\(([^)]*)\)\s*=>\s*pagePath\(\s*([`'"])([\s\S]*?)\3\s*\)/g
  );

  return entries;
};

const parseCallArguments = (content, startIndex) => {
  let index = startIndex;
  let depth = 1;
  let inString = null;
  let escaped = false;
  for (; index < content.length; index += 1) {
    const char = content[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      inString = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return content.slice(startIndex, index);
      }
    }
  }
  return content.slice(startIndex);
};

const collectApiFetchUsages = (content, filePath) => {
  const usages = [];
  const regex = /apiFetch\s*\(/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const startIndex = match.index + match[0].length;
    const args = parseCallArguments(content, startIndex);
    const line = getLineNumber(content, match.index);
    const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
    const hasRoutesApi = /routes\.api\./.test(args);
    const hasUnsafeApiPath = /unsafeApiPath\s*\(/.test(args);
    const hardcodedApiV1 = /['"`]\/api\/v1\//.test(args);
    const hardcodedApi = /['"`]\/api\//.test(args);
    usages.push({
      file: relative,
      line,
      hasRoutesApi,
      hasUnsafeApiPath,
      hardcodedApiV1,
      hardcodedApi,
    });
  }
  return usages;
};

const collectRouteUsage = (content, filePath, regex) => {
  const usages = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
    usages.push({ file: relative, line, token: match[0] });
  }
  return usages;
};

const collectStringLiteralMatches = (content, regex, filePath) => {
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const value = match[2];
    const line = getLineNumber(content, match.index);
    const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
    matches.push({ file: relative, line, value });
  }
  return matches;
};

const collectUnsafeApiPaths = (content, filePath) => {
  const regex = /unsafeApiPath\s*\(\s*(['"`])([^'"`]+)\1/g;
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const value = match[2];
    if (!value.startsWith("/api/")) continue;
    const line = getLineNumber(content, match.index);
    const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
    matches.push({ file: relative, line, value });
  }
  return matches;
};

const collectSnakeCaseKeys = (content, filePath) => {
  const regex = /['"`]([a-z]+_[a-z0-9_]+)['"`]/g;
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    const line = getLineNumber(content, match.index);
    const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
    matches.push({ file: relative, key, line });
  }
  return matches;
};

const collectSnakeCaseResponseKeys = (content, filePath) => {
  const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
  const responseCallRegex = /\bjson(?:Ok|Error)(?:WithRequestId)?\b/g;
  const keyRegex = /(?:['"`])?([a-z]+_[a-z0-9_]+)(?:['"`])?\s*:/g;
  const matches = [];
  const seen = new Set();
  let callMatch;
  while ((callMatch = responseCallRegex.exec(content)) !== null) {
    const windowStart = Math.max(0, callMatch.index - 200);
    const windowEnd = Math.min(content.length, callMatch.index + 400);
    const windowSlice = content.slice(windowStart, windowEnd);
    let keyMatch;
    while ((keyMatch = keyRegex.exec(windowSlice)) !== null) {
      const key = keyMatch[1];
      const absoluteIndex = windowStart + keyMatch.index;
      const line = getLineNumber(content, absoluteIndex);
      const dedupeKey = `${relative}::${key}::${line}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      matches.push({ file: relative, key, line });
    }
  }
  return matches;
};

const collectFieldVariants = (content, filePath) => {
  const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
  const occurrences = [];
  for (const variant of FIELD_VARIANTS) {
    const camelRegex = new RegExp(`\\b${variant.camel}\\b`, "g");
    const snakeRegex = new RegExp(`\\b${variant.snake}\\b`, "g");
    let match;
    while ((match = camelRegex.exec(content)) !== null) {
      occurrences.push({
        field: variant.camel,
        variant: variant.camel,
        file: relative,
        line: getLineNumber(content, match.index),
      });
    }
    while ((match = snakeRegex.exec(content)) !== null) {
      occurrences.push({
        field: variant.camel,
        variant: variant.snake,
        file: relative,
        line: getLineNumber(content, match.index),
      });
    }
  }
  return occurrences;
};

const collectSupabaseUsage = (content, filePath) => {
  const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
  const browserClientMatches = collectRouteUsage(content, filePath, /createSupabaseBrowserClient/g).map(
    (item) => ({ ...item, file: relative })
  );
  const realtimeMatches = collectRouteUsage(content, filePath, /\.channel\s*\(/g).map((item) => ({
    ...item,
    file: relative,
  }));
  return { browserClientMatches, realtimeMatches };
};

const collectHardcodedApiPaths = (content, filePath) =>
  collectStringLiteralMatches(content, /(['"`])([^'"`]*?\/api\/v1\/[^'"`]*)\1/g, filePath);

const collectHardcodedApiPathsAll = (content, filePath) =>
  collectStringLiteralMatches(content, /(['"`])([^'"`]*?\/api\/[^'"`]*)\1/g, filePath);

const buildDebtSummary = (items, limit = DEFAULT_LIMIT) => {
  const counts = new Map();
  for (const item of items) {
    const file = item.file || "(unknown)";
    counts.set(file, (counts.get(file) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([file, count]) => ({ file, count }));
};

const buildIssueCountsByFile = (items, limit = 10) => {
  const counts = new Map();
  for (const item of items) {
    const file = item.file || "(unknown)";
    const entry = counts.get(file) || { count: 0, kinds: new Set() };
    entry.count += 1;
    if (item.kind) {
      entry.kinds.add(item.kind);
    }
    counts.set(file, entry);
  }
  return Array.from(counts.entries())
    .map(([file, entry]) => ({
      file,
      count: entry.count,
      kinds: Array.from(entry.kinds.values()).sort(),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

const normalizeComparablePath = (value) => {
  if (!value) return value;
  return value.replace(/\/+$/, "") || "/";
};

const buildApiRouteMatchers = (routes) =>
  routes.map((route) => {
    const pattern = `^${route.pathNormalized
      .replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
      .replace(/:param\*/g, ".+")
      .replace(/:param/g, "[^/]+")}$`;
    return {
      route,
      regex: new RegExp(pattern),
    };
  });

const suggestApiRouteBuilders = (hardcodedPaths, ssotApiRoutes, limit = DEFAULT_LIMIT) => {
  const matchers = buildApiRouteMatchers(ssotApiRoutes);
  const suggestions = [];
  for (const item of hardcodedPaths.slice(0, limit)) {
    const normalized = normalizeComparablePath(item.value);
    const exactMatches = matchers
      .filter((matcher) => matcher.regex.test(normalized))
      .map((matcher) => matcher.route);
    const candidates = exactMatches.length
      ? exactMatches
      : matchers
          .filter((matcher) => matcher.route.pathNormalized.startsWith(normalized.split("/").slice(0, 3).join("/")))
          .map((matcher) => matcher.route);
    const candidateBuilders = Array.from(
      new Map(
        candidates.map((route) => [
          `${route.builder}:${route.pathNormalized}`,
          { builder: route.builder, path: route.pathNormalized },
        ])
      ).values()
    ).slice(0, 5);

    suggestions.push({
      file: item.file,
      line: item.line,
      value: item.value,
      candidates: candidateBuilders.map((candidate) => ({
        builder: candidate.builder,
        path: candidate.path,
        usageHint: `routes.api.${candidate.builder}(...)`,
      })),
    });
  }
  return suggestions;
};

const buildMissingInSsotSuggestions = (missingInSsot, limit = DEFAULT_LIMIT) => {
  const candidates = Array.from(
    new Map(
      missingInSsot.map((item) => [`${item.kind}:${item.path}`, { kind: item.kind, path: item.path }])
    ).values()
  );
  return candidates.slice(0, limit);
};

const limitList = (items, limit) => (limit == null ? items : items.slice(0, limit));

const buildSummaryStatus = (count, severity = "warning") => {
  if (count === 0) return "✅";
  return severity === "error" ? "❌" : "⚠️";
};

const findDuplicateApiRoutes = (apiRoutes) => {
  const map = new Map();
  for (const route of apiRoutes) {
    const methods = route.methods.length ? route.methods : ["UNKNOWN"];
    for (const method of methods) {
      const key = `${method} ${route.pathNormalized}`;
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

export const scanRepository = async ({ writeReport = false, limit = DEFAULT_LIMIT } = {}) => {
  const allowlist = await loadAllowlist();
  const hardcodedApiV1Scope = resolveHardcodedApiV1Scope(allowlist);
  const files = await walk(REPO_ROOT);
  const routeFiles = collectRouteFiles(files, { isApi: true });
  const pageFiles = collectRouteFiles(files, { isApi: false });

  const apiRoutes = await collectApiRoutes(routeFiles);
  const pageRoutes = await collectPageRoutes(pageFiles);

  const ssotRoutes = await parseSsotRoutes();
  const ssotApiRoutes = ssotRoutes.filter((route) => route.kind === "api");
  const ssotPageRoutes = ssotRoutes.filter((route) => route.kind === "page");

  const apiRouteMap = new Set(apiRoutes.map((route) => route.pathNormalized));
  const pageRouteMap = new Set(pageRoutes.map((route) => route.pathNormalized));

  const missingRouteFile = ssotRoutes
    .filter((route) => route.comparable)
    .filter((route) => {
      const map = route.kind === "api" ? apiRouteMap : pageRouteMap;
      if (route.dynamic && route.pathNormalized === "/") return false;
      const key = `${route.kind}::${route.pathNormalized}`;
      if ((allowlist.missingRouteFile || []).includes(key)) return false;
      return !map.has(route.pathNormalized);
    })
    .map((route) => ({
      kind: route.kind,
      builder: route.builder,
      path: route.pathNormalized,
      file: "lib/standards/routes.ts",
      dynamic: route.dynamic,
    }));

  const ssotApiPathSet = new Set(ssotApiRoutes.map((route) => route.pathNormalized));
  const ssotPagePathSet = new Set(ssotPageRoutes.map((route) => route.pathNormalized));

  const missingInSsot = [
    ...apiRoutes.map((route) => ({
      kind: "api",
      path: route.pathNormalized,
      file: route.file,
    })),
    ...pageRoutes.map((route) => ({
      kind: "page",
      path: route.pathNormalized,
      file: route.file,
    })),
  ]
    .filter((route) => {
      const set = route.kind === "api" ? ssotApiPathSet : ssotPagePathSet;
      const key = `${route.kind}::${route.path}`;
      if ((allowlist.missingInSsot || []).includes(key)) return false;
      return !set.has(route.path);
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const apiFetchUsages = [];
  const routesApiUsages = [];
  const routesPageUsages = [];
  const unsafeApiPaths = [];
  const hardcodedApiV1 = [];
  const hardcodedApiPaths = [];
  const supabaseBrowserClient = [];
  const supabaseRealtimeChannels = [];
  const snakeCaseKeys = [];
  const snakeCaseResponseKeys = [];
  const fieldVariants = [];

  for (const filePath of files) {
    if (!isSourceFile(filePath)) continue;
    const content = await fs.readFile(filePath, "utf8");
    const relative = toPosixPath(path.relative(REPO_ROOT, filePath));
    const isDtoScanTarget = isInScope(relative, DTO_SCAN_SCOPE);
    apiFetchUsages.push(...collectApiFetchUsages(content, filePath));
    routesApiUsages.push(...collectRouteUsage(content, filePath, /routes\.api\.[A-Za-z0-9_.]+/g));
    routesPageUsages.push(...collectRouteUsage(content, filePath, /routes\.page\.[A-Za-z0-9_.]+/g));
    unsafeApiPaths.push(...collectUnsafeApiPaths(content, filePath));
    const hardcodedMatches = collectHardcodedApiPaths(content, filePath);
    if (hardcodedMatches.length) {
      hardcodedApiV1.push(
        ...hardcodedMatches.filter((item) => isHardcodedApiV1InScope(item.file, hardcodedApiV1Scope))
      );
    }
    hardcodedApiPaths.push(...collectHardcodedApiPathsAll(content, filePath));

    const { browserClientMatches, realtimeMatches } = collectSupabaseUsage(content, filePath);
    supabaseBrowserClient.push(...browserClientMatches);
    supabaseRealtimeChannels.push(...realtimeMatches);

    if (isDtoScanTarget) {
      snakeCaseKeys.push(...collectSnakeCaseKeys(content, filePath));
      snakeCaseResponseKeys.push(...collectSnakeCaseResponseKeys(content, filePath));
      fieldVariants.push(...collectFieldVariants(content, filePath));
    }
  }

  const duplicates = {
    apiRoutes: findDuplicateApiRoutes(apiRoutes),
  };

  const debtItems = [
    ...missingRouteFile,
    ...missingInSsot,
    ...unsafeApiPaths,
    ...hardcodedApiV1,
  ];

  const topDebtFiles = buildDebtSummary(debtItems, limit);

  const metrics = {
    routes_total: apiRoutes.length + pageRoutes.length,
    routes_api_total: apiRoutes.length,
    routes_page_total: pageRoutes.length,
    ssot_routes_total: ssotRoutes.length,
    calls_total: apiFetchUsages.length,
    missing_route_file_count: missingRouteFile.length,
    missing_in_ssot_count: missingInSsot.length,
    hardcoded_api_path_count: hardcodedApiPaths.length,
    unsafe_api_path_count: unsafeApiPaths.length,
  };

  const topOffenders = {
    files_by_issue_count: buildIssueCountsByFile(
      [
        ...missingRouteFile.map((item) => ({ ...item, kind: "missing_route_file" })),
        ...missingInSsot.map((item) => ({ ...item, kind: "missing_in_ssot" })),
        ...unsafeApiPaths.map((item) => ({ ...item, kind: "unsafe_api_path" })),
        ...hardcodedApiPaths.map((item) => ({ ...item, kind: "hardcoded_api_path" })),
      ],
      10
    ),
    missing_route_file: limitList(
      [...missingRouteFile].sort((a, b) => a.path.localeCompare(b.path)),
      10
    ),
    missing_in_ssot: limitList(missingInSsot, 10),
    hardcoded_api_paths: limitList(
      [...hardcodedApiPaths].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
      20
    ),
    unsafe_api_paths: limitList(
      unsafeApiPaths.map((item) => ({
        ...item,
        reason: "unsafeApiPath used with /api/ path",
      })),
      20
    ),
  };

  const suggestions = {
    missing_in_ssot: {
      title: "routes.ts에 추가할 후보 경로",
      candidates: buildMissingInSsotSuggestions(missingInSsot, limit),
    },
    hardcoded_api_paths: {
      title: "routes.ts의 builder로 바꾸기 후보",
      candidates: suggestApiRouteBuilders(hardcodedApiPaths, ssotApiRoutes, limit),
    },
  };

  const report = {
    generatedAt: new Date().toISOString(),
    metrics,
    routes: {
      appRouter: {
        api: apiRoutes.sort((a, b) => a.pathNormalized.localeCompare(b.pathNormalized)),
        pages: pageRoutes.sort((a, b) => a.pathNormalized.localeCompare(b.pathNormalized)),
      },
      ssot: {
        api: ssotApiRoutes.sort((a, b) => a.pathNormalized.localeCompare(b.pathNormalized)),
        pages: ssotPageRoutes.sort((a, b) => a.pathNormalized.localeCompare(b.pathNormalized)),
      },
    },
    usage: {
      apiFetch: apiFetchUsages,
      routesApi: routesApiUsages,
      routesPage: routesPageUsages,
      unsafeApiPaths,
      hardcodedApiV1,
      hardcodedApiPaths,
      dto: {
        snakeCaseKeys,
        snakeCaseResponseKeys,
        fieldVariants,
      },
      supabase: {
        browserClient: supabaseBrowserClient,
        realtimeChannels: supabaseRealtimeChannels,
      },
    },
    mismatches: {
      missingRouteFile,
      missingInSsot,
    },
    duplicates,
    debt: {
      topFiles: topDebtFiles,
    },
    topOffenders,
    suggestions,
  };

  if (writeReport) {
    await writeReportFiles(report, { limit });
  }

  return report;
};

export const writeReportFiles = async (report, { limit = DEFAULT_LIMIT, outMdPath, outJsonPath } = {}) => {
  const mdPath = outMdPath || REPORT_MD_PATH;
  const jsonPath = outJsonPath || REPORT_JSON_PATH;
  await fs.mkdir(path.dirname(mdPath), { recursive: true });

  const limitedReport = {
    ...report,
    usage: {
      ...report.usage,
      apiFetch: limitList(report.usage.apiFetch, limit),
      routesApi: limitList(report.usage.routesApi, limit),
      routesPage: limitList(report.usage.routesPage, limit),
      unsafeApiPaths: limitList(report.usage.unsafeApiPaths, limit),
      hardcodedApiV1: limitList(report.usage.hardcodedApiV1, limit),
      hardcodedApiPaths: limitList(report.usage.hardcodedApiPaths, limit),
      supabase: {
        browserClient: limitList(report.usage.supabase.browserClient, limit),
        realtimeChannels: limitList(report.usage.supabase.realtimeChannels, limit),
      },
    },
    mismatches: {
      missingRouteFile: limitList(report.mismatches.missingRouteFile, limit),
      missingInSsot: limitList(report.mismatches.missingInSsot, limit),
    },
  };

  await fs.writeFile(jsonPath, `${JSON.stringify(limitedReport, null, 2)}\n`, "utf8");

  const formatList = (items, format) =>
    items.length ? items.map((item) => `- ${format(item)}`).join("\n") : "- (none)";

  const lines = [];
  lines.push("# Selfcheck Report");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(
    `- Routes: ${report.metrics.routes_total} (API ${report.metrics.routes_api_total}, Page ${report.metrics.routes_page_total})`
  );
  lines.push(`- SSOT Routes: ${report.metrics.ssot_routes_total}`);
  lines.push(`- API calls detected: ${report.metrics.calls_total}`);
  lines.push("");
  lines.push(
    `- ${buildSummaryStatus(report.metrics.missing_route_file_count, "error")} Missing route files: ${report.metrics.missing_route_file_count}`
  );
  lines.push(
    `- ${buildSummaryStatus(report.metrics.missing_in_ssot_count, "warning")} Missing in SSOT: ${report.metrics.missing_in_ssot_count}`
  );
  lines.push(
    `- ${buildSummaryStatus(report.metrics.hardcoded_api_path_count, "error")} Hardcoded /api/ paths: ${report.metrics.hardcoded_api_path_count}`
  );
  lines.push(
    `- ${buildSummaryStatus(report.metrics.unsafe_api_path_count, "warning")} unsafeApiPath usage: ${report.metrics.unsafe_api_path_count}`
  );
  lines.push("");
  lines.push("### Top 5 위험 항목");
  lines.push(
    formatList(report.topOffenders.missing_route_file.slice(0, 5), (item) => `${item.kind} ${item.path}`)
  );
  lines.push("");
  lines.push("### Top 5 SSOT 누락");
  lines.push(formatList(report.topOffenders.missing_in_ssot.slice(0, 5), (item) => `${item.kind} ${item.path}`));
  lines.push("");
  lines.push("### Top 5 하드코딩 경로");
  lines.push(
    formatList(report.topOffenders.hardcoded_api_paths.slice(0, 5), (item) => `${item.file}:${item.line} ${item.value}`)
  );
  lines.push("");
  lines.push("### Top 5 부채 파일");
  lines.push(formatList(report.debt.topFiles.slice(0, 5), (item) => `${item.file} (${item.count})`));
  lines.push("");
  lines.push("## Details");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>App Router API Routes</summary>");
  lines.push("");
  lines.push(
    formatList(report.routes.appRouter.api, (item) => `${item.path} (${item.methods.join(", ") || "-"})`)
  );
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>App Router Page Routes</summary>");
  lines.push("");
  lines.push(formatList(report.routes.appRouter.pages, (item) => item.path));
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>SSOT API Routes</summary>");
  lines.push("");
  lines.push(
    formatList(report.routes.ssot.api, (item) =>
      item.dynamic
        ? `${item.pathNormalized} (dynamic builder: ${item.builder})`
        : `${item.path} (${item.builder})`
    )
  );
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>SSOT Page Routes</summary>");
  lines.push("");
  lines.push(
    formatList(report.routes.ssot.pages, (item) =>
      item.dynamic
        ? `${item.pathNormalized} (dynamic builder: ${item.builder})`
        : `${item.path} (${item.builder})`
    )
  );
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>Missing Route Files (SSOT → App Router)</summary>");
  lines.push("");
  lines.push(
    formatList(limitedReport.mismatches.missingRouteFile, (item) => `${item.kind} ${item.path} (${item.builder})`)
  );
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>Missing in SSOT (App Router → SSOT)</summary>");
  lines.push("");
  lines.push(
    formatList(limitedReport.mismatches.missingInSsot, (item) => `${item.kind} ${item.path} (${item.file})`)
  );
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>apiFetch Usage</summary>");
  lines.push("");
  lines.push(
    formatList(
      limitedReport.usage.apiFetch,
      (item) =>
        `${item.file}:${item.line} routes.api=${item.hasRoutesApi} unsafeApiPath=${item.hasUnsafeApiPath} hardcodedV1=${item.hardcodedApiV1}`
    )
  );
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>routes.api.* Usage</summary>");
  lines.push("");
  lines.push(formatList(limitedReport.usage.routesApi, (item) => `${item.file}:${item.line} ${item.token}`));
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>routes.page.* Usage</summary>");
  lines.push("");
  lines.push(formatList(limitedReport.usage.routesPage, (item) => `${item.file}:${item.line} ${item.token}`));
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>unsafeApiPath Usage</summary>");
  lines.push("");
  lines.push(
    formatList(limitedReport.usage.unsafeApiPaths, (item) => `${item.file}:${item.line} ${item.value}`)
  );
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>Hardcoded /api/v1/ Paths</summary>");
  lines.push("");
  lines.push(formatList(limitedReport.usage.hardcodedApiV1, (item) => `${item.file}:${item.line} ${item.value}`));
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>Hardcoded /api/ Paths (All)</summary>");
  lines.push("");
  lines.push(formatList(limitedReport.usage.hardcodedApiPaths, (item) => `${item.file}:${item.line} ${item.value}`));
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>Supabase Browser Client Usage</summary>");
  lines.push("");
  lines.push(
    formatList(
      limitedReport.usage.supabase.browserClient,
      (item) => `${item.file}:${item.line} createSupabaseBrowserClient`
    )
  );
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>Supabase Realtime Channel Usage</summary>");
  lines.push("");
  lines.push(
    formatList(limitedReport.usage.supabase.realtimeChannels, (item) => `${item.file}:${item.line} .channel(`)
  );
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>Duplicate API Endpoints</summary>");
  lines.push("");
  lines.push(formatList(report.duplicates.apiRoutes, (item) => `${item.endpoint} (${item.files.join(", ")})`));
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>Top Debt Files</summary>");
  lines.push("");
  lines.push(formatList(report.debt.topFiles, (item) => `${item.file} (${item.count})`));
  lines.push("");
  lines.push("</details>");
  lines.push("");

  await fs.writeFile(mdPath, `${lines.join("\n")}\n`, "utf8");
};

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const args = process.argv.slice(2);
  const summary = args.includes("--summary");
  const limitArgIndex = args.findIndex((arg) => arg === "--limit");
  const limitValue = limitArgIndex >= 0 ? Number(args[limitArgIndex + 1]) : DEFAULT_LIMIT;
  const outMdIndex = args.findIndex((arg) => arg === "--out-md");
  const outJsonIndex = args.findIndex((arg) => arg === "--out-json");
  const outMdPath = outMdIndex >= 0 ? args[outMdIndex + 1] : undefined;
  const outJsonPath = outJsonIndex >= 0 ? args[outJsonIndex + 1] : undefined;

  const resolvedLimit = Number.isFinite(limitValue) ? limitValue : DEFAULT_LIMIT;
  const writeDefaultReport = !outMdPath && !outJsonPath;

  scanRepository({ writeReport: writeDefaultReport, limit: resolvedLimit })
    .then(async (report) => {
      if (!writeDefaultReport) {
        await writeReportFiles(report, {
          limit: resolvedLimit,
          outMdPath,
          outJsonPath,
        });
      }
      if (summary) {
        console.log("[selfcheck:scan] Summary");
        console.log(`- Missing route files: ${report.metrics.missing_route_file_count}`);
        console.log(`- Missing in SSOT: ${report.metrics.missing_in_ssot_count}`);
        console.log(`- Hardcoded /api/ paths: ${report.metrics.hardcoded_api_path_count}`);
        console.log(`- unsafeApiPath usage: ${report.metrics.unsafe_api_path_count}`);
        console.log(
          `- Top debt files: ${report.debt.topFiles.slice(0, 5).map((item) => item.file).join(", ") || "-"}`
        );
      }
    })
    .catch((error) => {
      console.error("[selfcheck:scan] Failed", error);
      process.exit(1);
    });
}
