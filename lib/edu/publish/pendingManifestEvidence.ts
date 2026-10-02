import type { CanonicalPublishManifest } from "@/lib/edu/publish/manifest";

export type PendingPublishManifestEvidenceFields = {
  manifestSchemaVersion?: unknown;
  declaredManifestDigest?: unknown;
  declaredManifest?: unknown;
};

export type ForwardablePendingManifestEvidenceV1 = {
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;
  declaredManifest: CanonicalPublishManifest;
};

export type PendingManifestEvidenceForwarding =
  | { mode: "legacy" }
  | {
      mode: "forwardable_v1";
      evidence: ForwardablePendingManifestEvidenceV1;
    }
  | { mode: "not_forwardable" };

const EVIDENCE_FIELDS = [
  "manifestSchemaVersion",
  "declaredManifestDigest",
  "declaredManifest",
] as const;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function copyManifestFiles(value: unknown): CanonicalPublishManifest["files"] {
  if (!Array.isArray(value)) return [];

  return value.map((file) => {
    if (!isPlainObject(file)) return {} as CanonicalPublishManifest["files"][number];
    return {
      path: file.path as string,
      sizeBytes: file.sizeBytes as number,
      contentType: file.contentType as string,
      sha256: file.sha256 as string,
    };
  });
}

export function classifyPendingManifestEvidenceForForwarding(
  value: unknown,
): PendingManifestEvidenceForwarding {
  if (!isPlainObject(value)) return { mode: "not_forwardable" };

  const presentFields = EVIDENCE_FIELDS.filter((field) => value[field] !== undefined);
  if (presentFields.length === 0) return { mode: "legacy" };
  if (presentFields.length !== EVIDENCE_FIELDS.length) return { mode: "not_forwardable" };

  if (value.manifestSchemaVersion !== 1) return { mode: "not_forwardable" };

  const declaredManifestDigest = value.declaredManifestDigest;
  if (typeof declaredManifestDigest !== "string" || !SHA256_HEX.test(declaredManifestDigest)) {
    return { mode: "not_forwardable" };
  }

  const submittedManifest = value.declaredManifest;
  if (!isPlainObject(submittedManifest)) return { mode: "not_forwardable" };
  if (submittedManifest.schemaVersion !== 1) return { mode: "not_forwardable" };
  if (submittedManifest.entryPoint !== "index.html") return { mode: "not_forwardable" };
  if (!Array.isArray(submittedManifest.files)) return { mode: "not_forwardable" };

  return {
    mode: "forwardable_v1",
    evidence: {
      manifestSchemaVersion: 1,
      declaredManifestDigest,
      declaredManifest: {
        schemaVersion: 1,
        entryPoint: "index.html",
        files: copyManifestFiles(submittedManifest.files),
      },
    },
  };
}
