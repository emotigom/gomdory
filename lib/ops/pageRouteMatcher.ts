import "server-only";

import { PAGE_ROUTE_PATTERNS, type CompiledPageRoutePattern } from "@/lib/generated/pageRouteInventory";

type ScoredRoute = { patternPath: string; score: number };

function normalizePath(raw: string) {
  if (!raw) return "/";
  const stripped = raw.split(/[?#]/, 1)[0];
  if (!stripped) return "/";
  if (stripped !== "/" && stripped.endsWith("/")) return stripped.replace(/\/+$/, "");
  return stripped;
}

function splitSegments(path: string) {
  const normalized = normalizePath(path);
  if (normalized === "/") return [] as string[];
  return normalized.split("/").filter(Boolean);
}

function isPlaceholderSegment(segment: string) {
  // Our worker-level sanitizer may emit ":id" placeholders in logged routes.
  return segment.startsWith(":");
}

function matchPattern(pattern: CompiledPageRoutePattern, candidatePath: string) {
  const target = splitSegments(candidatePath);
  const segs = pattern.segments;

  let i = 0;
  let j = 0;
  while (i < segs.length && j < target.length) {
    const seg = segs[i];
    if (seg.kind === "catchall") return true;
    if (seg.kind === "param") {
      i += 1;
      j += 1;
      continue;
    }
    const value = target[j];
    if (isPlaceholderSegment(value)) {
      // Logged placeholder can match any literal.
      i += 1;
      j += 1;
      continue;
    }
    if (seg.value !== value) return false;
    i += 1;
    j += 1;
  }

  if (i < segs.length) {
    return segs.slice(i).every((seg) => seg.kind === "catchall");
  }
  return j === target.length;
}

function scoreSimilarity(pattern: CompiledPageRoutePattern, candidatePath: string): number {
  const target = splitSegments(candidatePath);
  const segs = pattern.segments;
  const maxLen = Math.max(target.length, segs.length);
  if (maxLen === 0) return 0;

  let score = 0;
  const minLen = Math.min(target.length, segs.length);
  for (let idx = 0; idx < minLen; idx += 1) {
    const p = segs[idx];
    const t = target[idx];

    if (p.kind === "catchall") {
      score += 0.5;
      break;
    }
    if (p.kind === "param") {
      score += 1;
      continue;
    }
    if (isPlaceholderSegment(t)) {
      // placeholder in logged route, likely dynamic
      score += 1;
      continue;
    }
    if (p.value === t) {
      score += 3;
      continue;
    }
    // mismatch: stop comparing further segments to favor prefix similarity
    score -= 1;
    break;
  }

  // Penalize very different lengths to avoid silly matches
  score -= Math.abs(segs.length - target.length) * 0.2;

  return score;
}

export function doesPageRouteExist(path: string) {
  const normalized = normalizePath(path);
  return PAGE_ROUTE_PATTERNS.some((pattern) => matchPattern(pattern, normalized));
}

function specificityScore(pattern: CompiledPageRoutePattern) {
  // Higher means more specific (more literals, fewer catchalls).
  let score = 0;
  for (const seg of pattern.segments) {
    if (seg.kind === "literal") score += 3;
    else if (seg.kind === "param") score += 1;
    else score += 0.2;
  }
  return score;
}

export function findMatchingPageRoutePatterns(path: string, max = 3): CompiledPageRoutePattern[] {
  const normalized = normalizePath(path);
  const matches = PAGE_ROUTE_PATTERNS.filter((pattern) => matchPattern(pattern, normalized));

  matches.sort(
    (a, b) =>
      specificityScore(b) - specificityScore(a) ||
      scoreSimilarity(b, normalized) - scoreSimilarity(a, normalized) ||
      a.patternPath.localeCompare(b.patternPath),
  );

  return matches.slice(0, Math.max(0, max));
}

export function findClosestPageRoutes(path: string, max = 3): ScoredRoute[] {
  const normalized = normalizePath(path);

  const scored: ScoredRoute[] = PAGE_ROUTE_PATTERNS.map((pattern) => ({
    patternPath: pattern.patternPath,
    score: scoreSimilarity(pattern, normalized),
  }));

  scored.sort((a, b) => b.score - a.score || a.patternPath.localeCompare(b.patternPath));
  return scored.filter((x) => x.score > 0).slice(0, max);
}
