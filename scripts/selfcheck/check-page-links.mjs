import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Prevent hidden 404s by validating hardcoded page links.
 *
 * What it checks:
 * - href="/..." / href='/...'
 * - router.push("/...") / router.replace("/...")
 * - redirect("/...")
 *
 * Rules:
 * - Skip /api/*
 * - Skip absolute URLs and anchors
 * - Skip template literals containing ${...}
 * - Strip query/hash before matching
 */

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const APP_DIR = path.join(REPO_ROOT, "app");
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

const toPosixPath = (value) => value.split(path.sep).join("/");

const shouldIgnoreDir = (entry) => IGNORED_DIRS.has(entry);

const isSourceFile = (filePath) => SOURCE_EXTENSIONS.has(path.extname(filePath));

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

const parseRoutePathFromPageFile = (filePath) => {
  const relative = path.relative(APP_DIR, filePath);
  const parts = toPosixPath(relative).split("/");
  const trimmed = parts.slice(0, -1);
  return normalizeRouteSegments(trimmed);
};

const compileRoutePattern = (patternPath) => {
  const normalized = patternPath === "/" ? "/" : patternPath.replace(/\/+$/, "");
  const segments = normalized === "/" ? [] : normalized.split("/").filter(Boolean);
  const compiled = segments.map((segment) => {
    if (segment.startsWith(":")) {
      const isCatchAll = segment.endsWith("*");
      return { kind: isCatchAll ? "catchall" : "param", value: segment };
    }
    return { kind: "literal", value: segment };
  });
  return { patternPath: normalized, segments: compiled };
};

const stripQueryHash = (raw) => raw.split(/[?#]/, 1)[0];

const normalizeCandidatePath = (raw) => {
  if (!raw) return null;
  if (raw.includes("${")) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("//")) return null;
  if (raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("/api/")) return null;
  const stripped = stripQueryHash(raw);
  if (!stripped) return null;
  if (stripped !== "/" && stripped.endsWith("/")) return stripped.replace(/\/+$/, "");
  return stripped;
};

const matchCompiled = (compiled, candidatePath) => {
  const target = candidatePath === "/" ? [] : candidatePath.split("/").filter(Boolean);
  const segs = compiled.segments;
  let i = 0;
  let j = 0;
  while (i < segs.length && j < target.length) {
    const seg = segs[i];
    if (seg.kind === "catchall") {
      return true;
    }
    if (seg.kind === "param") {
      i += 1;
      j += 1;
      continue;
    }
    if (seg.value !== target[j]) return false;
    i += 1;
    j += 1;
  }
  if (i < segs.length) {
    return segs.slice(i).every((seg) => seg.kind === "catchall");
  }
  return j === target.length;
};

const loadAllowlist = async () => {
  try {
    const raw = await fs.readFile(ALLOWLIST_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const ignored = Array.isArray(parsed.pageLinkIgnore) ? parsed.pageLinkIgnore : [];
    const ignoredPrefixes = Array.isArray(parsed.pageLinkIgnorePrefixes) ? parsed.pageLinkIgnorePrefixes : [];
    return { ignored, ignoredPrefixes };
  } catch {
    return { ignored: [], ignoredPrefixes: [] };
  }
};

const isAllowlisted = (candidate, allowlist) => {
  if (allowlist.ignored.includes(candidate)) return true;
  return allowlist.ignoredPrefixes.some((prefix) => candidate.startsWith(prefix));
};

const LINK_PATTERNS = [
  { kind: "href", regex: /\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/g },
  { kind: "router", regex: /\brouter\.(?:push|replace)\(\s*(?:"([^"]+)"|'([^']+)')/g },
  { kind: "redirect", regex: /\bredirect\(\s*(?:"([^"]+)"|'([^']+)')/g },
];

const FORBIDDEN_PUBLIC_LINKS = [
  {
    label: "legacy private GitHub account",
    regex: /^https?:\/\/github\.com\/gkrry(?:\/|$)/i,
  },
  {
    label: "private gom-clean docs",
    regex: /^https?:\/\/github\.com\/emotigom\/gom-clean\/blob\/main\/docs(?:\/|$)/i,
  },
  {
    label: "private gom-clean docs",
    regex: /^https?:\/\/github\.com\/[^/\s]+\/gom-clean\/blob\/main\/docs(?:\/|$)/i,
  },
];

const isPublicPageSourceFile = (relativePath) => {
  if (!relativePath.startsWith("app/")) return false;
  if (relativePath.startsWith("app/api/")) return false;
  if (relativePath.startsWith("app/(marketing)/")) return true;
  if (relativePath.startsWith("app/(labs)/")) return true;
  if (relativePath.startsWith("app/[code]/")) return true;
  if (relativePath.startsWith("app/edu/")) return true;
  return false;
};

const extractLinksFromContent = (content) => {
  const results = [];
  for (const pattern of LINK_PATTERNS) {
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const value = match[1] ?? match[2];
      if (!value) continue;
      results.push({ kind: pattern.kind, value, index: match.index });
    }
  }
  return results;
};

const getLineNumber = (content, index) => {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === "\n") line += 1;
  }
  return line;
};

const collectPageRoutePatterns = async () => {
  const files = await walk(APP_DIR);
  const pageFiles = files.filter((filePath) =>
    /\/page\.(ts|tsx|js|jsx|mjs|cjs)$/.test(toPosixPath(filePath))
  );
  const patterns = pageFiles.map((filePath) => parseRoutePathFromPageFile(filePath));
  const unique = Array.from(new Set(patterns));
  return unique.map((pattern) => compileRoutePattern(pattern));
};

const collectLinkCandidates = async () => {
  const roots = ["app", "components", "lib", "src"].map((dir) => path.join(REPO_ROOT, dir));
  const files = [];
  for (const dir of roots) {
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }
    const walked = await walk(dir);
    for (const filePath of walked) {
      if (!isSourceFile(filePath)) continue;
      files.push(filePath);
    }
  }

  const findings = [];
  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const rel = toPosixPath(path.relative(REPO_ROOT, filePath));
    for (const hit of extractLinksFromContent(content)) {
      const normalized = normalizeCandidatePath(hit.value);
      if (!normalized) continue;
      findings.push({
        file: rel,
        line: getLineNumber(content, hit.index),
        raw: hit.value,
        path: normalized,
        kind: hit.kind,
      });
    }
  }
  return findings;
};

