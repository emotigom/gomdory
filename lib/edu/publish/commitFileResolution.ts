import type { EduPublishFileMetaNormalized } from "@/lib/edu/validateFiles";

export type PublishFileDebugListing = {
  topLevelEntries: string[];
  sampleFiles: string[];
  detectedRootPaths: string[];
};

export type ResolvedPublishFile = {
  expectedPath: string;
  actualPath: string;
  contentType: string;
  sizeBytes: number;
};

function dirname(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut >= 0 ? path.slice(0, cut) : "";
}

function basename(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut >= 0 ? path.slice(cut + 1) : path;
}

function buildDetectedRootPaths(relativeKeys: string[]): string[] {
  const roots = [""];
  const topLevelDirs = new Set<string>();
  let hasTopLevelFile = false;

  for (const key of relativeKeys) {
    const parts = key.split("/");
    if (parts.length <= 1) {
      hasTopLevelFile = true;
      continue;
    }
    topLevelDirs.add(parts[0] ?? "");
  }

  if (!hasTopLevelFile && topLevelDirs.size === 1) {
    const [dir] = [...topLevelDirs];
    if (dir) {
      roots.push(`${dir}/`);
    }
  }

  return roots;
}

function buildDebugListing(relativeKeys: string[]): PublishFileDebugListing {
  const topLevel = new Set<string>();
  for (const key of relativeKeys) {
    const [first, ...rest] = key.split("/");
    if (!first) continue;
    topLevel.add(rest.length > 0 ? `${first}/` : first);
  }

  return {
    topLevelEntries: [...topLevel].sort().slice(0, 20),
    sampleFiles: [...relativeKeys].sort().slice(0, 20),
    detectedRootPaths: buildDetectedRootPaths(relativeKeys),
  };
}

function matchRequiredPath(params: {
  rootPrefix: string;
  requiredPath: string;
  allPaths: Set<string>;
  allRelativeKeys: string[];
}): string | null {
  const targetPath = `${params.rootPrefix}${params.requiredPath}`;
  if (params.allPaths.has(targetPath)) {
    return targetPath;
  }

  if (params.requiredPath.toLowerCase() !== "index.html") {
    return null;
  }

  const targetDir = dirname(targetPath);
  const indexCandidates = params.allRelativeKeys.filter((entry) => {
    if (dirname(entry) !== targetDir) return false;
    return basename(entry).toLowerCase() === "index.html";
  });

  if (indexCandidates.length === 1) {
    return indexCandidates[0] ?? null;
  }

  return null;
}

export function resolvePublishFilesForCommit(params: {
  files: EduPublishFileMetaNormalized[];
  relativeObjectKeys: string[];
}): {
  resolved: ResolvedPublishFile[] | null;
  debug: PublishFileDebugListing;
} {
  const relativeKeys = params.relativeObjectKeys.filter(Boolean);
  const debug = buildDebugListing(relativeKeys);
  const allPaths = new Set(relativeKeys);

  for (const rootPrefix of debug.detectedRootPaths) {
    const resolved = params.files.map((file) => {
      const actualPath = matchRequiredPath({
        rootPrefix,
        requiredPath: file.path,
        allPaths,
        allRelativeKeys: relativeKeys,
      });

      if (!actualPath) {
        return null;
      }

      return {
        expectedPath: file.path,
        actualPath,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
      } satisfies ResolvedPublishFile;
    });

    if (resolved.every((item) => item !== null)) {
      return { resolved: resolved as ResolvedPublishFile[], debug };
    }
  }

  return { resolved: null, debug };
}
