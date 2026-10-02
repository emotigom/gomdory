export const EDU_PUBLISH_MANIFEST_SCHEMA_VERSION = 1 as const;

export type PublishAttemptFieldName =
  | "publishAttemptId"
  | "declaredManifestDigest"
  | "manifestSchemaVersion";

export type PublishAttemptCompatibilityFields = {
  publishAttemptId?: unknown;
  declaredManifestDigest?: unknown;
  manifestSchemaVersion?: unknown;
};

export type PublishAttemptEvidenceV1 = {
  publishAttemptId: string;
  declaredManifestDigest: string;
  manifestSchemaVersion: typeof EDU_PUBLISH_MANIFEST_SCHEMA_VERSION;
};

/**
 * These fields stay optional while legacy payloads are accepted. A new attempt
 * payload must contain all three fields; callers should classify before reuse.
 */
export type OptionalPublishAttemptEvidence = {
  publishAttemptId?: string;
  declaredManifestDigest?: string;
  manifestSchemaVersion?: typeof EDU_PUBLISH_MANIFEST_SCHEMA_VERSION;
};

export type PublishAttemptCompatibility =
  | { mode: "legacy" }
  | { mode: "attempt_v1"; evidence: PublishAttemptEvidenceV1 }
  | {
      mode: "partial";
      presentFields: readonly PublishAttemptFieldName[];
      missingFields: readonly PublishAttemptFieldName[];
    }
  | {
      mode: "invalid";
      field: PublishAttemptFieldName | "payload";
      reason: "invalid_type" | "invalid_format" | "invalid_value";
    }
  | { mode: "unsupported_schema"; manifestSchemaVersion: number };

const PUBLISH_ATTEMPT_FIELDS: readonly PublishAttemptFieldName[] = [
  "publishAttemptId",
  "declaredManifestDigest",
  "manifestSchemaVersion",
];
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function isPlainObject(value: unknown): value is PublishAttemptCompatibilityFields {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalid(
  field: PublishAttemptFieldName,
  reason: "invalid_type" | "invalid_format" | "invalid_value",
): PublishAttemptCompatibility {
  return { mode: "invalid", field, reason };
}

export function classifyPublishAttemptCompatibility(value: unknown): PublishAttemptCompatibility {
  if (!isPlainObject(value)) return { mode: "invalid", field: "payload", reason: "invalid_type" };

  const presentFields = PUBLISH_ATTEMPT_FIELDS.filter((field) => value[field] !== undefined);
  if (presentFields.length === 0) return { mode: "legacy" };
  if (presentFields.length !== PUBLISH_ATTEMPT_FIELDS.length) {
    return {
      mode: "partial",
      presentFields,
      missingFields: PUBLISH_ATTEMPT_FIELDS.filter((field) => !presentFields.includes(field)),
    };
  }

  if (typeof value.publishAttemptId !== "string") return invalid("publishAttemptId", "invalid_type");
  if (!CANONICAL_UUID.test(value.publishAttemptId)) return invalid("publishAttemptId", "invalid_format");

  if (typeof value.declaredManifestDigest !== "string") return invalid("declaredManifestDigest", "invalid_type");
  if (!SHA256_HEX.test(value.declaredManifestDigest)) return invalid("declaredManifestDigest", "invalid_format");

  if (typeof value.manifestSchemaVersion !== "number") return invalid("manifestSchemaVersion", "invalid_type");
  if (!Number.isSafeInteger(value.manifestSchemaVersion) || value.manifestSchemaVersion <= 0) {
    return invalid("manifestSchemaVersion", "invalid_value");
  }
  if (value.manifestSchemaVersion !== EDU_PUBLISH_MANIFEST_SCHEMA_VERSION) {
    return { mode: "unsupported_schema", manifestSchemaVersion: value.manifestSchemaVersion };
  }

  return {
    mode: "attempt_v1",
    evidence: {
      publishAttemptId: value.publishAttemptId,
      declaredManifestDigest: value.declaredManifestDigest,
      manifestSchemaVersion: EDU_PUBLISH_MANIFEST_SCHEMA_VERSION,
    },
  };
}
