import type { EduFeatureFlags } from "@/lib/edu/featureFlags";
import {
  resolveLessonWebllmAssetHosts,
  resolveLessonWebllmSelectionMetadata
} from "@/lib/edu/lesson/lessonWebllmAssetConfigAdapter";
import {
  resolveLessonWebllmDecorateBoundary,
  type ResolveLessonWebllmDecorateBoundaryResult,
} from "@/lib/edu/lesson/lessonWebllmExecutionAdapter";
import {
  resolveLessonWebllmGate,
  type LessonWebllmGateHealthState,
} from "@/lib/edu/lesson/lessonWebllmGateAdapter";
import type { WebLLMStatus } from "@/lib/edu/llm/webllmStatus";

export type ResolveLessonWebllmReadinessSnapshotInput = {
  featureFlags: EduFeatureFlags;
  hasWebllmEnv: boolean;
  entryBlocked: boolean;
  health: LessonWebllmGateHealthState | null;
  preferredModelId: string | null;
  degradedBlocked?: boolean;
};

export type LessonWebllmReadinessSnapshot = {
  gate: ReturnType<typeof resolveLessonWebllmGate>;
  descriptor: {
    hosts: ReturnType<typeof resolveLessonWebllmAssetHosts>;
    selection: ReturnType<typeof resolveLessonWebllmSelectionMetadata>;
  };
};

export const resolveLessonWebllmReadinessSnapshot = (
  input: ResolveLessonWebllmReadinessSnapshotInput,
): LessonWebllmReadinessSnapshot => {
  const gate = resolveLessonWebllmGate({
    featureFlags: input.featureFlags,
    hasWebllmEnv: input.hasWebllmEnv,
    entryBlocked: input.entryBlocked,
    health: input.health,
    degradedBlocked: input.degradedBlocked,
  });

  const descriptor = {
    hosts: resolveLessonWebllmAssetHosts({
      effectiveWebllmEnabled: gate.effectiveWebllmEnabled,
      preferredModelId: input.preferredModelId,
      health: input.health,
    }),
    selection: resolveLessonWebllmSelectionMetadata({
      effectiveWebllmEnabled: gate.effectiveWebllmEnabled,
      health: input.health,
    }),
  };

  return { gate, descriptor };
};

export type ResolveLessonWebllmLaneStatusViewInput = {
  readiness: LessonWebllmReadinessSnapshot;
  webllmEntryBlocked: boolean;
  preferredModelId: string | null;
  degradedBlocked?: boolean;
};

export type LessonWebllmLaneStatusView = {
  readinessState: "ready" | "hold" | "disabled";
  disabledReason:
    | "auth_required"
    | "feature_flags_unavailable"
    | "user_disabled"
    | "entry_blocked"
    | "generic_disabled"
    | null;
  holdReason: "env_missing" | "asset_host_missing" | null;
  unavailableGuide: string | null;
  selection: {
    preferredModelId: string | null;
    fallbackModelId: string | null;
    coachModelId: string | null;
  };
  healthHints: {
    hasWebllmEnvEffective: boolean;
    hasModelHost: boolean;
    hasWasmHost: boolean;
    webllmAuthRequired: boolean;
    featureFlagsUnavailable: boolean;
  };
};

export const resolveLessonWebllmLaneStatusView = (
  input: ResolveLessonWebllmLaneStatusViewInput,
): LessonWebllmLaneStatusView => {
  const { readiness, webllmEntryBlocked, preferredModelId } = input;
  const { gate, descriptor } = readiness;
  const hasModelHost = Boolean(descriptor.hosts.modelHost);
  const hasWasmHost = Boolean(descriptor.hosts.wasmHost);
  const selection = {
    preferredModelId,
    fallbackModelId: descriptor.selection.fallbackModelId,
    coachModelId: descriptor.selection.coachModelId,
  };

  if (!gate.effectiveWebllmEnabled) {
    const disabledReason = gate.webllmAuthRequired
      ? "auth_required"
      : gate.featureFlagsUnavailable
        ? "feature_flags_unavailable"
        : gate.webllmEnableDecision.reasonCode === "user_disabled"
          ? "user_disabled"
          : webllmEntryBlocked
            ? "entry_blocked"
            : "generic_disabled";
    const unavailableGuide =
      disabledReason === "auth_required"
        ? "로그인/세션이 필요합니다 (401). WebLLM 권한을 확인하지 못해 온라인 모드(기본 모드)로 전환했어요."
        : disabledReason === "feature_flags_unavailable"
          ? "WebLLM 사용 조건을 확인하지 못했어요. 온라인 모드(기본 모드)로 안전하게 진행합니다."
          : disabledReason === "user_disabled"
            ? "현재 계정 설정에서 WebLLM이 꺼져 있어요. 온라인 모드(기본 모드)로 수업을 진행하세요."
            : disabledReason === "entry_blocked"
              ? "샘플 레슨에서는 WebLLM 리소스 다운로드를 막습니다. 공유 링크(jt)로 입장하면 사용 가능합니다."
              : "WebLLM을 사용할 수 없어도 수업은 정상 진행돼요. 온라인 모드(기본 모드)를 사용해 주세요.";

    return {
      readinessState: "disabled",
      disabledReason,
      holdReason: null,
      unavailableGuide,
      selection,
      healthHints: {
        hasWebllmEnvEffective: gate.hasWebllmEnvEffective,
        hasModelHost,
        hasWasmHost,
        webllmAuthRequired: gate.webllmAuthRequired,
        featureFlagsUnavailable: gate.featureFlagsUnavailable,
      },
    };
  }

  const holdReason = !gate.hasWebllmEnvEffective
    ? "env_missing"
    : !hasModelHost || !hasWasmHost
      ? "asset_host_missing"
      : null;

  return {
    readinessState: holdReason ? "hold" : "ready",
    disabledReason: null,
    holdReason,
    unavailableGuide: null,
    selection,
    healthHints: {
      hasWebllmEnvEffective: gate.hasWebllmEnvEffective,
      hasModelHost,
      hasWasmHost,
      webllmAuthRequired: gate.webllmAuthRequired,
      featureFlagsUnavailable: gate.featureFlagsUnavailable,
    },
  };
};

export type ResolveLessonWebllmLaneBoundaryInput = {
  decorateQuotaExceeded: boolean;
  webllmStatusCode: string | null;
  webllmStatusAt: number | null;
  effectiveStatus: WebLLMStatus;
  effectiveWebllmEnabled: boolean;
  hasModelHost: boolean;
  hasWasmHost: boolean;
  readyWaitMs: number;
  nowMs: number;
};

export const resolveLessonWebllmLaneBoundary = (
  input: ResolveLessonWebllmLaneBoundaryInput,
): ResolveLessonWebllmDecorateBoundaryResult => resolveLessonWebllmDecorateBoundary(input);