const collectForbiddenPublicLinks = async () => {
  const files = await walk(APP_DIR);
  const findings = [];
  for (const filePath of files) {
    if (!isSourceFile(filePath)) continue;
    const rel = toPosixPath(path.relative(REPO_ROOT, filePath));
    if (!isPublicPageSourceFile(rel)) continue;
    const content = await fs.readFile(filePath, "utf8");
    for (const hit of extractLinksFromContent(content)) {
      const matched = FORBIDDEN_PUBLIC_LINKS.find((rule) => rule.regex.test(hit.value));
      if (!matched) continue;
      findings.push({
        file: rel,
        line: getLineNumber(content, hit.index),
        raw: hit.value,
        kind: hit.kind,
        reason: matched.label,
      });
    }
  }
  return findings;
};

const run = async () => {
  const allowlist = await loadAllowlist();
  const routePatterns = await collectPageRoutePatterns();
  const linkCandidates = await collectLinkCandidates();
  const forbiddenPublicLinks = await collectForbiddenPublicLinks();

  const missing = [];
  for (const item of linkCandidates) {
    if (isAllowlisted(item.path, allowlist)) continue;
    const ok = routePatterns.some((pattern) => matchCompiled(pattern, item.path));
    if (!ok) missing.push(item);
  }

  if (forbiddenPublicLinks.length > 0) {
    console.error(`[page-links] Forbidden public links detected: ${forbiddenPublicLinks.length}`);
    console.error("\nExamples:");
    for (const item of forbiddenPublicLinks.slice(0, 30)) {
      console.error(`- ${item.file}:${item.line} ${item.kind} -> ${item.raw} (${item.reason})`);
    }
    console.error("\nPublic pages should use internal public pages, public downloads, public repos, or admin-only screens instead of private GitHub docs.");
    process.exit(1);
  }

  if (missing.length === 0) {
    console.log(`[page-links] OK (${linkCandidates.length} links checked)`);
    return;
  }

  const max = 30;
  console.error(`[page-links] Missing routes detected: ${missing.length}`);
  console.error("\nExamples:");
  for (const item of missing.slice(0, max)) {
    console.error(`- ${item.file}:${item.line} ${item.kind} -> ${item.path} (raw: ${item.raw})`);
  }
  if (missing.length > max) {
    console.error(`- ...and ${missing.length - max} more`);
  }
  console.error("\nFix options:");
  console.error("1) Create the missing page route under app/.../page.tsx");
  console.error("2) Update the link to an existing route (prefer routes.ts builders)");
  console.error("3) If intentional, add to scripts/selfcheck/allowlist.json: pageLinkIgnore or pageLinkIgnorePrefixes");
  process.exit(1);
};

run().catch((error) => {
  console.error("[page-links] Failed", error);
  process.exit(1);
});
