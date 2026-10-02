import {
  createDeclaredPublishManifestEvidence,
  type DeclaredPublishSourceFile,
} from "@/lib/edu/publish/declaredManifestEvidence";
import type { CanonicalPublishManifest } from "@/lib/edu/publish/manifest";

export type PublishUploadSource = {
  path: string;
  contentType: string;
  body: string | Blob | Uint8Array;
};

export type OptionalClientPrepareEvidence = {
  files: Array<{
    path: string;
    contentType: string;
    sizeBytes: number;
  }>;
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;
  declaredManifest: CanonicalPublishManifest;
};

const textEncoder = new TextEncoder();

function sourceBodyToBytes(body: PublishUploadSource["body"]): Uint8Array {
  if (typeof body === "string") return textEncoder.encode(body);
  if (body instanceof Uint8Array) return body;
  throw new Error("UNSUPPORTED_PUBLISH_UPLOAD_BODY");
}

async function sourceToDeclaredFile(source: PublishUploadSource): Promise<DeclaredPublishSourceFile> {
  const bytes = source.body instanceof Blob
    ? new Uint8Array(await source.body.arrayBuffer())
    : sourceBodyToBytes(source.body);

  return { path: source.path, contentType: source.contentType, bytes };
}

export async function createClientPublishPrepareEvidence(
  sources: readonly PublishUploadSource[],
): Promise<OptionalClientPrepareEvidence> {
  const evidence = await createDeclaredPublishManifestEvidence(
    await Promise.all(sources.map(sourceToDeclaredFile)),
  );

  return {
    files: evidence.manifest.files.map(({ path, contentType, sizeBytes }) => ({ path, contentType, sizeBytes })),
    manifestSchemaVersion: evidence.manifest.schemaVersion,
    declaredManifestDigest: evidence.declaredManifestDigest,
    declaredManifest: evidence.manifest,
  };
}
