import { toHex } from "./webcrypto";

type Sha256Input = ArrayBuffer | Uint8Array | Blob;
const DEFAULT_MAX_FILE_BYTES = 30 * 1024 * 1024;

function normalizeBuffer(input: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (!(input instanceof Uint8Array)) {
    return input;
  }

  if (input.buffer instanceof ArrayBuffer) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  }

  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy.buffer;
}

async function normalizeInput(input: Sha256Input): Promise<ArrayBuffer> {
  if (input instanceof Blob) {
    return input.arrayBuffer();
  }

  return normalizeBuffer(input);
}

export async function sha256Hex(input: Sha256Input): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await normalizeInput(input));
  return toHex(digest);
}

export async function sha256BlobHex(blob: Blob): Promise<string> {
  return sha256Hex(blob);
}

export async function fileSha256Hex(
  file: File,
  options: { maxBytes?: number } = {},
): Promise<string> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_FILE_BYTES;

  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error("maxBytes must be a positive number");
  }

  if (file.size > maxBytes) {
    throw new Error("file_too_large_for_hash");
  }

  return sha256Hex(await file.arrayBuffer());
}
