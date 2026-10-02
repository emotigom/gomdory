import {
  classifyPublishAttemptCompatibility,
} from "@/lib/edu/publish/attemptCompatibility";
import {
  classifyPendingManifestEvidenceForForwarding,
  type ForwardablePendingManifestEvidenceV1,
} from "@/lib/edu/publish/pendingManifestEvidence";
import { EDU_PUBLISH_COMMIT_CAPABILITY_MAX_TOKEN_LENGTH } from "@/lib/edu/publish/commitCapability";

export type { ForwardablePendingManifestEvidenceV1 };

export type PublishPrepareAttemptResponseFields = {
  publishAttemptId?: unknown;
  declaredManifestDigest?: unknown;
  manifestSchemaVersion?: unknown;
  publishCapability?: unknown;
};

export type ClientPrepareAttemptSelection =
  | {
      mode: "attempt_v1";
      publishAttemptId: string;
    }
  | {
      mode: "not_available";
    };

export function selectClientPrepareAttemptIdentity(
  response: unknown,
  localEvidence: ForwardablePendingManifestEvidenceV1 | null,
): ClientPrepareAttemptSelection {
  if (!localEvidence) return { mode: "not_available" };

  const responseAttempt = classifyPublishAttemptCompatibility(response);
  if (responseAttempt.mode !== "attempt_v1") return { mode: "not_available" };
  if (responseAttempt.evidence.declaredManifestDigest !== localEvidence.declaredManifestDigest) {
    return { mode: "not_available" };
  }
  if (responseAttempt.evidence.manifestSchemaVersion !== localEvidence.manifestSchemaVersion) {
    return { mode: "not_available" };
  }

  return {
    mode: "attempt_v1",
    publishAttemptId: responseAttempt.evidence.publishAttemptId,
  };
}

export type ForwardableOpaquePublishCapability = {
  publishCapability: string;
};

export type ClientPreparePublishSecuritySelection =
  | {
      mode: "not_available";
      fields: Record<string, never>;
    }
  | {
      mode: "attempt_v1";
      fields: {
        publishAttemptId: string;
      };
    }
  | {
      mode: "capability_opaque";
      fields: {
        publishAttemptId: string;
        publishCapability: string;
      };
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isForwardableOpaquePublishCapability(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= EDU_PUBLISH_COMMIT_CAPABILITY_MAX_TOKEN_LENGTH &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

export function selectClientPreparePublishSecurity(
  response: unknown,
  localEvidence: ForwardablePendingManifestEvidenceV1 | null,
): ClientPreparePublishSecuritySelection {
  const attemptSelection = selectClientPrepareAttemptIdentity(response, localEvidence);
  if (attemptSelection.mode !== "attempt_v1") {
    return { mode: "not_available", fields: {} };
  }

  if (!isPlainObject(response) || !isForwardableOpaquePublishCapability(response.publishCapability)) {
    return {
      mode: "attempt_v1",
      fields: { publishAttemptId: attemptSelection.publishAttemptId },
    };
  }

  return {
    mode: "capability_opaque",
    fields: {
      publishAttemptId: attemptSelection.publishAttemptId,
      publishCapability: response.publishCapability,
    },
  };
}

export type ForwardablePendingPublishCommitFieldsV1 =
  ForwardablePendingManifestEvidenceV1 & {
    publishAttemptId: string;
  };

export type ForwardablePendingPublishCapabilityFields =
  ForwardablePendingPublishCommitFieldsV1 & ForwardableOpaquePublishCapability;

export type PendingPublishCommitForwarding =
  | {
      mode: "legacy";
      fields: Record<string, never>;
    }
  | {
      mode: "manifest_v1";
      fields: ForwardablePendingManifestEvidenceV1;
    }
  | {
      mode: "attempt_v1";
      fields: ForwardablePendingPublishCommitFieldsV1;
    }
  | {
      mode: "capability_opaque";
      fields: ForwardablePendingPublishCapabilityFields;
    }
  | {
      mode: "not_forwardable";
      fields: Record<string, never>;
    };

export function classifyPendingPublishCommitForForwarding(
  value: unknown,
): PendingPublishCommitForwarding {
  const manifestResult = classifyPendingManifestEvidenceForForwarding(value);

  if (manifestResult.mode === "legacy") {
    return { mode: "legacy", fields: {} };
  }
  if (manifestResult.mode === "not_forwardable") {
    return { mode: "not_forwardable", fields: {} };
  }

  const manifestEvidence = manifestResult.evidence;
  const pendingAttempt = classifyPublishAttemptCompatibility(value);
  if (
    pendingAttempt.mode === "attempt_v1" &&
    pendingAttempt.evidence.declaredManifestDigest === manifestEvidence.declaredManifestDigest &&
    pendingAttempt.evidence.manifestSchemaVersion === manifestEvidence.manifestSchemaVersion
  ) {
    if (isPlainObject(value) && isForwardableOpaquePublishCapability(value.publishCapability)) {
      return {
        mode: "capability_opaque",
        fields: {
          ...manifestEvidence,
          publishAttemptId: pendingAttempt.evidence.publishAttemptId,
          publishCapability: value.publishCapability,
        },
      };
    }

    return {
      mode: "attempt_v1",
      fields: {
        ...manifestEvidence,
        publishAttemptId: pendingAttempt.evidence.publishAttemptId,
      },
    };
  }

  return { mode: "manifest_v1", fields: manifestEvidence };
}
