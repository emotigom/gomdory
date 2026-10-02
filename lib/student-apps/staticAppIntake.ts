import type {
  StudentAppSource,
  StudentAppUploadFileInput,
  ValidateStudentStaticAppInput,
} from "./deploymentTypes";

type IncomingStudentAppFile = {
  name: string;
  path?: string | null;
  contentType?: string | null;
  content: string | Uint8Array;
};

export type NormalizeStudentAppFilesInput = {
  files: IncomingStudentAppFile[];
  rootFolderName?: string | null;
};

export type NormalizeStudentAppFilesResult =
  | { ok: true; files: StudentAppUploadFileInput[]; warnings: string[] }
  | { ok: false; files: StudentAppUploadFileInput[]; errors: string[]; warnings: string[] };

const DEFAULT_TITLE = "학생 앱";

function normalizeUploadPath(file: IncomingStudentAppFile): string {
  const raw = (file.path ?? file.name).trim();
  return raw.replace(/\\+/g, "/").replace(/\/+/g, "/");
}

function normalizeRootName(name: string): string {
  return name.trim().replace(/\\+/g, "/").replace(/^\/+|\/+$/g, "");
}

function shouldDropNoise(path: string): boolean {
  const basename = path.slice(path.lastIndexOf("/") + 1);
  if (path.startsWith("__MACOSX/")) return true;
  return basename === ".DS_Store" || basename === "Thumbs.db";
}

function removeRoot(path: string, root: string): string {
  if (path === root) return "";
  if (path.startsWith(`${root}/`)) return path.slice(root.length + 1);
  return path;
}

export function normalizeStudentAppFiles(input: NormalizeStudentAppFilesInput): NormalizeStudentAppFilesResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const normalized = input.files
    .map((file) => ({ ...file, normalizedPath: normalizeUploadPath(file) }))
    .filter((file) => {
      if (file.normalizedPath.length === 0) {
        errors.push("empty_path");
        return false;
      }
      if (file.normalizedPath.endsWith("/")) {
        warnings.push(`ignored_directory_placeholder:${file.normalizedPath}`);
        return false;
      }
      if (shouldDropNoise(file.normalizedPath)) {
        warnings.push(`ignored_noise_file:${file.normalizedPath}`);
        return false;
      }
      return true;
    });

  const requestedRoot = input.rootFolderName ? normalizeRootName(input.rootFolderName) : "";
  const slashPaths = normalized.map((file) => file.normalizedPath).filter((path) => path.includes("/"));
  const topLevels = new Set(slashPaths.map((path) => path.split("/")[0]).filter(Boolean));
  const allFilesHaveDirectories = slashPaths.length > 0 && slashPaths.length === normalized.length;
  const hasSingleRoot = allFilesHaveDirectories && topLevels.size === 1;
  const singleRoot = hasSingleRoot ? [...topLevels][0] : "";
  const stripRoot = requestedRoot || (hasSingleRoot ? singleRoot : "");

  const files: StudentAppUploadFileInput[] = [];
  const seen = new Set<string>();

  for (const file of normalized) {
    let finalPath = file.normalizedPath;
    if (stripRoot) {
      finalPath = removeRoot(finalPath, stripRoot);
    }

    if (finalPath.length === 0) {
      errors.push(`empty_final_path:${file.normalizedPath}`);
      continue;
    }
    if (finalPath.endsWith("/")) {
      warnings.push(`ignored_directory_placeholder:${finalPath}`);
      continue;
    }
    if (finalPath.startsWith("/") || /^[A-Za-z]:/.test(finalPath) || finalPath.includes("..") || /[\x00-\x1F\x7F]/.test(finalPath)) {
      errors.push(`path_outside_root:${finalPath}`);
      continue;
    }
    const collisionKey = finalPath.toLowerCase();
    if (seen.has(collisionKey)) {
      errors.push(`duplicate_path:${finalPath}`);
      continue;
    }

    seen.add(collisionKey);
    files.push({
      path: finalPath,
      contentType: file.contentType ?? undefined,
      content: file.content,
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  if (errors.length > 0) {
    return { ok: false, files, errors: [...new Set(errors)].sort(), warnings: [...new Set(warnings)].sort() };
  }

  return { ok: true, files, warnings: [...new Set(warnings)].sort() };
}

export function inferStudentAppTitleFromFiles(files: StudentAppUploadFileInput[]): string {
  const indexFile = files.find((file) => file.path === "index.html");
  if (!indexFile) return DEFAULT_TITLE;

  const html = typeof indexFile.content === "string" ? indexFile.content : new TextDecoder().decode(indexFile.content);
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return DEFAULT_TITLE;

  const stripped = match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!stripped) return DEFAULT_TITLE;
  return stripped.slice(0, 80);
}

export function buildValidationInputFromNormalizedFiles(input: {
  files: StudentAppUploadFileInput[];
  title?: string;
  source: StudentAppSource;
}): ValidateStudentStaticAppInput {
  const title = input.title?.trim() ? input.title.trim().slice(0, 80) : inferStudentAppTitleFromFiles(input.files);
  return {
    title,
    source: input.source,
    files: input.files,
  };
}
