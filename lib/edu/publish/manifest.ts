import {
  EDU_PUBLISH_DEFAULT_MAX_FILES,
  EDU_PUBLISH_DEFAULT_MAX_SINGLE_BYTES,
  EDU_PUBLISH_DEFAULT_MAX_TOTAL_BYTES,
  normalizeEduPublishPath,
  validateEduPublishFiles,
} from "@/lib/edu/validateFiles";
import { digestHex } from "@/lib/crypto/webcrypto";

export type DeclaredPublishFile = {
  path: string;
  sizeBytes: number;
  contentType: string;
  sha256: string;
};

export type CanonicalPublishManifest = {
  schemaVersion: 1;
  entryPoint: "index.html";
  files: Array<{
    path: string;
    sizeBytes: number;
    contentType: string;
    sha256: string;
  }>;
};

export class PublishManifestContractError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "PublishManifestContractError";
    this.code = code;
  }
}

function invalid(code: string): never {
  throw new PublishManifestContractError(code);
}

function canonicalizeSha256(value: unknown): string {
  if (typeof value !== "string" || !/^[\da-f]{64}$/i.test(value)) {
    return invalid("INVALID_MANIFEST_SHA256");
  }
  return value.toLowerCase();
}

export function canonicalizeDeclaredPublishManifest(
  files: readonly DeclaredPublishFile[],
): CanonicalPublishManifest {
  if (!Array.isArray(files) || files.length === 0) invalid("EMPTY_MANIFEST");
  if (files.length > EDU_PUBLISH_DEFAULT_MAX_FILES) invalid("INVALID_MANIFEST_SIZE");

  const prepared = files.map((file) => {
    if (!file || typeof file !== "object" || typeof file.path !== "string") invalid("INVALID_MANIFEST_PATH");
    if (!Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 0) invalid("INVALID_MANIFEST_SIZE");
    if (typeof file.contentType !== "string" || !file.contentType.trim()) invalid("INVALID_MANIFEST_CONTENT_TYPE");

    const normalizedPath = normalizeEduPublishPath(file.path.normalize("NFC"));
    if (!normalizedPath.ok) invalid("INVALID_MANIFEST_PATH");
    return {
      path: normalizedPath.path,
      sizeBytes: file.sizeBytes,
      contentType: file.contentType.trim(),
      sha256: canonicalizeSha256(file.sha256),
    };
  });

  const totalBytes = prepared.reduce((total, file) => total + file.sizeBytes, 0);
  if (totalBytes > EDU_PUBLISH_DEFAULT_MAX_TOTAL_BYTES || prepared.some((file) => file.sizeBytes > EDU_PUBLISH_DEFAULT_MAX_SINGLE_BYTES)) {
    invalid("INVALID_MANIFEST_SIZE");
  }

  const validation = validateEduPublishFiles(
    prepared.map((file) => ({ path: file.path, sizeBytes: file.sizeBytes, contentType: file.contentType })),
    {
      maxFiles: EDU_PUBLISH_DEFAULT_MAX_FILES,
      maxTotalBytes: EDU_PUBLISH_DEFAULT_MAX_TOTAL_BYTES,
      maxSingleBytes: EDU_PUBLISH_DEFAULT_MAX_SINGLE_BYTES,
    },
  );
  if (!validation.ok) {
    const code = validation.code === "DUPLICATE_PATH"
      ? "DUPLICATE_MANIFEST_PATH"
      : validation.code === "INVALID_CONTENT_TYPE"
        ? "INVALID_MANIFEST_CONTENT_TYPE"
        : validation.code === "MISSING_INDEX"
          ? "MISSING_ENTRY_POINT"
          : validation.code === "INVALID_SIZE" || validation.code === "TOO_LARGE_FILE" || validation.code === "TOO_LARGE_TOTAL"
            ? "INVALID_MANIFEST_SIZE"
            : "INVALID_MANIFEST_PATH";
    invalid(code);
  }

  if (prepared.filter((file) => file.path === "index.html").length !== 1) invalid("MISSING_ENTRY_POINT");

  const canonicalFiles = prepared.slice().sort((left, right) => {
    const leftBytes = new TextEncoder().encode(left.path);
    const rightBytes = new TextEncoder().encode(right.path);
    const length = Math.min(leftBytes.length, rightBytes.length);
    for (let index = 0; index < length; index += 1) {
      const difference = leftBytes[index] - rightBytes[index];
      if (difference !== 0) return difference;
    }
    return leftBytes.length - rightBytes.length;
  });

  return {
    schemaVersion: 1,
    entryPoint: "index.html",
    files: canonicalFiles.map(({ path, sizeBytes, contentType, sha256 }) => ({ path, sizeBytes, contentType, sha256 })),
  };
}

export function serializeCanonicalPublishManifest(manifest: CanonicalPublishManifest): string {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    entryPoint: manifest.entryPoint,
    files: manifest.files.map((file) => ({
      path: file.path,
      sizeBytes: file.sizeBytes,
      contentType: file.contentType,
      sha256: file.sha256,
    })),
  });
}

export async function digestCanonicalPublishManifest(manifest: CanonicalPublishManifest): Promise<string> {
  return digestHex("SHA-256", serializeCanonicalPublishManifest(manifest));
}
