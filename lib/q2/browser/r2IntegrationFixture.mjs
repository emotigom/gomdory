const MAX_BYTES = 1024;
const MIME = "text/plain; charset=utf-8";
const PREFIX = "q2/b9-c/";

function fail(message) {
  throw new Error(`Q2-B9-C fixture: ${message}`);
}

export function assertQaObjectKey(key) {
  if (typeof key !== "string" || !key.startsWith(PREFIX)) fail("key must use the q2/b9-c/ namespace");
  if (key.startsWith("/") || key.includes("..") || key.includes("\\") || /[\u0000-\u001f\u007f]/.test(key)) fail("unsafe object key");
  const parts = key.split("/");
  if (parts.length !== 5 || !parts.every(Boolean) || !parts.at(-1)?.endsWith(".txt")) fail("invalid fixture key shape");
  return key;
}

export function assertFixture(input) {
  const bytes = input?.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) fail("fixture must be 1..1024 bytes");
  if (input.mimeType !== MIME) fail("fixture MIME must be text/plain; charset=utf-8");
  assertQaObjectKey(input.key);
  return input;
}

export class LocalR2Bucket {
  #objects = new Map();
  mutations = { put: 0, get: 0, head: 0, delete: 0 };

  async put(key, value, options = {}) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    if (this.#objects.has(key)) fail("refusing to overwrite an existing object");
    this.mutations.put += 1;
    this.#objects.set(key, {
      bytes,
      httpMetadata: options.httpMetadata ?? {},
      customMetadata: options.customMetadata ?? {},
      etag: `local-${bytes.byteLength}`,
    });
    return { key, size: bytes.byteLength, etag: `local-${bytes.byteLength}`, httpEtag: `\"local-${bytes.byteLength}\"` };
  }

  async head(key) {
    this.mutations.head += 1;
    const object = this.#objects.get(key);
    return object ? { key, size: object.bytes.byteLength, etag: object.etag, httpMetadata: object.httpMetadata, customMetadata: object.customMetadata } : null;
  }

  async get(key) {
    this.mutations.get += 1;
    const object = this.#objects.get(key);
    return object ? { ...object, arrayBuffer: async () => object.bytes.buffer.slice(object.bytes.byteOffset, object.bytes.byteOffset + object.bytes.byteLength) } : null;
  }

  async delete(key) {
    this.mutations.delete += 1;
    this.#objects.delete(key);
  }

  count() { return this.#objects.size; }
}

export async function uploadFixture({ bucket, key, bytes, mimeType, sha256 }) {
  assertFixture({ key, bytes, mimeType });
  if (!/^[a-f0-9]{64}$/i.test(sha256 ?? "")) fail("invalid SHA-256");
  return bucket.put(key, bytes, {
    httpMetadata: { contentType: mimeType },
    customMetadata: { sha256, q2WorkId: "Q2-B9-C" },
  });
}

export async function readFixture({ bucket, key }) {
  assertQaObjectKey(key);
  const object = await bucket.get(key);
  if (!object) return null;
  return { bytes: new Uint8Array(await object.arrayBuffer()), contentType: object.httpMetadata?.contentType, sha256: object.customMetadata?.sha256, etag: object.etag };
}

export async function deleteFixture({ bucket, key }) {
  assertQaObjectKey(key);
  await bucket.delete(key);
  return (await bucket.head(key)) === null;
}

export const R2_INTEGRATION_FIXTURE = { MIME, MAX_BYTES, PREFIX };
