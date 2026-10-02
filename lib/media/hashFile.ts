import { fileSha256Hex } from "@/lib/crypto/sha256";

const DEFAULT_MAX_BYTES = 30 * 1024 * 1024;

export async function hashFile(
  file: File,
  options: { maxBytes?: number } = {},
): Promise<{ sha256Hex: string | null; skipped: boolean }> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error("maxBytes must be a positive number");
  }

  if (file.size > maxBytes) {
    console.warn("[hashFile] skipping sha256 for large file", { size: file.size, maxBytes });
    return { sha256Hex: null, skipped: true };
  }

  try {
    const sha256Hex = await fileSha256Hex(file, { maxBytes });
    return { sha256Hex, skipped: false };
  } catch (error) {
    if (error instanceof Error && error.message === "file_too_large_for_hash") {
      console.warn("[hashFile] skipping sha256 for large file", { size: file.size, maxBytes });
      return { sha256Hex: null, skipped: true };
    }
    console.warn("[hashFile] failed to hash file", error);
    return { sha256Hex: null, skipped: true };
  }
}
