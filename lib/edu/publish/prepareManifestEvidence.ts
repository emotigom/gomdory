import {
  canonicalizeDeclaredPublishManifest,
  digestCanonicalPublishManifest,
  PublishManifestContractError,
  serializeCanonicalPublishManifest,
  type CanonicalPublishManifest,
  type DeclaredPublishFile,
} from "@/lib/edu/publish/manifest";

export type PublishPrepareManifestEvidenceFields = {
  manifestSchemaVersion?: unknown;
  declaredManifestDigest?: unknown;
  declaredManifest?: unknown;
};

export type PublishPrepareManifestEvidenceFieldName =
  | "manifestSchemaVersion"
  | "declaredManifestDigest"
  | "declaredManifest";

export type DeclaredPrepareManifestEvidenceV1 = {
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;
  declaredManifest: CanonicalPublishManifest;
  serializedManifest: string;
};

export type PublishPrepareManifestEvidenceCompatibility =
  | { mode: "legacy" }
  | { mode: "declared_v1"; evidence: DeclaredPrepareManifestEvidenceV1 }
  | {
      mode: "partial";
      presentFields: readonly PublishPrepareManifestEvidenceFieldName[];
      missingFields: readonly PublishPrepareManifestEvidenceFieldName[];
    }
  | {
      mode: "invalid";
      field:
        | PublishPrepareManifestEvidenceFieldName
        | "declaredManifest.schemaVersion"
        | "declaredManifest.entryPoint"
        | "declaredManifest.files"
        | "payload";
      reason: "invalid_type" | "invalid_format" | "invalid_value" | "invalid_manifest";
    }
  | { mode: "unsupported_schema"; manifestSchemaVersion: number }
  | { mode: "digest_mismatch" };

const MANIFEST_SCHEMA_VERSION = 1 as const;
const EVIDENCE_FIELDS: readonly PublishPrepareManifestEvidenceFieldName[] = [
  "manifestSchemaVersion",
  "declaredManifestDigest",
  "declaredManifest",
];
const SHA256_HEX = /^[0-9a-f]{64}$/;
type InvalidClassification = Extract<PublishPrepareManifestEvidenceCompatibility, { mode: "invalid" }>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalidField(
  field: InvalidClassification["field"],
  reason: InvalidClassification["reason"],
): InvalidClassification {
  return { mode: "invalid", field, reason };
}

function invalidManifest(
  field:
    | "declaredManifest"
    | "declaredManifest.schemaVersion"
    | "declaredManifest.entryPoint"
    | "declaredManifest.files" = "declaredManifest.files",
): Extract<PublishPrepareManifestEvidenceCompatibility, { mode: "invalid" }> {
  return invalidField(field, "invalid_manifest");
}

function pickDeclaredFile(value: unknown): DeclaredPublishFile {
  const file = isPlainObject(value) ? value : {};
  return {
    path: file.path as string,
    sizeBytes: file.sizeBytes as number,
    contentType: file.contentType as string,
    sha256: file.sha256 as string,
  };
}

export async function classifyPublishPrepareManifestEvidence(
  value: unknown,
): Promise<PublishPrepareManifestEvidenceCompatibility> {
  if (!isPlainObject(value)) return invalidField("payload", "invalid_type");

  const presentFields = EVIDENCE_FIELDS.filter((field) => value[field] !== undefined);
  if (presentFields.length === 0) return { mode: "legacy" };
  if (presentFields.length !== EVIDENCE_FIELDS.length) {
    return {
      mode: "partial",
      presentFields,
      missingFields: EVIDENCE_FIELDS.filter((field) => !presentFields.includes(field)),
    };
  }

  const manifestSchemaVersion = value.manifestSchemaVersion;
  if (typeof manifestSchemaVersion !== "number") return invalidField("manifestSchemaVersion", "invalid_type");
  if (!Number.isSafeInteger(manifestSchemaVersion) || manifestSchemaVersion <= 0) {
    return invalidField("manifestSchemaVersion", "invalid_value");
  }
  if (manifestSchemaVersion !== MANIFEST_SCHEMA_VERSION) {
    return { mode: "unsupported_schema", manifestSchemaVersion };
  }

  const declaredManifestDigest = value.declaredManifestDigest;
  if (typeof declaredManifestDigest !== "string") return invalidField("declaredManifestDigest", "invalid_type");
  if (!SHA256_HEX.test(declaredManifestDigest)) return invalidField("declaredManifestDigest", "invalid_format");

  const submittedManifest = value.declaredManifest;
  if (!isPlainObject(submittedManifest)) return invalidManifest("declaredManifest");
  if (submittedManifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) return invalidManifest("declaredManifest.schemaVersion");
  if (submittedManifest.entryPoint !== "index.html") return invalidManifest("declaredManifest.entryPoint");
  if (!Array.isArray(submittedManifest.files)) return invalidManifest("declaredManifest.files");

  let declaredManifest: CanonicalPublishManifest;
  try {
    declaredManifest = canonicalizeDeclaredPublishManifest(submittedManifest.files.map(pickDeclaredFile));
  } catch (error: unknown) {
    if (error instanceof PublishManifestContractError) return invalidManifest();
    throw error;
  }

  const serializedManifest = serializeCanonicalPublishManifest(declaredManifest);
  const calculatedDigest = await digestCanonicalPublishManifest(declaredManifest);
  if (declaredManifestDigest !== calculatedDigest) return { mode: "digest_mismatch" };

  return {
    mode: "declared_v1",
    evidence: {
      manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
      declaredManifestDigest,
      declaredManifest,
      serializedManifest,
    },
  };
}
