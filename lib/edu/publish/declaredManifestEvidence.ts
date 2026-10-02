import { sha256Hex } from "@/lib/crypto/sha256";
import {
  canonicalizeDeclaredPublishManifest,
  digestCanonicalPublishManifest,
  PublishManifestContractError,
  serializeCanonicalPublishManifest,
  type CanonicalPublishManifest,
} from "@/lib/edu/publish/manifest";

export type DeclaredPublishSourceFile = {
  path: string;
  contentType: string;
  bytes: Uint8Array;
};

export type DeclaredPublishManifestEvidence = {
  manifest: CanonicalPublishManifest;
  serializedManifest: string;
  declaredManifestDigest: string;
};

function invalidManifestBytes(): never {
  throw new PublishManifestContractError("INVALID_MANIFEST_BYTES");
}

/**
 * Deterministic evidence for the supplied source bytes. This does not verify
 * that R2 or another server-side object contains the same bytes.
 */
export async function createDeclaredPublishManifestEvidence(
  files: readonly DeclaredPublishSourceFile[],
): Promise<DeclaredPublishManifestEvidence> {
  if (!Array.isArray(files)) invalidManifestBytes();

  const declaredFiles = await Promise.all(
    files.map(async (file) => {
      if (!file || typeof file !== "object" || !(file.bytes instanceof Uint8Array)) {
        invalidManifestBytes();
      }

      return {
        path: file.path,
        sizeBytes: file.bytes.byteLength,
        contentType: file.contentType,
        sha256: await sha256Hex(file.bytes),
      };
    }),
  );

  const manifest = canonicalizeDeclaredPublishManifest(declaredFiles);
  const serializedManifest = serializeCanonicalPublishManifest(manifest);
  const declaredManifestDigest = await digestCanonicalPublishManifest(manifest);

  return { manifest, serializedManifest, declaredManifestDigest };
}
