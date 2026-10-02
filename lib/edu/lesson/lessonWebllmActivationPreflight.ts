import {
  resolveLessonWebllmLaneStatusView,
  type LessonWebllmReadinessSnapshot,
} from "@/lib/edu/lesson/lessonWebllmLaneDescriptor";

export type LessonWebllmActivationHardBlocker =
  | "auth_required"
  | "feature_flags_unavailable"
  | "user_disabled"
  | "entry_blocked"
  | "generic_disabled"
  | "env_missing"
  | "asset_host_missing"
  | "ssot_disabled"
  | "model_metadata_missing";

export type LessonWebllmActivationPreflight = {
  eligibility: "eligible" | "ineligible";
  hardBlockers: LessonWebllmActivationHardBlocker[];
  requiredConditions: {
    hasWebllmEnvEffective: boolean;
    hasModelHost: boolean;
    hasWasmHost: boolean;
    hasModelSelectionMetadata: boolean;
  };
  guardrails: {
    keepCoachDecorateMainline: true;
    webllmContainedNoProviderSwitch: true;
    noTelemetryContractChange: true;
  };
};

export type ResolveLessonWebllmActivationPreflightInput = {
  readiness: LessonWebllmReadinessSnapshot;
  webllmEntryBlocked: boolean;
  preferredModelId: string | null;
};

export const resolveLessonWebllmActivationPreflight = (
  input: ResolveLessonWebllmActivationPreflightInput,
): LessonWebllmActivationPreflight => {
  const statusView = resolveLessonWebllmLaneStatusView({
    readiness: input.readiness,
    webllmEntryBlocked: input.webllmEntryBlocked,
    preferredModelId: input.preferredModelId,
  });

  const hardBlockers = new Set<LessonWebllmActivationHardBlocker>();

  if (statusView.readinessState === "disabled" && statusView.disabledReason) {
    hardBlockers.add(statusView.disabledReason);
  }
  if (statusView.readinessState === "hold" && statusView.holdReason) {
    hardBlockers.add(statusView.holdReason);
  }
  if (input.readiness.gate.webllmSsotDisabled) {
    hardBlockers.add("ssot_disabled");
  }

  const hasModelSelectionMetadata = Boolean(
    statusView.selection.preferredModelId ||
      statusView.selection.fallbackModelId ||
      statusView.selection.coachModelId,
  );

  if (!hasModelSelectionMetadata) {
    hardBlockers.add("model_metadata_missing");
  }

  return {
    eligibility: hardBlockers.size === 0 ? "eligible" : "ineligible",
    hardBlockers: [...hardBlockers],
    requiredConditions: {
      hasWebllmEnvEffective: statusView.healthHints.hasWebllmEnvEffective,
      hasModelHost: statusView.healthHints.hasModelHost,
      hasWasmHost: statusView.healthHints.hasWasmHost,
      hasModelSelectionMetadata,
    },
    guardrails: {
      keepCoachDecorateMainline: true,
      webllmContainedNoProviderSwitch: true,
      noTelemetryContractChange: true,
    },
  };
};
