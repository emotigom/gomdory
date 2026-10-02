import type { NormalizedFile } from "@/lib/edu/fileProtocol";

type SanitizeResult = {
  sanitized: string;
  warnings: string[];
};

const EXTERNAL_SCRIPT_PATTERN =
  /<script\b[^>]*\bsrc\s*=\s*(["'])https?:\/\/[^"']+\1[^>]*>\s*<\/script\s*>/gi;
const EXTERNAL_LINK_PATTERN =
  /<link\b[^>]*\bhref\s*=\s*(["'])https?:\/\/[^"']+\1[^>]*>/gi;
const IFRAME_PATTERN = /<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi;
const IFRAME_SELF_CLOSING_PATTERN = /<iframe\b[^>]*\/?>/gi;
const META_REFRESH_PATTERN = /<meta\b[^>]*http-equiv\s*=\s*(["']?)refresh\1[^>]*>/gi;
const WHILE_TRUE_PATTERN = /while\s*\(\s*true\s*\)/g;
const SET_INTERVAL_PATTERN = /setInterval\s*\(/g;

export function sanitizeIndexHtml(html: string): SanitizeResult {
  let sanitized = html;
  sanitized = sanitized.replace(EXTERNAL_SCRIPT_PATTERN, "");
  sanitized = sanitized.replace(EXTERNAL_LINK_PATTERN, "");
  sanitized = sanitized.replace(IFRAME_PATTERN, "");
  sanitized = sanitized.replace(IFRAME_SELF_CLOSING_PATTERN, "");
  sanitized = sanitized.replace(META_REFRESH_PATTERN, "");
  return { sanitized, warnings: [] };
}

export function sanitizeScriptJs(js: string): SanitizeResult {
  const warnings: string[] = [];
  let sanitized = js;

  const whileMatches = sanitized.match(WHILE_TRUE_PATTERN)?.length ?? 0;
  if (whileMatches > 0) {
    warnings.push("infinite-loop");
    sanitized = sanitized.replace(
      WHILE_TRUE_PATTERN,
      "while (false /* sanitized: disabled infinite loop */)",
    );
  }

  const intervalMatches = sanitized.match(SET_INTERVAL_PATTERN)?.length ?? 0;
  if (intervalMatches >= 2) {
    warnings.push("interval-spam");
    let seen = 0;
    sanitized = sanitized.replace(SET_INTERVAL_PATTERN, (match) => {
      seen += 1;
      return seen <= 1 ? match : "setTimeout(";
    });
  }

  return { sanitized, warnings };
}

export function sanitizeGeneratedFiles(files: Record<string, NormalizedFile>): {
  files: Record<string, NormalizedFile>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const sanitizedFiles: Record<string, NormalizedFile> = {};

  for (const [filename, file] of Object.entries(files)) {
    if (filename === "index.html") {
      const result = sanitizeIndexHtml(file.content);
      warnings.push(...result.warnings);
      sanitizedFiles[filename] = { ...file, content: result.sanitized };
      continue;
    }

    if (filename.endsWith(".js")) {
      const result = sanitizeScriptJs(file.content);
      warnings.push(...result.warnings);
      sanitizedFiles[filename] = { ...file, content: result.sanitized };
      continue;
    }

    sanitizedFiles[filename] = file;
  }

  return { files: sanitizedFiles, warnings };
}
