"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
  type SVGProps,
} from "react";
import { digestHex, randomHex } from "@/lib/crypto/webcrypto";
import { recordEduEvent } from "@/lib/edu/opsEvent";
import {
  createStudentCoachActionPlan,
  createStudentDecorateActionPlan,
  recordStudentChatPanelTelemetryEvents,
} from "@/lib/edu/lesson/studentChatPanelOrchestration";
import {
  buildCoachActionSystemPrompt,
  buildCoachChatSystemPrompt,
  buildCoachFilesSystemPrompt,
} from "@/lib/edu/prompts";
import {
  abort as abortWebLLM,
  onProgress as onWebLLMProgress,
  start as startWebLLM,
  terminate as terminateWebLLMWorker,
} from "@/lib/edu/llm/webllmWorkerBridge";
import type {
  LocalChatMessage,
  WebLLMWorkerProgressEvent,
} from "@/lib/edu/llm/webllmWorkerTypes";
import { getGeneratorOverrideFlags, setGeneratorOverrideFlags } from "@/lib/edu/llm/diagnostics";
import { getWebLLMStatusDescriptor, type WebLLMStatus } from "@/lib/edu/llm/webllmStatus";
import {
  consumeWebllmRetryOnce,
  markWebllmDegraded,
  readWebllmDegradedGate,
} from "@/lib/edu/llm/webllmDegradedGate";
import {
  coachActionJsonSchema,
  coachActionSchema,
  filesSchema,
  type CoachAction,
} from "@/lib/edu/llm/responseSchemas";
import { sanitizeGeneratedFiles } from "@/lib/edu/files/sanitizeGeneratedFiles";
import { ensureRequiredRefs, normalizeFiles, type NormalizedFile } from "@/lib/edu/fileProtocol";
import { sanitizeUserInput, type Sanitized } from "@/lib/edu/input/sanitize";
import { makeInsuranceTemplate } from "@/lib/edu/insuranceTemplate";
import { sanitizeHanAsLastResort } from "@/lib/edu/hanGuard";
import { detectOffTrack } from "@/lib/edu/lesson/detectOffTrack";
import { getLocalEduNickname } from "@/app/edu/_utils/nickname";
import { runPrewarm as runWebllmPrewarm } from "@/lib/edu/prewarm";
import {
  getLessonIdFromNumber,
  getLessonSpec,
  type LessonId,
  type LessonLock,
} from "@/lib/edu/lesson/lessonLock";
import {
  getLessonContentSchema,
  getLessonContentZodSchema,
  lessonInsuranceContent,
  normalizeLessonContent,
  type P1Content,
  type P2Content,
  type P3Content,
  type P4Content,
} from "@/lib/edu/templates/schema";
import { renderLessonSite } from "@/lib/edu/templates";
import { getTemplateHintByKey, getTemplatesForLesson } from "@/lib/edu/templates/library";
import { applySlotIntent, patchTemplateFromRequest } from "@/lib/edu/templates/patchFromRequest";
import { sanitizeCoachText, type CoachSanitizeResult } from "@/lib/edu/text/coachSanitize";
import { detectKana, explainHanFound, sanitizeKanaAsLastResort } from "@/lib/edu/text/koreanGuard";
import { rewriteKoreanOnce } from "@/lib/edu/text/koreanRewrite";
import ExamplePromptPopover from "@/app/edu/_components/ExamplePromptPopover";
import {
  getNetworkPrepStatus,
  setNetworkPrepStatus,
  subscribeNetworkPrepStatus,
} from "@/lib/edu/netsaver/status";
import { createSingleFlight } from "@/lib/edu/runtime/singleFlight";
import { createSnapshotBuffer, type FileSnapshot } from "@/lib/edu/runtime/snapshots";
import {
  clearLocalAutosave,
  getAutosaveEnabled,
  restoreLocalAutosave,
  saveLocalAutosave,
  setAutosaveEnabled,
} from "@/lib/edu/runtime/localAutosave";
import { requestEduAiChat } from "@/lib/edu/ai/eduAiClient";
import { recordChatSoftError } from "@/lib/edu/recordChatSoftError.client";
import {
  createEduMetricsBuffer,
  type EduMetricEvent,
  type EduMetricEventName,
  type EduMetricEventSnapshot,
  type EduPanelStepId,
  type EduMetricStep,
  type EduMetricsSummary,
  normalizeMetricsSummary,
} from "@/lib/edu/telemetry/eduSessionMetrics";
import GlowProgressBar from "@/app/edu/_components/GlowProgressBar";
import ChatPanelErrorBoundary from "@/app/edu/_components/ChatPanelErrorBoundary";
import ChatMessageItem from "@/app/edu/_components/ChatMessageItem";
import StudentDecorateSurface from "@/app/edu/_components/StudentDecorateSurface";
import TeacherControlPanel from "@/app/edu/_components/TeacherControlPanel";
import type { WorkspaceFile } from "@/app/edu/_components/Workspace";
import { usePrefersReducedMotion } from "@/lib/ui/motion";
import { analyzeFiles } from "@/lib/edu/quality/analyze";
import { resolveTeacherMode } from "@/lib/edu/ui/teacherMode";
import {
  applyWaitingActionChangeSet,
  getContextualFallbackActions,
  shouldShowStudentDecorateAssistUi,
  WAITING_ACTION_LABELS,
  type WaitingActionId,
} from "@/lib/edu/waitingActions";
import { verifySlotTargets } from "@/lib/edu/slots/verifySlotTargets";
import SlotChoiceActions, { type SlotChoiceAction } from "@/app/edu/_components/SlotChoiceActions";
import { runCoachHealthcheck } from "@/lib/dev/coachHealthcheck";
import { simpleCoach, type SimpleCoachResult } from "@/lib/edu/coach/simpleCoach";
import {
  getWebLLMLastGoodSelection,
  prefetchWebLLMAssets,
  type WebLLMLastGoodSelection,
} from "@/lib/edu/llm/webllmRuntime";
import { getWebLLMDeviceTier, readWebLLMCooldownState } from "@/lib/edu/llm/webllmTiering";
import {
  getEduWebLLMPrefetchFlag,
} from "@/lib/edu/llm/webllmFeatureFlags";
import { usePathname, useSearchParams } from "next/navigation";
import { fetchEduFeatureFlags } from "@/lib/edu/featureFlagsClient";
import { EDU_FEATURE_FLAGS_DEFAULTS } from "@/lib/edu/featureFlags";
import { setNetworkSaverUserFlags } from "@/lib/edu/netsaver/config";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { applyHtmlCssPatch } from "@/lib/edu/patch/applyHtmlCssPatch";
import { useWebLLM } from "@/lib/edu/llm/useWebLLM";
import {
  resolveLessonWebllmLaneBoundary,
  resolveLessonWebllmLaneStatusView,
  resolveLessonWebllmReadinessSnapshot,
} from "@/lib/edu/lesson/lessonWebllmLaneDescriptor";
import { resolveLessonWebllmActivationPreflight } from "@/lib/edu/lesson/lessonWebllmActivationPreflight";
import { resolveLessonWebllmActivationHook } from "@/lib/edu/lesson/lessonWebllmActivationHook";
import {
  readLessonWebllmDispatchExperimentMode,
  readLessonWebllmDispatchKillSwitchEnabled,
  readLessonWebllmDispatchRolloutLessonAllowlistRaw,
  resolveLessonWebllmDispatchSelector,
} from "@/lib/edu/lesson/lessonWebllmDispatchSelector";
import {
  resolveLessonWebllmContainedDispatchPlan,
  resolveLessonWebllmExperimentOutcome,
  shouldFallbackToOpenAiMainline,
} from "@/lib/edu/lesson/lessonWebllmLiveDispatchExperiment";
import { resolveLessonWebllmExperimentAuditRecord } from "@/lib/edu/lesson/lessonWebllmExperimentAudit";
import {
  appendWebllmContainedRolloutEvidence,
  buildWebllmContainedAttemptEvidence,
  getWebllmContainedRolloutEvidence,
  type WebllmContainedAttemptDecision,
  type WebllmContainedAttemptOutcome,
} from "@/lib/edu/llm/webllmContainedRolloutEvidence";
import {
  resolveWebllmContainedRolloutSnapshot,
  type WebllmContainedLessonScope,
} from "@/lib/edu/llm/webllmContainedRolloutSnapshot";
import { buildWebllmContainedLessonExecutionStripModel } from "@/lib/edu/llm/webllmContainedLessonExecutionStrip";
import { readLessonWebllmActivationExperimentMode } from "@/lib/edu/lesson/lessonWebllmActivationPolicy";
import { type LessonWebllmGateHealthState } from "@/lib/edu/lesson/lessonWebllmGateAdapter";
import { resolveLessonWebllmErrorStatus } from "@/lib/edu/lesson/lessonWebllmExecutionAdapter";
import { classifyTemplateAbortUiReason, resolveGenerateJsonTimeoutMs } from "@/lib/edu/llm/abortUtils";
import { runDecorateFlow } from "@/lib/edu/lesson/runDecorateFlow";
import {
  getStructureAwareStudentDecorateExamples,
  getStudentDecorateInputGuidanceCopy,
  getStudentDecorateResultCopy,
  buildStudentOutcomeSummary,
  buildStudentResultConfidenceLine,
  inferStudentMajorTargetsFromPlan,
  resolveStudentDecorateCtaModel,
  type StudentDecorateExampleKind,
  type StudentDecorateUiState,
} from "@/lib/edu/lesson/studentDecorateUi";
import { runDecorateReliabilityPrewarm } from "@/lib/edu/lesson/decorateReliabilityPrewarm";
import WebLLMLessonExecutionStrip from "@/app/edu/_components/WebLLMLessonExecutionStrip";
import { requestServerDecoratePlan } from "@/lib/edu/lesson/serverDecoratePlanClient";
import { createDecorateController, type DecorateControllerPhase } from "@/lib/edu/lesson/decorateController";
import {
  classifyPreviewApplyConsistency,
  decidePendingInvalidationReason,
  evaluateDecoratePreviewQuality,
  autoEnrichLowImpactPreview,
  hardenOpenaiResponseQuality,
  raiseFallbackQualityFloor,
  decideAcceptedStudentResult,
  decideStudentCoachRecovery,
  shouldBlockGeneratorFallbackRestore,
  type DecoratePendingInvalidationReason,
} from "@/lib/edu/lesson/decorateGuards";
import { reportUiError } from "@/lib/ops/reportUiError.client";
import { routeDecorateIntent, type DecoratePrimaryIntent } from "@/lib/edu/lesson/decorateIntentRouter";
import { classifyDecorateStyleIntent } from "@/lib/edu/lesson/decorateStyleIntent";
import { buildDecorateHistoryContext, type DecorateHistoryContext } from "@/lib/edu/lesson/decorateHistoryContext";
import {
  createDecorateMetrics,
  hasDisallowedImageSource,
  type DecorateMetrics,
} from "@/lib/edu/lesson/decoratePipeline";
import {
  buildDecorateCacheKey,
  createDecoratePreviewCache,
  getDecorateCacheTtlMs,
  hashDecoratePrompt,
  shouldCacheDecoratePreview,
} from "@/lib/edu/lesson/decoratePreviewCache";
import { buildDecorateDebugSummary, buildDecorateTuningSignal } from "@/lib/edu/lesson/decorateObservability";
import { scoreDecorateOutcome } from "@/lib/edu/lesson/decorateOutcomeScoring";
import { resolveStudentProviderAvailability } from "@/lib/edu/lesson/studentExecutionProviderAvailability";
import { type StudentCoachSubmitSource } from "@/lib/edu/lesson/studentCoachExecution";
import {
  resolveStudentDecorateStartOutcomeState,
  type StudentDecorateSubmitSource,
} from "@/lib/edu/lesson/studentDecorateExecution";
import { allowedCoachFiles } from "@/lib/edu/llm/coachFilesValidation";

const isDev = process.env.NODE_ENV !== "production";
const devToolsEnabled = isDev || process.env.NEXT_PUBLIC_DEV_TOOLS === "1";
const MAX_INPUT_SUMMARY = 120;
const MAX_OUTPUT_SNAPSHOT = 500;
const WEBLLM_ALLOWED_FILES = allowedCoachFiles;
const WEBLLM_FALLBACK_DELAY_MS = 1500;
const SIMPLE_COACH_DELAY_MS = 7000;
const RETRY_PROMPT_DELAY_MS = 10000;
const WEBLLM_DEGRADED_COOLDOWN_MS = 5 * 60 * 1000;
const WEBLLM_FAILURE_WINDOW_MS = 2 * 60 * 1000;
const WEBLLM_FAILURE_THRESHOLD = 2;
const WEBLLM_LAZY_IDLE_TIMEOUT_MS = 1_500;

// Phase-65 hold-surface cleanup:
// keep WebLLM gate/status payloads explicit and reusable without changing behavior.
type WebllmAutoSelectionState = {
  requested: string;
  resolved: string;
};

const safeAbortWebLLM = (requestId: string | null | undefined) => {
  if (!requestId) return;
  try {
    abortWebLLM(requestId);
  } catch {
    // ignore bridge errors
  }
};

const safeStartWebLLM = async (requestId: string, input: Parameters<typeof startWebLLM>[1]) => {
  try {
    return await startWebLLM(requestId, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "webllm_start_failed";
    return {
      type: "error" as const,
      requestId,
      kind: input.kind,
      error: { message },
    };
  }
};


const isQuotaExceededError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const normalized = message.toLowerCase();
  return (
    (error instanceof DOMException && error.name === "QuotaExceededError") ||
    (error instanceof Error && error.name === "QuotaExceededError") ||
    normalized.includes("quota exceeded") ||
    normalized.includes("quotaexceedederror")
  );
};


export type ChatPanelProps = {
  title: string;
  goal: string;
  starterPromptSuggestions: string[];
  lessonId: number;
  lessonLock: LessonLock;
  teacherUiEnabled: boolean;
  shareCode?: string | null;
  profileName?: string;
  onSetLessonId: (id: LessonId) => void;
  onToggleLessonLock: (next: boolean) => void;
  allowedFilenames: string[];
  currentFiles: Record<string, WorkspaceFile>;
  onFilesMerged: (files: Record<string, WorkspaceFile>) => void;
  onFastApplyAppliedSlots?: (appliedSlots: string[]) => void;
  onHelpClick?: () => void;
  onTemplateStart?: () => void;
  presentationMode: boolean;
  onTogglePresentationMode: (next: boolean) => void;
  onMessageCountChange?: (count: number) => void;
  chatStorageKeyPrefix?: string;
  templateFirstMode?: boolean;
  initialManualFallbackReason?: "changeset" | "apply_failed" | "slot_choice" | "slot_target_missing" | null;
  slimMode?: boolean;
};

export type ChatPanelHandle = {
  generate: () => void;
  abortAll: () => void;
  resetEngine: () => void;
  hardReset: () => void;
  undo: () => void;
  redo: () => void;
  exportDiagnostics: () => void;
  toggleAutosave: () => void;
  getMessageCount: () => number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  clientMsgId?: string;
};


type ChatPanelState =
  | "COACH_STREAMING"
  | "ACTION_PREPARING"
  | "READY_TO_GENERATE"
  | "GENERATING_FILES"
  | "POSTPROCESSING_FILES"
  | "APPLIED"
  | "ERROR_RECOVERABLE";

type ActionPhase = "idle" | "preparing" | "thinking" | "applying" | "done" | "partial" | "choice" | "failed";

type ActionPhaseEvent = {
  type: "TRANSITION";
  next: ActionPhase;
};

type ChatSlaTracker = {
  clientMsgId: string;
  startedAt: number;
  tRemoteStartMs?: number;
  tCoachMs?: number;
  tFirstResponseMs?: number;
  rid?: string | null;
  recorded?: boolean;
};

const getInitialActionPhase = (
  reason: "changeset" | "apply_failed" | "slot_choice" | "slot_target_missing" | null,
): ActionPhase => {
  if (reason === "slot_choice" || reason === "slot_target_missing") {
    return "choice";
  }
  if (reason) {
    return "failed";
  }
  return "idle";
};

const ACTION_PHASE_TRANSITIONS: Record<ActionPhase, ActionPhase[]> = {
  idle: ["preparing", "thinking", "applying", "done", "partial", "choice", "failed", "idle"],
  preparing: ["thinking", "applying", "partial", "choice", "failed", "idle"],
  thinking: ["applying", "partial", "choice", "failed", "idle"],
  applying: ["done", "partial", "choice", "failed", "idle"],
  done: ["idle", "preparing", "thinking", "applying", "partial", "choice", "failed"],
  partial: ["idle", "preparing", "thinking", "applying", "done", "choice", "failed"],
  choice: ["idle", "preparing", "thinking", "applying", "done", "partial", "failed"],
  failed: ["idle", "preparing", "thinking", "applying"],
};

const actionPhaseReducer = (state: ActionPhase, event: ActionPhaseEvent): ActionPhase => {
  if (event.type !== "TRANSITION") {
    return state;
  }
  if (state === event.next) {
    return state;
  }
  const allowed = ACTION_PHASE_TRANSITIONS[state] ?? [];
  if (!allowed.includes(event.next)) {
    return state;
  }
  return event.next;
};

const ACTION_PHASE_COPY_STUDENT: Record<ActionPhase, string> = {
  idle: "",
  preparing: "준비하는 중!",
  thinking: "조용히 만들고 있어!",
  applying: "붙이는 중!",
  done: "여기까지 만들었어!",
  partial: "먼저 여기까지!",
  choice: "미리보기를 먼저 만들고 있어요.",
  failed: "조금 단순한 방식으로 미리보기를 준비했어요.",
};

const ACTION_PHASE_COPY_TEACHER: Record<ActionPhase, string> = {
  idle: "",
  preparing: "준비 중… 기기에서 실행",
  thinking: "만드는 중… 멈출 수 있어요",
  applying: "수정 반영 중…",
  done: "여기까지 준비했어요",
  partial: "일부만 먼저 했어요",
  choice: "버튼으로 먼저 시작하도록 안내해요.",
  failed: "이번엔 여기서 멈췄어요. 대신 선택 버튼을 준비했어요.",
};

const ACTION_PHASE_ICON: Record<ActionPhase, string> = {
  idle: "",
  preparing: "🧰",
  thinking: "💭",
  applying: "🧩",
  done: "✅",
  partial: "🌓",
  choice: "👉",
  failed: "⏸️",
};

const ACTION_PHASE_TONE: Record<ActionPhase, string> = {
  idle: "text-slate-500",
  preparing: "text-slate-600",
  thinking: "text-slate-600",
  applying: "text-slate-600",
  done: "text-emerald-600",
  partial: "text-amber-600",
  choice: "text-amber-600",
  failed: "text-rose-600",
};

type ErrorCode =
  | "MESSAGE_SHAPE"
  | "ENGINE_FETCH"
  | "RESPONSE_FORMAT_UNSUPPORTED"
  | "SCHEMA_FAILED"
  | "FALLBACK_APPLIED"
  | "AUTH_ERROR"
  | "ENV_MISSING"
  | "HEALTH_FALLBACK"
  | "FETCH_BLOCKED"
  | "ENGINE_ERROR";

const LOCAL_TIMEOUT_MS = 120000;
const GENERATOR_TIMEOUT_MS = 12_000;
const DECORATE_INTENT_MAX_TOKENS = 192;

type AbortReason = "timeout" | "user_cancel" | "ui_step_change" | "navigation" | "unknown";
type AbortMeta = {
  abortReason: AbortReason;
  phase: string;
  startedAt: number;
  usingLocalWebLLM: boolean;
  timeoutMs?: number | null;
  modelId?: string | null;
  stage?: string | null;
  retryCount?: number | null;
  slotCandidatesCount?: number | null;
  selectedSlotId?: string | null;
  selectedSelector?: string | null;
  slotResolveSource?: string | null;
  htmlHashBefore?: string | null;
  htmlHashAfterInjection?: string | null;
  snapshotVersion?: string | null;
  committedHtmlHash?: string | null;
  commitTargetKey?: string | null;
  previewRefreshTriggered?: boolean | null;
  previewHtmlHash?: string | null;
  previewMatchesCommitted?: boolean | null;
};

type SsotOwner = "user_edit" | "decorate" | "generator";

type DecorateChangedNode = {
  selector: string;
  kind: "insert" | "update" | "style";
  summary: string;
  beforeSnippet: string;
  afterSnippet: string;
};

type DecorateUndoStackItem = {
  snapshotVersion: string | null;
  html: string;
  htmlHash: string;
  at: number;
  reason: "decorate_apply";
};


const getNowMs = () => Date.now();

const createAbortMeta = (input: {
  abortReason: AbortReason;
  phase: string;
  usingLocalWebLLM: boolean;
  startedAt?: number;
  timeoutMs?: number | null;
  modelId?: string | null;
  stage?: string | null;
  retryCount?: number | null;
  slotCandidatesCount?: number | null;
  selectedSlotId?: string | null;
  selectedSelector?: string | null;
  slotResolveSource?: string | null;
  htmlHashBefore?: string | null;
  htmlHashAfterInjection?: string | null;
  snapshotVersion?: string | null;
  committedHtmlHash?: string | null;
  commitTargetKey?: string | null;
  previewRefreshTriggered?: boolean | null;
  previewHtmlHash?: string | null;
  previewMatchesCommitted?: boolean | null;
}): AbortMeta => ({
  abortReason: input.abortReason,
  phase: input.phase,
  startedAt: typeof input.startedAt === "number" ? input.startedAt : getNowMs(),
  usingLocalWebLLM: input.usingLocalWebLLM,
  timeoutMs: typeof input.timeoutMs === "number" ? input.timeoutMs : null,
  modelId: input.modelId ?? null,
  stage: input.stage ?? null,
  retryCount: typeof input.retryCount === "number" ? input.retryCount : null,
  slotCandidatesCount: typeof input.slotCandidatesCount === "number" ? input.slotCandidatesCount : null,
  selectedSlotId: input.selectedSlotId ?? null,
  selectedSelector: input.selectedSelector ?? null,
  slotResolveSource: input.slotResolveSource ?? null,
  htmlHashBefore: input.htmlHashBefore ?? null,
  htmlHashAfterInjection: input.htmlHashAfterInjection ?? null,
  snapshotVersion: input.snapshotVersion ?? null,
  committedHtmlHash: input.committedHtmlHash ?? null,
  commitTargetKey: input.commitTargetKey ?? null,
  previewRefreshTriggered: typeof input.previewRefreshTriggered === "boolean" ? input.previewRefreshTriggered : null,
  previewHtmlHash: input.previewHtmlHash ?? null,
  previewMatchesCommitted: typeof input.previewMatchesCommitted === "boolean" ? input.previewMatchesCommitted : null,
});

const buildAbortMetaFromDecorateMetrics = (
  metrics: DecorateMetrics | null | undefined,
  input: {
    abortReason: AbortReason;
    phase: string;
    usingLocalWebLLM: boolean;
    startedAt?: number;
    timeoutMs?: number | null;
    modelId?: string | null;
  },
): AbortMeta => {
  const source = metrics ?? null;
  return createAbortMeta({
    abortReason: input.abortReason,
    phase: input.phase,
    usingLocalWebLLM: input.usingLocalWebLLM,
    startedAt: source?.startedAt ?? input.startedAt,
    timeoutMs: source?.timeoutMs ?? input.timeoutMs ?? null,
    modelId: source?.modelId ?? input.modelId ?? null,
    stage: source?.stage ?? "engine_warmup",
    retryCount: source?.retryCount ?? null,
    slotCandidatesCount: source?.slotCandidatesCount ?? 0,
    selectedSlotId: source?.selectedSlotId ?? null,
    selectedSelector: source?.selectedSelector ?? "__unresolved__",
    slotResolveSource: source?.slotResolveSource ?? "boot",
    snapshotVersion: source?.snapshotVersion ?? "pending",
    htmlHashBefore: source?.htmlHashBefore ?? "pending",
    htmlHashAfterInjection: source?.htmlHashAfterInjection ?? null,
    committedHtmlHash: source?.committedHtmlHash ?? null,
    commitTargetKey: source?.commitTargetKey ?? null,
    previewRefreshTriggered: source?.previewRefreshTriggered ?? null,
    previewHtmlHash: source?.previewHtmlHash ?? null,
    previewMatchesCommitted: source?.previewMatchesCommitted ?? null,
  });
};

const getAbortMetaFromError = (error: unknown): AbortMeta | null => {
  if (!(error instanceof DOMException) || error.name !== "AbortError") return null;
  if (!error.message) return null;
  try {
    const parsed = JSON.parse(error.message) as Partial<AbortMeta>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.phase !== "string") return null;
    if (typeof parsed.abortReason !== "string") return null;
    if (typeof parsed.startedAt !== "number") return null;
    if (typeof parsed.usingLocalWebLLM !== "boolean") return null;
    return {
      abortReason: parsed.abortReason as AbortReason,
      phase: parsed.phase,
      startedAt: parsed.startedAt,
      usingLocalWebLLM: parsed.usingLocalWebLLM,
      timeoutMs: typeof parsed.timeoutMs === "number" ? parsed.timeoutMs : null,
      modelId: typeof parsed.modelId === "string" ? parsed.modelId : null,
      stage: typeof parsed.stage === "string" ? parsed.stage : null,
      retryCount: typeof parsed.retryCount === "number" ? parsed.retryCount : null,
      slotCandidatesCount: typeof parsed.slotCandidatesCount === "number" ? parsed.slotCandidatesCount : null,
      selectedSlotId: typeof parsed.selectedSlotId === "string" ? parsed.selectedSlotId : null,
      selectedSelector: typeof parsed.selectedSelector === "string" ? parsed.selectedSelector : null,
      slotResolveSource: typeof parsed.slotResolveSource === "string" ? parsed.slotResolveSource : null,
      htmlHashBefore: typeof parsed.htmlHashBefore === "string" ? parsed.htmlHashBefore : null,
      htmlHashAfterInjection: typeof parsed.htmlHashAfterInjection === "string" ? parsed.htmlHashAfterInjection : null,
      snapshotVersion: typeof parsed.snapshotVersion === "string" ? parsed.snapshotVersion : null,
      committedHtmlHash: typeof parsed.committedHtmlHash === "string" ? parsed.committedHtmlHash : null,
      commitTargetKey: typeof parsed.commitTargetKey === "string" ? parsed.commitTargetKey : null,
      previewRefreshTriggered: typeof parsed.previewRefreshTriggered === "boolean" ? parsed.previewRefreshTriggered : null,
      previewHtmlHash: typeof parsed.previewHtmlHash === "string" ? parsed.previewHtmlHash : null,
      previewMatchesCommitted: typeof parsed.previewMatchesCommitted === "boolean" ? parsed.previewMatchesCommitted : null,
    };
  } catch {
    return null;
  }
};

const getAbortElapsedMs = (meta: AbortMeta) => Math.max(0, Math.round(getNowMs() - meta.startedAt));

const FAST_FALLBACK_TIMEOUT_MS = 10_000;
const DECORATE_COMMIT_STABILIZATION_MS = 1_500;
const SLOW_GENERATION_HINT_MS = 6000;
const DECORATE_SLOW_NOTICE_MS = 20_000;
const DECORATE_LLM_READY_WAIT_MS = 2_000;
const QUALITY_SCORE_THRESHOLD = 60;
const SLOW_NETWORK_HINT_MS = 60000;
const PROGRESS_THROTTLE_BASE_MS = 700;
const PROGRESS_THROTTLE_PERF_MS = 1000;
const PERFORMANCE_LONGTASK_THRESHOLD = 2;
const PERFORMANCE_LONGTASK_WINDOW_MS = 20000;
const PERFORMANCE_RENDER_COUNT_THRESHOLD = 80;
const MESSAGE_VIRTUALIZATION_THRESHOLD = 60;
const MESSAGE_VIRTUALIZATION_LIMIT = 40;
const SAFE_EVENT_BUFFER_LIMIT = 20;
const BOTTOM_THRESHOLD_PX = 120;
const SLOW_NUDGE_MS = 15000;
const WAITING_ACTION_INITIAL_MS = 6000;
const WAITING_ACTION_EXPAND_MS = 12000;
const COOLDOWN_MS = 10000;
const FORCE_CONTENT_PROMPT = `
이전 응답이 JSON이 아니었습니다. 반드시 JSON만 출력하세요.
출력은 lessonId에 맞는 content 스키마 객체 1개만 허용합니다.
HTML/CSS/JS를 출력하지 마세요.
`.trim();

const STRICT_LANGUAGE_PROMPT = `
한자/중국어/일본어 문자 발견 시 실패 처리됩니다. 반드시 한글로만 작성하세요.
특히 爱好 같은 한자 혼용 금지. "수영자" 같은 표현 금지.
`.trim();

const ANON_ID_STORAGE_KEY = "gomdory:anonId";
const LOCAL_AI_DISABLED_KEY = "gomdory.edu.webllm.disabled";
const CHAT_STORAGE_KEY_PREFIX = "edu_intro_chat_v2";
const MAX_STORED_MESSAGES = 120;
const COACH_SAFE_FALLBACK_MESSAGE =
  "지금은 연결이 잠시 불안정해요. 잠깐 쉬었다가 다시 도전해 볼까요? ✏️ 글은 AI에게 / 🖱️ 사진·꾸미기는 직접!";
const RATE_LIMIT_STUDENT_MESSAGE = "요청이 몰려 있어요. 잠깐 쉬었다가 다시 물어봐도 좋아요.";
const RATE_LIMIT_TEACHER_MESSAGE = "요청이 몰려 있어요. 교사 모드에서는 30초 후 다시 시도해 주세요.";
const LIGHT_MODE_KEY = "edu:webllm:lightMode";
const TEACHER_FLAG_KEY = "edu:webllm:teacher";
const WARMUP_ALLOW_KEY = "edu:webllm:allowWarmup";
const CHAT_RESET_EVENT = "edu:chat-reset";
const LOCAL_AI_DISABLED_EVENT = "edu:webllm:disabled-change";
const WEBLLM_SESSION_RETRY_KEY = "edu:webllm:sessionRetryUsed";
const AI_FALLBACK_LAST_KEY = "edu:ai:fallback:last";
const OFF_TOPIC_P1_KEYWORDS = ["재생", "콘솔", "player", "플레이어"];
const IMAGE_REQUEST_PATTERN = /(?:image|picture|photo|그림|사진|이미지)/i;

type OpsMode = "normal" | "ai_off" | "simple";

const OPS_MODE_KEY = "edu:webllm:opsMode";
const OPS_MODE_LABELS: Record<OpsMode, string> = {
  normal: "기본",
  ai_off: "AI 잠깐 끄기",
  simple: "간단 모드",
};

type ThrottleState<T> = {
  lastTs: number;
  timer: number | null;
  pending: T | null;
};

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    (record.role === "user" || record.role === "assistant" || record.role === "system") &&
    typeof record.content === "string"
  );
};

const redactSensitiveText = (value: string) => {
  let nextValue = value;
  nextValue = nextValue.replace(/```[\s\S]*?```/g, "[code]");
  nextValue = nextValue.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[email]",
  );
  nextValue = nextValue.replace(/\bhttps?:\/\/\S+\b/gi, "[url]");
  nextValue = nextValue.replace(/\b(?:share\s*code|sharecode|공유\s*코드|공유코드)\s*[:=]?\s*[A-Za-z0-9-]{4,}\b/gi, "shareCode:[redacted]");
  nextValue = nextValue.replace(/\b(\+?\d[\d\s-]{7,}\d)\b/g, "[phone]");
  return nextValue;
};

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
};

const buildSafeSummary = (value: string, maxLength: number) =>
  truncateText(redactSensitiveText(value).replace(/\s+/g, " ").trim(), maxLength);

const createRequestId = () => {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const cryptoRef = globalThis.crypto as Crypto | undefined;
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createClientMsgId = () => `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeStoredMessages = (value: unknown): ChatMessage[] | null => {
  if (!Array.isArray(value)) return null;
  if (!value.every(isChatMessage)) return null;
  if (value.length <= MAX_STORED_MESSAGES) return value;
  return value.slice(-MAX_STORED_MESSAGES);
};

const useThrottledSetter = <T,>(setter: (value: T) => void, delayMs: number) => {
  const throttleRef = useRef<ThrottleState<T>>({ lastTs: 0, timer: null, pending: null });

  const setThrottled = useCallback(
    (value: T) => {
      const ref = throttleRef.current;
      const now = Date.now();
      const elapsed = now - ref.lastTs;
      const apply = (nextValue: T) => {
        ref.lastTs = Date.now();
        setter(nextValue);
      };
      if (elapsed >= delayMs) {
        if (ref.timer) {
          window.clearTimeout(ref.timer);
          ref.timer = null;
        }
        ref.pending = null;
        apply(value);
        return;
      }
      ref.pending = value;
      if (ref.timer) return;
      ref.timer = window.setTimeout(() => {
        ref.timer = null;
        if (ref.pending !== null) {
          apply(ref.pending);
          ref.pending = null;
        }
      }, Math.max(0, delayMs - elapsed));
    },
    [delayMs, setter],
  );

  const clear = useCallback(() => {
    const ref = throttleRef.current;
    if (ref.timer) {
      window.clearTimeout(ref.timer);
      ref.timer = null;
    }
    ref.pending = null;
  }, []);

  return { clear, setThrottled };
};

const UserIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.8-3.2 5-5 8-5s6.2 1.8 8 5" strokeLinecap="round" />
  </svg>
);

const LayoutIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10.5h17M9.5 4.5v15" strokeLinecap="round" />
  </svg>
);

const BadgeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <circle cx="12" cy="10" r="5" />
    <path d="M9.2 9.8l1.8 1.8 3.6-3.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 15.5l-1.5 4 3.5-1.8 2 2 2-2 3.5 1.8-1.5-4" strokeLinecap="round" />
  </svg>
);

const ImageIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="9" r="1.8" />
    <path d="M21 16.5l-5.5-5.5-6.5 6.5-2.5-2.5L3 18" strokeLinecap="round" />
  </svg>
);

const LightbulbIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="M8 14c-2.2-1.7-3-4.8-1.4-7.2A5.8 5.8 0 0 1 12 4.5c2.6 0 4.8 1.5 5.4 3.9.6 2.2-.2 4.5-2.1 5.6" />
    <path d="M9 18h6M10 21h4" strokeLinecap="round" />
  </svg>
);

const WandIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="m5 19 9-9" strokeLinecap="round" />
    <path d="M14 7.5 16.5 5" strokeLinecap="round" />
    <path d="M16.5 9.5 19 7" strokeLinecap="round" />
    <path d="M12 5 13.5 3" strokeLinecap="round" />
    <path d="m16 12 2 2" strokeLinecap="round" />
    <rect x="3" y="17" width="6" height="3" rx="1.5" />
  </svg>
);

const ShieldIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path
      d="M12 3 19 6v6c0 4.2-2.6 7.6-7 9-4.4-1.4-7-4.8-7-9V6l7-3Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PencilIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="M14.4 4.2 19.8 9.6" strokeLinecap="round" />
    <path d="M5 19h4l9.4-9.4-4-4L5 15v4Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SendIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="M3 12l18-8-4.5 16-5-6-8.5-2Z" strokeLinejoin="round" />
    <path d="M11.5 14 9 20" strokeLinecap="round" />
  </svg>
);

const StopIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="m6 6 12 12" strokeLinecap="round" />
    <path d="m18 6-12 12" strokeLinecap="round" />
  </svg>
);

const UndoIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="M9 7H5v4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 11c1.8-3 5-5 8.5-5 4.4 0 7.5 2.6 7.5 6.5 0 3.6-2.7 6.5-6.5 6.5" strokeLinecap="round" />
  </svg>
);

const RedoIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="M15 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 11c-1.8-3-5-5-8.5-5C6.1 6 3 8.6 3 12.5 3 16.1 5.7 19 9.5 19" strokeLinecap="round" />
  </svg>
);

const MoreIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
);

const getDateSeed = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const hashSeed = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const hashCode = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
};

const parseFilesPayload = (
  value: unknown,
): { ok: true; payload: { message: string; files: Record<string, string> } } | { ok: false } | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type !== "files") return null;
  if (!record.files || typeof record.files !== "object") {
    return { ok: false };
  }
  const allowedSet = new Set(WEBLLM_ALLOWED_FILES);
  const files: Record<string, string> = {};
  let hasInvalid = false;
  for (const [filename, content] of Object.entries(record.files as Record<string, unknown>)) {
    if (!allowedSet.has(filename as (typeof WEBLLM_ALLOWED_FILES)[number])) {
      hasInvalid = true;
      continue;
    }
    if (typeof content === "string") {
      files[filename] = content;
    } else {
      hasInvalid = true;
    }
  }
  if (hasInvalid || Object.keys(files).length === 0) {
    return { ok: false };
  }
  const message = typeof record.message === "string" ? record.message : "";
  return { ok: true, payload: { message, files } };
};

const sanitizeCoachResponse = (text: string) => {
  const hanSanitized = sanitizeHanAsLastResort(text);
  if (detectKana(hanSanitized)) {
    return sanitizeKanaAsLastResort(hanSanitized);
  }
  return hanSanitized;
};

const createAbortError = (meta?: AbortMeta) => {
  const message = meta ? JSON.stringify(meta) : "Aborted";
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, "AbortError");
  }
  const error = new Error(message);
  (error as Error & { name: string }).name = "AbortError";
  return error;
};

const isAbortError = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError",
  );

const createAbortErrorFromSignal = (signal: AbortSignal) => {
  const reason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (reason && typeof reason === "object") {
    return createAbortError(reason as AbortMeta);
  }
  return createAbortError();
};

const createLinkedAbortController = (...signals: Array<AbortSignal | undefined | null>) => {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];
  const abortWithReason = (signal?: AbortSignal) => {
    const reason = signal ? (signal as AbortSignal & { reason?: unknown }).reason : undefined;
    if (reason === undefined) {
      controller.abort();
      return;
    }
    controller.abort(reason);
  };
  const validSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  for (const signal of validSignals) {
    if (signal.aborted) {
      abortWithReason(signal);
      return { controller, cleanup: () => undefined };
    }
    const handleAbort = () => abortWithReason(signal);
    signal.addEventListener("abort", handleAbort);
    cleanups.push(() => signal.removeEventListener("abort", handleAbort));
  }
  return { controller, cleanup: () => cleanups.forEach((cleanup) => cleanup()) };
};

const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel(
  {
    title,
    goal,
    starterPromptSuggestions,
    lessonId,
    lessonLock,
    teacherUiEnabled,
    shareCode,
    profileName,
    onSetLessonId,
    onToggleLessonLock,
    allowedFilenames,
    currentFiles,
    onFilesMerged,
    onFastApplyAppliedSlots,
    onHelpClick,
    onTemplateStart,
    presentationMode,
    onTogglePresentationMode,
    onMessageCountChange,
    chatStorageKeyPrefix = CHAT_STORAGE_KEY_PREFIX,
    templateFirstMode = false,
    initialManualFallbackReason = null,
    slimMode = false,
  }: ChatPanelProps,
  ref,
) {
  if (process.env.NODE_ENV !== "production") {
    const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    if (sp?.get("__debugCrash") === "1") {
      throw new Error("debug_crash");
    }
  }
  const initialMessages = useMemo<ChatMessage[]>(
    () => [
      {
        id: "welcome",
        role: "assistant",
        content: `오늘은 ${title}에 도전해요! 목표: ${goal}`,
      },
    ],
    [goal, title],
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [panelState, setPanelState] = useState<ChatPanelState>("ACTION_PREPARING");
  const [actionPhase, dispatchActionPhase] = useReducer(
    actionPhaseReducer,
    getInitialActionPhase(initialManualFallbackReason),
  );
  const [performanceMode, setPerformanceMode] = useState(false);
  const [lastApplyOutcome, setLastApplyOutcome] = useState<"done" | "partial" | null>(null);
  const [manualFallbackReason, setManualFallbackReason] = useState<
    "changeset" | "apply_failed" | "slot_choice" | "slot_target_missing" | null
  >(initialManualFallbackReason);
  const [actionPrompt, setActionPrompt] = useState<{
    showTemplate: boolean;
    showHelp: boolean;
    showRetry: boolean;
    showSelfcheck: boolean;
    showDiagnostics: boolean;
    showGenerate: boolean;
    showGenerateRetry: boolean;
    showTemplateChips: boolean;
    showRefresh: boolean;
  } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [corsCopyMessage, setCorsCopyMessage] = useState<string | null>(null);
  const [corsCopyNotice, setCorsCopyNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panelStateRef = useRef<ChatPanelState>("ACTION_PREPARING");
  const fastFallbackTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const simpleCoachTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const remoteAbortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const activeMsgIdRef = useRef<string | null>(null);
  const fallbackMsgIdRef = useRef<string | null>(null);
  const retryConsumedRef = useRef(new Set<string>());
  const coachSubmitSourceRef = useRef<StudentCoachSubmitSource>("submit");
  const chatSlaRef = useRef<ChatSlaTracker | null>(null);
  const chatRequestSeqRef = useRef(0);
  const fastApplyNoticeTimerRef = useRef<number | null>(null);
  const slowGenerationTimerRef = useRef<number | null>(null);
  const slowNudgeTimerRef = useRef<number | null>(null);
  const decorateSlowTimerRef = useRef<number | null>(null);
  const decorateHardTimeoutTimerRef = useRef<number | null>(null);
  const waitingActionTimerRef = useRef<number | null>(null);
  const waitingActionExpandTimerRef = useRef<number | null>(null);
  const slowNudgeShownRef = useRef(false);
  const requestSeqRef = useRef(0);
  const requestIdRef = useRef<string | null>(null);
  const coachRequestIdRef = useRef<string | null>(null);
  const generatorRequestIdRef = useRef<string | null>(null);
  const lastWebLLMProgressRef = useRef<{
    event: WebLLMWorkerProgressEvent;
    at: number;
  } | null>(null);
  const performanceModeRef = useRef(false);
  const longTaskCountRef = useRef(0);
  const longTaskWindowStartRef = useRef<number | null>(null);
  const renderCountRef = useRef(0);
  const renderCountActiveRef = useRef(false);
  const fastFallbackAppliedRef = useRef<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [styleHint, setStyleHint] = useState<string | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [anonId, setAnonId] = useState<string | null>(null);
  const [coachAction, setCoachAction] = useState<CoachAction | null>(null);
  const [, setCoachReady] = useState(false);
  const [, setGeneratorReady] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [examplesAnchor, setExamplesAnchor] = useState<"desktop" | "mobile">("desktop");
  const [presetMoreOpen, setPresetMoreOpen] = useState(false);
  const [preferredModelId, setPreferredModelId] = useState<string | null>(null);
  const [modelChoice, setModelChoice] = useState<"primary" | "fallback" | null>(null);
  const [webllmStatus, setWebllmStatus] = useState<WebLLMStatus>("READY");
  const [webllmStatusCode, setWebllmStatusCode] = useState<string | null>(null);
  const [webllmStatusRid, setWebllmStatusRid] = useState<string | null>(null);
  const [webllmStatusAt, setWebllmStatusAt] = useState<number | null>(null);
  const [webllmDegradedUntil, setWebllmDegradedUntil] = useState<number | null>(null);
  const [localAiDisabled, setLocalAiDisabled] = useState(false);
  const [webllmAutoSelection, setWebllmAutoSelection] = useState<WebllmAutoSelectionState | null>(null);
  const [webllmPrefetchReady, setWebllmPrefetchReady] = useState<boolean | null>(null);
  const [webllmSessionRetryUsed, setWebllmSessionRetryUsed] = useState(false);
  const [, setWebllmLastGoodSelection] = useState<WebLLMLastGoodSelection | null>(null);
  const webllmTierDiagnostics = (() => {
    if (typeof navigator === "undefined") return null;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cooldown = readWebLLMCooldownState();
    return getWebLLMDeviceTier({
      deviceMemory: nav.deviceMemory,
      hardwareConcurrency: nav.hardwareConcurrency,
      crossOriginIsolated: typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : false,
      sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
      cooldownActive: cooldown.cooldownActive,
    });
  })();
  const webllmStatusRef = useRef<WebLLMStatus>("READY");
  const webllmFailureLogRef = useRef<number[]>([]);
  const decorateQuotaExceededRef = useRef(false);
  const [fileProgressMessage, setFileProgressMessage] = useState("");
  const [slowNetworkHint, setSlowNetworkHint] = useState(false);
  const [slowGenerationHint, setSlowGenerationHint] = useState(false);
  const [waitingActionStage, setWaitingActionStage] = useState<"idle" | "initial" | "expanded">(
    "idle",
  );
  const [decorateSlowNotice, setDecorateSlowNotice] = useState(false);
  const [decorateAbortNotice, setDecorateAbortNotice] = useState<string | null>(null);
  const [decorateTransactionPhase, setDecorateTransactionPhase] = useState<DecorateControllerPhase>("idle");
  const [fastFallbackApplied, setFastFallbackApplied] = useState(false);
  const [fastFallbackNotice, setFastFallbackNotice] = useState<string | null>(null);
  const [fastApplyNotice, setFastApplyNotice] = useState<string | null>(null);
  const [simpleCoachHint, setSimpleCoachHint] = useState<SimpleCoachResult | null>(null);
  const [fallbackStage, setFallbackStage] = useState<"idle" | "waiting" | "coach" | "retry">(
    "idle",
  );
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  const [fallbackMsgId, setFallbackMsgId] = useState<string | null>(null);
  const [rateLimitNotice, setRateLimitNotice] = useState<{
    requestId: string;
    errorCode: string;
  } | null>(null);
  const [remoteChatWarning, setRemoteChatWarning] = useState<string | null>(null);
  const [fallbackRequestId, setFallbackRequestId] = useState<string | null>(null);
  const [fallbackErrorCode, setFallbackErrorCode] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [lightModeEnabled, setLightModeEnabled] = useState(false);
  const [opsMode, setOpsMode] = useState<OpsMode>("normal");
  const [teacherToast, setTeacherToast] = useState<string | null>(null);
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const [lastGeneratorNotice, setLastGeneratorNotice] = useState<string | null>(null);
  const [lastCoachSanitizeFlags, setLastCoachSanitizeFlags] = useState<
    CoachSanitizeResult["flags"] | null
  >(null);
  const [networkPrepStatus, setNetworkPrepStatusState] = useState(getNetworkPrepStatus());
  const [coachRunning, setCoachRunning] = useState(false);
  const [genRunning, setGenRunning] = useState(false);
  const [lastSanitizeFlags, setLastSanitizeFlags] = useState<Sanitized["flags"] | null>(null);
  const [sanitizeSuggestion, setSanitizeSuggestion] = useState<string | null>(null);
  const [sanitizeSuggestionActive, setSanitizeSuggestionActive] = useState(false);
  const [insuranceSuggestionActive, setInsuranceSuggestionActive] = useState(false);
  const [sanitizePulseKey, setSanitizePulseKey] = useState(0);
  const [sanitizeShakeKey, setSanitizeShakeKey] = useState(0);
  const [sanitizePulseTone, setSanitizePulseTone] = useState<"glow" | "alert">("glow");
  const [offTrackPulseKey, setOffTrackPulseKey] = useState(0);
  const [offTrackVisible, setOffTrackVisible] = useState(false);
  const [undoEnabled, setUndoEnabled] = useState(false);
  const [redoEnabled, setRedoEnabled] = useState(false);
  const [undoPulseKey, setUndoPulseKey] = useState(0);
  const [sanitizePulseActive, setSanitizePulseActive] = useState(false);
  const [sanitizeShakeActive, setSanitizeShakeActive] = useState(false);
  const [offTrackPulseActive, setOffTrackPulseActive] = useState(false);
  const [undoPulseActive, setUndoPulseActive] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { hasWebllmEnv, envSnapshot } = useWebLLM();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const decorateJoinToken = useMemo(() => {
    const value = searchParams?.get("jt")?.trim() ?? "";
    return value.length > 0 ? value : undefined;
  }, [searchParams]);
  const webllmEntryBlocked = useMemo(() => {
    const isSampleLesson = /^\/edu\/lesson\/(0|1|2|3|4)(\/)?$/.test((pathname ?? "").replace(/\/+$/, ""));
    if (!isSampleLesson) return false;
    const joinToken = searchParams?.get("jt")?.trim() ?? "";
    return joinToken.length === 0;
  }, [pathname, searchParams]);
  const [webllmCoreRenderDone, setWebllmCoreRenderDone] = useState(false);
  const [webllmLazyActivationReady, setWebllmLazyActivationReady] = useState(false);
  const [eduFeatureFlags, setEduFeatureFlags] = useState(EDU_FEATURE_FLAGS_DEFAULTS);
  // Phase-65: keep gate payload shape centralized to reduce hold-surface drift.
  const [webllmHealthGate, setWebllmHealthGate] = useState<LessonWebllmGateHealthState | null>(null);
  const [isOpsAdmin, setIsOpsAdmin] = useState(false);
  const [webllmWarning, setWebllmWarning] = useState<string | null>(null);
  const webllmDegradedBlocked = localAiDisabled || (webllmDegradedUntil !== null && webllmDegradedUntil > Date.now());
  const lessonWebllmReadiness = useMemo(
    () =>
      resolveLessonWebllmReadinessSnapshot({
        featureFlags: eduFeatureFlags,
        hasWebllmEnv,
        entryBlocked: webllmEntryBlocked,
        health: webllmHealthGate,
        preferredModelId,
        degradedBlocked: webllmDegradedBlocked,
      }),
    [
      eduFeatureFlags,
      hasWebllmEnv,
      preferredModelId,
      webllmEntryBlocked,
      webllmHealthGate,
      webllmDegradedBlocked,
    ],
  );
  const {
    webllmSsotDisabled,
    effectiveWebllmEnabled: gateEffectiveWebllmEnabled,
    hasWebllmEnvEffective,
    webllmAuthRequired,
  } = lessonWebllmReadiness.gate;
  const lessonWebllmLaneStatusView = useMemo(
    () =>
      resolveLessonWebllmLaneStatusView({
        readiness: lessonWebllmReadiness,
        webllmEntryBlocked,
        preferredModelId,
      }),
    [lessonWebllmReadiness, webllmEntryBlocked, preferredModelId],
  );
  const lessonWebllmActivationPreflight = useMemo(
    () =>
      resolveLessonWebllmActivationPreflight({
        readiness: lessonWebllmReadiness,
        webllmEntryBlocked,
        preferredModelId,
      }),
    [lessonWebllmReadiness, preferredModelId, webllmEntryBlocked],
  );
  const lessonWebllmActivationHook = useMemo(
    () =>
      resolveLessonWebllmActivationHook({
        effectiveWebllmEnabled: gateEffectiveWebllmEnabled,
        preflight: lessonWebllmActivationPreflight,
        activationExperimentModeRaw: readLessonWebllmActivationExperimentMode(),
      }),
    [gateEffectiveWebllmEnabled, lessonWebllmActivationPreflight],
  );
  const lessonWebllmDispatchSelector = useMemo(
    () =>
      resolveLessonWebllmDispatchSelector({
        activationHook: lessonWebllmActivationHook,
        dispatchExperimentModeRaw: readLessonWebllmDispatchExperimentMode(),
        lessonId,
        dispatchKillSwitchRaw: readLessonWebllmDispatchKillSwitchEnabled() ? "1" : "0",
        rolloutLessonAllowlistRaw: readLessonWebllmDispatchRolloutLessonAllowlistRaw(),
      }),
    [lessonId, lessonWebllmActivationHook],
  );
  const effectiveWebllmEnabled = lessonWebllmActivationHook.effectiveWebllmEnabled;
  const [autosaveEnabled, setAutosaveEnabledState] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [containedEvidenceRows, setContainedEvidenceRows] = useState(() =>
    getWebllmContainedRolloutEvidence(30),
  );
  const [decorateDebugMetrics, setDecorateDebugMetrics] = useState<DecorateMetrics | null>(null);
  const [decorateResultReadyState, setDecorateResultReadyState] = useState<{
    mode: "llm" | "deterministic";
    summary: string;
    opsCount: number;
    selector: string;
    htmlSnippetLen: number;
    degraded?: boolean;
    changedNodes?: DecorateChangedNode[];
    confidenceLine?: string;
  } | null>(null);
  const [decoratePreviewExpanded, setDecoratePreviewExpanded] = useState(false);
  const [decorateHasPendingApply, setDecorateHasPendingApply] = useState(false);
  const [studentDecorateUiState, setStudentDecorateUiState] = useState<StudentDecorateUiState>("idle");
  const [healthcheckSummary, setHealthcheckSummary] = useState<{
    ok: number;
    fail: number;
    at: number;
  } | null>(null);
  const [persistedKeyExists, setPersistedKeyExists] = useState(false);
  const [lastSaveOk, setLastSaveOk] = useState(false);
  const [lastLoadOk, setLastLoadOk] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [lastApplyTs, setLastApplyTs] = useState<number | undefined>(undefined);
  const [lastCodeHash, setLastCodeHash] = useState<string | undefined>(undefined);
  const [decorateCooldownUntilMs, setDecorateCooldownUntilMs] = useState<number>(0);
  const [studentExampleOutcomeTick, setStudentExampleOutcomeTick] = useState(0);
  const sanitizeSuggestionRef = useRef({ insurance: false, sanitize: false, profanity: false });
  const previousFallbackRef = useRef<boolean | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveRestoredRef = useRef(false);
  const offTrackTimerRef = useRef<number | null>(null);
  const prewarmAbortRef = useRef<AbortController | null>(null);
  const idleWarmupRef = useRef<{ mode: "idle" | "timeout"; id: number } | null>(null);
  const decorateCooldownTimerRef = useRef<number | null>(null);
  const thinkingToastTimerRef = useRef<number | null>(null);
  const thinkingToastShownRef = useRef(false);
  const teacherToastHideTimerRef = useRef<number | null>(null);
  const examplesButtonRef = useRef<HTMLButtonElement | null>(null);
  const examplesMobileButtonRef = useRef<HTMLButtonElement | null>(null);
  const presetMoreRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const coachFlightRef = useRef(createSingleFlight({ mode: "replace" }));
  const genFlightRef = useRef(createSingleFlight({ mode: "queue1" }));
  const decorateFlightRef = useRef(createSingleFlight<{ applied: boolean; reason?: string }>({ mode: "replace" }));
  const decorateMetricsRef = useRef<DecorateMetrics | null>(null);
  const coachRunIdRef = useRef(0);
  const genRunIdRef = useRef(0);
  const decorateRunIdRef = useRef(0);
  const decorateControllerRef = useRef<ReturnType<typeof createDecorateController> | null>(null);
  const decorateBaseReadinessRef = useRef<{ snapshotReady: boolean; hashReady: boolean; hydrationStable: boolean }>({ snapshotReady: false, hashReady: false, hydrationStable: false });
  const decorateRecentSlaBreachRef = useRef(false);
  const decorateInProgressRef = useRef(false);
  const decorateCurrentPromptRef = useRef<string>("");
  const decorateServerPlanStartedRef = useRef(false);
  const decorateInvariantTimerRef = useRef<number | null>(null);
  const studentDecorateClickAtRef = useRef<number | null>(null);
  const studentDecorateTransactionAtRef = useRef<number | null>(null);
  const studentDecorateKickoffAtRef = useRef<number | null>(null);
  const studentDecorateSelectedExampleRef = useRef<{ kind: string; promptClass: string; prompt: string; index: number; lessonAware: boolean } | null>(null);
  const studentDecorateExampleOriginRef = useRef<{ kind: string; promptClass: string; index: number; lessonAware: boolean } | null>(null);
  const studentDecorateExamplesRenderedKeyRef = useRef<string | null>(null);
  const studentDecorateExamplePerfRef = useRef<Partial<Record<StudentDecorateExampleKind, { selected: number; outcomes: number; success: number; lowImpact: number }>>>({});
  const studentDecorateSendingTimerRef = useRef<number | null>(null);
  const lessonContainedRolloutSnapshot = useMemo(
    () =>
      resolveWebllmContainedRolloutSnapshot({
        lessonScope:
          lessonWebllmDispatchSelector.reason === "not_in_rollout_scope"
            ? "not_allowlisted"
            : lessonWebllmDispatchSelector.experimentScope.startsWith("in_scope")
              ? "allowlisted"
              : "unknown",
        bootstrapReady: lessonWebllmReadiness.gate.bootstrapPlan.shouldAttemptLocalInit,
        canonicalReady: webllmHealthGate?.canonicalStatus === "WEBLLM_READY",
        healthReady: webllmHealthGate?.ok === true,
        degradedBlocked: webllmDegradedBlocked,
        killSwitchOn: lessonWebllmDispatchSelector.reason === "dispatch_kill_switch_on",
        dispatchExperiment: readLessonWebllmDispatchExperimentMode(),
        activationExperiment: readLessonWebllmActivationExperimentMode(),
        shouldAttemptLocalInit: lessonWebllmDispatchSelector.wouldDispatchToWebllm,
        shouldUseServerFallback: !lessonWebllmDispatchSelector.wouldDispatchToWebllm,
        canonicalStatus: webllmHealthGate?.canonicalStatus ?? null,
        statusCode: lessonWebllmReadiness.gate.bootstrapPlan.statusCode,
        invalidReasons: webllmHealthGate?.invalidReasons ?? [],
      }),
    [
      lessonWebllmDispatchSelector.experimentScope,
      lessonWebllmDispatchSelector.reason,
      lessonWebllmDispatchSelector.wouldDispatchToWebllm,
      lessonWebllmReadiness.gate.bootstrapPlan.shouldAttemptLocalInit,
      lessonWebllmReadiness.gate.bootstrapPlan.statusCode,
      webllmDegradedBlocked,
      webllmHealthGate,
    ],
  );
  const lessonExecutionStripModel = useMemo(
    () =>
      buildWebllmContainedLessonExecutionStripModel({
        snapshot: lessonContainedRolloutSnapshot,
        evidenceRows: containedEvidenceRows,
        lessonId,
        teacherOrDebugVisible: isTeacherMode,
      }),
    [containedEvidenceRows, isTeacherMode, lessonContainedRolloutSnapshot, lessonId],
  );
  const decorateUndoStackRef = useRef<DecorateUndoStackItem[]>([]);
  const decoratePendingApplyRef = useRef<{
    nextHtml: string;
    mode: "llm" | "deterministic";
    requestId: string;
    summary: string;
    source: "server_llm" | "deterministic" | "local_llm";
    fallbackReason: string | null;
    baseSnapshotVersion: string | null;
    baseHtmlHash: string;
    previewHtmlHash: string;
    changedFiles: number;
    mutationSummary: {
      estimatedMutationCount: number;
      styleMutationCount: number;
      textMutationCount: number;
      imageIntentCount: number;
      lowImpactPreview: boolean;
      qualityScore?: number;
    };
    createdAt: number;
    promptLen: number;
    promptHash: string;
    primaryIntent: DecoratePrimaryIntent;
    confidence: number;
    ambiguous: boolean;
    previewEnriched: boolean;
    recoveryDecision: string | null;
    sourceAttempted: string[];
    outcomeScore?: number;
    outcomeBucket?: "excellent" | "good" | "acceptable" | "weak" | "failed";
    consistencyClass?: "consistent" | "recovered" | "mismatch" | "blocked";
    handoff: {
      requestId: string;
      source: "server_llm" | "deterministic" | "local_llm" | "cache";
      createdAt: number;
      baseSnapshotVersion: string | null;
      baseHtmlHash: string;
      previewHash: string;
      qualityScore: number;
      outcomeHint: "excellent" | "good" | "acceptable" | "weak" | "failed";
      invalidationRisk: "low" | "medium" | "high";
      applyEligibility: boolean;
    };
    exampleOrigin?: {
      lessonAware: boolean;
      exampleKind: string;
      promptClass: string;
      exampleIndex: number;
      lessonId: LessonId;
      isFreeMode: boolean;
    } | null;
  } | null>(null);
  const decoratePreviewCacheRef = useRef(createDecoratePreviewCache());
  const decorateRecentEventsRef = useRef<Array<{ intent: DecoratePrimaryIntent; tone: string[]; colors: string[]; emphasis: string[]; source: "server_llm" | "local_llm" | "deterministic" | "cache"; applied: boolean; undoneAfterApply: boolean; staleInvalidated: boolean; weakChange: boolean; requestId: string; at: number }>>([]);
  const applyManualFallbackTemplateRef = useRef<(() => Promise<void>) | null>(null);
  const decorateRecentUserEditRef = useRef<{ hasEdits: boolean; regionKinds: string[]; attributeKinds: string[]; at: number } | null>(null);
  const decorateLastAppliedRef = useRef<{ requestId: string; appliedAt: number } | null>(null);
  const decorateCacheLastBaseHashRef = useRef<string | null>(null);
  const lastDecorateFinishedAtRef = useRef<number>(0);
  const abortTelemetryDedupRef = useRef(new Set<string>());
  const snapshotRef = useRef(createSnapshotBuffer(3));
  const metricsRef = useRef(createEduMetricsBuffer(200));
  const safeEventBufferRef = useRef<EduMetricEventSnapshot[]>([]);
  const [metricsSummary, setMetricsSummary] = useState<EduMetricsSummary>(
    normalizeMetricsSummary(metricsRef.current.summary()),
  );
  const metricsUpdateTimerRef = useRef<number | null>(null);
  const recordedStepIdsRef = useRef(new Set<string>());
  const lastLessonMetricRef = useRef<string | null>(null);
  const slowNetworkWarnedRef = useRef(false);
  const lastProgressStepRef = useRef<EduPanelStepId | null>(null);
  const lastTemplateKeyRef = useRef<string | null>(null);
  const lastWebllmStatusLoggedRef = useRef<WebLLMStatus | null>(null);
  const decorateInterferenceLoggedRef = useRef<string | null>(null);
  const decorateProgressCopyRef = useRef<string>("");
  const decorateGuardWindowUntilRef = useRef<number>(0);

  useEffect(() => {
    decorateBaseReadinessRef.current.hydrationStable = true;
  }, []);
  const templateSnapshotRef = useRef<Record<string, WorkspaceFile> | null>(null);
  const lastSsotOwnerRef = useRef<{ owner: SsotOwner; at: number; snapshotVersion?: string; htmlHash?: string }>({
    owner: "generator",
    at: 0,
  });
  const internalCommitGuardUntilRef = useRef<number>(0);
  const lastObservedFilesSeedRef = useRef<string | null>(null);
  const generatorTouchedFilesRef = useRef<Set<string>>(new Set());
  const [errorBoundaryKey, setErrorBoundaryKey] = useState(0);
  const buildIdCacheRef = useRef<{ fetched: boolean; value: string | null }>({
    fetched: false,
    value: null,
  });
  const lockedLessonSpec = useMemo(
    () => (lessonLock.enabled ? getLessonSpec(lessonLock.lessonId) : null),
    [lessonLock.enabled, lessonLock.lessonId],
  );


  useEffect(() => {
    let active = true;
    void fetch(apiV1Path("ops/whoami"), {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!active || !response.ok) return;
        const json = (await response.json()) as { isOpsAdmin?: boolean } | null;
        setIsOpsAdmin(json?.isOpsAdmin === true);
      })
      .catch(() => {
        if (!active) return;
        setIsOpsAdmin(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (pathname?.startsWith("/s")) return;
    let active = true;
    void fetchEduFeatureFlags()
      .then((flags) => {
        if (!active) return;
        const safeFlags = flags ?? EDU_FEATURE_FLAGS_DEFAULTS;
        setEduFeatureFlags(safeFlags);
        setNetworkSaverUserFlags({
          enabled: safeFlags.netsaverEnabled === true,
          mode: safeFlags.netsaverMode,
          tier: safeFlags.netsaverP2pTier,
          maxBytes: safeFlags.maxBytes,
        });
      })
      .catch(() => {
        if (!active) return;
        setEduFeatureFlags(EDU_FEATURE_FLAGS_DEFAULTS);
        setNetworkSaverUserFlags({
          enabled: false,
          mode: EDU_FEATURE_FLAGS_DEFAULTS.netsaverMode,
          tier: EDU_FEATURE_FLAGS_DEFAULTS.netsaverP2pTier,
          maxBytes: EDU_FEATURE_FLAGS_DEFAULTS.maxBytes,
        });
      });
    return () => {
      active = false;
      setNetworkSaverUserFlags(null);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname?.startsWith("/s")) return;
    let active = true;
    void fetch(apiV1Path("edu/webllm/health"), {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!active || !response.ok) return;
        const json = (await response.json()) as Partial<LessonWebllmGateHealthState> | null;
        if (!active) return;
        if (json && typeof json.ok === "boolean") {
          setWebllmHealthGate({
            ok: json.ok,
            hardDisabled: json.hardDisabled === true,
            primary: json.primary ?? null,
            coach: json.coach ?? null,
            canonicalStatus: typeof json.canonicalStatus === "string" ? json.canonicalStatus : null,
            invalidReasons: Array.isArray(json.invalidReasons) ? json.invalidReasons : null,
          });
        }
      })
      .catch(() => {
        if (!active) return;
        setWebllmHealthGate(null);
      });
    return () => {
      active = false;
      setWebllmHealthGate(null);
    };
  }, [pathname]);

  useEffect(() => {
    performanceModeRef.current = performanceMode;
  }, [performanceMode]);

  const logDebug = useCallback((label: string, payload: Record<string, unknown>) => {
    if (!devToolsEnabled || typeof console === "undefined") return;
    console.debug(label, payload);
  }, []);

  const reportAbortTelemetry = useCallback(
    (meta: AbortMeta, requestId?: string | null) => {
      const localRequestId = requestId ?? requestIdRef.current ?? null;
      const dedupKey = `${localRequestId ?? "unknown"}:${meta.phase}`;
      if (abortTelemetryDedupRef.current.has(dedupKey)) {
        return;
      }
      abortTelemetryDedupRef.current.add(dedupKey);
      if (!Number.isFinite(meta.startedAt)) {
        void fetch(apiV1Path("ops/log"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            level: "error",
            route: "/edu/lesson",
            message: "decorate_startedAt_missing",
            requestId: localRequestId ?? undefined,
            meta: {
              phase: meta.phase,
              abortReason: meta.abortReason,
            },
          }),
        }).catch(() => undefined);
        return;
      }
      const elapsedMs = getAbortElapsedMs(meta);
      const level = meta.abortReason === "user_cancel" ? "info" : meta.abortReason === "timeout" ? "warn" : "warn";
      const payload = {
        abortReason: meta.abortReason,
        phase: meta.phase,
        startedAt: meta.startedAt,
        timeoutMs: meta.timeoutMs ?? null,
        elapsedMs,
        usingLocalWebLLM: meta.usingLocalWebLLM,
        modelId: meta.modelId ?? null,
        stage: meta.stage ?? null,
        retryCount: meta.retryCount ?? null,
        slotCandidatesCount: meta.slotCandidatesCount ?? null,
        selectedSlotId: meta.selectedSlotId ?? null,
        selectedSelector: meta.selectedSelector ?? null,
        slotResolveSource: meta.slotResolveSource ?? null,
        htmlHashBefore: meta.htmlHashBefore ?? null,
        htmlHashAfterInjection: meta.htmlHashAfterInjection ?? null,
        snapshotVersion: meta.snapshotVersion ?? null,
        committedHtmlHash: meta.committedHtmlHash ?? null,
        commitTargetKey: meta.commitTargetKey ?? null,
        previewRefreshTriggered: meta.previewRefreshTriggered ?? null,
        previewHtmlHash: meta.previewHtmlHash ?? null,
        previewMatchesCommitted: meta.previewMatchesCommitted ?? null,
      };
      void fetch(apiV1Path("ops/log"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          level,
          route: "/edu/lesson",
          message: "webllm_abort",
          requestId: localRequestId ?? undefined,
          meta: payload,
        }),
      }).catch(() => undefined);
      void reportUiError({
        message: "Aborted",
        route: pathname || "/edu/lesson",
        requestId: localRequestId ?? undefined,
        digest: null,
        stack: JSON.stringify(payload),
        abortReason: meta.abortReason,
        phase: meta.phase,
        timeoutMs: meta.timeoutMs ?? null,
        elapsedMs,
        usingLocalWebLLM: meta.usingLocalWebLLM,
        modelId: meta.modelId ?? null,
        stage: meta.stage ?? null,
        retryCount: meta.retryCount ?? null,
        slotCandidatesCount: meta.slotCandidatesCount ?? null,
        selectedSlotId: meta.selectedSlotId ?? null,
        selectedSelector: meta.selectedSelector ?? null,
        slotResolveSource: meta.slotResolveSource ?? null,
        htmlHashBefore: meta.htmlHashBefore ?? null,
        htmlHashAfterInjection: meta.htmlHashAfterInjection ?? null,
      });
    },
    [pathname],
  );

  const isActiveMsgId = useCallback((clientMsgId: string) => {
    return activeMsgIdRef.current === clientMsgId;
  }, []);

  const syncActiveMsgId = useCallback((clientMsgId: string | null) => {
    activeMsgIdRef.current = clientMsgId;
    setActiveMsgId(clientMsgId);
  }, []);

  const cancelIdleWarmup = useCallback((entry: { mode: "idle" | "timeout"; id: number } | null) => {
    if (!entry) return;
    if (entry.mode === "idle") {
      const cancelIdleCallback = (
        window as Window & { cancelIdleCallback?: (id: number) => void }
      ).cancelIdleCallback;
      if (cancelIdleCallback) {
        cancelIdleCallback(entry.id);
        return;
      }
    }
    window.clearTimeout(entry.id);
  }, []);

  const resetChatAbortController = useCallback(() => {
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
    }
    const controller = new AbortController();
    chatAbortRef.current = controller;
    return controller;
  }, []);

  const clearChatRequestTracking = useCallback(() => {
    syncActiveMsgId(null);
    setFallbackMsgId(null);
    fallbackMsgIdRef.current = null;
    chatSlaRef.current = null;
  }, [syncActiveMsgId]);

  const webllmHosts = lessonWebllmReadiness.descriptor.hosts;

  const initChatSla = useCallback((clientMsgId: string) => {
    chatSlaRef.current = {
      clientMsgId,
      startedAt: Date.now(),
      recorded: false,
    };
  }, []);

  const markChatSlaRemoteStart = useCallback((clientMsgId: string, requestId?: string | null) => {
    const tracker = chatSlaRef.current;
    if (!tracker || tracker.clientMsgId !== clientMsgId) return;
    if (tracker.tRemoteStartMs == null) {
      tracker.tRemoteStartMs = Date.now() - tracker.startedAt;
    }
    if (requestId) {
      tracker.rid = requestId;
    }
  }, []);

  const markChatSlaCoachShown = useCallback((clientMsgId: string) => {
    const tracker = chatSlaRef.current;
    if (!tracker || tracker.clientMsgId !== clientMsgId) return;
    if (tracker.tCoachMs == null) {
      tracker.tCoachMs = Date.now() - tracker.startedAt;
    }
  }, []);

  const recordChatSlaOutcome = useCallback(
    (clientMsgId: string, outcome: "local" | "remote" | "coach" | "retry_shown", path: "chat_remote" | "chat_local_fallback") => {
      const tracker = chatSlaRef.current;
      if (!tracker || tracker.clientMsgId !== clientMsgId || tracker.recorded) return;
      tracker.recorded = true;
      const tFirst = tracker.tFirstResponseMs ?? Date.now() - tracker.startedAt;
      void recordEduEvent({
        type: "EDU_CHAT_SLA",
        boardId: "edu_chat_panel",
        requestId: tracker.rid ?? null,
        shareCode: shareCode ?? undefined,
        extra: {
          clientMsgId,
          outcome,
          t_remote_start_ms: tracker.tRemoteStartMs ?? null,
          t_coach_ms: tracker.tCoachMs ?? null,
          t_first_response_ms: tFirst,
          rid: tracker.rid ?? null,
          path,
        },
      });
    },
    [shareCode],
  );

  const markChatSlaFirstResponse = useCallback(
    (clientMsgId: string, outcome: "local" | "remote" | "coach") => {
      const tracker = chatSlaRef.current;
      if (!tracker || tracker.clientMsgId !== clientMsgId) return;
      if (tracker.tFirstResponseMs == null) {
        tracker.tFirstResponseMs = Date.now() - tracker.startedAt;
      }
      recordChatSlaOutcome(clientMsgId, outcome, outcome === "remote" ? "chat_remote" : "chat_local_fallback");
    },
    [recordChatSlaOutcome],
  );

  const enablePerformanceMode = useCallback(
    (reason: "longtask" | "render_spike") => {
      if (performanceModeRef.current || isTeacherMode) return;
      performanceModeRef.current = true;
      setPerformanceMode(true);
      logDebug("[edu] performance.mode", { reason });
    },
    [isTeacherMode, logDebug],
  );

  const showTeacherToast = useCallback((message: string) => {
    setTeacherToast(message);
    if (teacherToastHideTimerRef.current) {
      window.clearTimeout(teacherToastHideTimerRef.current);
    }
    teacherToastHideTimerRef.current = window.setTimeout(() => {
      setTeacherToast(null);
      teacherToastHideTimerRef.current = null;
    }, 6000);
  }, []);

  const updateOpsMode = useCallback((next: OpsMode) => {
    setOpsMode(next);
    try {
      if (next === "normal") {
        window.sessionStorage.removeItem(OPS_MODE_KEY);
      } else {
        window.sessionStorage.setItem(OPS_MODE_KEY, next);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  const startRequest = useCallback(
    (source: string) => {
      const requestId = createRequestId();
      requestIdRef.current = requestId;
      logDebug("[edu] request.start", { requestId, source });
      return requestId;
    },
    [logDebug],
  );
  const resolvedLessonId = useMemo<LessonId>(() => {
    if (lessonLock.enabled) return lessonLock.lessonId;
    return lessonLock.lessonId ?? getLessonIdFromNumber(lessonId) ?? "P1";
  }, [lessonId, lessonLock.enabled, lessonLock.lessonId]);
  const isTemplateFirst = templateFirstMode;
  const chatStorageKey = useMemo(
    () => `${chatStorageKeyPrefix}:${resolvedLessonId}`,
    [chatStorageKeyPrefix, resolvedLessonId],
  );
  const resolvedLessonNumber = useMemo(() => {
    switch (resolvedLessonId) {
      case "P2":
        return 2;
      case "P3":
        return 3;
      case "P4":
        return 4;
      case "P1":
      default:
        return 1;
    }
  }, [resolvedLessonId]);
  const PREWARM_ONCE_KEY = "edu:webllm:autoprewarm:v1";
  const WARMUP_ONCE_KEY = "edu:webllm:autowarmup:v1";
  const shouldRunOnce = (key: string) => {
    try {
      if (typeof window === "undefined") return false;
      const hit = window.sessionStorage.getItem(key);
      if (hit === "1") return false;
      window.sessionStorage.setItem(key, "1");
      return true;
    } catch {
      return true;
    }
  };

  useEffect(() => {
    panelStateRef.current = panelState;
  }, [panelState]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setTimeout(() => {
      setWebllmCoreRenderDone(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!webllmCoreRenderDone || webllmLazyActivationReady) return;

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      setWebllmLazyActivationReady(true);
    };

    const interactionHandler = () => settle();
    window.addEventListener("pointerdown", interactionHandler, { passive: true, once: true });
    window.addEventListener("keydown", interactionHandler, { passive: true, once: true });
    window.addEventListener("touchstart", interactionHandler, { passive: true, once: true });

    const requestIdleCallback = (
      window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }
    ).requestIdleCallback;

    let idleMode: "idle" | "timeout";
    let idleId: number;
    if (requestIdleCallback) {
      idleMode = "idle";
      idleId = requestIdleCallback(settle, { timeout: WEBLLM_LAZY_IDLE_TIMEOUT_MS });
    } else {
      idleMode = "timeout";
      idleId = window.setTimeout(settle, WEBLLM_LAZY_IDLE_TIMEOUT_MS);
    }

    return () => {
      window.removeEventListener("pointerdown", interactionHandler);
      window.removeEventListener("keydown", interactionHandler);
      window.removeEventListener("touchstart", interactionHandler);
      if (idleMode === "idle") {
        (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [webllmCoreRenderDone, webllmLazyActivationReady]);

  useEffect(() => {
    if (panelState !== "ERROR_RECOVERABLE") return;
    setManualFallbackReason((prev) => prev ?? "apply_failed");
  }, [panelState]);

  useEffect(() => {
    const unsubscribe = onWebLLMProgress((event) => {
      lastWebLLMProgressRef.current = { event, at: Date.now() };
      if (!isTeacherMode) {
        if (thinkingToastTimerRef.current) {
          window.clearTimeout(thinkingToastTimerRef.current);
          thinkingToastTimerRef.current = null;
        }
        return;
      }
      if (event.stage === "thinking") {
        if (!thinkingToastTimerRef.current && !thinkingToastShownRef.current) {
          thinkingToastTimerRef.current = window.setTimeout(() => {
            thinkingToastTimerRef.current = null;
            thinkingToastShownRef.current = true;
            showTeacherToast("WebLLM이 20초 넘게 생각 중이에요. 간단 모드 전환을 추천합니다.");
          }, 20000);
        }
      } else if (thinkingToastTimerRef.current) {
        window.clearTimeout(thinkingToastTimerRef.current);
        thinkingToastTimerRef.current = null;
      }
    });
    return () => {
      unsubscribe();
    };
  }, [isTeacherMode, showTeacherToast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isTeacherMode) return;
    if (typeof PerformanceObserver === "undefined") return;
    if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return;

    const observer = new PerformanceObserver((list) => {
      if (performanceModeRef.current) return;
      const now = Date.now();
      if (
        longTaskWindowStartRef.current === null ||
        now - longTaskWindowStartRef.current > PERFORMANCE_LONGTASK_WINDOW_MS
      ) {
        longTaskWindowStartRef.current = now;
        longTaskCountRef.current = 0;
      }
      const entries = list.getEntries();
      if (entries.length === 0) return;
      longTaskCountRef.current += entries.length;
      if (longTaskCountRef.current >= PERFORMANCE_LONGTASK_THRESHOLD) {
        enablePerformanceMode("longtask");
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
    return () => observer.disconnect();
  }, [enablePerformanceMode, isTeacherMode]);

  useEffect(() => {
    if (coachRunning || genRunning) return;
    thinkingToastShownRef.current = false;
    if (thinkingToastTimerRef.current) {
      window.clearTimeout(thinkingToastTimerRef.current);
      thinkingToastTimerRef.current = null;
    }
  }, [coachRunning, genRunning]);

  useEffect(() => {
    recordedStepIdsRef.current.clear();
    lastProgressStepRef.current = null;
    safeEventBufferRef.current = [];
  }, [resolvedLessonId]);

  const scheduleMetricsSummaryUpdate = useCallback(() => {
    if (metricsUpdateTimerRef.current !== null) return;
    metricsUpdateTimerRef.current = window.setTimeout(() => {
      metricsUpdateTimerRef.current = null;
      setMetricsSummary(normalizeMetricsSummary(metricsRef.current.summary()));
    }, 250);
  }, []);

  const progressThrottleMs = useMemo(
    () => (performanceMode ? PROGRESS_THROTTLE_PERF_MS : PROGRESS_THROTTLE_BASE_MS),
    [performanceMode],
  );

  const { clear: clearProgressMessageThrottle, setThrottled: setProgressMessageThrottled } =
    useThrottledSetter(setProgressMessage, progressThrottleMs);
  const { clear: clearFileProgressMessageThrottle, setThrottled: setFileProgressMessageThrottled } =
    useThrottledSetter(setFileProgressMessage, progressThrottleMs);
  const { clear: clearNetworkPrepStatusThrottle, setThrottled: setNetworkPrepStatusThrottled } =
    useThrottledSetter(setNetworkPrepStatusState, progressThrottleMs);

  const runManualWarmup = useCallback(() => {
    if (!effectiveWebllmEnabled) return;
    setWebllmLazyActivationReady(true);
    try {
      window.sessionStorage.setItem(WARMUP_ALLOW_KEY, "1");
    } catch {
      // ignore storage failures
    }
    const requestId = createRequestId();
    const unsubscribe = onWebLLMProgress((event) => {
      if (event.requestId !== requestId || event.kind !== "warmup") return;
      setProgressMessageThrottled(event.message);
    });
    void safeStartWebLLM(requestId, {
      kind: "warmup",
      preferredModelId: preferredModelId ?? undefined,
    })
      .catch(() => undefined)
      .finally(() => {
        unsubscribe();
      });
  }, [effectiveWebllmEnabled, preferredModelId, setProgressMessageThrottled]);

  const setLocalAiDisabledState = useCallback((next: boolean) => {
    if (typeof window === "undefined") return;
    try {
      if (next) {
        window.localStorage.setItem(LOCAL_AI_DISABLED_KEY, "1");
      } else {
        window.localStorage.removeItem(LOCAL_AI_DISABLED_KEY);
      }
      window.dispatchEvent(new Event(LOCAL_AI_DISABLED_EVENT));
      setLocalAiDisabled(next);
    } catch {
      setLocalAiDisabled(next);
    }
  }, []);

  const handleWebLLMSessionRetry = useCallback(() => {
    if (webllmSessionRetryUsed) return;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(WEBLLM_SESSION_RETRY_KEY, "1");
      } catch {
        // ignore storage failures
      }
    }
    setWebllmSessionRetryUsed(true);
    if (localAiDisabled) {
      setLocalAiDisabledState(false);
    }
    setWebllmStatus("LOADING");
    setWebllmStatusCode("WEBLLM_RETRYING");
    setWebllmStatusAt(Date.now());
    runManualWarmup();
  }, [localAiDisabled, runManualWarmup, setLocalAiDisabledState, webllmSessionRetryUsed]);

  const recordInsuranceTemplateApplied = useCallback(() => {
    void safeStartWebLLM(createRequestId(), { kind: "recordInsurance" }).catch(() => undefined);
  }, []);

  const recordMetric = useCallback(
    (event: EduMetricEvent) => {
      metricsRef.current.add(event);
      if (event.type === "WARN") {
        safeEventBufferRef.current.push({
          ts: event.t,
          type: event.type,
          meta: { codeHash: hashCode(event.code) },
        });
      } else if (event.type === "HARDFAIL") {
        safeEventBufferRef.current.push({
          ts: event.t,
          type: event.type,
          meta: { codeHash: hashCode(event.code) },
        });
      } else if (event.type === "ACTION") {
        safeEventBufferRef.current.push({
          ts: event.t,
          type: event.type,
          meta: { codeHash: hashCode(event.name) },
        });
      } else if (event.type === "LESSON") {
        safeEventBufferRef.current.push({
          ts: event.t,
          type: event.type,
          meta: { codeHash: hashCode(`${event.lessonId}:${event.locked ? "locked" : "open"}`) },
        });
      }
      if (safeEventBufferRef.current.length > SAFE_EVENT_BUFFER_LIMIT) {
        safeEventBufferRef.current.splice(
          0,
          safeEventBufferRef.current.length - SAFE_EVENT_BUFFER_LIMIT,
        );
      }
      scheduleMetricsSummaryUpdate();
    },
    [scheduleMetricsSummaryUpdate],
  );

  const recordStep = useCallback(
    (step: EduMetricStep, ok: boolean, stepId: string) => {
      const dedupeKey = `${stepId}:${step}`;
      if (recordedStepIdsRef.current.has(dedupeKey)) return;
      recordedStepIdsRef.current.add(dedupeKey);
      const ts = Date.now();
      recordMetric({ t: ts, type: "STEP", step, ok });
      safeEventBufferRef.current.push({
        ts,
        type: "STEP",
        meta: { codeHash: hashCode(`${step}:${ok ? "ok" : "fail"}`) },
      });
      if (safeEventBufferRef.current.length > SAFE_EVENT_BUFFER_LIMIT) {
        safeEventBufferRef.current.splice(
          0,
          safeEventBufferRef.current.length - SAFE_EVENT_BUFFER_LIMIT,
        );
      }
    },
    [recordMetric],
  );

  const recordEvent = useCallback(
    (
      name: EduMetricEventName,
      codeHash?: string,
      meta?: { stepId?: EduPanelStepId; templateKey?: string },
    ) => {
      const ts = Date.now();
      recordMetric({ t: ts, type: "EVENT", name, codeHash });
      const eventMeta = {
        ...(codeHash ? { codeHash } : {}),
        ...(meta?.stepId ? { stepId: meta.stepId } : {}),
        ...(meta?.templateKey ? { templateKey: meta.templateKey } : {}),
      };
      safeEventBufferRef.current.push({
        ts,
        type: name,
        meta: Object.keys(eventMeta).length ? eventMeta : undefined,
      });
      if (safeEventBufferRef.current.length > SAFE_EVENT_BUFFER_LIMIT) {
        safeEventBufferRef.current.splice(
          0,
          safeEventBufferRef.current.length - SAFE_EVENT_BUFFER_LIMIT,
        );
      }
    },
    [recordMetric],
  );

  useEffect(() => {
    const lessonKey = `${resolvedLessonId}:${lessonLock.enabled}`;
    if (lastLessonMetricRef.current === lessonKey) return;
    lastLessonMetricRef.current = lessonKey;
    recordMetric({
      t: Date.now(),
      type: "LESSON",
      lessonId: resolvedLessonId,
      locked: lessonLock.enabled,
    });
  }, [lessonLock.enabled, recordMetric, resolvedLessonId]);

  useEffect(() => {
    recordEvent("chatpanel_render_ok");
    const recordedSteps = recordedStepIdsRef.current;
    return () => {
      recordedSteps.clear();
      clearProgressMessageThrottle();
      clearFileProgressMessageThrottle();
      clearNetworkPrepStatusThrottle();
      safeEventBufferRef.current = [];
    };
  }, [clearFileProgressMessageThrottle, clearNetworkPrepStatusThrottle, clearProgressMessageThrottle, recordEvent]);

  const deriveLocalCoachAction = useCallback(
    (messageText: string | null): CoachAction | null => {
      if (!lessonLock.enabled || lessonLock.lessonId !== "P1" || !messageText) {
        return null;
      }
      const hasName = /이름/.test(messageText);
      const hasHobby = /취미/.test(messageText);
      const ready = hasName && hasHobby;
      return {
        action: ready ? "build_site" : "ask_more",
        ready,
      };
    },
    [lessonLock.enabled, lessonLock.lessonId],
  );
  const insuranceLessonSpec = useMemo(() => {
    if (!resolvedLessonId) return null;
    return getLessonSpec(resolvedLessonId);
  }, [resolvedLessonId]);
  const lessonChatPrompt = useMemo(() => {
    const basePrompt = buildCoachChatSystemPrompt({
      lessonId: resolvedLessonId,
      lessonSpec: lockedLessonSpec,
    });
    if (!lightModeEnabled) return basePrompt;
    return `${basePrompt}\n\n라이트 모드: 답변은 2~3문장으로 짧고 빠르게 전달해줘.`;
  }, [lightModeEnabled, lockedLessonSpec, resolvedLessonId]);
  const lessonFilesPrompt = useMemo(
    () =>
      buildCoachFilesSystemPrompt({
        lessonId: resolvedLessonId,
        allowedFiles: allowedFilenames,
        lessonSpec: lockedLessonSpec,
      }),
    [allowedFilenames, lockedLessonSpec, resolvedLessonId],
  );
  const lessonActionPrompt = useMemo(
    () => buildCoachActionSystemPrompt({ lessonId: resolvedLessonId }),
    [resolvedLessonId],
  );
  const generatorSchema = useMemo(
    () => ({
      anyOf: [filesSchema([...WEBLLM_ALLOWED_FILES]), getLessonContentSchema(resolvedLessonId)],
    }),
    [resolvedLessonId],
  );
  const { fallbackModelId, coachModelId: decorateCoachModelId } = lessonWebllmReadiness.descriptor.selection;
  const templateOptions = useMemo(() => getTemplatesForLesson(resolvedLessonNumber), [resolvedLessonNumber]);

  const presetPrompts = useMemo(() => {
    if (resolvedLessonNumber === 1) {
      return [
        {
          id: "intro",
          label: "이름과 취미 한 줄 소개",
          prompt: "안녕하세요! 제 이름과 취미를 한 줄로 소개해 주세요.",
          icon: UserIcon,
        },
        {
          id: "profile-card",
          label: "학교/학년/관심사 프로필 카드",
          prompt: "학교, 학년, 관심사를 한눈에 보이는 프로필 카드 구성으로 만들어 주세요.",
          icon: LayoutIcon,
        },
        {
          id: "favorites",
          label: "좋아하는 것 섹션",
          prompt: "내가 좋아하는 색, 음식, 꿈을 소개하는 섹션을 만들어 주세요.",
          icon: BadgeIcon,
        },
        {
          id: "photo-slogan",
          label: "사진 자리 + 슬로건",
          prompt: "사진이 들어갈 자리와 한 줄 슬로건이 있는 소개 화면을 구성해 주세요.",
          icon: ImageIcon,
        },
      ];
    }

    return [
      {
        id: "goal",
        label: "이번 교시 목표 요청",
        prompt: "이번 교시 목표를 한 문장으로 정리해 주세요.",
        icon: UserIcon,
      },
      {
        id: "structure",
        label: "페이지 구성 제안",
        prompt: "오늘 배운 내용을 반영한 페이지 구성을 제안해 주세요.",
        icon: LayoutIcon,
      },
      {
        id: "style",
        label: "분위기/색감 추천",
        prompt: "프로젝트 분위기와 어울리는 색감 조합을 추천해 주세요.",
        icon: BadgeIcon,
      },
      {
        id: "visual",
        label: "이미지 배치 아이디어",
        prompt: "이미지를 배치할 위치와 설명 문구 아이디어를 알려 주세요.",
        icon: ImageIcon,
      },
    ];
  }, [resolvedLessonNumber]);
  const examplePrompts = useMemo(() => {
    const base = starterPromptSuggestions.slice(0, 3);
    if (base.length > 0) return base;
    return [
      "내 취미와 좋아하는 색을 소개해 줘.",
      "나만의 웹사이트를 만들고 싶은데 제목을 정해줘.",
      "오늘 배운 것을 반영해서 페이지 구성을 제안해줘.",
    ];
  }, [starterPromptSuggestions]);
  const mobilePresetPrompts = useMemo(() => presetPrompts.slice(0, 2), [presetPrompts]);
  const overflowPresetPrompts = useMemo(() => presetPrompts.slice(2), [presetPrompts]);
  const isFreeModeLesson = !lessonLock.enabled && lessonId === 0;
  const studentDecorateOutcomeHints = useMemo(() => {
    const perf = studentDecorateExamplePerfRef.current;
    const tick = studentExampleOutcomeTick;
    return Object.entries(perf).reduce((acc, [kind, stat]) => {
      if (!stat) return acc;
      acc[kind as StudentDecorateExampleKind] = {
        selectionRate: stat.selected > 0 ? Math.min(1, stat.selected / Math.max(1, 8 - Math.min(3, tick))) : 0,
        successRate: stat.outcomes > 0 ? stat.success / stat.outcomes : 0,
        lowImpactRate: stat.outcomes > 0 ? stat.lowImpact / stat.outcomes : 0,
      };
      return acc;
    }, {} as Partial<Record<StudentDecorateExampleKind, { selectionRate?: number; successRate?: number; lowImpactRate?: number }>>);
  }, [studentExampleOutcomeTick]);
  const structureAwareSuggestions = useMemo(() => {
    const html = currentFiles?.["index.html"]?.content ?? "";
    return getStructureAwareStudentDecorateExamples({
      lessonId: resolvedLessonId,
      isFreeMode: isFreeModeLesson,
      limit: 5,
      structureSignals: { html },
      outcomeHints: studentDecorateOutcomeHints,
    });
  }, [currentFiles, isFreeModeLesson, resolvedLessonId, studentDecorateOutcomeHints]);
  const studentDecorateSuggestions = structureAwareSuggestions.examples;
  const studentDecorateInputGuidance = useMemo(
    () => getStudentDecorateInputGuidanceCopy({ lessonId: resolvedLessonId, isFreeMode: isFreeModeLesson, structureSignals: structureAwareSuggestions.structureSignals }),
    [isFreeModeLesson, resolvedLessonId, structureAwareSuggestions.structureSignals],
  );
  useEffect(() => {
    const renderKey = `${resolvedLessonId}:${isFreeModeLesson ? "free" : "lesson"}:${studentDecorateSuggestions.map((item) => item.kind).join(",")}`;
    if (studentDecorateExamplesRenderedKeyRef.current === renderKey) return;
    studentDecorateExamplesRenderedKeyRef.current = renderKey;
    void recordEduEvent({
      type: "decorate_student_example_rendered",
      boardId: "edu_chat_panel",
      requestId: requestIdRef.current ?? createRequestId(),
      shareCode: shareCode ?? undefined,
      extra: {
        lessonId: resolvedLessonId,
        isFreeMode: isFreeModeLesson,
        lessonAware: true,
        kindsShown: studentDecorateSuggestions.map((item) => item.kind),
        count: studentDecorateSuggestions.length,
        structureAware: true,
        rankingReasons: structureAwareSuggestions.rankingReasonSummary,
        path: "decorate_local",
      },
    });
    void recordEduEvent({
      type: "decorate_student_example_ranked",
      boardId: "edu_chat_panel",
      requestId: requestIdRef.current ?? createRequestId(),
      shareCode: shareCode ?? undefined,
      extra: {
        lessonId: resolvedLessonId,
        exampleKinds: studentDecorateSuggestions.map((item) => item.kind),
        rankingReasons: structureAwareSuggestions.rankingReasonSummary,
        structureAware: true,
        path: "decorate_local",
      },
    });
    void recordEduEvent({
      type: "decorate_student_example_ranking_applied",
      boardId: "edu_chat_panel",
      requestId: requestIdRef.current ?? createRequestId(),
      shareCode: shareCode ?? undefined,
      extra: {
        lessonId: resolvedLessonId,
        chosenOrder: studentDecorateSuggestions.map((item) => item.kind),
        basedOnStructure: true,
        basedOnOutcomeHints: Object.keys(studentDecorateOutcomeHints).length > 0,
        path: "decorate_local",
      },
    });
  }, [isFreeModeLesson, resolvedLessonId, shareCode, studentDecorateOutcomeHints, studentDecorateSuggestions, structureAwareSuggestions.rankingReasonSummary]);
  const fillPrompt = (text: string) => {
    setInput(text);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const length = text.length;
      textarea.setSelectionRange(length, length);
    });
  };
  const handleStudentDecorateSuggestionSelect = (example: { kind: string; promptClass: string; prompt: string }, index: number) => {
    studentDecorateSelectedExampleRef.current = { ...example, index, lessonAware: true };
    studentDecorateExampleOriginRef.current = { kind: example.kind, promptClass: example.promptClass, index, lessonAware: true };
    const kind = example.kind as StudentDecorateExampleKind;
    const prev = studentDecorateExamplePerfRef.current[kind] ?? { selected: 0, outcomes: 0, success: 0, lowImpact: 0 };
    studentDecorateExamplePerfRef.current[kind] = { ...prev, selected: prev.selected + 1 };
    setStudentExampleOutcomeTick((value) => value + 1);
    fillPrompt(example.prompt);
    void recordEduEvent({
      type: "decorate_student_example_selected",
      boardId: "edu_chat_panel",
      requestId: requestIdRef.current ?? createRequestId(),
      shareCode: shareCode ?? undefined,
      extra: {
        lessonId: resolvedLessonId,
        isFreeMode: isFreeModeLesson,
        exampleKind: example.kind,
        exampleIndex: index,
        promptClass: example.promptClass,
        lessonAware: true,
        path: "decorate_local",
      },
    });
  };
  const insuranceTemplatePrompt = useMemo(() => {
    if (insuranceLessonSpec?.insurancePrompt) {
      return insuranceLessonSpec.insurancePrompt;
    }
    return "자기소개 한 장짜리 웹페이지를 만들어요. 이름: __, 취미: __. 사진 자리와 한줄 슬로건도 넣어줘.";
  }, [insuranceLessonSpec]);
  const applyInsurancePrompt = () => {
    setInsuranceSuggestionActive(false);
    fillPrompt(insuranceTemplatePrompt);
  };
  const applySanitizeSuggestion = () => {
    if (!sanitizeSuggestion) return;
    setSanitizeSuggestionActive(false);
    fillPrompt(sanitizeSuggestion);
  };

  const resolveFallbackName = useCallback(() => {
    const trimmedProfile = profileName?.trim();
    if (trimmedProfile) return trimmedProfile;
    const localNickname = getLocalEduNickname();
    if (localNickname) return localNickname;
    return "나";
  }, [profileName]);

  const buildFallbackFiles = useCallback(
    (prompt: string | null) => {
      const safePrompt = prompt ? sanitizeUserInput(prompt).sanitized : "";
      const fallbackName = resolveFallbackName();
      const lessonKey = lessonLock.lessonId ?? getLessonIdFromNumber(lessonId) ?? "P1";
      const base = lessonInsuranceContent(lessonKey);

      switch (lessonKey) {
        case "P2": {
          const content = base as P2Content;
          const merged: P2Content = {
            ...content,
            about: { ...content.about, name: fallbackName },
            footerNote: safePrompt ? `${content.footerNote} ${safePrompt}` : content.footerNote,
          };
          return renderLessonSite(lessonKey, merged);
        }
        case "P3": {
          const content = base as P3Content;
          const merged: P3Content = {
            ...content,
            intro: safePrompt ? `${content.intro} ${safePrompt}` : content.intro,
          };
          return renderLessonSite(lessonKey, merged);
        }
        case "P4": {
          const content = base as P4Content;
          const merged: P4Content = {
            ...content,
            profile: { ...content.profile, name: fallbackName },
            contactHint: safePrompt ? `${content.contactHint} ${safePrompt}` : content.contactHint,
          };
          return renderLessonSite(lessonKey, merged);
        }
        case "P1":
        default: {
          const content = base as P1Content;
          const merged: P1Content = {
            ...content,
            profile: { ...content.profile, name: fallbackName },
            intro: safePrompt ? `${content.intro} ${safePrompt}` : content.intro,
          };
          return renderLessonSite(lessonKey, merged);
        }
      }
    },
    [lessonId, lessonLock.lessonId, resolveFallbackName],
  );
  useEffect(() => {
    if (!input.trim()) {
      setLastSanitizeFlags(null);
      setSanitizeSuggestion(null);
      setSanitizeSuggestionActive(false);
      setInsuranceSuggestionActive(false);
      sanitizeSuggestionRef.current = { insurance: false, sanitize: false, profanity: false };
      return;
    }

    const result = sanitizeUserInput(input);
    setLastSanitizeFlags(result.flags);

    const hasSanitizeSuggestion = result.changed;
    const hasInsuranceSuggestion = result.flags.tooShort;
    const hasProfanity = result.flags.hasProfanity;

    setSanitizeSuggestion(hasSanitizeSuggestion ? result.sanitized : null);
    setSanitizeSuggestionActive(hasSanitizeSuggestion);
    setInsuranceSuggestionActive(hasInsuranceSuggestion);

    const hadSuggestion =
      sanitizeSuggestionRef.current.sanitize || sanitizeSuggestionRef.current.insurance;
    const hasSuggestion = hasSanitizeSuggestion || hasInsuranceSuggestion;

    if (hasSuggestion && !hadSuggestion) {
      setSanitizePulseTone(hasProfanity ? "alert" : "glow");
      setSanitizePulseKey((prev) => prev + 1);
    }

    sanitizeSuggestionRef.current = {
      insurance: hasInsuranceSuggestion,
      sanitize: hasSanitizeSuggestion,
      profanity: hasProfanity,
    };
  }, [input]);
  const canSwitchToFallback = Boolean(fallbackModelId && preferredModelId !== fallbackModelId);
  const isOpsModeLocked = opsMode !== "normal";
  const isCoachActionReady = coachAction?.ready === true;
  const isGenerateReady = isTemplateFirst ? true : isCoachActionReady;
  const isGeneratingFiles =
    (!fastFallbackApplied && genRunning) ||
    panelState === "GENERATING_FILES" ||
    panelState === "POSTPROCESSING_FILES";
  const isCoachBusy = coachRunning || panelState === "COACH_STREAMING";
  const derivedActionPhase = useMemo<ActionPhase>(() => {
    if (isOpsModeLocked) {
      return "idle";
    }
    if (manualFallbackReason === "slot_choice" || manualFallbackReason === "slot_target_missing") {
      return "choice";
    }
    if (manualFallbackReason) {
      return "failed";
    }
    if (panelState === "ERROR_RECOVERABLE") {
      return "failed";
    }
    if (panelState === "APPLIED") {
      if (lastApplyOutcome === "partial" || fastFallbackApplied) {
        return "partial";
      }
      return "done";
    }
    if (panelState === "POSTPROCESSING_FILES") {
      return "applying";
    }
    if (panelState === "GENERATING_FILES" || panelState === "COACH_STREAMING") {
      return "thinking";
    }
    if (panelState === "ACTION_PREPARING") {
      return lastUserMessage ? "preparing" : "idle";
    }
    return "idle";
  }, [
    fastFallbackApplied,
    isOpsModeLocked,
    lastApplyOutcome,
    manualFallbackReason,
    panelState,
    lastUserMessage,
  ]);
  useEffect(() => {
    dispatchActionPhase({ type: "TRANSITION", next: derivedActionPhase });
  }, [derivedActionPhase]);
  const progressSteps = useMemo(
    () => [
      {
        id: "chat",
        label: "대화",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 5.5C4 4.12 5.12 3 6.5 3h11C18.88 3 20 4.12 20 5.5v8c0 1.38-1.12 2.5-2.5 2.5H9l-4.5 4V16H6.5C5.12 16 4 14.88 4 13.5v-8Z" />
          </svg>
        ),
      },
      {
        id: "ready",
        label: "준비",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m12 2 2.2 5.2 5.6.6-4.2 3.7 1.2 5.5L12 14.8 7.2 17l1.2-5.5-4.2-3.7 5.6-.6L12 2Z" />
          </svg>
        ),
      },
      {
        id: "generate",
        label: "생성",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4v16M4 12h16" />
          </svg>
        ),
      },
      {
        id: "complete",
        label: "완료",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 12.5 9.5 17 19 7" />
          </svg>
        ),
      },
    ],
    [],
  );
  const currentStepId = useMemo<EduPanelStepId>(() => {
    if (panelState === "APPLIED") {
      return "complete";
    }
    if (
      panelState === "GENERATING_FILES" ||
      panelState === "POSTPROCESSING_FILES" ||
      (panelState === "ERROR_RECOVERABLE" && actionPrompt?.showGenerateRetry)
    ) {
      return "generate";
    }
    if (panelState === "READY_TO_GENERATE" || panelState === "ACTION_PREPARING") {
      return "ready";
    }
    if (panelState === "COACH_STREAMING") {
      return "chat";
    }
    return "ready";
  }, [actionPrompt?.showGenerateRetry, panelState]);
  const shouldVirtualizeMessages = useMemo(
    () => performanceMode || messages.length > MESSAGE_VIRTUALIZATION_THRESHOLD,
    [messages.length, performanceMode],
  );
  const visibleMessages = useMemo(
    () =>
      shouldVirtualizeMessages ? messages.slice(-MESSAGE_VIRTUALIZATION_LIMIT) : messages,
    [messages, shouldVirtualizeMessages],
  );
  const hiddenMessageCount = useMemo(
    () => Math.max(0, messages.length - visibleMessages.length),
    [messages.length, visibleMessages.length],
  );
  const messageItems = useMemo(
    () => visibleMessages.map((message) => <ChatMessageItem key={message.id} message={message} />),
    [visibleMessages],
  );
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = distanceToBottom < BOTTOM_THRESHOLD_PX;
    setAutoScroll((prev) => (prev === isAtBottom ? prev : isAtBottom));
    setShowJump((prev) => (prev === !isAtBottom ? prev : !isAtBottom));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setWebllmSessionRetryUsed(window.sessionStorage.getItem(WEBLLM_SESSION_RETRY_KEY) === "1");
    } catch {
      setWebllmSessionRetryUsed(false);
    }
  }, []);

  useEffect(() => {
    setWebllmLastGoodSelection(getWebLLMLastGoodSelection());
  }, [webllmStatus, webllmDegradedUntil]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(chatStorageKey);
      setPersistedKeyExists(Boolean(raw));
      if (!raw) {
        setLastLoadOk(false);
        return;
      }
      const parsed = JSON.parse(raw);
      const restored = normalizeStoredMessages(parsed);
      if (!restored) {
        window.localStorage.removeItem(chatStorageKey);
        setPersistedKeyExists(false);
        setLastLoadOk(false);
        return;
      }
      if (restored.length > 0) {
        setMessages(restored);
      }
      setLastLoadOk(true);
    } catch (error) {
      void recordChatSoftError({
        stage: "chat_storage_load",
        error,
        keyName: chatStorageKey,
        lessonId: resolvedLessonNumber,
      });
      if (isDev) {
        console.debug("[chatpanel] failed to read stored messages", error);
      }
      setLastLoadOk(false);
      try {
        window.localStorage.removeItem(chatStorageKey);
        setPersistedKeyExists(false);
      } catch {
        void recordChatSoftError({
          stage: "chat_storage_cleanup",
          keyName: chatStorageKey,
          lessonId: resolvedLessonNumber,
        });
        // ignore storage failures
      }
    }
  }, [chatStorageKey, resolvedLessonNumber]);

  useEffect(() => {
    const nextCount = messages.length;
    onMessageCountChange?.(nextCount);
  }, [messages, onMessageCountChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const trimmedMessages =
      messages.length > MAX_STORED_MESSAGES ? messages.slice(-MAX_STORED_MESSAGES) : messages;
    try {
      window.localStorage.setItem(chatStorageKey, JSON.stringify(trimmedMessages));
      setPersistedKeyExists(true);
      setLastSaveOk(true);
    } catch (error) {
      void recordChatSoftError({
        stage: "chat_storage_save",
        error,
        keyName: chatStorageKey,
        messageCount: trimmedMessages.length,
        lessonId: resolvedLessonNumber,
      });
      if (isDev) {
        console.debug("[chatpanel] failed to store messages", error);
      }
      setLastSaveOk(false);
    }
  }, [chatStorageKey, messages, resolvedLessonNumber]);

  useEffect(() => {
    if (!autoScroll) return;
    const container = scrollRef.current;
    if (!container) return;
    const behavior: ScrollBehavior = prefersReducedMotion || performanceMode ? "auto" : "smooth";
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior });
    });
  }, [autoScroll, messages, thinking, panelState, prefersReducedMotion, performanceMode]);

  useEffect(() => {
    if (panelState !== "GENERATING_FILES" && panelState !== "POSTPROCESSING_FILES") {
      setSlowGenerationHint(false);
      if (slowGenerationTimerRef.current) {
        window.clearTimeout(slowGenerationTimerRef.current);
        slowGenerationTimerRef.current = null;
      }
      return;
    }
    if (slowGenerationTimerRef.current) {
      window.clearTimeout(slowGenerationTimerRef.current);
    }
    slowGenerationTimerRef.current = window.setTimeout(() => {
      setSlowGenerationHint(true);
    }, SLOW_GENERATION_HINT_MS);
  }, [panelState]);

  useEffect(() => {
    if (sanitizePulseKey === 0) return;
    setSanitizePulseActive(true);
    const timeoutId = window.setTimeout(() => setSanitizePulseActive(false), 400);
    return () => window.clearTimeout(timeoutId);
  }, [sanitizePulseKey]);

  useEffect(() => {
    if (sanitizeShakeKey === 0) return;
    setSanitizeShakeActive(true);
    const timeoutId = window.setTimeout(() => setSanitizeShakeActive(false), 400);
    return () => window.clearTimeout(timeoutId);
  }, [sanitizeShakeKey]);

  useEffect(() => {
    if (offTrackPulseKey === 0) return;
    setOffTrackPulseActive(true);
    const timeoutId = window.setTimeout(() => setOffTrackPulseActive(false), 400);
    return () => window.clearTimeout(timeoutId);
  }, [offTrackPulseKey]);

  useEffect(() => {
    if (undoPulseKey === 0) return;
    setUndoPulseActive(true);
    const timeoutId = window.setTimeout(() => setUndoPulseActive(false), 400);
    return () => window.clearTimeout(timeoutId);
  }, [undoPulseKey]);

  const clearWaitingActionTimers = useCallback(() => {
    if (waitingActionTimerRef.current != null) {
      window.clearTimeout(waitingActionTimerRef.current);
      waitingActionTimerRef.current = null;
    }
    if (waitingActionExpandTimerRef.current != null) {
      window.clearTimeout(waitingActionExpandTimerRef.current);
      waitingActionExpandTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!thinking && !isGeneratingFiles) {
      setSlowNetworkHint(false);
      return;
    }
    const timeoutId = window.setTimeout(() => setSlowNetworkHint(true), SLOW_NETWORK_HINT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isGeneratingFiles, thinking]);

  useEffect(() => {
    const isStudentPresentation = presentationMode && !isTeacherMode;
    if (!thinking || isStudentPresentation) {
      setWaitingActionStage("idle");
      clearWaitingActionTimers();
      return;
    }
    clearWaitingActionTimers();
    setWaitingActionStage("idle");
    waitingActionTimerRef.current = window.setTimeout(() => {
      setWaitingActionStage("initial");
      waitingActionTimerRef.current = null;
    }, WAITING_ACTION_INITIAL_MS);
    waitingActionExpandTimerRef.current = window.setTimeout(() => {
      setWaitingActionStage("expanded");
      waitingActionExpandTimerRef.current = null;
    }, WAITING_ACTION_EXPAND_MS);
    return () => {
      clearWaitingActionTimers();
    };
  }, [clearWaitingActionTimers, isTeacherMode, presentationMode, thinking]);

  useEffect(() => {
    if (!slowNetworkHint || slowNetworkWarnedRef.current) return;
    recordMetric({ t: Date.now(), type: "WARN", code: "SLOW" });
    slowNetworkWarnedRef.current = true;
  }, [recordMetric, slowNetworkHint]);

  useEffect(() => {
    if (thinking || isGeneratingFiles) return;
    slowNetworkWarnedRef.current = false;
  }, [isGeneratingFiles, thinking]);

  useEffect(() => {
    return () => {
      if (offTrackTimerRef.current) {
        window.clearTimeout(offTrackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (thinkingToastTimerRef.current) {
        window.clearTimeout(thinkingToastTimerRef.current);
      }
      if (teacherToastHideTimerRef.current) {
        window.clearTimeout(teacherToastHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!teacherUiEnabled) {
        window.localStorage.removeItem(TEACHER_FLAG_KEY);
        setIsTeacherMode(false);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const teacherFromQuery = params.get("teacher") === "1";
      if (teacherFromQuery) {
        window.localStorage.setItem(TEACHER_FLAG_KEY, "1");
      }
      const storedFlag = window.localStorage.getItem(TEACHER_FLAG_KEY) === "1";
      setIsTeacherMode(
        resolveTeacherMode({ teacherUiEnabled, teacherFromQuery, storedFlag }),
      );
    } catch {
      setIsTeacherMode(false);
    }
  }, [teacherUiEnabled]);

  useEffect(() => {
    if (!isTeacherMode) return;
    const refreshEvidence = () => setContainedEvidenceRows(getWebllmContainedRolloutEvidence(30));
    refreshEvidence();
    const intervalId = window.setInterval(refreshEvidence, 2000);
    return () => window.clearInterval(intervalId);
  }, [isTeacherMode]);

  useEffect(() => {
    if (!isTeacherMode) return;
    setAutosaveEnabledState(getAutosaveEnabled());
  }, [isTeacherMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(LIGHT_MODE_KEY) === "1";
      setLightModeEnabled(stored);
      if (stored) {
        const current = getGeneratorOverrideFlags();
        previousFallbackRef.current = current.forceFallback;
        setGeneratorOverrideFlags({ ...current, forceFallback: true });
      }
    } catch {
      setLightModeEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!teacherUiEnabled) {
      setOpsMode("normal");
      try {
        window.sessionStorage.removeItem(OPS_MODE_KEY);
      } catch {
        // ignore storage failures
      }
      return;
    }
    try {
      const stored = window.sessionStorage.getItem(OPS_MODE_KEY);
      if (stored === "ai_off" || stored === "simple") {
        setOpsMode(stored);
      }
    } catch {
      setOpsMode("normal");
    }
  }, [teacherUiEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readLocalAiDisabled = () => {
      try {
        setLocalAiDisabled(window.localStorage.getItem(LOCAL_AI_DISABLED_KEY) === "1");
      } catch {
        setLocalAiDisabled(false);
      }
    };
    readLocalAiDisabled();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_AI_DISABLED_KEY) {
        readLocalAiDisabled();
      }
    };
    const handleLocalEvent = () => readLocalAiDisabled();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCAL_AI_DISABLED_EVENT, handleLocalEvent);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCAL_AI_DISABLED_EVENT, handleLocalEvent);
    };
  }, []);

  useEffect(() => {
    if (!localAiDisabled) return;
    if (prewarmAbortRef.current) {
      prewarmAbortRef.current.abort();
      prewarmAbortRef.current = null;
    }
    if (idleWarmupRef.current) {
      cancelIdleWarmup(idleWarmupRef.current);
      idleWarmupRef.current = null;
    }
    if (coachRequestIdRef.current) {
      safeAbortWebLLM(coachRequestIdRef.current);
    }
    if (generatorRequestIdRef.current) {
      safeAbortWebLLM(generatorRequestIdRef.current);
    }
  }, [cancelIdleWarmup, localAiDisabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const snapshot = readWebllmDegradedGate();
    setWebllmDegradedUntil(snapshot.until);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const unsubscribe = subscribeNetworkPrepStatus(setNetworkPrepStatusThrottled);
    return () => unsubscribe();
  }, [setNetworkPrepStatusThrottled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStudentPresentation = presentationMode && !isTeacherMode;
    const hasModelEnv = Boolean(
      process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID,
    );
    const conn = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    const saveData = Boolean(conn?.saveData);
    const effectiveType = String(conn?.effectiveType ?? "");
    const verySlowNet = effectiveType === "slow-2g" || effectiveType === "2g";
    const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory ?? null;
    const hc = navigator.hardwareConcurrency ?? 0;
    const skipWarmup = (deviceMemory !== null && deviceMemory < 4) || (hc && hc < 6);

    if (prewarmAbortRef.current) {
      prewarmAbortRef.current.abort();
      prewarmAbortRef.current = null;
    }
    if (idleWarmupRef.current) {
      cancelIdleWarmup(idleWarmupRef.current);
      idleWarmupRef.current = null;
    }

    if (!effectiveWebllmEnabled || isStudentPresentation || !hasModelEnv || saveData) {
      return () => {
        if (prewarmAbortRef.current) {
          prewarmAbortRef.current.abort();
          prewarmAbortRef.current = null;
        }
        if (idleWarmupRef.current) {
          cancelIdleWarmup(idleWarmupRef.current);
          idleWarmupRef.current = null;
        }
      };
    }

    if (shouldRunOnce(PREWARM_ONCE_KEY)) {
      const controller = new AbortController();
      prewarmAbortRef.current = controller;
      if (!isTeacherMode) {
        setNetworkPrepStatus("preparing", { reason: "auto_prewarm", ttlMs: 4500 });
      }
      void (async () => {
        try {
          await runWebllmPrewarm({
            plan: { wasm: true, config: true, tokenizer: true, shards: false },
            durationMs: verySlowNet ? 2500 : 4500,
            onProgress: undefined,
            signal: controller.signal,
          });
        } catch {
          // ignore prewarm failures
        }
      })();
    }

    let allowWarmup = isTeacherMode;
    if (!allowWarmup) {
      try {
        allowWarmup = window.sessionStorage.getItem(WARMUP_ALLOW_KEY) === "1";
      } catch {
        allowWarmup = false;
      }
    }

    if (!webllmLazyActivationReady) return;

    if (allowWarmup && !verySlowNet && !skipWarmup && shouldRunOnce(WARMUP_ONCE_KEY)) {
      const runWarmup = () => {
        if (document.visibilityState !== "visible") return;
        if (!isTeacherMode) {
          setNetworkPrepStatus("preparing", { reason: "auto_warmup", ttlMs: 4500 });
        }
        const requestId = createRequestId();
        const unsubscribe = onWebLLMProgress((event) => {
          if (event.requestId !== requestId || event.kind !== "warmup") return;
          setProgressMessageThrottled(event.message);
        });
        void safeStartWebLLM(requestId, {
          kind: "warmup",
          preferredModelId: preferredModelId ?? undefined,
        })
          .catch(() => undefined)
          .finally(() => {
            unsubscribe();
          });
      };
      const requestIdleCallback = (
        window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }
      ).requestIdleCallback;
      if (requestIdleCallback) {
        const id = requestIdleCallback(runWarmup, { timeout: 2000 });
        idleWarmupRef.current = { mode: "idle", id };
      } else {
        const id = window.setTimeout(runWarmup, 1200);
        idleWarmupRef.current = { mode: "timeout", id };
      }
    }

    return () => {
      if (prewarmAbortRef.current) {
        prewarmAbortRef.current.abort();
        prewarmAbortRef.current = null;
      }
      if (idleWarmupRef.current) {
        cancelIdleWarmup(idleWarmupRef.current);
        idleWarmupRef.current = null;
      }
    };
  }, [
    cancelIdleWarmup,
    effectiveWebllmEnabled,
    isTeacherMode,
    presentationMode,
    preferredModelId,
    setProgressMessageThrottled,
    webllmLazyActivationReady,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const safePathname = pathname ?? "";
    const isJoinOrSharePage = safePathname.includes("/join") || safePathname.includes("/share");
    const isEduEntryScreen = safePathname.startsWith("/edu") && !isJoinOrSharePage;
    if (!webllmLazyActivationReady) {
      setWebllmPrefetchReady(null);
      return;
    }
    if (!effectiveWebllmEnabled || !getEduWebLLMPrefetchFlag()) {
      setWebllmPrefetchReady(null);
      return;
    }
    if (!isEduEntryScreen) {
      setWebllmPrefetchReady(null);
      return;
    }
    const controller = new AbortController();
    let idleId: number | null = null;
    const startPrefetch = () => {
      void prefetchWebLLMAssets({ signal: controller.signal })
        .then((result) => {
          setWebllmPrefetchReady(result.ready);
        })
        .catch(() => {
          setWebllmPrefetchReady(false);
        });
    };
    const requestIdleCallback = (
      window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }
    ).requestIdleCallback;
    if (requestIdleCallback) {
      idleId = requestIdleCallback(startPrefetch, { timeout: 2_000 });
    } else {
      idleId = window.setTimeout(startPrefetch, 1_200);
    }
    return () => {
      controller.abort();
      if (idleId != null) {
        window.clearTimeout(idleId);
      }
    };
  }, [effectiveWebllmEnabled, pathname, webllmLazyActivationReady]);

  useEffect(() => {
    return () => {
      if (metricsUpdateTimerRef.current) {
        window.clearTimeout(metricsUpdateTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(ANON_ID_STORAGE_KEY);
      if (stored) {
        setAnonId(stored);
        return;
      }
      const generated =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(ANON_ID_STORAGE_KEY, generated);
      setAnonId(generated);
    } catch {
      setAnonId(null);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("edu:webllm:modelId");
      setPreferredModelId(stored && stored.length > 0 ? stored : null);
    } catch {
      setPreferredModelId(null);
    }
  }, []);

  useEffect(() => {
    webllmStatusRef.current = webllmStatus;
  }, [webllmStatus]);

  useEffect(() => {
    if (opsMode === "ai_off") {
      setWebllmStatus("DISABLED");
      setWebllmStatusCode("WEBLLM_DISABLED");
      return;
    }
    if (!hasWebllmEnvEffective) {
      setWebllmStatus("ENV_MISSING");
      setWebllmStatusCode("WEBLLM_ENV_MISSING");
      return;
    }
    if (typeof navigator !== "undefined" && !("gpu" in navigator)) {
      setWebllmStatus("UNSUPPORTED");
      setWebllmStatusCode("WEBLLM_UNSUPPORTED");
      return;
    }
    if (webllmStatusRef.current === "DISABLED" || webllmStatusRef.current === "ENV_MISSING") {
      setWebllmStatus("READY");
      setWebllmStatusCode(null);
    }
    if (!hasWebllmEnv && hasWebllmEnvEffective) {
      setWebllmStatusCode("WEBLLM_HEALTH_FALLBACK");
    }
  }, [hasWebllmEnv, hasWebllmEnvEffective, opsMode]);

  useEffect(() => {
    if (!webllmDegradedUntil) return;
    const remaining = webllmDegradedUntil - Date.now();
    if (remaining <= 0) {
      setWebllmDegradedUntil(null);
      if (webllmStatusRef.current === "DEGRADED") {
        setWebllmStatus("READY");
        setWebllmStatusCode(null);
      }
      return;
    }
    const timer = window.setTimeout(() => {
      setWebllmDegradedUntil(null);
      if (webllmStatusRef.current === "DEGRADED") {
        setWebllmStatus("READY");
        setWebllmStatusCode(null);
      }
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [webllmDegradedUntil]);

  const toggleExamples = useCallback(
    (anchor: "desktop" | "mobile") => {
      setExamplesAnchor(anchor);
      setExamplesOpen((prev) => !(prev && examplesAnchor === anchor));
    },
    [examplesAnchor],
  );

  useEffect(() => {
    if (!presetMoreOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!presetMoreRef.current?.contains(event.target as Node)) {
        setPresetMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [presetMoreOpen]);

  useEffect(() => {
    if (panelState === "APPLIED" || panelState === "ERROR_RECOVERABLE" || isGeneratingFiles) {
      return;
    }
    if (isGenerateReady) {
      if (panelState !== "READY_TO_GENERATE") {
        setPanelState("READY_TO_GENERATE");
      }
      return;
    }
    if (panelState === "READY_TO_GENERATE") {
      setPanelState("ACTION_PREPARING");
    }
  }, [isGenerateReady, isGeneratingFiles, panelState]);

  const updateWebLLMStatus = useCallback(
    (
      nextStatus: WebLLMStatus,
      options?: { code?: string | null; requestId?: string | null },
    ) => {
      setWebllmStatus(nextStatus);
      setWebllmStatusCode(options?.code ?? null);
      setWebllmStatusRid(options?.requestId ?? null);
      setWebllmStatusAt(Date.now());
    },
    [],
  );

  const recordWebLLMFailure = useCallback(
    (nextStatus: WebLLMStatus, options?: { code?: string | null; requestId?: string | null }) => {
      const now = Date.now();
      const entries = webllmFailureLogRef.current;
      entries.push(now);
      while (entries.length > 0 && entries[0] < now - WEBLLM_FAILURE_WINDOW_MS) {
        entries.shift();
      }
      setWebllmWarning("WebLLM이 불안정해 자동으로 비활성화했어요. 수업은 계속 진행할 수 있어요.");
      if (entries.length >= WEBLLM_FAILURE_THRESHOLD) {
        const snapshot = markWebllmDegraded(WEBLLM_DEGRADED_COOLDOWN_MS);
        setWebllmDegradedUntil(snapshot.until);
        void recordEduEvent({
          type: "EDU_WEBLLM_DEGRADED_ENTER",
          boardId: "edu_webllm",
          requestId: options?.requestId ?? null,
          shareCode: shareCode ?? undefined,
          extra: {
            untilTs: snapshot.until,
            reasonCode: options?.code ?? null,
          },
        });
        updateWebLLMStatus("DEGRADED", { code: options?.code, requestId: options?.requestId });
        return;
      }
      updateWebLLMStatus(nextStatus, options);
    },
    [shareCode, updateWebLLMStatus],
  );

  const getEffectiveWebLLMStatus = useCallback((): WebLLMStatus => {
    if (opsMode === "ai_off") return "DISABLED";
    if (!effectiveWebllmEnabled) return "DISABLED";
    if (localAiDisabled) return "DEGRADED";
    if (!hasWebllmEnvEffective) return "ENV_MISSING";
    if (typeof navigator !== "undefined" && !("gpu" in navigator)) return "UNSUPPORTED";
    if (webllmDegradedUntil && Date.now() < webllmDegradedUntil) return "DEGRADED";
    return webllmStatusRef.current;
  }, [effectiveWebllmEnabled, hasWebllmEnvEffective, localAiDisabled, opsMode, webllmDegradedUntil]);

  const resolveDecorateBypassBoundary = useCallback(
    (effectiveStatus: WebLLMStatus) =>
      resolveLessonWebllmLaneBoundary({
        decorateQuotaExceeded: decorateQuotaExceededRef.current,
        webllmStatusCode,
        webllmStatusAt,
        effectiveStatus,
        effectiveWebllmEnabled,
        hasModelHost: Boolean(webllmHosts.modelHost),
        hasWasmHost: Boolean(webllmHosts.wasmHost),
        readyWaitMs: DECORATE_LLM_READY_WAIT_MS,
        nowMs: Date.now(),
      }),
    [effectiveWebllmEnabled, webllmHosts.modelHost, webllmHosts.wasmHost, webllmStatusAt, webllmStatusCode],
  );

  const webllmUnavailableGuide = useMemo(() => {
    if (opsMode === "ai_off") {
      return "WebLLM이 운영 모드에서 꺼져 있어요. 온라인 모드(기본 모드)로 수업을 계속 진행합니다.";
    }
    return lessonWebllmLaneStatusView.unavailableGuide;
  }, [lessonWebllmLaneStatusView.unavailableGuide, opsMode]);

  const waitMs = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      }),
    [],
  );

  const requestRemoteAssistant = useCallback(
    async (
      historyMessages: ChatMessage[],
      options?: { requestId?: string; signal?: AbortSignal },
    ): Promise<
      | {
          ok: true;
          responseText: string;
          requestId: string;
          latencyMs: number;
          status?: number;
          modelHost?: string | null;
        }
      | {
          ok: false;
          requestId: string;
          errorCode: string;
          latencyMs: number;
          status?: number;
          modelHost?: string | null;
        }
    > => {
      const result = await requestEduAiChat({
        lessonId: resolvedLessonNumber,
        anonId,
        shareCode: shareCode ?? undefined,
        requestId: options?.requestId,
        signal: options?.signal,
        telemetryPath: "chat_remote",
        messages: historyMessages
          .filter(
            (message): message is ChatMessage & { role: "user" | "assistant" } =>
              message.role === "user" || message.role === "assistant",
          )
          .map((message) => ({ role: message.role, content: message.content })),
      });
      if (result.ok) {
        return {
          ok: true,
          responseText: result.message,
          requestId: result.requestId,
          latencyMs: result.latencyMs,
          status: result.status,
          modelHost: result.modelHost,
        };
      }
      return {
        ok: false,
        requestId: result.requestId,
        errorCode: result.errorCode,
        latencyMs: result.latencyMs,
        status: result.status,
        modelHost: result.modelHost,
      };
    },
    [anonId, resolvedLessonNumber, shareCode],
  );

  const appendToMessage = useCallback(
    (id: string, chunk: string) => {
      if (!chunk) return;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id ? { ...message, content: `${message.content}${chunk}` } : message,
        ),
      );
    },
    [setMessages],
  );

  const replaceMessage = useCallback(
    (id: string, content: string, role?: ChatMessage["role"]) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id ? { ...message, content, role: role ?? message.role } : message,
        ),
      );
    },
    [setMessages],
  );

  const removeMessage = useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((message) => message.id !== id));
    },
    [setMessages],
  );

  const finalizeCoachText = useCallback(
    (text: string) => {
      const sanitized = sanitizeCoachResponse(text);
      const result = sanitizeCoachText(sanitized);
      setLastCoachSanitizeFlags(result.flags);
      if (result.flags.hadKana) {
        recordMetric({ t: Date.now(), type: "WARN", code: "KANA" });
      }
      if (result.flags.hadMeta) {
        recordMetric({ t: Date.now(), type: "WARN", code: "META" });
      }
      if (result.flags.hadMarkdown) {
        recordMetric({ t: Date.now(), type: "WARN", code: "MARKDOWN" });
      }
      return result.text;
    },
    [recordMetric],
  );

  const formatRemoteAssistantText = useCallback(
    (text: string, options?: { prefix?: string | null }) => {
      const normalized = text.replace(/\r\n/g, "\n").trim();
      if (!normalized) return text;
      const lines = normalized
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length >= 3) {
        const summary = lines[0] ?? "";
        const actions = lines.slice(1).filter(Boolean).slice(0, 2);
        const actionLines = actions.map((line) => (line.match(/^[-*•]\s+/) ? line : `- ${line}`));
        const parts = [
          options?.prefix ? options.prefix : null,
          `요약: ${summary}`,
          ...actionLines,
        ].filter(Boolean);
        return parts.join("\n");
      }
      const trimmed = truncateText(normalized, 240);
      if (options?.prefix) {
        return [options.prefix, trimmed].join("\n");
      }
      return trimmed;
    },
    [],
  );

  const persistAiFallbackStatus = useCallback(
    (input: { ok: boolean; errorCode?: string; latencyMs: number }) => {
      if (typeof window === "undefined") return;
      try {
        const payload = {
          ok: input.ok,
          errorCode: input.errorCode ?? null,
          latencyMs: input.latencyMs,
          at: Date.now(),
        };
        window.localStorage.setItem(AI_FALLBACK_LAST_KEY, JSON.stringify(payload));
      } catch {
        // ignore storage failures
      }
    },
    [],
  );

  const appendMessage = useCallback((role: ChatMessage["role"], content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role,
        content,
      },
    ]);
  }, []);

  const getSlowNudgeText = useCallback((lessonId: "P1" | "P2" | "P3" | "P4") => {
    switch (lessonId) {
      case "P1":
        return [
          "지금은 모델 준비가 조금 느려요. 먼저 템플릿에 이 한 줄만 적고 계속하자!",
          '예시: "이름: 별빛 / 취미: 농구 / 키워드: #용기 #웃음 #빠름 / 좋아하는 것: 초코, 고양이"',
        ].join("\n");
      case "P2":
        return [
          "모델이 느리면 먼저 템플릿부터 채우면 돼요! 한 줄로 시작해볼래?",
          '예시: "주제: 동물 + 이유: 귀여워서 + 카드1:왜 좋아?/카드2:특징/카드3:내 생각 + 시작->조사->정리"',
        ].join("\n");
      case "P3":
        return [
          "잠깐! 먼저 3개 미션을 템플릿에 적고 있어보자. 그 다음에 AI로 꾸며도 돼!",
          '예시: "제목: 나의 미션 + 한줄: 오늘은 3가지! + 1번:조사/2번:만들기/3번:발표 + 결과: 다음엔 더 크게!"',
        ].join("\n");
      case "P4":
      default:
        return [
          "지금은 먼저 발표용 뼈대만 만들자! 제목+목차3+마무리 한 줄이면 끝!",
          '예시: "발표제목: 나의 전시 + 목차: 주제소개/만든것/느낀점 + 마무리: 오늘의 내가 최고!"',
        ].join("\n");
    }
  }, []);

  const clearSlowNudgeTimer = useCallback(() => {
    if (slowNudgeTimerRef.current != null) {
      window.clearTimeout(slowNudgeTimerRef.current);
      slowNudgeTimerRef.current = null;
    }
  }, []);

  const clearDecorateCooldownTimer = useCallback(() => {
    if (decorateCooldownTimerRef.current != null) {
      window.clearTimeout(decorateCooldownTimerRef.current);
      decorateCooldownTimerRef.current = null;
    }
  }, []);

  const clearChatFallbackTimers = useCallback(() => {
    if (fallbackTimerRef.current != null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (simpleCoachTimerRef.current != null) {
      window.clearTimeout(simpleCoachTimerRef.current);
      simpleCoachTimerRef.current = null;
    }
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const resetChatFallbackUi = useCallback(() => {
    clearChatFallbackTimers();
    setSimpleCoachHint(null);
    setFallbackStage("idle");
    setFallbackRequestId(null);
    setFallbackErrorCode(null);
    setRateLimitNotice(null);
    setRemoteChatWarning(null);
  }, [clearChatFallbackTimers]);

  const startDecorateCooldown = useCallback(
    (ms: number) => {
      clearDecorateCooldownTimer();
      const until = Date.now() + ms;
      setDecorateCooldownUntilMs(until);
      decorateCooldownTimerRef.current = window.setTimeout(() => {
        setDecorateCooldownUntilMs(0);
        decorateCooldownTimerRef.current = null;
      }, ms);
    },
    [clearDecorateCooldownTimer],
  );

  const startSlowNudgeTimer = useCallback(
    (lessonId: "P1" | "P2" | "P3" | "P4", requestSeqAtStart: number) => {
      clearSlowNudgeTimer();
      slowNudgeShownRef.current = false;

      slowNudgeTimerRef.current = window.setTimeout(() => {
        if (requestSeqRef.current !== requestSeqAtStart) return;
        if (slowNudgeShownRef.current) return;
        if (!isGeneratingFiles) return;

        slowNudgeShownRef.current = true;
        appendMessage("assistant", getSlowNudgeText(lessonId));
        if (!isTeacherMode) {
          startDecorateCooldown(COOLDOWN_MS);
        }
      }, SLOW_NUDGE_MS);
    },
    [
      appendMessage,
      clearSlowNudgeTimer,
      getSlowNudgeText,
      isGeneratingFiles,
      isTeacherMode,
      startDecorateCooldown,
    ],
  );

  useEffect(() => {
    return () => {
      clearSlowNudgeTimer();
    };
  }, [clearSlowNudgeTimer]);

  useEffect(() => {
    return () => {
      clearDecorateCooldownTimer();
    };
  }, [clearDecorateCooldownTimer]);

  useEffect(() => {
    return () => {
      clearChatFallbackTimers();
      if (remoteAbortRef.current) {
        remoteAbortRef.current.abort();
        remoteAbortRef.current = null;
      }
    };
  }, [clearChatFallbackTimers]);

  const formatErrorMessage = useCallback(
    (code: ErrorCode, content: string) => `[${code}] ${content}`,
    [],
  );

  const buildErrorMessage = useCallback(
    ({
      code,
      detail,
      includeWifiHint,
    }: {
      code: ErrorCode;
      detail?: string;
      includeWifiHint?: boolean;
    }) => {
      const suffix = detail ? `\n\n상세: ${detail}` : "";
      switch (code) {
        case "MESSAGE_SHAPE":
          return formatErrorMessage(
            code,
            "내부 오류: 메시지 형식이 올바르지 않아요. 새로고침 후 다시 시도해 주세요.",
          );
        case "ENGINE_FETCH": {
          const hint = includeWifiHint
            ? "\n학교 와이파이 제한으로 다운로드가 막힐 수 있어요.\n자가진단: /edu/selfcheck"
            : "";
          return formatErrorMessage(
            code,
            `로컬 AI 리소스를 불러오지 못했어요. 네트워크/CORS/파일 경로를 확인해 주세요.${hint}${suffix}`,
          );
        }
        case "RESPONSE_FORMAT_UNSUPPORTED":
          return formatErrorMessage(
            code,
            `이 브라우저에서는 로컬 AI 응답 포맷을 지원하지 않아요. WebGPU를 켜거나 다른 브라우저를 사용해 주세요.${suffix}`,
          );
        case "SCHEMA_FAILED":
          return formatErrorMessage(
            code,
            "AI가 콘텐츠 스키마를 지키지 못했어요. 다시 시도하거나 템플릿으로 시작해 주세요.",
          );
        case "FALLBACK_APPLIED":
          return formatErrorMessage(
            code,
            "엔진 초기화 실패로 기본 템플릿을 적용했어요. 필요하면 문구/색/섹션을 요청해 주세요.",
          );
        case "AUTH_ERROR":
          return formatErrorMessage(code, "로그인/세션 확인이 필요해 로컬 AI를 시작할 수 없어요.");
        case "ENV_MISSING":
          return formatErrorMessage(code, "로컬 AI 실행 환경이 비어 있어요. 운영 설정을 확인해 주세요.");
        case "HEALTH_FALLBACK":
          return formatErrorMessage(
            code,
            "클라이언트 환경 변수가 비어 있어 서버 health 경로로 WebLLM 초기화를 시도하고 있어요.",
          );
        case "FETCH_BLOCKED":
          return formatErrorMessage(code, "모델 파일 다운로드가 차단되어 로컬 AI를 시작할 수 없어요.");
        case "ENGINE_ERROR":
          return formatErrorMessage(code, "로컬 AI 엔진 초기화 중 오류가 발생했어요.");
        default:
          return formatErrorMessage(code, "알 수 없는 오류가 발생했어요.");
      }
    },
    [formatErrorMessage],
  );

  const isMessageFormatError = useCallback(
    (message: string) =>
      /Last message should be from either/i.test(message) ||
      /마지막 메시지는 user\/tool이어야 합니다/.test(message) ||
      /system 메시지는 첫 번째여야 합니다/.test(message),
    [],
  );

  const isEngineFetchError = useCallback(
    (message: string) =>
      /CORS|WASM|HTTP|NetworkError|Failed to fetch|fetch|R2|모델 설정 파일/i.test(message),
    [],
  );

  const parseFirstJsonObject = useCallback((rawText: string) => {
    if (!rawText) return null;
    const codeBlock = rawText.match(/```json\\s*([\\s\\S]*?)```/i);
    const candidate = codeBlock?.[1]?.trim() ?? null;
    if (candidate) {
      try {
        return JSON.parse(candidate) as unknown;
      } catch (error) {
        void recordChatSoftError({
          stage: "chat_parse_json_block",
          error,
          lessonId: resolvedLessonNumber,
        });
        return null;
      }
    }
    const startIndex = rawText.indexOf("{");
    if (startIndex === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = startIndex; index < rawText.length; index += 1) {
      const char = rawText[index];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\\\") {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") {
        depth += 1;
        continue;
      }
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          const text = rawText.slice(startIndex, index + 1);
          try {
            return JSON.parse(text) as unknown;
          } catch (error) {
            void recordChatSoftError({
              stage: "chat_parse_json_object",
              error,
              lessonId: resolvedLessonNumber,
            });
            return null;
          }
        }
      }
    }
    return null;
  }, [resolvedLessonNumber]);

  const getConversationForGenerate = (historyMessages: ChatMessage[]): LocalChatMessage[] =>
    historyMessages
      .filter(
        (message): message is ChatMessage & { role: "user" | "assistant" } =>
          message.role !== "system",
      )
      .filter(
        (message) => !(message.role === "assistant" && message.content.trim().length === 0),
      )
      .map((message) => ({ role: message.role, content: message.content }));

  const buildActionMessages = useCallback(
    (historyMessages: ChatMessage[], assistantText: string): LocalChatMessage[] => {
      const conversation = [
        ...historyMessages,
        { id: "assistant:action", role: "assistant", content: assistantText },
      ]
        .filter(
          (message): message is ChatMessage & { role: "user" | "assistant" } =>
            message.role !== "system",
        )
        .filter(
          (message) => !(message.role === "assistant" && message.content.trim().length === 0),
        )
        .map((message) => ({ role: message.role, content: message.content }));

      return [{ role: "system", content: lessonActionPrompt }, ...conversation];
    },
    [lessonActionPrompt],
  );

  const formatPayloadMessage = useCallback((message?: string, notice?: string) => {
    const baseMessage = message?.trim();
    const fallbackMessage = !baseMessage ? "파일을 업데이트했어요." : "";
    const combined = [notice?.trim(), baseMessage || fallbackMessage].filter(Boolean);
    return combined.join("\n\n");
  }, []);

  const refreshUndoRedo = useCallback(() => {
    setUndoEnabled(snapshotRef.current.canUndo());
    setRedoEnabled(snapshotRef.current.canRedo());
  }, []);

  const scheduleAutosave = useCallback(
    (files: Record<string, WorkspaceFile> | null, options?: { immediate?: boolean }) => {
      if (!files || Object.keys(files).length === 0) return;
      if (!isTeacherMode || !autosaveEnabled) return;
      const runSave = async () => {
        await saveLocalAutosave(files as Record<string, WorkspaceFile>);
      };
      if (options?.immediate) {
        void runSave();
      }
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = window.setTimeout(() => {
        void runSave();
      }, 7000);
    },
    [autosaveEnabled, isTeacherMode],
  );

  const buildSnapshotSeed = useCallback(
    (files: Record<string, WorkspaceFile>) =>
      Object.entries(files)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([filename, file]) => `${filename}\n${file.content}`)
        .join("\n"),
    [],
  );

  const hashSnapshotFiles = useCallback(async (files: Record<string, WorkspaceFile>) => {
    try {
      const seed = buildSnapshotSeed(files);
      const digest = await digestHex("SHA-256", seed);
      return digest.slice(0, 12);
    } catch {
      return "unknown";
    }
  }, [buildSnapshotSeed]);
  const markSsotOwner = useCallback((owner: SsotOwner, files?: Record<string, WorkspaceFile> | null) => {
    internalCommitGuardUntilRef.current = Date.now() + 1200;
    const snapshotVersion = files ? buildSnapshotSeed(files) : undefined;
    const html = files?.["index.html"]?.content ?? "";
    const next = {
      owner,
      at: Date.now(),
      snapshotVersion,
      htmlHash: html ? hashCode(html) : undefined,
    };
    lastSsotOwnerRef.current = next;
  }, [buildSnapshotSeed]);


  const buildSnapshot = useCallback(
    async (files: Record<string, WorkspaceFile>): Promise<FileSnapshot> => ({
      id: (() => {
        try {
          return randomHex(4);
        } catch {
          return Math.random().toString(36).slice(2, 8);
        }
      })(),
      ts: Date.now(),
      codeHash: await hashSnapshotFiles(files),
      files: files as Record<string, NormalizedFile>,
    }),
    [hashSnapshotFiles],
  );

  const syncCurrentSnapshot = useCallback(
    async (files: Record<string, WorkspaceFile>) => {
      const snapshot = await buildSnapshot(files);
      const current = snapshotRef.current.peek();
      if (current) {
        Object.assign(current, snapshot);
        refreshUndoRedo();
        return;
      }
      snapshotRef.current.push(snapshot);
      refreshUndoRedo();
    },
    [buildSnapshot, refreshUndoRedo],
  );

  const takeSnapshotIfPossible = useCallback(async (files: Record<string, WorkspaceFile> | null) => {
    if (!files || Object.keys(files).length === 0) return;
    const snapshot = await buildSnapshot(files);
    snapshotRef.current.push(snapshot);
    refreshUndoRedo();
  }, [buildSnapshot, refreshUndoRedo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isTeacherMode || !autosaveEnabled || autosaveRestoredRef.current) return;
    autosaveRestoredRef.current = true;
    void restoreLocalAutosave()
      .then(async (restored) => {
        if (!restored.ok || !restored.files || Object.keys(restored.files).length === 0) {
          return;
        }
        snapshotRef.current = createSnapshotBuffer(3);
        refreshUndoRedo();
        onFilesMerged(restored.files as Record<string, WorkspaceFile>);
        await syncCurrentSnapshot(restored.files as Record<string, WorkspaceFile>);
        setPanelState("APPLIED");
        setLastApplyOutcome("done");
        setManualFallbackReason(null);
        setIsDirty(true);
      })
      .catch(() => undefined);
  }, [
    autosaveEnabled,
    isTeacherMode,
    onFilesMerged,
    refreshUndoRedo,
    setLastApplyOutcome,
    setManualFallbackReason,
    syncCurrentSnapshot,
  ]);

  useEffect(() => {
    if (!renderCountActiveRef.current) return;
    renderCountRef.current += 1;
    if (!performanceModeRef.current && renderCountRef.current >= PERFORMANCE_RENDER_COUNT_THRESHOLD) {
      enablePerformanceMode("render_spike");
    }
  });

  useEffect(() => {
    if (!currentFiles || Object.keys(currentFiles).length === 0) return;
    const seed = buildSnapshotSeed(currentFiles);
    if (lastObservedFilesSeedRef.current !== seed) {
      const isInternalCommit = Date.now() <= internalCommitGuardUntilRef.current;
      if (!isInternalCommit) {
        lastSsotOwnerRef.current = {
          owner: "user_edit",
          at: Date.now(),
          snapshotVersion: seed,
        };
      }
      lastObservedFilesSeedRef.current = seed;
    }
    const currentSnapshot = snapshotRef.current.peek();
    if (!currentSnapshot) {
      void syncCurrentSnapshot(currentFiles);
      return;
    }
    currentSnapshot.files = currentFiles as Record<string, NormalizedFile>;
    currentSnapshot.ts = Date.now();
  }, [buildSnapshotSeed, currentFiles, syncCurrentSnapshot]);

  useEffect(() => {
    if (!currentFiles || Object.keys(currentFiles).length === 0) {
      setLastCodeHash(undefined);
      setLastApplyTs(undefined);
      return;
    }
    setLastApplyTs(Date.now());
    void hashSnapshotFiles(currentFiles).then((hash) => setLastCodeHash(hash));
  }, [currentFiles, hashSnapshotFiles]);


  const getCommittedEditorHtml = useCallback(async () => {
    const snapshot = snapshotRef.current.peek();
    const snapshotHtml = snapshot?.files?.["index.html"]?.content;
    return {
      html: typeof snapshotHtml === "string" ? snapshotHtml : currentFiles?.["index.html"]?.content ?? "",
      snapshotVersion: snapshot?.codeHash ?? null,
    };
  }, [currentFiles]);




  const finalizeFiles = useCallback(
    async (files: Record<string, string>, message?: string, notice?: string, stepId?: string) => {
      const normalized = normalizeFiles(files, { allowedFilenames });
      const fixed = ensureRequiredRefs(normalized);
      if (fixed.metrics.missingRefsDetected) {
        recordMetric({ t: Date.now(), type: "HARDFAIL", code: "MISSING_REFS" });
      }
      const sanitized = sanitizeGeneratedFiles(fixed.files);
      if (sanitized.warnings.length > 0 && process.env.NODE_ENV !== "production") {
        console.warn("[edu] sanitized generated files", sanitized.warnings);
      }
      if (Object.keys(sanitized.files).length === 0) {
        setManualFallbackReason("apply_failed");
        return { ok: false } as const;
      }
      await takeSnapshotIfPossible(currentFiles);
      markSsotOwner("generator", sanitized.files);
      Object.keys(sanitized.files).forEach((path) => generatorTouchedFilesRef.current.add(path));
      onFilesMerged(sanitized.files);
      await syncCurrentSnapshot(sanitized.files);
      scheduleAutosave(sanitized.files, { immediate: true });
      setIsDirty(true);
      const messageText = formatPayloadMessage(message ?? "", notice);
      setActionPrompt(null);
      setLastGeneratorNotice(messageText || null);
      if (stepId) {
        recordStep("APPLY", true, stepId);
      }
      setManualFallbackReason(null);
      return { ok: true, files: sanitized.files } as const;
    },
    [
      allowedFilenames,
      currentFiles,
      formatPayloadMessage,
      markSsotOwner,
      onFilesMerged,
      recordMetric,
      recordStep,
      scheduleAutosave,
      setActionPrompt,
      setIsDirty,
      setLastGeneratorNotice,
      setManualFallbackReason,
      syncCurrentSnapshot,
      takeSnapshotIfPossible,
    ],
  );

  const applyTemplateFromRequest = useCallback(
    async (messageText: string, requestId?: string) => {
      if (!isTemplateFirst || !messageText.trim()) {
        return { applied: false, reason: "invalid" } as const;
      }
      if (!currentFiles || Object.keys(currentFiles).length === 0) {
        return { applied: false, reason: "invalid" } as const;
      }
      const patched = await patchTemplateFromRequest({
        lessonKey: resolvedLessonId,
        userText: messageText,
        files: currentFiles,
        profileName,
        requestId,
        target: "preview",
      });
      if (patched.warnings?.includes("changeset_required")) {
        setManualFallbackReason("changeset");
        return { applied: false, reason: "changeset" } as const;
      }
      if (patched.warnings?.includes("slot_choice")) {
        return { applied: false, reason: "slot_choice" } as const;
      }
      if (patched.warnings?.includes("slot_target_missing")) {
        return { applied: false, reason: "slot_target_missing" } as const;
      }
      if (!patched.changed) return { applied: false, reason: "no_change" } as const;
      await takeSnapshotIfPossible(currentFiles);
      markSsotOwner("user_edit", patched.files);
      decorateRecentUserEditRef.current = {
        hasEdits: true,
        regionKinds: patched.appliedSlots.map((slot) => String(slot)).slice(0, 4),
        attributeKinds: ["content", "style"],
        at: Date.now(),
      };
      if (decoratePendingApplyRef.current) {
        const reason: DecoratePendingInvalidationReason = "pending_stale_due_to_user_edit";
        void recordEduEvent({
          type: "decorate_pending_invalidated",
          boardId: "edu_chat_panel",
          requestId: requestId ?? decoratePendingApplyRef.current.requestId,
          shareCode: shareCode ?? undefined,
          extra: { reason, path: "decorate_local" },
        });
        void recordEduEvent({
          type: "decorate_pending_invalidation_visible",
          boardId: "edu_chat_panel",
          requestId: requestId ?? decoratePendingApplyRef.current.requestId,
          shareCode: shareCode ?? undefined,
          extra: { reason, path: "decorate_local", message: "미리보기가 최신 상태와 달라져 다시 만들어야 해요." },
        });
        decoratePendingApplyRef.current = null;
        setDecorateHasPendingApply(false);
      }
      {
        const cleared = decoratePreviewCacheRef.current.clear("user_edit");
        void recordEduEvent({
          type: "decorate_preview_cache_invalidated",
          boardId: "edu_chat_panel",
          requestId: requestId ?? createRequestId(),
          shareCode: shareCode ?? undefined,
          extra: { reason: "user_edit", count: cleared.count, path: "decorate_local" },
        });
      }
      onFilesMerged(patched.files);
      if (patched.appliedSlots.length > 0) {
        onFastApplyAppliedSlots?.(patched.appliedSlots);
      }
      await syncCurrentSnapshot(patched.files);
      scheduleAutosave(patched.files, { immediate: true });
      setIsDirty(true);
      setManualFallbackReason(null);
      setLastApplyOutcome("done");
      setPanelState("READY_TO_GENERATE");
      return { applied: true } as const;
    },
    [
      currentFiles,
      isTemplateFirst,
      markSsotOwner,
      onFastApplyAppliedSlots,
      onFilesMerged,
      profileName,
      resolvedLessonId,
      shareCode,
      scheduleAutosave,
      setIsDirty,
      setLastApplyOutcome,
      setManualFallbackReason,
      setPanelState,
      syncCurrentSnapshot,
      takeSnapshotIfPossible,
    ],
  );

  const showFastApplyNotice = useCallback((message: string) => {
    setFastApplyNotice(message);
    if (fastApplyNoticeTimerRef.current) {
      window.clearTimeout(fastApplyNoticeTimerRef.current);
    }
    fastApplyNoticeTimerRef.current = window.setTimeout(() => {
      setFastApplyNotice(null);
      fastApplyNoticeTimerRef.current = null;
    }, 2200);
  }, []);

  const showDecorateProgressCopy = useCallback(
    (requestId: string | null | undefined, phase: string, message: string) => {
      const from = decorateProgressCopyRef.current;
      showFastApplyNotice(message);
      if (from === message) return;
      decorateProgressCopyRef.current = message;
      void recordEduEvent({
        type: "decorate_progress_copy_changed",
        boardId: "edu_chat_panel",
        requestId: requestId ?? undefined,
        shareCode: shareCode ?? undefined,
        extra: { from: from || null, to: message, phase, path: "decorate_local" },
      });
    },
    [shareCode, showFastApplyNotice],
  );

  const getPendingInvalidationNotice = useCallback((reason: DecoratePendingInvalidationReason) => {
    if (reason === "pending_stale_due_to_newer_decorate") {
      return "다른 수정이 먼저 반영돼서 이 미리보기는 사용할 수 없어요.";
    }
    return "미리보기가 최신 상태와 달라져 다시 만들어야 해요.";
  }, []);

  const invalidateDecoratePreviewCache = useCallback(
    (reason: "user_edit" | "newer_decorate_apply" | "snapshot_changed" | "stale_risk", requestId?: string | null) => {
      const result = decoratePreviewCacheRef.current.clear(reason);
      void recordEduEvent({
        type: "decorate_preview_cache_invalidated",
        boardId: "edu_chat_panel",
        requestId: requestId ?? createRequestId(),
        shareCode: shareCode ?? undefined,
        extra: { reason, count: result.count, path: "decorate_local" },
      });
    },
    [shareCode],
  );

  const commitDecorateHtml = useCallback(
    async (nextHtml: string, owner: SsotOwner = "decorate") => {
      if (!currentFiles) return;
      const patchedFiles = {
        ...currentFiles,
        "index.html": { ...(currentFiles["index.html"] ?? { filename: "index.html", language: "html" }), content: nextHtml },
      };
      markSsotOwner(owner, patchedFiles);
      onFilesMerged(patchedFiles);
      await syncCurrentSnapshot(patchedFiles);
      scheduleAutosave(patchedFiles, { immediate: true });
      setIsDirty(true);
    },
    [currentFiles, markSsotOwner, onFilesMerged, scheduleAutosave, syncCurrentSnapshot],
  );

  const appendDecorateRecentEvent = useCallback((event: { intent: DecoratePrimaryIntent; tone?: string[]; colors?: string[]; emphasis?: string[]; source: "server_llm" | "local_llm" | "deterministic" | "cache"; applied?: boolean; undoneAfterApply?: boolean; staleInvalidated?: boolean; weakChange?: boolean; requestId: string }) => {
    decorateRecentEventsRef.current = [
      ...decorateRecentEventsRef.current.slice(-11),
      {
        intent: event.intent,
        tone: event.tone ?? [],
        colors: event.colors ?? [],
        emphasis: event.emphasis ?? [],
        source: event.source,
        applied: event.applied === true,
        undoneAfterApply: event.undoneAfterApply === true,
        staleInvalidated: event.staleInvalidated === true,
        weakChange: event.weakChange === true,
        requestId: event.requestId,
        at: Date.now(),
      },
    ];
  }, []);

  const emitOutcomeLearningSignal = useCallback((input: { requestId: string; primaryIntent: DecoratePrimaryIntent; finalSource: "server_llm" | "local_llm" | "deterministic" | "cache"; outcomeScore: number; applied: boolean; undoneAfterApply: boolean; abandonedPreview: boolean; replacedByNewerDecorate: boolean; staleInvalidated: boolean; applyDelayMs?: number; previewAgeMs?: number; qualityBucket: "high" | "medium" | "low"; historyConfidence: number; recommendedTuningBucket: string }) => {
    const applyDelayBucket = typeof input.applyDelayMs === "number" ? (input.applyDelayMs < 2000 ? "fast" : input.applyDelayMs < 8000 ? "normal" : "slow") : "none";
    const previewAgeBucket = typeof input.previewAgeMs === "number" ? (input.previewAgeMs < 10000 ? "fresh" : "aged") : "none";
    const satisfactionProxy = input.applied && !input.undoneAfterApply ? "positive" : input.undoneAfterApply || input.abandonedPreview || input.staleInvalidated ? "negative" : "neutral";
    void recordEduEvent({
      type: "decorate_outcome_learning_signal",
      boardId: "edu_chat_panel",
      requestId: input.requestId,
      shareCode: shareCode ?? undefined,
      extra: {
        requestId: input.requestId,
        primaryIntent: input.primaryIntent,
        finalSource: input.finalSource,
        outcomeScore: input.outcomeScore,
        applied: input.applied,
        undoneAfterApply: input.undoneAfterApply,
        abandonedPreview: input.abandonedPreview,
        replacedByNewerDecorate: input.replacedByNewerDecorate,
        staleInvalidated: input.staleInvalidated,
        applyDelayBucket,
        previewAgeBucket,
        qualityBucket: input.qualityBucket,
        historyConfidence: input.historyConfidence,
        recommendedTuningBucket: input.recommendedTuningBucket,
        satisfactionProxy,
        path: "decorate_local",
      },
    });
  }, [shareCode]);

  const pushDecorateUndoSnapshot = useCallback(async () => {
    const committed = await getCommittedEditorHtml();
    const entry: DecorateUndoStackItem = {
      snapshotVersion: committed.snapshotVersion,
      html: committed.html,
      htmlHash: hashCode(committed.html),
      at: Date.now(),
      reason: "decorate_apply",
    };
    decorateUndoStackRef.current = [...decorateUndoStackRef.current.slice(-4), entry];
  }, [getCommittedEditorHtml]);

  const applyPendingDecorate = useCallback(async () => {
    const pending = decoratePendingApplyRef.current;
    if (!pending) {
      void recordEduEvent({
        type: "decorate_apply_mismatch",
        boardId: "edu_chat_panel",
        requestId: createRequestId(),
        shareCode: shareCode ?? undefined,
        extra: { reason: "preview_apply_missing_pending", path: "decorate_local" },
      });
      return false;
    }
    if (!pending.handoff.applyEligibility) {
      void recordEduEvent({
        type: "decorate_preview_handoff_blocked",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: { reason: "apply_eligibility_false", invalidationRisk: pending.handoff.invalidationRisk, path: "decorate_local" },
      });
      if (decoratePendingApplyRef.current?.requestId === pending.requestId) {
        decoratePendingApplyRef.current.handoff.applyEligibility = false;
      }
      decoratePendingApplyRef.current = null;
      setDecorateHasPendingApply(false);
      showFastApplyNotice("미리보기가 최신 상태와 달라져 다시 만들어야 해요.");
      return false;
    }
    const committedBeforeApply = await getCommittedEditorHtml();
    const committedBeforeHash = hashCode(committedBeforeApply.html);
    let staleReason = decidePendingInvalidationReason({
      beforeSnapshotVersion: committedBeforeApply.snapshotVersion,
      beforeHtmlHash: committedBeforeHash,
      pendingBaseSnapshotVersion: pending.baseSnapshotVersion,
      pendingBaseHtmlHash: pending.baseHtmlHash,
      lastOwner: lastSsotOwnerRef.current.owner,
    });
    const consistency = classifyPreviewApplyConsistency({
      pendingRequestId: pending.requestId,
      pendingPreviewHash: pending.previewHtmlHash,
      pendingBaseSnapshotVersion: pending.baseSnapshotVersion,
      pendingBaseHtmlHash: pending.baseHtmlHash,
      beforeSnapshotVersion: committedBeforeApply.snapshotVersion,
      beforeHtmlHash: committedBeforeHash,
    });
    const consistencyClass: "consistent" | "recovered" | "mismatch" | "blocked" = staleReason
      ? "blocked"
      : consistency.ok
      ? "consistent"
      : consistency.reasons.includes("preview_apply_rebased")
      ? "recovered"
      : "mismatch";

    if (staleReason) {
      void recordEduEvent({
        type: "decorate_fast_rebase_attempted",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: { staleReason, consistencyReasons: consistency.reasons, path: "decorate_local" },
      });
      const canFastRebase =
        staleReason !== "pending_stale_due_to_user_edit" &&
        staleReason !== "pending_stale_due_to_snapshot_change" &&
        consistency.reasons.length <= 2;
      if (canFastRebase) {
        staleReason = null;
        pending.baseSnapshotVersion = committedBeforeApply.snapshotVersion;
        pending.baseHtmlHash = committedBeforeHash;
        pending.handoff.baseSnapshotVersion = committedBeforeApply.snapshotVersion;
        pending.handoff.baseHtmlHash = committedBeforeHash;
        void recordEduEvent({ type: "decorate_fast_rebase_succeeded", boardId: "edu_chat_panel", requestId: pending.requestId, shareCode: shareCode ?? undefined, extra: { path: "decorate_local" } });
      } else {
        void recordEduEvent({ type: "decorate_fast_rebase_blocked", boardId: "edu_chat_panel", requestId: pending.requestId, shareCode: shareCode ?? undefined, extra: { staleReason, path: "decorate_local" } });
      }
    }

    void recordEduEvent({
      type: "decorate_apply_consistency_check",
      boardId: "edu_chat_panel",
      requestId: pending.requestId,
      shareCode: shareCode ?? undefined,
      extra: {
        ok: consistency.ok,
        reasons: consistency.reasons,
        pendingPreviewHash: pending.previewHtmlHash,
        pendingBaseSnapshotVersion: pending.baseSnapshotVersion,
        beforeSnapshotVersion: committedBeforeApply.snapshotVersion,
        pendingMutationSummary: pending.mutationSummary,
        changedFiles: pending.changedFiles,
        path: "decorate_local",
      },
    });

    if (consistency.reasons.includes("preview_apply_rebased")) {
      void recordEduEvent({
        type: "decorate_apply_rebased",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: { reason: "preview_apply_rebased", path: "decorate_local" },
      });
    }

    if (staleReason) {
      void recordEduEvent({
        type: "decorate_pending_invalidated",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: { reason: staleReason, path: "decorate_local" },
      });
      void recordEduEvent({
        type: "decorate_apply_blocked",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: { reason: staleReason, path: "decorate_local" },
      });
      void recordEduEvent({
        type: "decorate_pending_invalidation_visible",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: { reason: staleReason, path: "decorate_local", message: getPendingInvalidationNotice(staleReason) },
      });
      for (const reason of consistency.reasons) {
        void recordEduEvent({
          type: "decorate_apply_mismatch",
          boardId: "edu_chat_panel",
          requestId: pending.requestId,
          shareCode: shareCode ?? undefined,
          extra: { reason, path: "decorate_local" },
        });
      }
      void recordEduEvent({
        type: "decorate_apply_reliability",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: {
          consistencyResult: consistency.ok ? "ok" : "mismatch",
          applyBlocked: true,
          blockedReason: staleReason,
          invalidationReason: staleReason,
          rebased: consistency.reasons.includes("preview_apply_rebased"),
          commitSucceeded: false,
          previewToApplyDelayMs: Math.max(0, Date.now() - pending.createdAt),
          path: "decorate_local",
        },
      });
      const blockedOutcome = scoreDecorateOutcome({
        previewQuality: pending.mutationSummary.qualityScore ?? 0.4,
        lowImpactPreview: pending.mutationSummary.lowImpactPreview,
        usedFallback: pending.source === "deterministic",
        usedEnrich: pending.previewEnriched,
        applySucceeded: false,
        applyBlocked: true,
        consistencyClass,
        staleRisk: "high",
      });
      void recordEduEvent({
        type: "decorate_outcome_scored",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: {
          score: blockedOutcome.score,
          bucket: blockedOutcome.bucket,
          primaryIntent: pending.primaryIntent,
          finalSource: pending.source,
          recommendedFollowup: blockedOutcome.recommendedFollowup,
          path: "decorate_local",
        },
      });
      if (pending.exampleOrigin?.lessonAware) {
        void recordEduEvent({
          type: "decorate_student_example_outcome_linked",
          boardId: "edu_chat_panel",
          requestId: pending.requestId,
          shareCode: shareCode ?? undefined,
          extra: {
            lessonId: pending.exampleOrigin.lessonId,
            isFreeMode: pending.exampleOrigin.isFreeMode,
            exampleKind: pending.exampleOrigin.exampleKind,
            promptClass: pending.exampleOrigin.promptClass,
            exampleIndex: pending.exampleOrigin.exampleIndex,
            lessonAware: pending.exampleOrigin.lessonAware,
            outcomeScore: blockedOutcome.score,
            applied: false,
            satisfactionProxy: "stale_invalidated",
            path: "decorate_local",
          },
        });
      const kind = pending.exampleOrigin.exampleKind as StudentDecorateExampleKind;
      const prev = studentDecorateExamplePerfRef.current[kind] ?? { selected: 0, outcomes: 0, success: 0, lowImpact: 0 };
      const next = { ...prev, outcomes: prev.outcomes + 1, lowImpact: prev.lowImpact + 1 };
      studentDecorateExamplePerfRef.current[kind] = next;
      setStudentExampleOutcomeTick((value) => value + 1);
      const supportScore = Number((next.success / Math.max(1, next.outcomes)).toFixed(2));
      void recordEduEvent({
        type: "decorate_student_example_rank_outcome_linked",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: {
          lessonId: pending.exampleOrigin.lessonId,
          exampleKind: kind,
          supportScore,
          outcomeHintBucket: "weak",
          path: "decorate_local",
        },
      });
      }
      void recordEduEvent({
        type: "decorate_session_summary",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: {
          requestId: pending.requestId,
          promptLen: pending.promptLen,
          promptHash: pending.promptHash,
          primaryIntent: pending.primaryIntent,
          confidence: pending.confidence,
          ambiguous: pending.ambiguous,
          sourceAttempted: pending.sourceAttempted,
          finalSource: pending.source,
          previewReady: true,
          applyAttempted: true,
          applySucceeded: false,
          blockedReason: staleReason,
          invalidationReason: staleReason,
          recoveryDecision: pending.recoveryDecision,
          previewLowImpact: pending.mutationSummary.lowImpactPreview,
          previewEnriched: pending.previewEnriched,
          previewReadyToApplyMs: Math.max(0, Date.now() - pending.createdAt),
          qualityScore: pending.mutationSummary.qualityScore ?? null,
          outcomeScore: blockedOutcome.score,
          outcomeBucket: blockedOutcome.bucket,
          consistencyClass,
          mutationCount: pending.mutationSummary.estimatedMutationCount,
          changedFiles: pending.changedFiles,
          path: "decorate_local",
        },
      });
      emitOutcomeLearningSignal({
        requestId: pending.requestId,
        primaryIntent: pending.primaryIntent,
        finalSource: pending.source,
        outcomeScore: blockedOutcome.score,
        applied: false,
        undoneAfterApply: false,
        abandonedPreview: true,
        replacedByNewerDecorate: false,
        staleInvalidated: true,
        previewAgeMs: Math.max(0, Date.now() - pending.createdAt),
        qualityBucket: (pending.mutationSummary.qualityScore ?? 0.5) >= 0.75 ? "high" : (pending.mutationSummary.qualityScore ?? 0.5) >= 0.45 ? "medium" : "low",
        historyConfidence: 0.45,
        recommendedTuningBucket: blockedOutcome.recommendedFollowup,
      });
      decoratePendingApplyRef.current = null;
      setDecorateHasPendingApply(false);
      showFastApplyNotice(getPendingInvalidationNotice(staleReason));
      return false;
    }
    await pushDecorateUndoSnapshot();
    await commitDecorateHtml(pending.nextHtml, "decorate");
    const committedAfterApply = await getCommittedEditorHtml();
    const committedHtmlHash = hashCode(committedAfterApply.html);
    void recordEduEvent({
      type: "decorate_apply_commit",
      boardId: "edu_chat_panel",
      requestId: pending.requestId,
      shareCode: shareCode ?? undefined,
      extra: { committedHtmlHash, commitTargetKey: "index.html", mode: pending.mode, owner: "decorate", source: pending.source, path: "decorate_local" },
    });
    void recordEduEvent({
      type: "decorate_preview_state",
      boardId: "edu_chat_panel",
      requestId: pending.requestId,
      shareCode: shareCode ?? undefined,
      extra: {
        previewHtmlHash: pending.previewHtmlHash,
        committedHtmlHash,
        matchesCommitted: pending.previewHtmlHash === committedHtmlHash,
        mode: pending.mode,
        path: "decorate_local",
      },
    });
    if (pending.previewHtmlHash !== committedHtmlHash) {
      void recordEduEvent({
        type: "decorate_apply_mismatch",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: { reason: "preview_apply_hash_mismatch", path: "decorate_local" },
      });
    }
    void recordEduEvent({
      type: "decorate_apply_reliability",
      boardId: "edu_chat_panel",
      requestId: pending.requestId,
      shareCode: shareCode ?? undefined,
      extra: {
        consistencyResult: consistency.ok ? "ok" : "mismatch",
        applyBlocked: false,
        blockedReason: null,
        invalidationReason: null,
        rebased: consistency.reasons.includes("preview_apply_rebased"),
        commitSucceeded: true,
        previewToApplyDelayMs: Math.max(0, Date.now() - pending.createdAt),
        path: "decorate_local",
      },
    });
    const applyOutcome = scoreDecorateOutcome({
      previewQuality: pending.mutationSummary.qualityScore ?? 0.5,
      lowImpactPreview: pending.mutationSummary.lowImpactPreview,
      usedFallback: pending.source === "deterministic",
      usedEnrich: pending.previewEnriched,
      applySucceeded: true,
      applyBlocked: false,
      consistencyClass,
      staleRisk: consistencyClass === "mismatch" ? "medium" : "low",
    });
    void recordEduEvent({
      type: "decorate_outcome_scored",
      boardId: "edu_chat_panel",
      requestId: pending.requestId,
      shareCode: shareCode ?? undefined,
      extra: {
        score: applyOutcome.score,
        bucket: applyOutcome.bucket,
        primaryIntent: pending.primaryIntent,
        finalSource: pending.source,
        recommendedFollowup: applyOutcome.recommendedFollowup,
        path: "decorate_local",
      },
    });
    if (pending.exampleOrigin?.lessonAware) {
      void recordEduEvent({
        type: "decorate_student_example_outcome_linked",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: {
          lessonId: pending.exampleOrigin.lessonId,
          isFreeMode: pending.exampleOrigin.isFreeMode,
          exampleKind: pending.exampleOrigin.exampleKind,
          promptClass: pending.exampleOrigin.promptClass,
          exampleIndex: pending.exampleOrigin.exampleIndex,
          lessonAware: pending.exampleOrigin.lessonAware,
          outcomeScore: applyOutcome.score,
          applied: true,
          satisfactionProxy: applyOutcome.score >= 70 ? "high" : "medium",
          path: "decorate_local",
        },
      });
      const kind = pending.exampleOrigin.exampleKind as StudentDecorateExampleKind;
      const prev = studentDecorateExamplePerfRef.current[kind] ?? { selected: 0, outcomes: 0, success: 0, lowImpact: 0 };
      const successDelta = applyOutcome.score >= 70 ? 1 : 0;
      const lowImpactDelta = pending.mutationSummary.lowImpactPreview ? 1 : 0;
      const next = { ...prev, outcomes: prev.outcomes + 1, success: prev.success + successDelta, lowImpact: prev.lowImpact + lowImpactDelta };
      studentDecorateExamplePerfRef.current[kind] = next;
      setStudentExampleOutcomeTick((value) => value + 1);
      const supportScore = Number((next.success / Math.max(1, next.outcomes)).toFixed(2));
      void recordEduEvent({
        type: "decorate_student_example_rank_outcome_linked",
        boardId: "edu_chat_panel",
        requestId: pending.requestId,
        shareCode: shareCode ?? undefined,
        extra: {
          lessonId: pending.exampleOrigin.lessonId,
          exampleKind: kind,
          supportScore,
          outcomeHintBucket: applyOutcome.score >= 70 ? "strong" : applyOutcome.score >= 55 ? "medium" : "weak",
          path: "decorate_local",
        },
      });
    }
    appendDecorateRecentEvent({
      requestId: pending.requestId,
      intent: pending.primaryIntent,
      source: pending.source,
      applied: true,
      weakChange: pending.mutationSummary.lowImpactPreview,
    });
    decorateLastAppliedRef.current = { requestId: pending.requestId, appliedAt: Date.now() };
    emitOutcomeLearningSignal({
      requestId: pending.requestId,
      primaryIntent: pending.primaryIntent,
      finalSource: pending.source,
      outcomeScore: applyOutcome.score,
      applied: true,
      undoneAfterApply: false,
      abandonedPreview: false,
      replacedByNewerDecorate: false,
      staleInvalidated: false,
      applyDelayMs: Math.max(0, Date.now() - pending.createdAt),
      previewAgeMs: Math.max(0, Date.now() - pending.createdAt),
      qualityBucket: (pending.mutationSummary.qualityScore ?? 0.5) >= 0.75 ? "high" : (pending.mutationSummary.qualityScore ?? 0.5) >= 0.45 ? "medium" : "low",
      historyConfidence: 0.6,
      recommendedTuningBucket: applyOutcome.recommendedFollowup,
    });
    void recordEduEvent({
      type: "decorate_session_summary",
      boardId: "edu_chat_panel",
      requestId: pending.requestId,
      shareCode: shareCode ?? undefined,
      extra: {
        requestId: pending.requestId,
        promptLen: pending.promptLen,
        promptHash: pending.promptHash,
        primaryIntent: pending.primaryIntent,
        confidence: pending.confidence,
        ambiguous: pending.ambiguous,
        sourceAttempted: pending.sourceAttempted,
        finalSource: pending.source,
        previewReady: true,
        applyAttempted: true,
        applySucceeded: true,
        blockedReason: null,
        invalidationReason: null,
        recoveryDecision: pending.recoveryDecision,
        previewLowImpact: pending.mutationSummary.lowImpactPreview,
        previewEnriched: pending.previewEnriched,
        previewReadyToApplyMs: Math.max(0, Date.now() - pending.createdAt),
        qualityScore: pending.mutationSummary.qualityScore ?? null,
        outcomeScore: applyOutcome.score,
        outcomeBucket: applyOutcome.bucket,
        consistencyClass,
        mutationCount: pending.mutationSummary.estimatedMutationCount,
        changedFiles: pending.changedFiles,
        path: "decorate_local",
      },
    });
    void recordEduEvent({ type: "decorate_tuning_signal", boardId: "edu_chat_panel", requestId: pending.requestId, shareCode: shareCode ?? undefined, extra: { ...buildDecorateTuningSignal({ requestId: pending.requestId, intent: { primaryIntent: pending.primaryIntent, secondaryIntents: [], colors: [], tone: [], emphasisTargets: [], imageTargets: [], rewriteTargets: [], confidence: pending.confidence, isAmbiguous: pending.ambiguous }, source: pending.source, qualityScore: pending.mutationSummary.qualityScore ?? 0.5, lowImpactPreview: pending.mutationSummary.lowImpactPreview, usedFallback: pending.source === "deterministic", usedAutoEnrich: pending.previewEnriched, usedRecoveryDecision: Boolean(pending.recoveryDecision), applySucceeded: true, applyBlocked: false, blockedReason: null, invalidationReason: null }), path: "decorate_local" } });
    decoratePendingApplyRef.current = null;
    setDecorateHasPendingApply(false);
    invalidateDecoratePreviewCache("newer_decorate_apply", pending.requestId);
    showDecorateProgressCopy(pending.requestId, "completed", getStudentDecorateResultCopy("applied"));
    return true;
  }, [
    commitDecorateHtml,
    getCommittedEditorHtml,
    getPendingInvalidationNotice,
    pushDecorateUndoSnapshot,
    shareCode,
    showFastApplyNotice,
    invalidateDecoratePreviewCache,
    showDecorateProgressCopy,
    appendDecorateRecentEvent,
    emitOutcomeLearningSignal,
  ]);

  const runDecorateUndo = useCallback(async () => {
    if (lastSsotOwnerRef.current.owner === "user_edit") {
      void recordEduEvent({ type: "decorate_undo_reliability", boardId: "edu_chat_panel", requestId: createRequestId(), shareCode: shareCode ?? undefined, extra: { undoAvailable: false, undoAttempted: true, undoSucceeded: false, blockedReason: "recent_user_edit", path: "decorate_local" } });
      showFastApplyNotice("최근 편집이 있어 되돌릴 수 없어요");
      return;
    }
    const last = decorateUndoStackRef.current.at(-1);
    if (!last) {
      void recordEduEvent({ type: "decorate_undo_reliability", boardId: "edu_chat_panel", requestId: createRequestId(), shareCode: shareCode ?? undefined, extra: { undoAvailable: false, undoAttempted: true, undoSucceeded: false, blockedReason: "empty_undo_stack", path: "decorate_local" } });
      showFastApplyNotice("되돌릴 decorate 이력이 없어요");
      return;
    }
    decorateUndoStackRef.current = decorateUndoStackRef.current.slice(0, -1);
    await commitDecorateHtml(last.html, "decorate");
    void recordEduEvent({
      type: "decorate_undo_success",
      boardId: "edu_chat_panel",
      requestId: createRequestId(),
      shareCode: shareCode ?? undefined,
      extra: { restoredHash: last.htmlHash, path: "decorate_local" },
    });
    void recordEduEvent({ type: "decorate_undo_reliability", boardId: "edu_chat_panel", requestId: createRequestId(), shareCode: shareCode ?? undefined, extra: { undoAvailable: true, undoAttempted: true, undoSucceeded: true, blockedReason: null, path: "decorate_local" } });
    if (decorateLastAppliedRef.current) {
      const applied = decorateRecentEventsRef.current.find((event) => event.requestId === decorateLastAppliedRef.current?.requestId);
      emitOutcomeLearningSignal({
        requestId: decorateLastAppliedRef.current.requestId,
        primaryIntent: applied?.intent ?? "ambiguous",
        finalSource: applied?.source ?? "deterministic",
        outcomeScore: 32,
        applied: true,
        undoneAfterApply: true,
        abandonedPreview: false,
        replacedByNewerDecorate: false,
        staleInvalidated: false,
        applyDelayMs: Math.max(0, Date.now() - decorateLastAppliedRef.current.appliedAt),
        qualityBucket: "low",
        historyConfidence: 0.55,
        recommendedTuningBucket: "tune_intent_rules",
      });
      appendDecorateRecentEvent({
        requestId: decorateLastAppliedRef.current.requestId,
        intent: applied?.intent ?? "ambiguous",
        source: applied?.source ?? "deterministic",
        undoneAfterApply: true,
      });
      decorateLastAppliedRef.current = null;
    }
    showFastApplyNotice("직전 decorate 적용을 되돌렸어요");
  }, [appendDecorateRecentEvent, commitDecorateHtml, emitOutcomeLearningSignal, shareCode, showFastApplyNotice]);

  const runPatchApply = useCallback(
    (requestId?: string, promptOverride?: string, controllerContext?: { requestId: string; setPhase: (phase: "starting" | "server_kickoff" | "webllm_kickoff" | "fallback_kickoff" | "building_preview") => void; markServerPlanStart: () => void; markServerPlanEnd: () => void; shouldFallbackImmediately: () => boolean; wasServerPlanStarted: () => boolean }) => {
      if (!isTemplateFirst || !currentFiles) return Promise.resolve({ applied: false as const, reason: "invalid" as const });
      const decoratePrompt = promptOverride?.trim() ?? messages.filter((m) => m.role === "user").slice(-1)[0]?.content?.trim() ?? "";
      const decorateClickMeta = {
        promptLen: decoratePrompt.length,
        hasPendingPreview: Boolean(decoratePendingApplyRef.current),
        inProgress: decorateInProgressRef.current,
      };
      console.info("[decorate] CLICK", { ...decorateClickMeta, now: Date.now() });
      void recordEduEvent({
        type: "decorate_click",
        boardId: "edu_chat_panel",
        requestId: requestId ?? null,
        shareCode: shareCode ?? undefined,
        extra: { ...decorateClickMeta, path: "decorate_local" },
      });
      decorateServerPlanStartedRef.current = false;
      if (decorateInvariantTimerRef.current) {
        window.clearTimeout(decorateInvariantTimerRef.current);
      }
      const invariantRequestId = requestId ?? null;
      decorateInvariantTimerRef.current = window.setTimeout(() => {
        if (decorateServerPlanStartedRef.current) return;
        console.error("[decorate] invariant violation", { missing: "server_plan_start", requestId: invariantRequestId, promptLen: decoratePrompt.length });
        void recordEduEvent({
          type: "decorate_pipeline_invariant_violation",
          boardId: "edu_chat_panel",
          requestId: invariantRequestId,
          shareCode: shareCode ?? undefined,
          extra: { missing: "server_plan_start", promptLen: decoratePrompt.length, path: "decorate_local" },
        });
        if (isDev) {
          showFastApplyNotice("서버 AI 호출이 시작되지 않았어요(버그).");
        }
      }, 300);
      const recordDecorateSkip = (reason: string) => {
        const payload = {
          reason,
          promptLen: decoratePrompt.length,
          inProgress: decorateInProgressRef.current,
          hasPendingPreview: Boolean(decoratePendingApplyRef.current),
        };
        console.warn("[decorate] SKIP", payload);
        void recordEduEvent({
          type: "decorate_skip",
          boardId: "edu_chat_panel",
          requestId: requestId ?? null,
          shareCode: shareCode ?? undefined,
          extra: { ...payload, path: "decorate_local" },
        });
      };
      if (!decoratePrompt) {
        recordDecorateSkip("empty_prompt");
        showFastApplyNotice("먼저 꾸미기 요청 문장을 입력해 주세요.");
        return Promise.resolve({ applied: false as const, reason: "invalid" as const });
      }
      if (decoratePendingApplyRef.current && !controllerContext) {
        recordDecorateSkip("pending_preview_exists");
        showFastApplyNotice("이미 미리보기가 있어요. Apply를 눌러 반영해 주세요.");
        return Promise.resolve({ applied: false as const, reason: "pending_preview_exists" as const });
      }
      if (decorateInProgressRef.current) {
        if (decorateCurrentPromptRef.current && decorateCurrentPromptRef.current === decoratePrompt) {
          recordDecorateSkip("in_flight_duplicate");
          showFastApplyNotice("이미 같은 꾸미기를 진행 중이에요.");
          return Promise.resolve({ applied: false as const, reason: "in_flight_duplicate" as const });
        }
        decorateFlightRef.current.abort(
          buildAbortMetaFromDecorateMetrics(decorateMetricsRef.current, {
            abortReason: "user_cancel",
            phase: "decorate.cancel.replace",
            usingLocalWebLLM: effectiveWebllmEnabled,
            modelId: decorateCoachModelId ?? null,
          }),
        );
      }
      decorateCurrentPromptRef.current = decoratePrompt;
      if (decoratePendingApplyRef.current) {
        const previousPendingRequestId = decoratePendingApplyRef.current.requestId;
        const previousPending = decoratePendingApplyRef.current;
        const reason: DecoratePendingInvalidationReason = "pending_stale_due_to_newer_decorate";
        emitOutcomeLearningSignal({
          requestId: previousPendingRequestId,
          primaryIntent: previousPending.primaryIntent,
          finalSource: previousPending.source,
          outcomeScore: previousPending.outcomeScore ?? 50,
          applied: false,
          undoneAfterApply: false,
          abandonedPreview: true,
          replacedByNewerDecorate: true,
          staleInvalidated: false,
          previewAgeMs: Math.max(0, Date.now() - previousPending.createdAt),
          qualityBucket: (previousPending.mutationSummary.qualityScore ?? 0.5) >= 0.75 ? "high" : (previousPending.mutationSummary.qualityScore ?? 0.5) >= 0.45 ? "medium" : "low",
          historyConfidence: 0.4,
          recommendedTuningBucket: "reduce_noop",
        });
        const satDecision = shouldCacheDecoratePreview({
          qualityScore: previousPending.mutationSummary.qualityScore ?? 0.5,
          lowImpactPreview: previousPending.mutationSummary.lowImpactPreview,
          enriched: previousPending.previewEnriched,
          invalidated: true,
          ambiguous: previousPending.ambiguous,
        });
        void recordEduEvent({ type: "decorate_preview_cache_satisfaction_gate", boardId: "edu_chat_panel", requestId: previousPendingRequestId, shareCode: shareCode ?? undefined, extra: { cacheDecision: satDecision.ok ? "store" : "skip", satisfactionProxy: "abandoned", ttlBucket: "none", path: "decorate_local" } });
        void recordEduEvent({
          type: "decorate_pending_invalidated",
          boardId: "edu_chat_panel",
          requestId: previousPendingRequestId,
          shareCode: shareCode ?? undefined,
          extra: { reason, path: "decorate_local", replacedBy: requestId ?? null },
        });
        void recordEduEvent({
          type: "decorate_pending_invalidation_visible",
          boardId: "edu_chat_panel",
          requestId: previousPendingRequestId,
          shareCode: shareCode ?? undefined,
          extra: { reason, path: "decorate_local", message: "미리보기가 최신 상태와 달라져 다시 만들어야 해요." },
        });
      }
      decoratePendingApplyRef.current = null;
      setDecorateHasPendingApply(false);
      const localRequestId = requestId ?? createRequestId();
      const planningStartedAt = Date.now();
      if (!decorateBaseReadinessRef.current.hydrationStable || !decorateBaseReadinessRef.current.snapshotReady || !decorateBaseReadinessRef.current.hashReady) {
        void recordEduEvent({ type: "decorate_base_readiness_pending", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { hydrationStable: decorateBaseReadinessRef.current.hydrationStable, snapshotReady: decorateBaseReadinessRef.current.snapshotReady, hashReady: decorateBaseReadinessRef.current.hashReady, path: "decorate_local" } });
      }
      const routedIntent = routeDecorateIntent(decoratePrompt);
      void recordEduEvent({
        type: "decorate_phase_transition",
        boardId: "edu_chat_panel",
        requestId: localRequestId,
        shareCode: shareCode ?? undefined,
        extra: { phase: "planning_started", path: "decorate_local" },
      });
      showDecorateProgressCopy(localRequestId, "starting", "AI가 바꾸는 방법을 생각하고 있어요.");
      controllerContext?.setPhase("server_kickoff");
      if (routedIntent.isAmbiguous) {
        void recordEduEvent({
          type: "decorate_ambiguous_prompt_detected",
          boardId: "edu_chat_panel",
          requestId: localRequestId,
          shareCode: shareCode ?? undefined,
          extra: { primaryIntent: routedIntent.primaryIntent, confidence: routedIntent.confidence, path: "decorate_local" },
        });
        void recordEduEvent({
          type: "decorate_ambiguous_prompt_defaulted",
          boardId: "edu_chat_panel",
          requestId: localRequestId,
          shareCode: shareCode ?? undefined,
          extra: { strategy: "neutral_safe", path: "decorate_local" },
        });
      }
      void recordEduEvent({
        type: "decorate_intent_routed",
        boardId: "edu_chat_panel",
        requestId: localRequestId,
        shareCode: shareCode ?? undefined,
        extra: {
          primaryIntent: routedIntent.primaryIntent,
          confidence: routedIntent.confidence,
          ambiguous: routedIntent.isAmbiguous,
          hasColorIntent: routedIntent.colors.length > 0,
          hasToneIntent: routedIntent.tone.length > 0,
          hasImageIntent: routedIntent.imageTargets.length > 0,
          hasRewriteIntent: routedIntent.rewriteTargets.length > 0,
          hasEmphasisIntent: routedIntent.emphasisTargets.length > 0,
          path: "decorate_local",
        },
      });
      const timeoutMs = resolveGenerateJsonTimeoutMs({
        usingLocalWebLLM: effectiveWebllmEnabled,
        localTimeoutMs: LOCAL_TIMEOUT_MS,
        generatorTimeoutMs: GENERATOR_TIMEOUT_MS,
      });
      const metrics = createDecorateMetrics({ requestId: localRequestId, timeoutMs, modelId: decorateCoachModelId ?? null });
      decorateMetricsRef.current = metrics;
      const decorateRunId = (decorateRunIdRef.current += 1);
      if (fastFallbackTimerRef.current) {
        window.clearTimeout(fastFallbackTimerRef.current);
        fastFallbackTimerRef.current = null;
      }
      const syncDecorateDebugMetrics = () => {
        const next = { ...metrics, stageDurations: { ...metrics.stageDurations } };
        decorateMetricsRef.current = next;
        setDecorateDebugMetrics(next);
      };

      const effectiveStatus = getEffectiveWebLLMStatus();
      const { bypassDecision, bypassTelemetry: decorateBypassExtra, webllmUnavailableReason } =
        resolveDecorateBypassBoundary(effectiveStatus);
      console.info("[decorate] bypass.decision", decorateBypassExtra);
      void recordEduEvent({
        type: "decorate_bypass_decision",
        boardId: "edu_chat_panel",
        requestId: localRequestId,
        shareCode: shareCode ?? undefined,
        extra: { ...decorateBypassExtra, path: "decorate_local" },
      });
      const providerAvailability = resolveStudentProviderAvailability({
        openaiConfigured: true,
        openaiProxyReachable: true,
        webllmAvailable: webllmUnavailableReason === null,
        bypassRequested: bypassDecision.bypass,
        webllmUnavailableReason,
      });
      void recordEduEvent({
        type: "decorate_provider_availability_checked",
        boardId: "edu_chat_panel",
        requestId: localRequestId,
        shareCode: shareCode ?? undefined,
        extra: { ...providerAvailability, path: "decorate_local" },
      });
      const localPlanEnabled = false;
      void recordEduEvent({
        type: "decorate_prewarm_nonblocking_confirmed",
        boardId: "edu_chat_panel",
        requestId: localRequestId,
        shareCode: shareCode ?? undefined,
        extra: { path: "decorate_local" },
      });
      const decorateMode = "llm";
      if (!providerAvailability.webllmUsable) {
        void recordEduEvent({
          type: "decorate_webllm_skipped",
          boardId: "edu_chat_panel",
          requestId: localRequestId,
          shareCode: shareCode ?? undefined,
          extra: { provider: "webllm", status: "skipped", reason: providerAvailability.reasonCodes.join(",") || "unavailable", path: "decorate_local" },
        });
      }
      if (bypassDecision.bypass) {
        void recordEduEvent({
          type: "decorate_llm_bypass",
          boardId: "edu_chat_panel",
          requestId: localRequestId,
          shareCode: shareCode ?? undefined,
          extra: {
            reason: bypassDecision.reason,
            mode: decorateMode,
            interpretation: "local_webllm_skip_only",
            path: "decorate_local",
          },
        });
      }
      const mergeAbortSignals = (signals: Array<AbortSignal | undefined>) => {
        const activeSignals = signals.filter((candidate): candidate is AbortSignal => Boolean(candidate));
        if (activeSignals.length <= 1) {
          return activeSignals[0];
        }
        const controller = new AbortController();
        const cleanupCallbacks: Array<() => void> = [];
        const abortWith = (signal: AbortSignal) => {
          cleanupCallbacks.forEach((cleanup) => cleanup());
          if (!controller.signal.aborted) {
            controller.abort(signal.reason);
          }
        };
        for (const signal of activeSignals) {
          if (signal.aborted) {
            abortWith(signal);
            break;
          }
          const handler = () => abortWith(signal);
          signal.addEventListener("abort", handler, { once: true });
          cleanupCallbacks.push(() => signal.removeEventListener("abort", handler));
        }
        return controller.signal;
      };

      decorateInProgressRef.current = true;
      const decoratePromise = decorateFlightRef.current
        .run(
        async (decorateSignal) => {
          if (decorateRunIdRef.current !== decorateRunId) {
            return { applied: false as const, reason: "stale_decorate_run" as const };
          }
          const decorateStartWebLLM = async (
            decorateRequestId: string,
            input: Parameters<typeof safeStartWebLLM>[1] & { signal?: AbortSignal },
          ) => {
            const mergedSignal = mergeAbortSignals([decorateSignal, input.signal]);
            const throwDecorateAbort = (phase: string) => {
              const signalAbortMeta = getAbortMetaFromError(createAbortErrorFromSignal(decorateSignal));
              throw new DOMException(
                JSON.stringify(
                  buildAbortMetaFromDecorateMetrics(metrics, {
                    abortReason: signalAbortMeta?.abortReason ?? "user_cancel",
                    phase,
                    usingLocalWebLLM: effectiveWebllmEnabled,
                    modelId: decorateCoachModelId ?? null,
                  }),
                ),
                "AbortError",
              );
            };
            if (mergedSignal?.aborted) {
              throwDecorateAbort("decorate.generateJson");
            }
            const handleAbort = () => {
              safeAbortWebLLM(decorateRequestId);
            };
            mergedSignal?.addEventListener("abort", handleAbort, { once: true });
            try {
              const webllmInput = { ...input };
              delete (webllmInput as { signal?: AbortSignal }).signal;
              const response = await safeStartWebLLM(decorateRequestId, webllmInput);
              if (mergedSignal?.aborted || decorateSignal.aborted) {
                throwDecorateAbort("decorate.generateJson");
              }
              return response;
            } finally {
              mergedSignal?.removeEventListener("abort", handleAbort);
            }
          };

          try {
            let lastPlanSource: "server_llm" | "local_llm" | "deterministic" | null = null;
            let serverPlanFailureReason: string | null = null;
            let lastPlanRecommendedAction: "accept" | "accept_and_enrich" | "fallback" | "reject" = "accept";
            const cacheBefore = await getCommittedEditorHtml();
            decorateBaseReadinessRef.current.snapshotReady = Boolean(cacheBefore.snapshotVersion);
            decorateBaseReadinessRef.current.hashReady = Boolean(cacheBefore.html);
            void recordEduEvent({ type: "decorate_base_readiness_resolved", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { snapshotReady: decorateBaseReadinessRef.current.snapshotReady, hashReady: decorateBaseReadinessRef.current.hashReady, path: "decorate_local" } });
            const cacheBaseHash = hashCode(cacheBefore.html);
            const cacheKey = buildDecorateCacheKey({
              prompt: decoratePrompt,
              baseSnapshotVersion: cacheBefore.snapshotVersion,
              baseHtmlHash: cacheBaseHash,
              intent: { primaryIntent: routedIntent.primaryIntent, isAmbiguous: routedIntent.isAmbiguous },
            });
            if (decorateCacheLastBaseHashRef.current && decorateCacheLastBaseHashRef.current !== cacheBaseHash) {
              invalidateDecoratePreviewCache("snapshot_changed", localRequestId);
            }
            decorateCacheLastBaseHashRef.current = cacheBaseHash;
            const cachedPreview = decoratePreviewCacheRef.current.get(cacheKey);
            if (cachedPreview) {
              void recordEduEvent({ type: "decorate_preview_cache_hit", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { key: cacheKey.slice(0, 64), source: cachedPreview.source, qualityScore: cachedPreview.qualityScore, ageMs: Math.max(0, Date.now() - cachedPreview.createdAt), path: "decorate_local" } });
              decoratePendingApplyRef.current = {
                nextHtml: cachedPreview.previewHtml,
                mode: "deterministic",
                requestId: localRequestId,
                summary: "cached_preview_reused",
                source: cachedPreview.source,
                fallbackReason: cachedPreview.fallbackReason,
                baseSnapshotVersion: cachedPreview.baseSnapshotVersion,
                baseHtmlHash: cachedPreview.baseHtmlHash,
                previewHtmlHash: cachedPreview.previewHtmlHash,
                changedFiles: cachedPreview.changedFiles,
                mutationSummary: {
                  estimatedMutationCount: cachedPreview.mutationCount,
                  styleMutationCount: 0,
                  textMutationCount: 0,
                  imageIntentCount: 0,
                  lowImpactPreview: cachedPreview.lowImpactPreview,
                  qualityScore: cachedPreview.qualityScore,
                },
                createdAt: Date.now(),
                promptLen: decoratePrompt.length,
                promptHash: hashDecoratePrompt(decoratePrompt),
                primaryIntent: routedIntent.primaryIntent,
                confidence: routedIntent.confidence,
                ambiguous: routedIntent.isAmbiguous,
                previewEnriched: cachedPreview.enriched,
                recoveryDecision: null,
                sourceAttempted: ["cache"],
                outcomeScore: cachedPreview.qualityScore >= 0.75 ? 72 : 58,
                outcomeBucket: cachedPreview.qualityScore >= 0.75 ? "good" : "acceptable",
                consistencyClass: "consistent",
                handoff: {
                  requestId: localRequestId,
                  source: "cache",
                  createdAt: Date.now(),
                  baseSnapshotVersion: cachedPreview.baseSnapshotVersion,
                  baseHtmlHash: cachedPreview.baseHtmlHash,
                  previewHash: cachedPreview.previewHtmlHash,
                  qualityScore: cachedPreview.qualityScore,
                  outcomeHint: cachedPreview.qualityScore >= 0.75 ? "good" : "acceptable",
                  invalidationRisk: routedIntent.isAmbiguous ? "medium" : "low",
                  applyEligibility: true,
                },
                exampleOrigin: studentDecorateExampleOriginRef.current
                  ? {
                      lessonAware: studentDecorateExampleOriginRef.current.lessonAware,
                      exampleKind: studentDecorateExampleOriginRef.current.kind,
                      promptClass: studentDecorateExampleOriginRef.current.promptClass,
                      exampleIndex: studentDecorateExampleOriginRef.current.index,
                      lessonId: resolvedLessonId,
                      isFreeMode: isFreeModeLesson,
                    }
                  : null,
              };
              setDecorateHasPendingApply(true);
              void recordEduEvent({ type: "decorate_preview_handoff_ready", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { source: "cache", createdAt: decoratePendingApplyRef.current?.handoff.createdAt ?? Date.now(), baseSnapshotVersion: cachedPreview.baseSnapshotVersion, baseHtmlHash: cachedPreview.baseHtmlHash, previewHash: cachedPreview.previewHtmlHash, qualityScore: cachedPreview.qualityScore, outcomeHint: cachedPreview.qualityScore >= 0.75 ? "good" : "acceptable", invalidationRisk: routedIntent.isAmbiguous ? "medium" : "low", applyEligibility: true, path: "decorate_local" } });
              showDecorateProgressCopy(localRequestId, "preview_ready", getStudentDecorateResultCopy("preview_ready"));
              void recordEduEvent({ type: "decorate_preview_ready", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { previewHtmlHash: cachedPreview.previewHtmlHash, mode: "cache", summary: "cached_preview_reused", path: "decorate_local" } });
              return { applied: false as const, reason: "preview_ready" as const };
            }
            void recordEduEvent({ type: "decorate_preview_cache_miss", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { key: cacheKey.slice(0, 64), path: "decorate_local" } });
            const historyContext: DecorateHistoryContext = buildDecorateHistoryContext({
              recentUserEditSummary: decorateRecentUserEditRef.current
                ? {
                    hasEdits: decorateRecentUserEditRef.current.hasEdits,
                    regionKinds: decorateRecentUserEditRef.current.regionKinds,
                    attributeKinds: decorateRecentUserEditRef.current.attributeKinds,
                    ageMs: Math.max(0, Date.now() - decorateRecentUserEditRef.current.at),
                  }
                : undefined,
              recentDecorateEvents: decorateRecentEventsRef.current.slice(-6).map((item) => ({
                intent: item.intent,
                tone: item.tone,
                colors: item.colors,
                emphasis: item.emphasis,
                source: item.source,
                applied: item.applied,
                undoneAfterApply: item.undoneAfterApply,
                staleInvalidated: item.staleInvalidated,
                weakChange: item.weakChange,
              })),
              currentHtmlHash: cacheBaseHash,
            });
            controllerContext?.setPhase("building_preview");
            const flow = await runDecorateFlow({
              requestId: localRequestId,
              userPrompt: decoratePrompt,
              timeoutMs,
              modelId: decorateCoachModelId ?? undefined,
              metrics,
              signal: decorateSignal,
              maxTokens: DECORATE_INTENT_MAX_TOKENS,
              getCommittedEditorHtmlSSOT: getCommittedEditorHtml,
              commitStudentHtml: commitDecorateHtml,
              emitSlotResolve: ({ snapshotVersion, resolved, htmlHashBefore, htmlHashAfterInjection }) => {
                syncDecorateDebugMetrics();
                void recordEduEvent({
                  type: "decorate_slot_resolve",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: {
                    snapshotVersion,
                    candidatesCount: resolved.candidates.length,
                    selectedSelector: resolved.selected?.selector ?? null,
                    selectedSlotId: resolved.selected?.id ?? null,
                    source: resolved.source,
                    fingerprint: resolved.fingerprint,
                    htmlHashBefore,
                    htmlHashAfterInjection,
                    path: "decorate_local",
                  },
                });
              },
              emitCommitState: ({ committedHtmlHash, commitTargetKey, previewRefreshTriggered }) => {
                void recordEduEvent({
                  type: "decorate_commit",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { committedHtmlHash, commitTargetKey, previewRefreshTriggered, path: "decorate_local" },
                });
              },
              emitResultReady: ({ mode, summary, opsCount, selector, htmlSnippetLen }) => {
                void recordEduEvent({
                  type: "decorate_result_ready",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { mode, summary, opsCount, selector, htmlSnippetLen, path: "decorate_local" },
                });
              },
              emitPlanReady: ({ mode, source, opsCount, summary }) => {
                void recordEduEvent({
                  type: "decorate_plan_ready",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { mode: source ?? mode, opsCount, summary, path: "decorate_local" },
                });
              },
              emitPlanExecute: ({ appliedOps, changed, degraded, changedNodesCount, majorTargets }) => {
                void recordEduEvent({
                  type: "decorate_plan_execute",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { appliedOps, changed, degraded, changedNodesCount, majorTargets, path: "decorate_local" },
                });
              },
              historyContext,
              pageSignals: {
                recentUserEditRegionKinds: decorateRecentUserEditRef.current?.regionKinds ?? [],
                imageSlotsAvailable: routedIntent.imageTargets.length > 0 ? 1 : 0,
              },
              allowUserEditConflictOverride: /(?:제목|button|버튼|headline|title)/i.test(decoratePrompt),
              degradedHint: {
                kickoffDelayMs: Date.now() - planningStartedAt,
                snapshotReady: decorateBaseReadinessRef.current.snapshotReady,
                hashReady: decorateBaseReadinessRef.current.hashReady,
                hydrationStable: decorateBaseReadinessRef.current.hydrationStable,
                recentSlaBreach: decorateRecentSlaBreachRef.current,
                networkTimeoutSignal: decorateBypassExtra.isLoadingTooLong,
              },
              emitDegradedMode: ({ mode, reasons }) => {
                void recordEduEvent({ type: "decorate_degraded_mode_reasoned", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { mode, reasons, path: "decorate_local" } });
                if (mode !== "normal") {
                  void recordEduEvent({ type: "decorate_degraded_mode_entered", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { mode, reasons, path: "decorate_local" } });
                } else {
                  void recordEduEvent({ type: "decorate_degraded_mode_exited", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { mode, path: "decorate_local" } });
                }
              },
              emitReliabilityBudget: ({ event, elapsedMs, budgetMs }) => {
                void recordEduEvent({ type: event, boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { elapsedMs, budgetMs, path: "decorate_local" } });
              },
              emitHistoryContextBuilt: ({ hasRecentEdits, hasRecentDecorateApply, hasRecentUndo, historyConfidence, biasKinds }) => {
                void recordEduEvent({
                  type: "decorate_history_context_built",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { hasRecentEdits, hasRecentDecorateApply, hasRecentUndo, historyConfidence, biasKinds, path: "decorate_local" },
                });
              },
              emitPlanShaped: ({ primaryIntent, shapingReasons, targetBiasKinds, avoidRegionKinds, recommendedStrength }) => {
                void recordEduEvent({
                  type: "decorate_plan_shaped",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { primaryIntent, shapingReasons, targetBiasKinds, avoidRegionKinds, recommendedStrength, path: "decorate_local" },
                });
                if (shapingReasons.includes("avoid_recent_user_edit_conflict")) {
                  void recordEduEvent({ type: "decorate_user_edit_conflict_avoided", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { avoidRegionKinds, path: "decorate_local" } });
                }
                if (/(?:제목|button|버튼|headline|title)/i.test(decoratePrompt) && shapingReasons.includes("avoid_recent_user_edit_conflict")) {
                  void recordEduEvent({ type: "decorate_user_edit_conflict_override", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { requestedRegionHint: true, path: "decorate_local" } });
                }
              },
              emitStyleIntentClassified: ({ styleIntent, primaryStyleIntent, secondaryStyleIntents, compositionHints, styleProfile, colorTokens, gradientRequested, backgroundRequested, confidence }) => {
                void recordEduEvent({
                  type: "decorate_style_intent_classified",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { styleIntent, primaryStyleIntent, secondaryStyleIntents, compositionHints, styleProfile, colorTokens, gradientRequested, backgroundRequested, confidence, path: "decorate_local" },
                });
              },

              emitStyleIntentComposed: ({ requestId, primaryStyleIntent, secondaryStyleIntents, compositionHints, confidence }) => {
                void recordEduEvent({
                  type: "decorate_style_intent_composed",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { primaryStyleIntent, secondaryStyleIntents, compositionHints, confidence, path: "decorate_local" },
                });
              },
              emitStyleProfileNormalized: ({ requestId, profile, sourceIntent, confidence }) => {
                void recordEduEvent({
                  type: "decorate_style_profile_normalized",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { profile, sourceIntent, confidence, path: "decorate_local" },
                });
              },
              emitStyleTargetsResolved: ({ requestId, targetKinds, resolvedCount, unresolvedKinds, confidences, semanticKindsUsed, provenanceKinds, semanticCoverageScore }) => {
                void recordEduEvent({
                  type: "decorate_style_targets_resolved",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { targetKinds, resolvedCount, unresolvedKinds, confidences, semanticKindsUsed: semanticKindsUsed ?? [], provenanceKinds: provenanceKinds ?? [], semanticCoverageScore: semanticCoverageScore ?? null, path: "decorate_local" },
                });
              },
              emitSemanticSectionsDetected: ({ requestId, sectionKinds, primarySectionKind, hasHero, hasCTA, hasCards, count }) => {
                void recordEduEvent({
                  type: "decorate_semantic_sections_detected",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { sectionKinds, primarySectionKind, hasHero, hasCTA, hasCards, count, path: "decorate_local" },
                });
              },
              emitSemanticPartialTargetUsed: ({ requestId, requestedKinds, resolvedKinds, missingKinds, strategy }) => {
                void recordEduEvent({
                  type: "decorate_semantic_partial_target_used",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { requestedKinds, resolvedKinds, missingKinds, strategy, path: "decorate_local" },
                });
              },
              emitStructureGuidedCompositionBuilt: ({ requestId, semanticKindsUsed, opKinds, targetKinds, compositionStrategy }) => {
                void recordEduEvent({
                  type: "decorate_structure_guided_composition_built",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { semanticKindsUsed, opKinds, targetKinds, compositionStrategy, path: "decorate_local" },
                });
              },
              emitStyleProfileSemanticApplied: ({ requestId, profile, semanticKinds, majorTargets }) => {
                void recordEduEvent({
                  type: "decorate_style_profile_semantic_applied",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { profile, semanticKinds, majorTargets, path: "decorate_local" },
                });
              },
              emitSemanticCoherenceEvaluated: ({ requestId, score, matchedSemanticKinds, missingSemanticKinds, penalties }) => {
                void recordEduEvent({
                  type: "decorate_semantic_coherence_evaluated",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { score, matchedSemanticKinds, missingSemanticKinds, penalties, path: "decorate_local" },
                });
              },
              emitStyleCompositionBuilt: ({ requestId, opKinds, targetKinds, strength, styleProfile }) => {
                void recordEduEvent({
                  type: "decorate_style_composition_built",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { opKinds, targetKinds, strength, styleProfile, path: "decorate_local" },
                });
              },
              emitContrastGuardEvaluated: ({ requestId, score, contrastWarnings }) => {
                void recordEduEvent({ type: "decorate_contrast_guard_evaluated", boardId: "edu_chat_panel", requestId, shareCode: shareCode ?? undefined, extra: { score, contrastWarnings, path: "decorate_local" } });
              },
              emitContrastGuardAdjusted: ({ requestId, adjustmentsApplied }) => {
                void recordEduEvent({ type: "decorate_contrast_guard_adjusted", boardId: "edu_chat_panel", requestId, shareCode: shareCode ?? undefined, extra: { adjustmentsApplied, path: "decorate_local" } });
              },
              emitStyleFallbackComposed: ({ requestId, profile, opKinds, targetKinds }) => {
                void recordEduEvent({
                  type: "decorate_style_fallback_composed",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { profile, opKinds, targetKinds, path: "decorate_local" },
                });
              },
              emitSlotResolveBlocked: ({ styleIntent, blockedResolver, reason }) => {
                void recordEduEvent({
                  type: "decorate_slot_resolve_blocked",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { styleIntent, blockedResolver, reason, path: "decorate_local" },
                });
              },
              emitHtmlMutationBlocked: ({ styleIntent, reason }) => {
                void recordEduEvent({
                  type: "decorate_html_mutation_blocked_for_intent",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { styleIntent, reason, path: "decorate_local" },
                });
              },
              emitBackgroundFallbackSelected: ({ targetKind, styleIntent, colors, gradient, contrastAdjusted }) => {
                void recordEduEvent({
                  type: "decorate_background_fallback_selected",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { targetKind, styleIntent, colors, gradient, contrastAdjusted, path: "decorate_local" },
                });
              },
              emitSurfaceTargetResolved: ({ targetType, selector, confidence, reason }) => {
                void recordEduEvent({
                  type: "decorate_surface_target_resolved",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { targetType, selector, confidence, reason, path: "decorate_local" },
                });
              },
              emitIntentMatchEvaluated: ({ primaryIntent, styleIntent, intentMatched, mismatchKinds, surfaceStyleChanged, htmlOnlyMutation }) => {
                void recordEduEvent({
                  type: "decorate_intent_match_evaluated",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { primaryIntent, styleIntent, intentMatched, mismatchKinds, surfaceStyleChanged, htmlOnlyMutation, path: "decorate_local" },
                });
              },
              emitStudentPreviewSummaryBuilt: ({ requestId, summaryKind, majorTargets, intentMatched }) => {
                void recordEduEvent({
                  type: "decorate_student_preview_summary_built",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { summaryKind, majorTargets, intentMatched, path: "decorate_local" },
                });
              },
              emitSummaryBuilt: ({ opKinds, styleProfile, summaryKind, intentMatched, semanticKindsMentioned, summaryAudienceStyle, multiSection }) => {
                void recordEduEvent({
                  type: "decorate_summary_built",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { styleProfile: styleProfile ?? null, opKinds, summaryKind, intentMatched, semanticKindsMentioned: semanticKindsMentioned ?? [], summaryAudienceStyle: summaryAudienceStyle ?? null, multiSection: Boolean(multiSection), path: "decorate_local" },
                });
              },
              emitStudentPromptInterpreted: ({ requestId, normalizedPromptClass, primaryIntent, styleIntent, confidence }) => {
                void recordEduEvent({
                  type: "decorate_student_prompt_interpreted",
                  boardId: "edu_chat_panel",
                  requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { normalizedPromptClass, primaryIntent, styleIntent, confidence, path: "decorate_local" },
                });
              },
              emitIntentRouted: (intent) => {
                void recordEduEvent({
                  type: "decorate_intent_routed",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: {
                    primaryIntent: intent.primaryIntent,
                    confidence: intent.confidence,
                    ambiguous: intent.isAmbiguous,
                    hasColorIntent: intent.colors.length > 0,
                    hasToneIntent: intent.tone.length > 0,
                    hasImageIntent: intent.imageTargets.length > 0,
                    hasRewriteIntent: intent.rewriteTargets.length > 0,
                    hasEmphasisIntent: intent.emphasisTargets.length > 0,
                    path: "decorate_local",
                  },
                });
              },
              emitFallbackIntentExtracted: (intent) => {
                void recordEduEvent({
                  type: "decorate_fallback_intent_extracted",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { ...intent, path: "decorate_local" },
                });
              },
              emitPlanSource: ({ source, stage, latencyMs, ok, status, reason }) => {
                if (stage === "end" && ok) {
                  lastPlanSource = source;
                  if (source === "deterministic") {
                    void recordEduEvent({ type: "decorate_fallback_shaped", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { shapingKinds: ["history_aware_fallback"], historyConfidence: historyContext.historyConfidence, path: "decorate_local" } });
                  }
                }
                if (source === "server_llm" && stage === "end" && !ok) {
                  serverPlanFailureReason = reason ?? "unknown";
                }
                if (source === "local_llm" && stage === "start") {
                  controllerContext?.setPhase("webllm_kickoff");
                  void recordEduEvent({
                    type: "decorate_phase_transition",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { phase: "webllm_kickoff_started", path: "decorate_local" },
                  });
                  void recordEduEvent({
                    type: "decorate_webllm_handoff_started",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { initialProvider: "openai", nextProvider: "webllm", path: "decorate_local" },
                  });
                  void recordEduEvent({
                    type: "decorate_webllm_attempt_started",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { provider: "webllm", status: "started", path: "decorate_local" },
                  });
                }
                if (source === "local_llm" && stage === "end" && ok) {
                  void recordEduEvent({
                    type: "decorate_webllm_attempt_completed",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { provider: "webllm", status: "completed", latencyMs, reason: null, path: "decorate_local" },
                  });
                  void recordEduEvent({
                    type: "decorate_webllm_handoff_completed",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { latencyMs, path: "decorate_local" },
                  });
                }
                if (source === "local_llm" && stage === "end" && !ok) {
                  void recordEduEvent({
                    type: "decorate_webllm_attempt_failed",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { provider: "webllm", status: "failed", latencyMs, reason: reason ?? "unknown", path: "decorate_local" },
                  });
                  if ((reason ?? "").includes("timeout") || (reason ?? "") === "abort") {
                    void recordEduEvent({
                      type: "decorate_webllm_handoff_timed_out",
                      boardId: "edu_chat_panel",
                      requestId: localRequestId,
                      shareCode: shareCode ?? undefined,
                      extra: { latencyMs, reason: reason ?? "unknown", path: "decorate_local" },
                    });
                  }
                }
                if (source === "deterministic" && stage === "start") {
                  void recordEduEvent({
                    type: "decorate_dispatch_deterministic_started",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { reason: reason ?? null, path: "decorate_local" },
                  });
                  void recordEduEvent({
                    type: "decorate_fallback_attempt_started",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { provider: "deterministic", status: "started", reason: reason ?? null, path: "decorate_local" },
                  });
                }
                if (source === "deterministic" && stage === "end") {
                  void recordEduEvent({
                    type: "decorate_fallback_attempt_completed",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { provider: "deterministic", status: ok ? "completed" : "failed", latencyMs, reason: reason ?? null, path: "decorate_local" },
                  });
                }
                void recordEduEvent({
                  type: "decorate_plan_source",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { source, stage: stage ?? "end", latencyMs, ok, status: status ?? null, reason: reason ?? null, path: "decorate_local" },
                });
              },
              emitPlanValidation: ({ source, schemaValid, semanticallyUseful, repairable, recommendedAction, issues, intentMatched, mismatchKinds }) => {
                lastPlanRecommendedAction = recommendedAction;
                void recordEduEvent({
                  type: "decorate_plan_validation",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: {
                    source,
                    schemaValid,
                    semanticallyUseful,
                    repairable,
                    recommendedAction,
                    issueCount: issues.length,
                    issueKinds: issues,
                    intentMatched: intentMatched ?? null,
                    mismatchKinds: mismatchKinds ?? [],
                    path: "decorate_local",
                  },
                });
                if (source === "server_llm" || source === "cache") {
                  void recordEduEvent({
                    type: "decorate_openai_response_quality_evaluated",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: {
                      source,
                      schemaValid,
                      semanticallyUseful,
                      recommendedAction,
                      issueCount: issues.length,
                      intentMatched: intentMatched ?? null,
                      mismatchKinds: mismatchKinds ?? [],
                      path: "decorate_local",
                    },
                  });
                }
              },
              emitCandidateComparison: ({ serverScore, fallbackScore, chosenSource, reason, intentMatchScore, surfaceStyleScore, htmlOnlyPenalty, contrastSafetyScore, accentCoverageScore, overMutationPenalty, semanticCoherenceScore, chosenReason }) => {
                void recordEduEvent({
                  type: "decorate_candidate_comparison",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { serverScore, fallbackScore, chosenSource, reason, intentMatchScore: intentMatchScore ?? null, surfaceStyleScore: surfaceStyleScore ?? null, htmlOnlyPenalty: htmlOnlyPenalty ?? null, contrastSafetyScore: contrastSafetyScore ?? null, accentCoverageScore: accentCoverageScore ?? null, overMutationPenalty: overMutationPenalty ?? null, semanticCoherenceScore: semanticCoherenceScore ?? null, chosenReason: chosenReason ?? reason, path: "decorate_local" },
                });
              },
              requestServerPlan: async ({ prompt, snapshotVersion, slotFingerprint, slotHints, changedNodesCount, intentSummary, shapedPlan, historyConfidence, signal }) => {
                void recordEduEvent({
                  type: "decorate_dispatch_network_started",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { provider: "openai", path: "decorate_local" },
                });
                void recordEduEvent({ type: "decorate_phase_transition", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { phase: "server_kickoff_started", path: "decorate_local" } });
                void recordEduEvent({
                  type: "decorate_openai_attempt_started",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { provider: "openai", status: "started", path: "decorate_local" },
                });
                if (controllerContext?.shouldFallbackImmediately()) {
                  console.info("[decorate] fallback start", { requestId: localRequestId, reason: "server_start_timeout" });
                  void recordEduEvent({
                    type: "decorate_hard_fallback_forced",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { reason: "server_start_timeout", path: "decorate_local" },
                  });
                  void recordEduEvent({
                    type: "decorate_fallback_start",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { reason: "server_start_timeout", path: "decorate_local" },
                  });
                  console.info("[decorate] fallback end", { requestId: localRequestId, reason: "server_start_timeout" });
                  void recordEduEvent({
                    type: "decorate_fallback_end",
                    boardId: "edu_chat_panel",
                    requestId: localRequestId,
                    shareCode: shareCode ?? undefined,
                    extra: { reason: "server_start_timeout", path: "decorate_local" },
                  });
                  return { ok: false as const, reason: "server_start_timeout", status: 408 };
                }
                const timeoutController = new AbortController();
                const timeoutId = window.setTimeout(() => {
                  timeoutController.abort({ abortReason: "timeout", phase: "decorate.serverPlan" });
                }, 6_000);
                const combinedSignal = mergeAbortSignals([signal, timeoutController.signal]);
                decorateServerPlanStartedRef.current = true;
                controllerContext?.markServerPlanStart();
                if (decorateInvariantTimerRef.current) {
                  window.clearTimeout(decorateInvariantTimerRef.current);
                  decorateInvariantTimerRef.current = null;
                }
                console.info("[decorate] openai start", { requestId: localRequestId });
                try {
                  const result = await requestServerDecoratePlan({
                    prompt,
                    snapshotVersion,
                    slotFingerprint,
                    slotHints,
                    changedNodesCount,
                    intentSummary,
                    priorQualityScore: null,
                    lowImpactRisk: intentSummary?.isAmbiguous ?? false,
                    shapedPlan,
                    historyConfidence,
                    onPayloadBuilt: ({ primaryIntent, confidence, ambiguous, includedHintKinds, stabilityPreference, historyConfidence }) => {
                      void recordEduEvent({
                        type: "decorate_server_payload_built",
                        boardId: "edu_chat_panel",
                        requestId: localRequestId,
                        shareCode: shareCode ?? undefined,
                        extra: { primaryIntent, confidence, ambiguous, includedHintKinds, stabilityPreference, historyConfidence, path: "decorate_local" },
                      });
                      void recordEduEvent({
                        type: "decorate_server_payload_shaped",
                        boardId: "edu_chat_panel",
                        requestId: localRequestId,
                        shareCode: shareCode ?? undefined,
                        extra: { includedShapingKinds: includedHintKinds.filter((kind) => kind.includes("shaped") || kind.includes("intent")), historyConfidence, stabilityPreference, path: "decorate_local" },
                      });
                      void recordEduEvent({
                        type: "decorate_openai_payload_tuned",
                        boardId: "edu_chat_panel",
                        requestId: localRequestId,
                        shareCode: shareCode ?? undefined,
                        extra: { primaryIntent, confidence, ambiguous, includedHintKinds, stabilityPreference, historyConfidence, path: "decorate_local" },
                      });
                    },
                    joinToken: decorateJoinToken,
                    signal: combinedSignal,
                  });
                  console.info("[decorate] openai end", {
                    requestId: localRequestId,
                    ok: result.ok,
                    status: result.status ?? null,
                    reason: result.ok ? null : result.reason,
                    latencyMs: result.latencyMs,
                  });
                  if (result.ok) {
                    void recordEduEvent({
                      type: "decorate_openai_attempt_completed",
                      boardId: "edu_chat_panel",
                      requestId: localRequestId,
                      shareCode: shareCode ?? undefined,
                      extra: { provider: "openai", status: "completed", latencyMs: result.latencyMs, reason: null, path: "decorate_local" },
                    });
                  } else {
                    void recordEduEvent({
                      type: "decorate_openai_attempt_failed",
                      boardId: "edu_chat_panel",
                      requestId: localRequestId,
                      shareCode: shareCode ?? undefined,
                      extra: { provider: "openai", status: "failed", latencyMs: result.latencyMs, reason: result.reason, path: "decorate_local" },
                    });
                  }
                  controllerContext?.markServerPlanEnd();
                  if (!result.ok) {
                    void recordEduEvent({ type: "decorate_phase_transition", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { phase: "fallback_kickoff_started", path: "decorate_local" } });
                    console.info("[decorate] fallback start", { requestId: localRequestId, reason: result.reason });
                    void recordEduEvent({
                      type: "decorate_fallback_start",
                      boardId: "edu_chat_panel",
                      requestId: localRequestId,
                      shareCode: shareCode ?? undefined,
                      extra: { reason: result.reason ?? "openai_failed", path: "decorate_local" },
                    });
                  }
                  return result;
                } finally {
                  window.clearTimeout(timeoutId);
                }
              },
              localPlanEnabled,
              changedNodesHint: 0,
              onGuardrail: ({ reason, source }) => {
                void recordEduEvent({
                  type: "decorate_guardrail",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { reason, slotResolveSource: source, path: "decorate_local" },
                });
              },
              startWebLLM: decorateStartWebLLM,
              decorateMode,
            });
            syncDecorateDebugMetrics();

            if (!flow.ok) {
              if (flow.reason === "slot_not_found") {
                setManualFallbackReason("slot_choice");
                return { applied: false as const, reason: "slot_choice" as const };
              }
              if (flow.reason === "json_unrecoverable" || flow.reason === "engine") {
                void recordEduEvent({
                  type: "decorate_guardrail",
                  boardId: "edu_chat_panel",
                  requestId: localRequestId,
                  shareCode: shareCode ?? undefined,
                  extra: { reason: "decorate_noop", path: "decorate_local" },
                });
                showFastApplyNotice("적용할 변경이 없어요");
              }
              void recordEduEvent({
                type: "decorate_last_safe_path_forced",
                boardId: "edu_chat_panel",
                requestId: localRequestId,
                shareCode: shareCode ?? undefined,
                extra: { reason: flow.reason, path: "decorate_local" },
              });
              await applyManualFallbackTemplateRef.current?.();
              showFastApplyNotice("완성 결과를 기본 모드로 준비했어요.");
              return { applied: true as const };
            }

            if (lastPlanSource === "server_llm") {
              void recordEduEvent({
                type: "decorate_webllm_skipped",
                boardId: "edu_chat_panel",
                requestId: localRequestId,
                shareCode: shareCode ?? undefined,
                extra: { provider: "webllm", status: "skipped", reason: "openai_succeeded", path: "decorate_local" },
              });
            }
            if (lastPlanSource === "deterministic") {
              const fallbackReason = serverPlanFailureReason || "server_timeout";
              console.info("[decorate] fallback end", { requestId: localRequestId, reason: fallbackReason });
              void recordEduEvent({
                type: "decorate_fallback_end",
                boardId: "edu_chat_panel",
                requestId: localRequestId,
                shareCode: shareCode ?? undefined,
                extra: { reason: fallbackReason, path: "decorate_local" },
              });
              showDecorateProgressCopy(localRequestId, "fallback_kickoff", "조금 더 빠른 방식으로 미리보기를 만들고 있어요.");
            }
            console.info("[decorate] resultReady", flow.resultReady);
            setDecorateResultReadyState({
              mode: flow.mode,
              summary: flow.resultReady.summary,
              opsCount: flow.resultReady.opsCount,
              selector: flow.resultReady.selector,
              htmlSnippetLen: flow.resultReady.htmlSnippet.length,
              degraded: flow.applyResult.degradedExternalImage,
              changedNodes: flow.applyResult.changedNodes.slice(0, 3),
            });
            lastDecorateFinishedAtRef.current = Date.now();
            void recordEduEvent({
              type: "decorate_result_ready_ui",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                mode: flow.mode,
                summary: flow.resultReady.summary,
                opsCount: flow.resultReady.opsCount,
                selector: flow.resultReady.selector,
                path: "decorate_local",
              },
            });

            const beforeApply = await getCommittedEditorHtml();
            const htmlHashBefore = hashCode(beforeApply.html);
            const snapshotVersion = beforeApply.snapshotVersion;
            void recordEduEvent({
              type: "decorate_apply_start",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: { htmlHashBefore, snapshotVersion, mode: flow.mode, path: "decorate_local" },
            });

            if (!flow.applyResult.matched) {
              void recordEduEvent({
                type: "decorate_apply_failure",
                boardId: "edu_chat_panel",
                requestId: metrics.requestId,
                shareCode: shareCode ?? undefined,
                extra: {
                  reason: "APPLY_SELECTOR_MISMATCH",
                  planSummary: flow.plan.summary,
                  applyTarget: `slot:${flow.slot.selector}`,
                  htmlHashBefore,
                  path: "decorate_local",
                },
              });
              showFastApplyNotice("적용할 변경이 없어요(셀렉터 불일치)");
              return { applied: false as const, reason: "slot_target_missing" as const };
            }

            if (!flow.applyResult.changed) {
              void recordEduEvent({
                type: "decorate_apply_failure",
                boardId: "edu_chat_panel",
                requestId: metrics.requestId,
                shareCode: shareCode ?? undefined,
                extra: {
                  reason: "APPLY_NO_CHANGE",
                  planSummary: flow.plan.summary,
                  applyTarget: `slot:${flow.slot.selector}`,
                  htmlHashBefore,
                  path: "decorate_local",
                },
              });
              showFastApplyNotice("적용할 변경이 없어요(셀렉터 불일치/결과 없음)");
              return { applied: false as const, reason: "no_change" as const };
            }

            const degradedExternalImage = flow.applyResult.degradedExternalImage;
            if (degradedExternalImage) {
              void recordEduEvent({
                type: "decorate_apply_degraded",
                boardId: "edu_chat_panel",
                requestId: metrics.requestId,
                shareCode: shareCode ?? undefined,
                extra: { reason: "external_image_url_blocked", planSummary: flow.plan.summary, path: "decorate_local" },
              });
            }

            if (hasDisallowedImageSource(flow.nextHtml)) {
              void recordEduEvent({ type: "decorate_last_safe_path_forced", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { reason: "abort", path: "decorate_local" } });
              await applyManualFallbackTemplateRef.current?.();
              showFastApplyNotice("완성 결과를 기본 모드로 준비했어요.");
              return { applied: true as const };
            }

            const styleIntent = classifyDecorateStyleIntent({ prompt: decoratePrompt, intent: routedIntent });
            const previewQuality = evaluateDecoratePreviewQuality({
              beforeHtml: beforeApply.html,
              nextHtml: flow.nextHtml,
              changedFiles: 1,
              prompt: decoratePrompt,
              plan: flow.plan,
              styleIntent: styleIntent.styleIntent,
            });
            void recordEduEvent({
              type: "decorate_preview_quality",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                source: lastPlanSource,
                changedFiles: previewQuality.changedFiles,
                htmlChanged: previewQuality.htmlChanged,
                estimatedMutationCount: previewQuality.estimatedMutationCount,
                lowImpactPreview: previewQuality.lowImpactPreview,
                styleMutationCount: previewQuality.styleMutationCount,
                textMutationCount: previewQuality.textMutationCount,
                imageIntentCount: previewQuality.imageIntentCount,
                intentMismatch: previewQuality.intentMismatch,
                mismatchKinds: previewQuality.mismatchKinds,
                path: "decorate_local",
              },
            });
            void recordEduEvent({
              type: "decorate_student_first_preview_quality",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                source: lastPlanSource,
                qualityScore: previewQuality.qualityScore,
                lowImpactPreview: previewQuality.lowImpactPreview,
                intentMismatch: previewQuality.intentMismatch,
                path: "decorate_local",
              },
            });
            let previewHtml = flow.nextHtml;
            const initialProvider =
              lastPlanSource === "server_llm"
                ? "openai"
                : lastPlanSource === "local_llm"
                  ? "webllm"
                  : "deterministic";
            const openaiHardening = initialProvider === "openai"
              ? hardenOpenaiResponseQuality({ quality: previewQuality, intent: routedIntent })
              : null;
            if (openaiHardening) {
              void recordEduEvent({ type: "decorate_openai_response_hardened", boardId: "edu_chat_panel", requestId: metrics.requestId, shareCode: shareCode ?? undefined, extra: { requestId: metrics.requestId, semanticUseful: openaiHardening.semanticUseful, studentVisibleChange: openaiHardening.studentVisibleChange, intentMatched: openaiHardening.intentMatched, recommendedAction: openaiHardening.recommendedAction, path: "decorate_local" } });
            }
            const recovery = decideStudentCoachRecovery({
              initialProvider,
              quality: previewQuality,
              hasDeterministicBudget: true,
              intent: routedIntent,
            });
            if (previewQuality.lowImpactPreview || !previewQuality.studentVisibleChange) {
              void recordEduEvent({ type: "decorate_student_weak_preview_detected", boardId: "edu_chat_panel", requestId: metrics.requestId, shareCode: shareCode ?? undefined, extra: { requestId: metrics.requestId, source: initialProvider, reasons: [previewQuality.lowImpactPreview ? "low_impact_preview" : null, previewQuality.studentVisibleChange ? null : "student_visible_change_low", previewQuality.intentMismatch ? "intent_mismatch" : null].filter(Boolean), visibleTargetKinds: previewQuality.visibleTargetKinds, path: "decorate_local" } });
            }
            void recordEduEvent({ type: "decorate_fallback_quality_floor_checked", boardId: "edu_chat_panel", requestId: metrics.requestId, shareCode: shareCode ?? undefined, extra: { source: initialProvider, lowImpactPreview: previewQuality.lowImpactPreview, studentVisibleChange: previewQuality.studentVisibleChange, path: "decorate_local" } });
            void recordEduEvent({
              type: "decorate_student_recovery_decision",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                requestId: metrics.requestId,
                initialProvider,
                quality: previewQuality.qualityScore,
                decision: recovery.decision,
                reason: recovery.reason,
                path: "decorate_local",
              },
            });
            let acceptedSource: "openai" | "openai_enriched" | "fallback_deterministic" | "webllm" | "deterministic" =
              initialProvider === "openai" ? "openai" : initialProvider === "webllm" ? "webllm" : "deterministic";
            if (recovery.decision === "enrich_openai" || recovery.decision === "enrich_webllm" || recovery.decision === "fallback_deterministic") {
              const enriched = autoEnrichLowImpactPreview({ nextHtml: flow.nextHtml, intent: routedIntent });
              if (enriched.applied) {
                previewHtml = enriched.nextHtml;
                if (initialProvider === "openai") acceptedSource = "openai_enriched";
                void recordEduEvent({
                  type: "decorate_student_preview_enriched",
                  boardId: "edu_chat_panel",
                  requestId: metrics.requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { initialProvider, decision: recovery.decision, reason: enriched.reason, path: "decorate_local" },
                });
                showFastApplyNotice("미리보기를 더 또렷하게 다듬었어요.");
              } else {
                void recordEduEvent({
                  type: "decorate_student_preview_left_weak",
                  boardId: "edu_chat_panel",
                  requestId: metrics.requestId,
                  shareCode: shareCode ?? undefined,
                  extra: { initialProvider, decision: recovery.decision, reason: enriched.reason, path: "decorate_local" },
                });
              }
            } else if (previewQuality.lowImpactPreview) {
              void recordEduEvent({
                type: "decorate_student_preview_left_weak",
                boardId: "edu_chat_panel",
                requestId: metrics.requestId,
                shareCode: shareCode ?? undefined,
                extra: { initialProvider, decision: recovery.decision, reason: recovery.reason, path: "decorate_local" },
              });
            }

            if (initialProvider === "openai" && openaiHardening) {
              const floorRaised = raiseFallbackQualityFloor({ nextHtml: flow.nextHtml, intent: routedIntent, styleIntent: styleIntent.styleIntent });
              const fallbackQuality = floorRaised.raised ? Math.min(1, previewQuality.qualityScore + 0.22) : previewQuality.qualityScore;
              const acceptance = decideAcceptedStudentResult({ openaiQuality: previewQuality.qualityScore, fallbackQuality, openaiPatchable: openaiHardening.recommendedAction === "enrich", openaiStrong: openaiHardening.semanticUseful && openaiHardening.studentVisibleChange && openaiHardening.intentMatched });
              if (acceptance.chosenSource === "fallback_deterministic" && floorRaised.raised) {
                previewHtml = floorRaised.nextHtml;
                acceptedSource = "fallback_deterministic";
                void recordEduEvent({ type: "decorate_fallback_quality_floor_raised", boardId: "edu_chat_panel", requestId: metrics.requestId, shareCode: shareCode ?? undefined, extra: { reasons: floorRaised.reasons, source: initialProvider, path: "decorate_local" } });
              }
              void recordEduEvent({ type: "decorate_student_result_acceptance_decided", boardId: "edu_chat_panel", requestId: metrics.requestId, shareCode: shareCode ?? undefined, extra: { requestId: metrics.requestId, openaiQuality: previewQuality.qualityScore, fallbackQuality, chosenSource: acceptance.chosenSource, reason: acceptance.reason, path: "decorate_local" } });
            }
            if (initialProvider === "deterministic") {
              const floorRaised = raiseFallbackQualityFloor({ nextHtml: previewHtml, intent: routedIntent, styleIntent: styleIntent.styleIntent });
              if (floorRaised.raised) {
                previewHtml = floorRaised.nextHtml;
                void recordEduEvent({ type: "decorate_fallback_quality_floor_raised", boardId: "edu_chat_panel", requestId: metrics.requestId, shareCode: shareCode ?? undefined, extra: { reasons: floorRaised.reasons, source: initialProvider, path: "decorate_local" } });
              }
            }

            const previewEnriched = previewHtml !== flow.nextHtml;
            const previewSource = acceptedSource === "fallback_deterministic" ? "deterministic" : lastPlanSource === "deterministic" ? "deterministic" : lastPlanSource === "local_llm" ? "local_llm" : "server_llm";
            const normalizedPreviewMode: "llm" | "deterministic" = previewSource === "deterministic" ? "deterministic" : "llm";
            const majorTargets = inferStudentMajorTargetsFromPlan(flow.plan);
            const outcomeSummary = buildStudentOutcomeSummary({
              majorTargets,
              lowImpactPreview: previewQuality.lowImpactPreview,
            });
            const confidenceLine = buildStudentResultConfidenceLine({ majorTargets, lowImpactPreview: previewQuality.lowImpactPreview });
            const summaryOverstated = !previewQuality.studentVisibleChange && !outcomeSummary.includes("조금");
            void recordEduEvent({ type: "decorate_student_summary_honesty_checked", boardId: "edu_chat_panel", requestId: metrics.requestId, shareCode: shareCode ?? undefined, extra: { requestId: metrics.requestId, summaryKind: majorTargets.join("_") || "general", opKinds: flow.plan.ops.map((op) => op.op), intentMatched: !previewQuality.intentMismatch, overstated: summaryOverstated, path: "decorate_local" } });
            void recordEduEvent({
              type: "decorate_student_summary_quality_checked",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                source: previewSource,
                lowImpactPreview: previewQuality.lowImpactPreview,
                summary: outcomeSummary,
                majorTargets,
                path: "decorate_local",
              },
            });
            setDecorateResultReadyState({
              mode: normalizedPreviewMode,
              summary: outcomeSummary,
              opsCount: flow.resultReady.opsCount,
              selector: flow.resultReady.selector,
              htmlSnippetLen: flow.resultReady.htmlSnippet.length,
              degraded: flow.applyResult.degradedExternalImage,
              changedNodes: flow.applyResult.changedNodes.slice(0, 3),
              confidenceLine,
            });
            const promptHash = hashDecoratePrompt(decoratePrompt);
            const previewOutcome = scoreDecorateOutcome({
              previewQuality: previewQuality.qualityScore,
              lowImpactPreview: previewQuality.lowImpactPreview,
              usedFallback: previewSource === "deterministic",
              usedEnrich: previewEnriched,
              applySucceeded: false,
              applyBlocked: false,
              consistencyClass: "consistent",
              staleRisk: routedIntent.isAmbiguous ? "medium" : "low",
            });
            decoratePendingApplyRef.current = {
              nextHtml: previewHtml,
              mode: normalizedPreviewMode,
              requestId: metrics.requestId,
              summary: outcomeSummary,
              source: previewSource,
              fallbackReason: lastPlanSource === "deterministic" ? (serverPlanFailureReason || "server_timeout") : null,
              baseSnapshotVersion: snapshotVersion,
              baseHtmlHash: htmlHashBefore,
              previewHtmlHash: hashCode(previewHtml),
              changedFiles: 1,
              mutationSummary: {
                estimatedMutationCount: previewQuality.estimatedMutationCount,
                styleMutationCount: previewQuality.styleMutationCount,
                textMutationCount: previewQuality.textMutationCount,
                imageIntentCount: previewQuality.imageIntentCount,
                lowImpactPreview: previewQuality.lowImpactPreview,
                qualityScore: previewQuality.qualityScore,
              },
              createdAt: Date.now(),
              promptLen: decoratePrompt.length,
              promptHash,
              primaryIntent: routedIntent.primaryIntent,
              confidence: routedIntent.confidence,
              ambiguous: routedIntent.isAmbiguous,
              previewEnriched,
              recoveryDecision: recovery.decision,
              sourceAttempted: ["server_llm", "local_llm", "deterministic"],
              outcomeScore: previewOutcome.score,
              outcomeBucket: previewOutcome.bucket,
              consistencyClass: "consistent",
              handoff: {
                requestId: metrics.requestId,
                source: previewSource,
                createdAt: Date.now(),
                baseSnapshotVersion: snapshotVersion,
                baseHtmlHash: htmlHashBefore,
                previewHash: hashCode(previewHtml),
                qualityScore: previewQuality.qualityScore,
                outcomeHint: previewOutcome.bucket,
                invalidationRisk: routedIntent.isAmbiguous || previewQuality.lowImpactPreview ? "medium" : "low",
                applyEligibility: true,
              },
              exampleOrigin: studentDecorateExampleOriginRef.current
                ? {
                    lessonAware: studentDecorateExampleOriginRef.current.lessonAware,
                    exampleKind: studentDecorateExampleOriginRef.current.kind,
                    promptClass: studentDecorateExampleOriginRef.current.promptClass,
                    exampleIndex: studentDecorateExampleOriginRef.current.index,
                    lessonId: resolvedLessonId,
                    isFreeMode: isFreeModeLesson,
                  }
                : null,
            };
            appendDecorateRecentEvent({
              requestId: metrics.requestId,
              intent: routedIntent.primaryIntent,
              tone: routedIntent.tone,
              colors: routedIntent.colors,
              emphasis: routedIntent.emphasisTargets,
              source: previewSource,
              applied: false,
              weakChange: previewQuality.lowImpactPreview,
            });
            void recordEduEvent({
              type: "decorate_outcome_scored",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                score: previewOutcome.score,
                bucket: previewOutcome.bucket,
                primaryIntent: routedIntent.primaryIntent,
                finalSource: previewSource,
                recommendedFollowup: previewOutcome.recommendedFollowup,
                path: "decorate_local",
              },
            });
            const storeDecision = shouldCacheDecoratePreview({
              qualityScore: previewQuality.qualityScore,
              lowImpactPreview: previewQuality.lowImpactPreview,
              enriched: previewEnriched,
              invalidated: false,
              ambiguous: routedIntent.isAmbiguous,
              outcomeScore: previewOutcome.score,
              outcomeBucket: previewOutcome.bucket,
              planRecommendedAction: lastPlanRecommendedAction,
              staleRisk: routedIntent.isAmbiguous ? "medium" : "low",
            });
            const satisfactionProxy = previewOutcome.bucket === "excellent" || previewOutcome.bucket === "good" ? "positive" : previewOutcome.bucket === "weak" || previewOutcome.bucket === "failed" ? "negative" : "neutral";
            void recordEduEvent({
              type: "decorate_preview_cache_satisfaction_gate",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: { cacheDecision: storeDecision.ok ? "store" : "skip", satisfactionProxy, ttlBucket: routedIntent.isAmbiguous ? "short" : "normal", path: "decorate_local" },
            });
            void recordEduEvent({
              type: "decorate_preview_cache_quality_gate",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                cacheable: storeDecision.ok,
                reason: storeDecision.reason,
                outcomeBucket: previewOutcome.bucket,
                planRecommendedAction: lastPlanRecommendedAction,
                path: "decorate_local",
              },
            });
            const storeKey = buildDecorateCacheKey({
              prompt: decoratePrompt,
              baseSnapshotVersion: snapshotVersion,
              baseHtmlHash: htmlHashBefore,
              intent: { primaryIntent: routedIntent.primaryIntent, isAmbiguous: routedIntent.isAmbiguous },
            });
            if (storeDecision.ok) {
              const ttlMs = getDecorateCacheTtlMs({ ambiguous: routedIntent.isAmbiguous });
              decoratePreviewCacheRef.current.set({
                key: storeKey,
                requestId: metrics.requestId,
                promptHash,
                primaryIntent: routedIntent.primaryIntent,
                confidence: routedIntent.confidence,
                ambiguous: routedIntent.isAmbiguous,
                previewHtml,
                previewHtmlHash: hashCode(previewHtml),
                qualityScore: previewQuality.qualityScore,
                lowImpactPreview: previewQuality.lowImpactPreview,
                enriched: previewEnriched,
                source: previewSource,
                fallbackReason: lastPlanSource === "deterministic" ? (serverPlanFailureReason || "server_timeout") : null,
                mutationCount: previewQuality.estimatedMutationCount,
                changedFiles: 1,
                baseSnapshotVersion: snapshotVersion,
                baseHtmlHash: htmlHashBefore,
                createdAt: Date.now(),
                ttlMs,
              });
              void recordEduEvent({ type: "decorate_preview_cache_store", boardId: "edu_chat_panel", requestId: metrics.requestId, shareCode: shareCode ?? undefined, extra: { ttlMs, qualityScore: previewQuality.qualityScore, lowImpactPreview: previewQuality.lowImpactPreview, enriched: previewEnriched, path: "decorate_local" } });
            } else {
              void recordEduEvent({ type: "decorate_preview_cache_store_skipped", boardId: "edu_chat_panel", requestId: metrics.requestId, shareCode: shareCode ?? undefined, extra: { reason: storeDecision.reason, qualityScore: previewQuality.qualityScore, lowImpactPreview: previewQuality.lowImpactPreview, enriched: previewEnriched, path: "decorate_local" } });
            }
            const debugSummary = buildDecorateDebugSummary({
              requestId: metrics.requestId,
              promptLen: decoratePrompt.length,
              promptHash,
              intent: { primaryIntent: routedIntent.primaryIntent, confidence: routedIntent.confidence, isAmbiguous: routedIntent.isAmbiguous },
              source: previewSource,
              fallbackReason: serverPlanFailureReason,
              qualityScore: previewQuality.qualityScore,
              lowImpact: previewQuality.lowImpactPreview,
              enriched: previewEnriched,
              decision: previewQuality.lowImpactPreview ? "recovery_checked" : null,
              pending: true,
              baseSnapshotVersion: snapshotVersion,
              baseHtmlHash: htmlHashBefore,
            });
            console.info("[decorate] summary", debugSummary);
            void recordEduEvent({ type: "decorate_tuning_signal", boardId: "edu_chat_panel", requestId: metrics.requestId, shareCode: shareCode ?? undefined, extra: { ...buildDecorateTuningSignal({ requestId: metrics.requestId, intent: routedIntent, source: previewSource, qualityScore: previewQuality.qualityScore, lowImpactPreview: previewQuality.lowImpactPreview, usedFallback: previewSource === "deterministic", usedAutoEnrich: previewEnriched, usedRecoveryDecision: previewQuality.lowImpactPreview, applySucceeded: false, applyBlocked: false, blockedReason: null, invalidationReason: null }), path: "decorate_local" } });
            setDecorateHasPendingApply(true);
            void recordEduEvent({
              type: "decorate_preview_handoff_ready",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                requestId: metrics.requestId,
                source: previewSource,
                createdAt: decoratePendingApplyRef.current?.handoff.createdAt ?? Date.now(),
                baseSnapshotVersion: snapshotVersion,
                baseHtmlHash: htmlHashBefore,
                previewHash: hashCode(previewHtml),
                qualityScore: previewQuality.qualityScore,
                outcomeHint: previewOutcome.bucket,
                invalidationRisk: routedIntent.isAmbiguous || previewQuality.lowImpactPreview ? "medium" : "low",
                applyEligibility: true,
                path: "decorate_local",
              },
            });
            void recordEduEvent({
              type: "decorate_phase_latency",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: { planningToPreviewReadyMs: Math.max(0, Date.now() - planningStartedAt), path: "decorate_local" },
            });
            showDecorateProgressCopy(metrics.requestId, "preview_ready", getStudentDecorateResultCopy("preview_ready"));

            void recordEduEvent({
              type: "decorate_preview_probe",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                previewHtmlHash: hashCode(previewHtml),
                matchesCommitted: false,
                mode: normalizedPreviewMode,
                path: "decorate_local",
              },
            });
            void recordEduEvent({
              type: "decorate_preview_ready",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                previewHtmlHash: hashCode(previewHtml),
                mode: normalizedPreviewMode,
                summary: outcomeSummary,
                path: "decorate_local",
              },
            });
            void recordEduEvent({
              type: "decorate_preview_state",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                previewHtmlHash: hashCode(previewHtml),
                matchesCommitted: false,
                mode: normalizedPreviewMode,
                path: "decorate_local",
              },
            });
            void recordEduEvent({
              type: "decorate_session_summary",
              boardId: "edu_chat_panel",
              requestId: metrics.requestId,
              shareCode: shareCode ?? undefined,
              extra: {
                requestId: metrics.requestId,
                promptLen: decoratePrompt.length,
                promptHash: hashDecoratePrompt(decoratePrompt),
                primaryIntent: routedIntent.primaryIntent,
                confidence: routedIntent.confidence,
                ambiguous: routedIntent.isAmbiguous,
                sourceAttempted: ["server_llm", "local_llm", "deterministic"],
                finalSource: lastPlanSource ?? "deterministic",
                serverStarted: true,
                serverCompleted: lastPlanSource === "server_llm",
                fallbackStarted: lastPlanSource === "deterministic",
                fallbackCompleted: lastPlanSource === "deterministic",
                previewReady: true,
                previewLowImpact: previewQuality.lowImpactPreview,
                previewEnriched: previewHtml !== flow.nextHtml,
                applyAttempted: false,
                applySucceeded: false,
                undoAvailable: decorateUndoStackRef.current.length > 0,
                blockedReason: null,
                invalidationReason: null,
                recoveryDecision: recovery.decision,
                totalLatencyMs: Math.max(0, Date.now() - planningStartedAt),
                planningToPreviewReadyMs: Math.max(0, Date.now() - planningStartedAt),
                previewReadyToApplyMs: null,
                qualityScore: previewQuality.qualityScore,
                outcomeScore: previewOutcome.score,
                outcomeBucket: previewOutcome.bucket,
                consistencyClass: "consistent",
                mutationCount: previewQuality.estimatedMutationCount,
                changedFiles: 1,
                path: "decorate_local",
              },
            });
            return { applied: false as const, reason: "preview_ready" as const };
          } catch (error) {
            const abortMeta = getAbortMetaFromError(error);
            if (abortMeta) {
              syncDecorateDebugMetrics();
              setDecorateAbortNotice("꾸미기를 완료하지 못했어요. 다시 시도해 주세요.");
              showFastApplyNotice("꾸미기 실패/중단");
              reportAbortTelemetry(abortMeta, localRequestId);
              void reportUiError({
                message: JSON.stringify(abortMeta),
                route: "/edu/lesson",
                requestId: localRequestId,
                abortReason: abortMeta.abortReason,
                phase: abortMeta.phase,
                timeoutMs: abortMeta.timeoutMs ?? null,
                modelId: abortMeta.modelId ?? null,
                stage: abortMeta.stage ?? null,
                retryCount: abortMeta.retryCount ?? null,
                slotCandidatesCount: abortMeta.slotCandidatesCount ?? null,
                selectedSlotId: abortMeta.selectedSlotId ?? null,
                selectedSelector: abortMeta.selectedSelector ?? null,
                slotResolveSource: abortMeta.slotResolveSource ?? null,
                htmlHashBefore: abortMeta.htmlHashBefore ?? null,
                htmlHashAfterInjection: abortMeta.htmlHashAfterInjection ?? null,
                startedAt: abortMeta.startedAt,
                usingLocalWebLLM: abortMeta.usingLocalWebLLM,
                snapshotVersion: abortMeta.snapshotVersion ?? null,
                committedHtmlHash: abortMeta.committedHtmlHash ?? null,
                commitTargetKey: abortMeta.commitTargetKey ?? null,
                previewRefreshTriggered: abortMeta.previewRefreshTriggered ?? null,
                previewHtmlHash: abortMeta.previewHtmlHash ?? null,
                previewMatchesCommitted: abortMeta.previewMatchesCommitted ?? null,
              });
              void recordEduEvent({
                type: "decorate_apply_failure",
                boardId: "edu_chat_panel",
                requestId: localRequestId,
                shareCode: shareCode ?? undefined,
                extra: { reason: "abort", phase: abortMeta.phase, abortReason: abortMeta.abortReason, path: "decorate_local" },
              });
              return { applied: false as const, reason: "no_patch" as const };
            }

            syncDecorateDebugMetrics();
            setDecorateAbortNotice("꾸미기를 완료하지 못했어요. 다시 시도해 주세요.");
            showFastApplyNotice("꾸미기 실패/중단");
            void reportUiError({
              message: error instanceof Error ? error.message : "decorate_engine_error",
              route: "/edu/lesson",
              requestId: localRequestId,
              phase: "decorate.runPatchApply",
              abortReason: "navigation",
            });
            void recordEduEvent({
              type: "decorate_apply_failure",
              boardId: "edu_chat_panel",
              requestId: localRequestId,
              shareCode: shareCode ?? undefined,
              extra: { reason: "engine", path: "decorate_local" },
            });
            void recordEduEvent({ type: "decorate_last_safe_path_forced", boardId: "edu_chat_panel", requestId: localRequestId, shareCode: shareCode ?? undefined, extra: { reason: "engine", path: "decorate_local" } });
            await applyManualFallbackTemplateRef.current?.();
            showFastApplyNotice("완성 결과를 기본 모드로 준비했어요.");
            return { applied: true as const };
          }
          },
          {
            timeoutMs,
            onTimeout: ({ startedAt: flightStartedAt }) =>
              buildAbortMetaFromDecorateMetrics(decorateMetricsRef.current, {
                abortReason: "timeout",
                phase: decorateMetricsRef.current?.stage === "slot_resolve" ? "decorate.slotResolve" : "decorate.generateJson",
                usingLocalWebLLM: effectiveWebllmEnabled,
                startedAt: flightStartedAt,
                timeoutMs,
                modelId: decorateCoachModelId ?? null,
              }),
          },
        )
        .catch((error) => {
          const abortMeta = getAbortMetaFromError(error);
          if (abortMeta) {
            setDecorateAbortNotice("꾸미기를 완료하지 못했어요. 다시 시도해 주세요.");
            showFastApplyNotice("꾸미기 실패/중단");
            reportAbortTelemetry(abortMeta, localRequestId);
            void reportUiError({
              message: JSON.stringify(abortMeta),
              route: "/edu/lesson",
              requestId: localRequestId,
              abortReason: abortMeta.abortReason,
              phase: abortMeta.phase,
              timeoutMs: abortMeta.timeoutMs ?? null,
              modelId: abortMeta.modelId ?? null,
              stage: abortMeta.stage ?? null,
              retryCount: abortMeta.retryCount ?? null,
              slotCandidatesCount: abortMeta.slotCandidatesCount ?? null,
              selectedSlotId: abortMeta.selectedSlotId ?? null,
              selectedSelector: abortMeta.selectedSelector ?? null,
              slotResolveSource: abortMeta.slotResolveSource ?? null,
              htmlHashBefore: abortMeta.htmlHashBefore ?? null,
              htmlHashAfterInjection: abortMeta.htmlHashAfterInjection ?? null,
              startedAt: abortMeta.startedAt,
              usingLocalWebLLM: abortMeta.usingLocalWebLLM,
              snapshotVersion: abortMeta.snapshotVersion ?? null,
              committedHtmlHash: abortMeta.committedHtmlHash ?? null,
              commitTargetKey: abortMeta.commitTargetKey ?? null,
              previewRefreshTriggered: abortMeta.previewRefreshTriggered ?? null,
              previewHtmlHash: abortMeta.previewHtmlHash ?? null,
              previewMatchesCommitted: abortMeta.previewMatchesCommitted ?? null,
            });
            void recordEduEvent({
              type: "decorate_apply_failure",
              boardId: "edu_chat_panel",
              requestId: localRequestId,
              shareCode: shareCode ?? undefined,
              extra: { reason: "abort", phase: abortMeta.phase, abortReason: abortMeta.abortReason, path: "decorate_local" },
            });
            return { applied: false as const, reason: "no_patch" as const };
          }

          void reportUiError({
            message: error instanceof Error ? error.message : "decorate_engine_error",
            route: "/edu/lesson",
            requestId: localRequestId,
            phase: "decorate.runPatchApply",
            abortReason: "navigation",
          });
          void recordEduEvent({
            type: "decorate_apply_failure",
            boardId: "edu_chat_panel",
            requestId: localRequestId,
            shareCode: shareCode ?? undefined,
            extra: { reason: "engine", path: "decorate_local" },
          });
          return { applied: false as const, reason: "engine" as const };
        });
      return decoratePromise.finally(() => {
        if (decorateInvariantTimerRef.current) {
          window.clearTimeout(decorateInvariantTimerRef.current);
          decorateInvariantTimerRef.current = null;
        }
        if (decorateRunIdRef.current === decorateRunId) {
          decorateInProgressRef.current = false;
          decorateCurrentPromptRef.current = "";
        }
      });
    },
    [
      currentFiles,
      isTemplateFirst,
      effectiveWebllmEnabled,
      decorateCoachModelId,
      getEffectiveWebLLMStatus,
      messages,
      getCommittedEditorHtml,
      commitDecorateHtml,
      shareCode,
      showFastApplyNotice,
      showDecorateProgressCopy,
      resolveDecorateBypassBoundary,
      setManualFallbackReason,
      reportAbortTelemetry,
      isFreeModeLesson,
      invalidateDecoratePreviewCache,
      appendDecorateRecentEvent,
      emitOutcomeLearningSignal,
      resolvedLessonId,
      decorateJoinToken,
    ],
  );

  const startDecorateViaController = useCallback(async (prompt: string) => {
    if (!decorateControllerRef.current) {
      decorateControllerRef.current = createDecorateController({
        createRequestId,
        onClick: ({ requestId, promptLen, inProgress, hasPendingPreview }) => {
          const now = performance.now();
          if (studentDecorateClickAtRef.current !== null && studentDecorateTransactionAtRef.current === null) {
            studentDecorateTransactionAtRef.current = now;
            const elapsedMs = now - studentDecorateClickAtRef.current;
            if (elapsedMs > 200) {
              console.error("[decorate] invariant violation", { missing: "pipeline_started_within_200ms", requestId, elapsedMs });
              void recordEduEvent({
                type: "decorate_pipeline_invariant_violation",
                boardId: "edu_chat_panel",
                requestId,
                shareCode: shareCode ?? undefined,
                extra: { missing: "pipeline_started_within_200ms", elapsedMs, promptLen, path: "decorate_local" },
              });
              if (isDev) {
                showFastApplyNotice("실행 시작이 지연됐어요(버그).");
              }
            }
          }
          void recordEduEvent({
            type: "decorate_transaction_started",
            boardId: "edu_chat_panel",
            requestId,
            shareCode: shareCode ?? undefined,
            extra: { promptLen, inProgress, hasPendingPreview, path: "decorate_local" },
          });
        },
        onSkip: ({ reason, promptLen, inProgress, hasPendingPreview, requestId }) => {
          console.warn("[decorate] SKIP", { reason, promptLen, inProgress, hasPendingPreview });
          void recordEduEvent({
            type: "decorate_skip",
            boardId: "edu_chat_panel",
            requestId,
            shareCode: shareCode ?? undefined,
            extra: { reason, promptLen, inProgress, hasPendingPreview, path: "decorate_local" },
          });
        },
        onSlaEvent: (event) => {
          if (event.type === "decorate_sla_breached") {
            decorateRecentSlaBreachRef.current = true;
          }
          if (event.type === "decorate_sla_recovered") {
            decorateRecentSlaBreachRef.current = false;
          }
          const extra = { ...event, path: "decorate_local" } as Record<string, unknown>;
          delete extra.type;
          void recordEduEvent({ type: event.type, boardId: "edu_chat_panel", requestId: event.requestId, shareCode: shareCode ?? undefined, extra });
        },
        onInvariantViolation: ({ requestId, promptLen, missing }) => {
          console.error("[decorate] invariant violation", { missing, requestId, promptLen });
          void recordEduEvent({
            type: "decorate_pipeline_invariant_violation",
            boardId: "edu_chat_panel",
            requestId,
            shareCode: shareCode ?? undefined,
            extra: { missing, promptLen, path: "decorate_local" },
          });
        },
        executeStart: async (prompt, context) => {
          void recordEduEvent({
            type: "decorate_pipeline_mainline_entered",
            boardId: "edu_chat_panel",
            requestId: context.requestId,
            shareCode: shareCode ?? undefined,
            extra: { promptLen: prompt.length, path: "decorate_local" },
          });
          const result = await runPatchApply(context.requestId, prompt, context);
          void recordEduEvent({
            type: "decorate_pipeline_mainline_completed",
            boardId: "edu_chat_panel",
            requestId: context.requestId,
            shareCode: shareCode ?? undefined,
            extra: {
              applied: result.applied,
              reason: result.reason ?? null,
              mode: decoratePendingApplyRef.current?.mode ?? null,
              path: "decorate_local",
            },
          });
          return {
            ok: result.reason === "preview_ready" || result.applied,
            requestId: context.requestId,
            reason: result.applied ? "applied" : "preview_ready",
            mode: decoratePendingApplyRef.current?.mode,
          };
        },
        executeRecheckPending: async (pending) => {
          const active = decoratePendingApplyRef.current;
          const eligible = Boolean(active && active.requestId === pending.requestId && active.handoff.applyEligibility);
          void recordEduEvent({
            type: "decorate_preview_handoff_rechecked",
            boardId: "edu_chat_panel",
            requestId: pending.requestId,
            shareCode: shareCode ?? undefined,
            extra: {
              eligible,
              invalidationRisk: active?.handoff.invalidationRisk ?? "high",
              baseSnapshotVersion: active?.handoff.baseSnapshotVersion ?? null,
              path: "decorate_local",
            },
          });
          if (!eligible) {
            void recordEduEvent({
              type: "decorate_preview_handoff_blocked",
              boardId: "edu_chat_panel",
              requestId: pending.requestId,
              shareCode: shareCode ?? undefined,
              extra: { reason: "handoff_not_eligible", path: "decorate_local" },
            });
          }
          return { eligible, reason: eligible ? undefined : "blocked_stale_pending" };
        },
        executeApplyPending: async (pending) => {
          void pending;
          showDecorateProgressCopy(pending.requestId, "applying", getStudentDecorateResultCopy("apply_start"));
          await applyPendingDecorate();
        },
        executeUndo: async () => {
          await runDecorateUndo();
        },
        stabilizationMs: DECORATE_COMMIT_STABILIZATION_MS,
        onCommitBarrierEvent: ({ requestId, event, phase }) => {
          if (event === "started") {
            decorateGuardWindowUntilRef.current = Date.now() + DECORATE_COMMIT_STABILIZATION_MS;
            void recordEduEvent({ type: "decorate_commit_barrier_started", boardId: "edu_chat_panel", requestId, shareCode: shareCode ?? undefined, extra: { phase, path: "decorate_local" } });
            void recordEduEvent({ type: "decorate_interference_guard_window_started", boardId: "edu_chat_panel", requestId, shareCode: shareCode ?? undefined, extra: { phase, path: "decorate_local" } });
          } else if (event === "completed") {
            decorateGuardWindowUntilRef.current = 0;
            void recordEduEvent({ type: "decorate_commit_barrier_completed", boardId: "edu_chat_panel", requestId, shareCode: shareCode ?? undefined, extra: { phase, path: "decorate_local" } });
            void recordEduEvent({ type: "decorate_interference_guard_window_ended", boardId: "edu_chat_panel", requestId, shareCode: shareCode ?? undefined, extra: { phase, path: "decorate_local" } });
          } else {
            void recordEduEvent({ type: "decorate_commit_barrier_blocked_interference", boardId: "edu_chat_panel", requestId, shareCode: shareCode ?? undefined, extra: { phase, path: "decorate_local" } });
            void recordEduEvent({ type: "decorate_post_commit_interference_blocked", boardId: "edu_chat_panel", requestId, shareCode: shareCode ?? undefined, extra: { phase, path: "decorate_local" } });
          }
        },
        onPhaseTransition: ({ phase, requestId }) => {
          if ((phase === "server_kickoff" || phase === "webllm_kickoff" || phase === "fallback_kickoff") && studentDecorateClickAtRef.current !== null && studentDecorateKickoffAtRef.current === null) {
            const now = performance.now();
            studentDecorateKickoffAtRef.current = now;
            const elapsedMs = now - studentDecorateClickAtRef.current;
            if (elapsedMs > 500) {
              void recordEduEvent({
                type: "decorate_hung_state_detected",
                boardId: "edu_chat_panel",
                requestId,
                shareCode: shareCode ?? undefined,
                extra: { stage: "kickoff", elapsedMs, path: "decorate_local" },
              });
              console.error("[decorate] invariant violation", { missing: "kickoff_within_500ms", requestId, elapsedMs, phase });
              void recordEduEvent({
                type: "decorate_pipeline_invariant_violation",
                boardId: "edu_chat_panel",
                requestId,
                shareCode: shareCode ?? undefined,
                extra: { missing: "kickoff_within_500ms", elapsedMs, phase, path: "decorate_local" },
              });
              if (isDev) {
                showFastApplyNotice("실행 시작이 늦어요(버그).");
              }
            }
          }
          setDecorateTransactionPhase(phase);
          void recordEduEvent({
            type: "decorate_status_priority_resolved",
            boardId: "edu_chat_panel",
            requestId,
            shareCode: shareCode ?? undefined,
            extra: { phase, priority: "decorate_transaction", path: "decorate_local" },
          });
        },
      });
    }
    const prewarmRequestId = createRequestId();
    queueMicrotask(() => {
      void runDecorateReliabilityPrewarm({
        requestId: prewarmRequestId,
        runStep: async (step) => {
          if (step === "snapshot_hash_readiness") {
            const base = await getCommittedEditorHtml();
            decorateBaseReadinessRef.current.snapshotReady = Boolean(base.snapshotVersion);
            decorateBaseReadinessRef.current.hashReady = Boolean(base.html);
          }
        },
        onTelemetry: (type, extra) => {
          void recordEduEvent({ type, boardId: "edu_chat_panel", requestId: prewarmRequestId, shareCode: shareCode ?? undefined, extra: { ...(extra ?? {}), path: "decorate_local" } });
        },
      }).catch((error) => {
        void recordEduEvent({
          type: "decorate_prewarm_skipped",
          boardId: "edu_chat_panel",
          requestId: prewarmRequestId,
          shareCode: shareCode ?? undefined,
          extra: {
            step: "bootstrap",
            reason: error instanceof Error ? error.message : "unknown",
            path: "decorate_local",
          },
        });
      });
    });
    return decorateControllerRef.current.startDecorate(prompt);
  }, [applyPendingDecorate, getCommittedEditorHtml, runDecorateUndo, runPatchApply, shareCode, showDecorateProgressCopy, showFastApplyNotice]);

  const runFastApply = useCallback(
    async (messageText: string, requestId?: string) => {
      const result = await applyTemplateFromRequest(messageText, requestId);
      if (result.applied) {
        showFastApplyNotice("템플릿에 적용했어요.");
      }
      return result;
    },
    [applyTemplateFromRequest, showFastApplyNotice],
  );

  const runSlotChoiceAction = useCallback(
    async (action: SlotChoiceAction) => {
      if (!currentFiles || Object.keys(currentFiles).length === 0) return false;
      const verification = verifySlotTargets({
        pageKey: resolvedLessonId,
        slot: action.slot,
        files: {
          "index.html": currentFiles["index.html"]?.content ?? "",
        },
      });
      if (!verification.ok) {
        setManualFallbackReason("slot_choice");
        showFastApplyNotice("바꿀 위치를 찾지 못했어. 다른 버튼을 눌러볼까?");
        return false;
      }
      const patched = applySlotIntent(
        {
          lessonKey: resolvedLessonId,
          userText: "",
          files: currentFiles,
          profileName,
          target: "preview",
        },
        { slot: action.slot, value: action.value, confidence: 1 },
      );
      if (!patched.changed) return false;
      await takeSnapshotIfPossible(currentFiles);
      onFilesMerged(patched.files);
      if (patched.appliedSlots.length > 0) {
        onFastApplyAppliedSlots?.(patched.appliedSlots);
      }
      await syncCurrentSnapshot(patched.files);
      scheduleAutosave(patched.files, { immediate: true });
      setIsDirty(true);
      setManualFallbackReason(null);
      setLastApplyOutcome("done");
      setPanelState("READY_TO_GENERATE");
      showFastApplyNotice("버튼으로 먼저 바꿨어!");
      return true;
    },
    [
      currentFiles,
      onFastApplyAppliedSlots,
      onFilesMerged,
      profileName,
      resolvedLessonId,
      setLastApplyOutcome,
      setManualFallbackReason,
      scheduleAutosave,
      setIsDirty,
      setPanelState,
      showFastApplyNotice,
      syncCurrentSnapshot,
      takeSnapshotIfPossible,
    ],
  );

  const runWaitingAction = useCallback(
    async (actionId: WaitingActionId) => {
      if (!currentFiles || Object.keys(currentFiles).length === 0) return false;
      const html = currentFiles["index.html"]?.content ?? "";
      const css = currentFiles["style.css"]?.content ?? "";
      const result = applyWaitingActionChangeSet(actionId, html, css);
      if (!result.ok) return false;
      const handled = await finalizeFiles(
        {
          "index.html": result.html,
          "style.css": result.css,
        },
        "버튼으로 먼저 준비했어요.",
        undefined,
        `waiting-action-${actionId}-${Date.now()}`,
      );
      if (handled.ok) {
        setWaitingActionStage("idle");
        showFastApplyNotice("바로 할 일을 추가했어요.");
        return true;
      }
      return false;
    },
    [currentFiles, finalizeFiles, showFastApplyNotice],
  );

  const clearFastFallbackTimer = useCallback(() => {
    if (fastFallbackTimerRef.current) {
      window.clearTimeout(fastFallbackTimerRef.current);
      fastFallbackTimerRef.current = null;
    }
  }, []);

  const clearDecorateSafetyTimers = useCallback(() => {
    if (decorateSlowTimerRef.current) {
      window.clearTimeout(decorateSlowTimerRef.current);
      decorateSlowTimerRef.current = null;
    }
    if (decorateHardTimeoutTimerRef.current) {
      window.clearTimeout(decorateHardTimeoutTimerRef.current);
      decorateHardTimeoutTimerRef.current = null;
    }
  }, []);

  const restoreTemplateSnapshot = useCallback(() => {
    const snapshot = templateSnapshotRef.current;
    if (snapshot) {
      onFilesMerged(snapshot);
    }
  }, [onFilesMerged]);

  const restoreTemplateSnapshotForGeneratorFallback = useCallback(() => {
    const snapshot = templateSnapshotRef.current;
    if (!snapshot || !currentFiles) return;
    if (Date.now() < decorateGuardWindowUntilRef.current) {
      void recordEduEvent({
        type: "decorate_post_commit_interference_blocked",
        boardId: "edu_chat_panel",
        requestId: decorateControllerRef.current?.getState().requestId ?? undefined,
        shareCode: shareCode ?? undefined,
        extra: { interfererKind: "generator_restore", path: "decorate_local" },
      });
      return;
    }
    const currentHtmlHash = hashCode(currentFiles["index.html"]?.content ?? "");
    const ownerSnapshotHash = lastSsotOwnerRef.current.htmlHash ?? null;
    const restoreTargets = Array.from(generatorTouchedFilesRef.current).filter((path) => path !== "index.html");
    const restoreGuard = shouldBlockGeneratorFallbackRestore({
      decorateInProgress: decorateInProgressRef.current,
      lastOwner: lastSsotOwnerRef.current.owner,
      ownerSnapshotHash,
      currentHtmlHash,
      restoreTargets,
    });
    if (restoreGuard.blocked) {
      if (restoreGuard.reason) {
        void recordEduEvent({
          type: "generator_fallback_restore_blocked",
          boardId: "edu_chat_panel",
          requestId: generatorRequestIdRef.current ?? undefined,
          shareCode: shareCode ?? undefined,
          extra: { reason: restoreGuard.reason, owner: lastSsotOwnerRef.current.owner, path: "generator_fallback" },
        });
      }
      return;
    }
    const nextFiles: Record<string, WorkspaceFile> = { ...currentFiles };
    let changed = false;
    for (const path of restoreTargets) {
      const snapshotFile = snapshot[path];
      if (!snapshotFile) continue;
      const currentContent = currentFiles[path]?.content;
      if (currentContent === snapshotFile.content) continue;
      nextFiles[path] = { ...snapshotFile };
      changed = true;
    }
    if (!changed) return;
    void recordEduEvent({
      type: "generator_fallback_restore_allowed",
      boardId: "edu_chat_panel",
      requestId: generatorRequestIdRef.current ?? undefined,
      shareCode: shareCode ?? undefined,
      extra: { restoreTargets: restoreTargets.length, path: "generator_fallback" },
    });
    markSsotOwner("generator", nextFiles);
    onFilesMerged(nextFiles);
  }, [currentFiles, markSsotOwner, onFilesMerged, shareCode]);

  const abortTemplateFirstGeneration = useCallback(
    (reason: "user" | "timeout", abortMeta?: AbortMeta | null) => {
      const resolvedAbortMeta =
        abortMeta ??
        buildAbortMetaFromDecorateMetrics(decorateMetricsRef.current, {
          abortReason: reason === "timeout" ? "timeout" : "user_cancel",
          phase: "decorate.generateJson",
          usingLocalWebLLM: effectiveWebllmEnabled,
          modelId: decorateCoachModelId ?? null,
        });
      decorateFlightRef.current.abort(resolvedAbortMeta);
      setGenRunning(false);
      setThinking(false);
      setProgressMessage("");
      setFileProgressMessage("");
      setActionPrompt(null);
      setShowDiagnostics(false);
      setCorsCopyMessage(null);
      setCorsCopyNotice(null);
      setLastGeneratorNotice(null);
      setLastCoachSanitizeFlags(null);
      setIsRewriting(false);
      setFastFallbackApplied(false);
      setFastFallbackNotice(null);
      setDecorateSlowNotice(false);
      setDecorateAbortNotice(
        reason === "timeout"
          ? "조금 더 빠른 방식으로 미리보기를 만들고 있어요."
          : "꾸미기를 완료하지 못했어요. 미리보기를 다시 만들고 있어요.",
      );
      reportAbortTelemetry(resolvedAbortMeta, generatorRequestIdRef.current);
      if (reason === "timeout") {
        safeAbortWebLLM(coachRequestIdRef.current);
        safeAbortWebLLM(generatorRequestIdRef.current);
        terminateWebLLMWorker();
      }
      setManualFallbackReason(null);
      setLastApplyOutcome(null);
      setPanelState("READY_TO_GENERATE");
      clearDecorateSafetyTimers();
      restoreTemplateSnapshot();
    },
    [
      clearDecorateSafetyTimers,
      effectiveWebllmEnabled,
      decorateCoachModelId,
      reportAbortTelemetry,
      restoreTemplateSnapshot,
      setLastApplyOutcome,
      setManualFallbackReason,
    ],
  );

  const applyLessonFallback = useCallback(
    async (runId: number, notice: string) => {
      if (fastFallbackAppliedRef.current === runId) return;
      fastFallbackAppliedRef.current = runId;
      setFastFallbackNotice(notice);
      recordMetric({ t: Date.now(), type: "WARN", code: "FALLBACK" });

      void recordEduEvent({
        type: "lesson_fast_fallback_applied",
        boardId: "edu_chat_panel",
        requestId: generatorRequestIdRef.current ?? undefined,
        shareCode: shareCode ?? undefined,
        extra: { runId, notice, path: "generator_fallback" },
      });
      void recordEduEvent({
        type: "generator_fallback_context",
        boardId: "edu_chat_panel",
        requestId: generatorRequestIdRef.current ?? undefined,
        shareCode: shareCode ?? undefined,
        extra: {
          decorateInProgress: decorateInProgressRef.current,
          lastSsotOwner: lastSsotOwnerRef.current.owner,
          lastSsotOwnerAgeMs: Math.max(0, Date.now() - (lastSsotOwnerRef.current.at || 0)),
          currentRoute: pathname,
          runId,
          snapshotVersion: lastSsotOwnerRef.current.snapshotVersion ?? null,
          htmlHash: lastSsotOwnerRef.current.htmlHash ?? null,
          path: "generator_fallback",
        },
      });

      if (isTemplateFirst) {
        const lastCommit = lastSsotOwnerRef.current;
        const commitAgeMs = lastCommit?.at ? Date.now() - lastCommit.at : Number.POSITIVE_INFINITY;
        if ((lastCommit.owner === "decorate" || lastCommit.owner === "user_edit") && commitAgeMs < 30_000) {
          if (chatAbortRef.current) {
            chatAbortRef.current.abort();
            chatAbortRef.current = null;
          }
          if (coachRequestIdRef.current) {
            safeAbortWebLLM(coachRequestIdRef.current);
          }
          if (generatorRequestIdRef.current) {
            safeAbortWebLLM(generatorRequestIdRef.current);
          }
          setFastFallbackApplied(false);
          setPanelState("READY_TO_GENERATE");
          const message = "생성이 지연되어 중단했어요(기존 작업은 유지됨).";
          setFastFallbackNotice(message);
          showFastApplyNotice(message);
          void recordEduEvent({
            type: "generator_fallback_skipped_due_to_recent_commit",
            boardId: "edu_chat_panel",
            requestId: generatorRequestIdRef.current ?? undefined,
            shareCode: shareCode ?? undefined,
            extra: {
              owner: lastCommit.owner,
              ageMs: Math.max(0, Math.round(commitAgeMs)),
            },
          });
          fastFallbackAppliedRef.current = null;
          return;
        }
        const decorateRecentlyFinished = Date.now() - lastDecorateFinishedAtRef.current <= 5000;
        const decorateInProgress = decorateInProgressRef.current;
        if (decorateRecentlyFinished || decorateInProgress) {
          console.info("[decorate] generator_fallback.deferred", { runId, decorateRecentlyFinished, decorateInProgress });
          void recordEduEvent({
            type: "generator_fallback_skipped_due_to_recent_commit",
            boardId: "edu_chat_panel",
            requestId: generatorRequestIdRef.current ?? undefined,
            shareCode: shareCode ?? undefined,
            extra: {
              owner: lastSsotOwnerRef.current.owner,
              ageMs: Math.max(0, Date.now() - (lastSsotOwnerRef.current.at || 0)),
              decorateInProgress,
            },
          });
          fastFallbackAppliedRef.current = null;
          return;
        }
        if (chatAbortRef.current) {
          chatAbortRef.current.abort();
          chatAbortRef.current = null;
        }
        if (coachRequestIdRef.current) {
          safeAbortWebLLM(coachRequestIdRef.current);
        }
        if (generatorRequestIdRef.current) {
          safeAbortWebLLM(generatorRequestIdRef.current);
        }
        restoreTemplateSnapshotForGeneratorFallback();
        setFastFallbackApplied(false);
        setPanelState("READY_TO_GENERATE");
        return;
      }

      setFastFallbackApplied(true);
      const fallbackFiles = buildFallbackFiles(lastUserMessage);
      setPanelState("POSTPROCESSING_FILES");
      const handled = await finalizeFiles(fallbackFiles, notice, undefined, `apply-${runId}`);
      if (handled.ok) {
        recordInsuranceTemplateApplied();
        setPanelState("APPLIED");
        setLastApplyOutcome("partial");
        setManualFallbackReason(null);
        return;
      }
      fastFallbackAppliedRef.current = null;
      setFastFallbackApplied(false);
      setFastFallbackNotice(null);
    },
    [
      buildFallbackFiles,
      finalizeFiles,
      isTemplateFirst,
      lastUserMessage,
      recordInsuranceTemplateApplied,
      recordMetric,
      restoreTemplateSnapshotForGeneratorFallback,
      pathname,
      shareCode,
      showFastApplyNotice,
      setLastApplyOutcome,
      setManualFallbackReason,
      setPanelState,
    ],
  );

  const applyManualFallbackTemplate = useCallback(async () => {
    const fallbackFiles = buildFallbackFiles(lastUserMessage);
    setManualFallbackReason(null);
    setPanelState("POSTPROCESSING_FILES");
    const handled = await finalizeFiles(
      fallbackFiles,
      "기본 템플릿으로 먼저 준비했어요.",
      undefined,
      `apply-manual-${Date.now()}`,
    );
    if (handled.ok) {
      recordInsuranceTemplateApplied();
      setLastApplyOutcome("partial");
      setPanelState("APPLIED");
      return;
    }
    setManualFallbackReason("apply_failed");
    setPanelState("ERROR_RECOVERABLE");
  }, [
    buildFallbackFiles,
    finalizeFiles,
    lastUserMessage,
    recordInsuranceTemplateApplied,
    setLastApplyOutcome,
    setManualFallbackReason,
    setPanelState,
  ]);

  useEffect(() => {
    applyManualFallbackTemplateRef.current = applyManualFallbackTemplate;
  }, [applyManualFallbackTemplate]);

  const scheduleFastFallback = useCallback(
    (runId: number) => {
      if (isTemplateFirst) {
        return;
      }
      clearFastFallbackTimer();
      fastFallbackTimerRef.current = window.setTimeout(() => {
        if (genRunIdRef.current !== runId) return;
        if (fastFallbackAppliedRef.current === runId) return;
        if (
          panelStateRef.current !== "GENERATING_FILES" &&
          panelStateRef.current !== "POSTPROCESSING_FILES"
        ) {
          return;
        }
        const notice = isTemplateFirst
          ? "템플릿이 더 안정적이라 그대로 유지했어요."
          : "템플릿으로 빠르게 완성했어요. 원하면 더 바꿔볼 수 있어요.";
        void applyLessonFallback(runId, notice);
      }, FAST_FALLBACK_TIMEOUT_MS);
    },
    [applyLessonFallback, clearFastFallbackTimer, isTemplateFirst],
  );

  const getTitleAndH1 = useCallback((html: string) => {
    if (typeof DOMParser === "undefined") {
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      return {
        title: titleMatch?.[1]?.trim() ?? "",
        h1: h1Match?.[1]?.trim() ?? "",
      };
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return {
      title: doc.querySelector("title")?.textContent?.trim() ?? "",
      h1: doc.querySelector("h1")?.textContent?.trim() ?? "",
    };
  }, []);

  const needsLessonFallback = useCallback(
    (files: Record<string, WorkspaceFile>) => {
      const textFiles = Object.fromEntries(
        Object.entries(files).map(([path, file]) => [path, file.content]),
      );
      const quality = analyzeFiles(resolvedLessonNumber, textFiles);
      const mustIncludeCheck = quality.checks.find((check) => check.key === "lesson-must-include");
      const mustAvoidCheck = quality.checks.find((check) => check.key === "lesson-must-avoid");

      const html = textFiles["index.html"] ?? "";
      const { title, h1 } = getTitleAndH1(html);
      const combinedTitle = `${title} ${h1}`.toLowerCase();
      const isOffTopicTitle =
        resolvedLessonId === "P1" &&
        OFF_TOPIC_P1_KEYWORDS.some((keyword) => combinedTitle.includes(keyword.toLowerCase()));

      const failsMustInclude = mustIncludeCheck ? !mustIncludeCheck.ok : false;
      const failsMustAvoid = mustAvoidCheck ? !mustAvoidCheck.ok : false;
      const failsScore = quality.score < QUALITY_SCORE_THRESHOLD;

      return {
        invalid: isOffTopicTitle || failsMustInclude || failsMustAvoid || failsScore,
        quality,
      };
    },
    [getTitleAndH1, resolvedLessonId, resolvedLessonNumber],
  );

  const buildGenerateAction = useCallback(
    () => ({
      showTemplate: Boolean(onTemplateStart),
      showHelp: Boolean(onHelpClick),
      showRetry: false,
      showSelfcheck: false,
      showDiagnostics: false,
      showGenerate: true,
      showGenerateRetry: false,
      showTemplateChips: true,
      showRefresh: false,
    }),
    [onHelpClick, onTemplateStart],
  );

  const requestCoachAction = useCallback(
    async (
      historyMessages: ChatMessage[],
      assistantText: string,
      requestId?: string,
    ): Promise<CoachAction | null> => {
      if (!effectiveWebllmEnabled) return null;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), LOCAL_TIMEOUT_MS);
      const localMessages = buildActionMessages(historyMessages, assistantText);
      const inputSummary = buildSafeSummary(
        [...historyMessages.map((message) => message.content), assistantText].join(" "),
        MAX_INPUT_SUMMARY,
      );
      const startTs = typeof performance === "undefined" ? Date.now() : performance.now();
      const localRequestId = requestId ?? createRequestId();
      logDebug("[edu] webllm.call", {
        requestId: localRequestId,
        phase: "start",
        mode: "coach_action",
        inputSummary,
        source: "requestCoachAction",
      });
      const abortHandler = () => safeAbortWebLLM(localRequestId);
      controller.signal.addEventListener("abort", abortHandler);
      const response = await safeStartWebLLM(localRequestId, {
        kind: "generateJson",
        messages: localMessages,
        temperature: 0,
        schema: coachActionJsonSchema(),
        timeoutMs: resolveGenerateJsonTimeoutMs({ usingLocalWebLLM: effectiveWebllmEnabled, localTimeoutMs: LOCAL_TIMEOUT_MS, generatorTimeoutMs: GENERATOR_TIMEOUT_MS }),
        preferredModelId: preferredModelId ?? undefined,
      });
      controller.signal.removeEventListener("abort", abortHandler);
      const localResult =
        response.type === "result" && response.kind === "generateJson"
          ? response.result
          : {
              ok: false,
              reason: "engine_error" as const,
              message:
                response.type === "error"
                  ? response.error.message
                  : "요청이 중단되었습니다.",
              shouldFallback: false,
            };
      const durationMs = Math.round(
        (typeof performance === "undefined" ? Date.now() : performance.now()) - startTs,
      );
      logDebug("[edu] webllm.call", {
        requestId: localRequestId,
        phase: "end",
        mode: "coach_action",
        inputSummary,
        outputSnapshot: buildSafeSummary(
          "rawText" in localResult
            ? localResult.rawText
            : "message" in localResult
              ? localResult.message ?? ""
              : "",
          MAX_OUTPUT_SNAPSHOT,
        ),
        durationMs,
        ok: localResult.ok,
      });

      if (timeoutId !== null) window.clearTimeout(timeoutId);

      if (!localResult.ok || !("data" in localResult)) {
        return null;
      }

      const parsed = coachActionSchema.safeParse(localResult.data);
      if (!parsed.success) {
        return null;
      }

      return parsed.data;
    },
    [buildActionMessages, effectiveWebllmEnabled, logDebug, preferredModelId],
  );

  const resolveTemplateSelection = useCallback(() => {
    if (templateOptions.length === 0) {
      return null;
    }
    const directMatch = selectedTemplateKey
      ? templateOptions.find((template) => template.key === selectedTemplateKey)
      : null;
    if (directMatch) {
      return directMatch;
    }
    const seed = `${anonId ?? "anon"}:${getDateSeed()}:${resolvedLessonNumber}`;
    const index = hashSeed(seed) % templateOptions.length;
    const seeded = templateOptions[index];
    setSelectedTemplateKey(seeded.key);
    return seeded;
  }, [anonId, resolvedLessonNumber, selectedTemplateKey, templateOptions, setSelectedTemplateKey]);

  const handleTemplateSelect = useCallback(
    (templateKey: string) => {
      setSelectedTemplateKey(templateKey);
      recordEvent("template_select_count", undefined, { templateKey });
    },
    [recordEvent],
  );

  const buildTemplateHint = useCallback(
    (templateKey?: string | null, templateName?: string, description?: string) => {
      if (!templateKey) return null;
      const hint = getTemplateHintByKey(templateKey);
      if (hint) {
        return `템플릿 키: ${templateKey}\n템플릿 이름: ${templateName ?? templateKey}\n스타일 힌트: ${hint}`;
      }
      return `템플릿 키: ${templateKey}\n템플릿 이름: ${templateName ?? templateKey}\n스타일 힌트: ${description ?? ""}`;
    },
    [],
  );

  const buildContentMessages = useCallback(
    (
      historyMessages: ChatMessage[],
      options: {
        styleHint?: string;
        templateKey?: string | null;
        forceContentPrompt?: boolean;
        strictLanguage?: boolean;
        templateContext?: string;
        refineMode?: "lesson1";
      } | undefined,
      lessonId: LessonId,
    ): LocalChatMessage[] => {
      const buildGenerateUserInstruction = (templateKey?: string | null) =>
        [
          `lessonId=${lessonId}에 맞는 files JSON을 만들어줘.`,
          "반드시 JSON만 출력해. 설명이나 코드블록은 금지.",
          "허용 파일: index.html, style.css, script.js",
          "대화 내용을 반영해 구성과 내용을 채워줘.",
          templateKey ? `선택 템플릿: ${templateKey}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      const lesson1RefineRule =
        options?.refineMode === "lesson1"
          ? [
              "지금은 '자기소개 페이지' 템플릿을 꾸미는 단계야.",
              "반드시 이름/취미/키워드/좋아하는 것/오늘의 목표가 유지돼야 해.",
              "사진 자리와 한줄 슬로건, 프로필 카드 3개 구성을 유지해.",
              "재생 콘솔/플레이어/관리자 등 다른 앱은 절대 만들지 마.",
            ].join("\n")
          : null;
      const systemContent = [
        lessonFilesPrompt,
        options?.forceContentPrompt ? FORCE_CONTENT_PROMPT : null,
        options?.strictLanguage ? STRICT_LANGUAGE_PROMPT : null,
        options?.styleHint ? `스타일 힌트: ${options.styleHint}` : null,
        lesson1RefineRule,
        options?.templateContext ? `현재 템플릿 파일:\n${options.templateContext}` : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join("\n\n");
      const conversation = getConversationForGenerate(historyMessages);
      return [
        { role: "system", content: systemContent },
        ...conversation,
        { role: "user", content: buildGenerateUserInstruction(options?.templateKey ?? null) },
      ];
    },
    [lessonFilesPrompt],
  );

  const formatTemplateContext = useCallback((files: Record<string, WorkspaceFile>) => {
    return Object.entries(files)
      .map(([path, file]) => `--- ${path} ---\n${file.content}`)
      .join("\n\n");
  }, []);

  const requestContentJson = useCallback(
    async (
      historyMessages: ChatMessage[],
      options?: {
        styleHint?: string;
        templateKey?: string | null;
        temperature?: number;
        forceContentPrompt?: boolean;
        strictLanguage?: boolean;
        preferredModelId?: string | null;
        templateContext?: string;
        refineMode?: "lesson1";
        silent?: boolean;
        signal?: AbortSignal;
        requestId?: string;
      },
    ): Promise<
      | {
          ok: true;
          data: unknown;
          rawText: string;
          usedResponseFormat: boolean;
          modelChoice: "primary" | "fallback";
        }
      | { ok: false; reason?: "timeout" | "engine_error" | "config_missing" | "unsupported" | "disabled" }
    > => {
      if (!effectiveWebllmEnabled || !lessonWebllmDispatchSelector.wouldDispatchToWebllm) {
        return { ok: false, reason: "disabled" as const };
      }
      const { controller, cleanup } = createLinkedAbortController(options?.signal);
      const timeoutMs = resolveGenerateJsonTimeoutMs({ usingLocalWebLLM: effectiveWebllmEnabled, localTimeoutMs: LOCAL_TIMEOUT_MS, generatorTimeoutMs: GENERATOR_TIMEOUT_MS });
      const runStartedAt = getNowMs();
      const timeoutId = timeoutMs > 0
        ? window.setTimeout(
            () =>
              controller.abort(
                createAbortMeta({
                  abortReason: "timeout",
                  phase: "content.generateJson",
                  usingLocalWebLLM: effectiveWebllmEnabled,
                  startedAt: runStartedAt,
                  timeoutMs,
                  modelId: options?.preferredModelId ?? preferredModelId ?? null,
                }),
              ),
            timeoutMs,
          )
        : null;
      const localMessages = buildContentMessages(historyMessages, options, resolvedLessonId);
      recordEvent("generator_request_start");
      const inputSummary = buildSafeSummary(
        historyMessages
          .filter((message) => message.role === "user")
          .map((message) => message.content)
          .join(" "),
        MAX_INPUT_SUMMARY,
      );
      const startTs = typeof performance === "undefined" ? Date.now() : performance.now();
      const localRequestId = options?.requestId ?? createRequestId();
      logDebug("[edu] webllm.call", {
        requestId: localRequestId,
        phase: "start",
        mode: "generator_json",
        inputSummary,
        source: "requestContentJson",
      });
      const unsubscribe = onWebLLMProgress((event) => {
        if (event.requestId !== localRequestId || event.kind !== "generateJson") return;
        setFileProgressMessageThrottled(event.message);
      });
      const abortHandler = () => safeAbortWebLLM(localRequestId);
      controller.signal.addEventListener("abort", abortHandler);
      const response = await safeStartWebLLM(localRequestId, {
        kind: "generateJson",
        messages: localMessages,
        temperature: options?.temperature ?? 0.1,
        schema: generatorSchema,
        timeoutMs: resolveGenerateJsonTimeoutMs({ usingLocalWebLLM: effectiveWebllmEnabled, localTimeoutMs: LOCAL_TIMEOUT_MS, generatorTimeoutMs: GENERATOR_TIMEOUT_MS }),
        preferredModelId: options?.preferredModelId ?? preferredModelId ?? undefined,
      });
      controller.signal.removeEventListener("abort", abortHandler);
      unsubscribe();
      const localResult =
        response.type === "result" && response.kind === "generateJson"
          ? response.result
          : {
              ok: false,
              reason: "engine_error" as const,
              message:
                response.type === "error"
                  ? response.error.message
                  : "요청이 중단되었습니다.",
              shouldFallback: false,
            };
      const durationMs = Math.round(
        (typeof performance === "undefined" ? Date.now() : performance.now()) - startTs,
      );
      logDebug("[edu] webllm.call", {
        requestId: localRequestId,
        phase: "end",
        mode: "generator_json",
        inputSummary,
        outputSnapshot: buildSafeSummary(
          "rawText" in localResult
            ? localResult.rawText
            : "message" in localResult
              ? localResult.message ?? ""
              : "",
          MAX_OUTPUT_SNAPSHOT,
        ),
        durationMs,
        ok: localResult.ok,
      });

      window.clearTimeout(timeoutId);
      cleanup();

      if (response.type === "aborted") {
        const abortMetaFromSignal = (controller.signal as AbortSignal & { reason?: unknown }).reason;
        const resolvedAbortMeta =
          abortMetaFromSignal && typeof abortMetaFromSignal === "object"
            ? (abortMetaFromSignal as AbortMeta)
            : null;
        if (resolvedAbortMeta) {
          reportAbortTelemetry(resolvedAbortMeta, localRequestId);
        }
        return { ok: false, reason: "timeout" };
      }

      if (localResult.ok && "rawText" in localResult) {
        recordEvent("generator_request_success");
        setGeneratorReady(true);
        setModelChoice(localResult.modelChoice);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem("edu:webllm:modelId", localResult.modelId);
            setPreferredModelId(localResult.modelId);
          } catch {
            // ignore storage failures
          }
        }
        return {
          ok: true,
          data: localResult.data,
          rawText: localResult.rawText,
          usedResponseFormat: localResult.usedResponseFormat,
          modelChoice: localResult.modelChoice,
        };
      }

      recordEvent(
        "generator_request_fail",
        hashCode(localResult.reason ?? "unknown"),
      );

      if (!options?.silent) {
        const messageFormatError = isMessageFormatError(localResult.message);
        const isUnsupported = localResult.reason === "unsupported";
        const isFetchError = isEngineFetchError(localResult.message);
        const errorCode: ErrorCode = messageFormatError
          ? "MESSAGE_SHAPE"
          : isUnsupported
            ? "RESPONSE_FORMAT_UNSUPPORTED"
            : "ENGINE_FETCH";
        const errorMessage = buildErrorMessage({
          code: errorCode,
          detail: localResult.message,
          includeWifiHint: errorCode === "ENGINE_FETCH" && isFetchError,
        });

        appendMessage("system", errorMessage);
        setActionPrompt(
          messageFormatError
            ? {
                showTemplate: Boolean(onTemplateStart),
                showHelp: false,
                showRetry: false,
                showSelfcheck: true,
                showDiagnostics: false,
                showGenerate: false,
                showGenerateRetry: false,
                showTemplateChips: false,
                showRefresh: true,
              }
            : {
                showTemplate: Boolean(onTemplateStart),
                showHelp: Boolean(onHelpClick),
                showRetry: false,
                showSelfcheck: true,
                showDiagnostics: true,
                showGenerate: false,
                showGenerateRetry: true,
                showTemplateChips: false,
                showRefresh: false,
              },
        );
        const isCorsFailure = /CORS/i.test(localResult.message);
        setCorsCopyMessage(
          !messageFormatError && isCorsFailure
            ? "로컬 AI가 models.gomdory.com에서 불러오지 못했습니다. 학교/기관 네트워크에서 models.gomdory.com (GET/HEAD) CORS 허용 설정이 필요합니다."
            : null,
        );
        setCorsCopyNotice(null);
        setPanelState("ERROR_RECOVERABLE");
      }
      return { ok: false, reason: localResult.reason };
    },
    [
      appendMessage,
      buildContentMessages,
      buildErrorMessage,
      effectiveWebllmEnabled,
      generatorSchema,
      lessonWebllmDispatchSelector.wouldDispatchToWebllm,
      isEngineFetchError,
      isMessageFormatError,
      logDebug,
      onHelpClick,
      onTemplateStart,
      preferredModelId,
      recordEvent,
      reportAbortTelemetry,
      resolvedLessonId,
      setActionPrompt,
      setCorsCopyMessage,
      setCorsCopyNotice,
      setFileProgressMessageThrottled,
      setGeneratorReady,
      setModelChoice,
      setPanelState,
      setPreferredModelId,
    ],
  );

  const generateFilesFromHistoryInternal = useCallback(async (
    hint: string | undefined,
    signal: AbortSignal,
    runId: number,
    requestId?: string,
  ) => {
    if (signal.aborted) {
      throw createAbortErrorFromSignal(signal);
    }
    // Generator-only pipeline: do not call requestAssistant/streamLocalWebLLMChat here.
    const selectedTemplate = resolveTemplateSelection();
    const templateContext = isTemplateFirst ? formatTemplateContext(currentFiles ?? {}) : undefined;
    if (isTemplateFirst) {
      templateSnapshotRef.current = Object.fromEntries(
        Object.entries(currentFiles ?? {}).map(([path, file]) => [path, { ...file }]),
      );
    }
    lastTemplateKeyRef.current = selectedTemplate?.key ?? null;
    const templateHint = buildTemplateHint(
      selectedTemplate?.key ?? null,
      selectedTemplate?.name,
      selectedTemplate?.description,
    );
    const resolvedHint = hint ?? templateHint ?? styleHint ?? undefined;
    if (resolvedHint) {
      setStyleHint(resolvedHint);
    }

    const historyMessages = [...messages];
    const overrides = getGeneratorOverrideFlags();
    if (overrides.forceTemplate) {
      const fallbackFiles = makeInsuranceTemplate(
        resolvedLessonId,
        lastUserMessage ?? "",
        selectedTemplate?.key ?? null,
      );
      recordMetric({ t: Date.now(), type: "WARN", code: "FALLBACK" });
      setPanelState("POSTPROCESSING_FILES");
      const fallbackHandled = await finalizeFiles(
        fallbackFiles,
        "보험 템플릿을 적용했어요.",
        undefined,
        `apply-${runId}`,
      );
      if (fallbackHandled.ok) {
        recordInsuranceTemplateApplied();
        appendMessage(
          "system",
          "보험 템플릿을 강제로 적용했어요. 필요한 문구를 한글로 다듬어 볼까요?",
        );
        setPanelState("APPLIED");
        setLastApplyOutcome("partial");
        setManualFallbackReason(null);
        return;
      }
    }

    setThinking(false);
    setProgressMessage("");
    setFileProgressMessage("");
    setShowDiagnostics(false);
    setCorsCopyMessage(null);
    setCorsCopyNotice(null);
    setPanelState("GENERATING_FILES");
    setActionPrompt(null);
    setLastGeneratorNotice(null);

    let filesFailureDetected = false;

    const requestOnce = async (requestOptions: {
      styleHint?: string;
      templateKey?: string | null;
      temperature?: number;
      forceContentPrompt?: boolean;
      strictLanguage?: boolean;
      preferredModelId?: string | null;
    }) => {
      if (signal.aborted) {
        throw createAbortErrorFromSignal(signal);
      }
      return requestContentJson(historyMessages, {
        ...requestOptions,
        templateContext,
        refineMode: isTemplateFirst && resolvedLessonId === "P1" ? "lesson1" : undefined,
        silent: true,
        signal,
        requestId,
      });
    };

    const collectContentStrings = (value: unknown): string[] => {
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) return value.flatMap((item) => collectContentStrings(item));
      if (value && typeof value === "object") {
        return Object.values(value as Record<string, unknown>).flatMap((item) =>
          collectContentStrings(item),
        );
      }
      return [];
    };

    const handleLanguageWarning = (content: unknown, source: string) => {
      const strings = collectContentStrings(content);
      for (const text of strings) {
        const found = explainHanFound(text);
        if (found.found) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[edu] 한자 감지 (${source} content):`, found.sample);
          }
          return { ok: false } as const;
        }
      }
      return { ok: true } as const;
    };

    const tryHandleFilesPayload = async (
      payload: { message: string; files: Record<string, string> },
      source: string,
    ) => {
      if (fastFallbackAppliedRef.current === runId) {
        return { ok: true } as const;
      }
      const normalized = normalizeFiles(payload.files, { allowedFilenames: [...WEBLLM_ALLOWED_FILES] });
      const fixed = ensureRequiredRefs(normalized);
      if (fixed.metrics.missingRefsDetected) {
        recordMetric({ t: Date.now(), type: "HARDFAIL", code: "MISSING_REFS" });
      }
      if (Object.keys(fixed.files).length === 0) {
        filesFailureDetected = true;
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[edu] webllm files apply failed (${source})`);
        }
        return { ok: false, reason: "apply_failed" } as const;
      }
      setPanelState("POSTPROCESSING_FILES");
      await takeSnapshotIfPossible(currentFiles);
      const safeApplied = applyHtmlCssPatch({
        currentFiles,
        patch: {
          html: fixed.files["index.html"]?.content,
          css: fixed.files["style.css"]?.content,
        },
      });
      onFilesMerged(safeApplied.files);
      await syncCurrentSnapshot(safeApplied.files);
      scheduleAutosave(safeApplied.files, { immediate: true });
      setIsDirty(true);
      setActionPrompt(null);
      setLastGeneratorNotice(formatPayloadMessage(payload.message, undefined));
      setManualFallbackReason(null);
      setLastApplyOutcome("done");
      setFastFallbackNotice(null);
      setPanelState("APPLIED");
      recordStep("APPLY", true, `apply-${runId}`);
      recordStep("GEN", true, `gen-${runId}`);
      const evaluation = needsLessonFallback(fixed.files);
      if (evaluation.invalid) {
        await applyLessonFallback(runId, "주제에 맞는 템플릿으로 다시 완성했어요.");
      }
      return { ok: true } as const;
    };

    const tryHandleContent = async (content: unknown, source: string) => {
      if (fastFallbackAppliedRef.current === runId) {
        return { ok: true } as const;
      }
      const languageCheck = handleLanguageWarning(content, source);
      if (!languageCheck.ok) {
        return { ok: false, reason: "invalid_language" } as const;
      }
      const normalized = normalizeLessonContent(resolvedLessonId, content);
      const zodSchema = getLessonContentZodSchema(resolvedLessonId);
      const parsed = zodSchema.safeParse(normalized);
      if (!parsed.success) {
        return { ok: false, reason: "zod" } as const;
      }
      let files: Record<string, string>;
      try {
        files = renderLessonSite(resolvedLessonId, parsed.data);
      } catch {
        recordMetric({ t: Date.now(), type: "HARDFAIL", code: "RENDER_FAIL" });
        return { ok: false, reason: "render_fail" } as const;
      }
      const candidateFiles: Record<string, WorkspaceFile> = {
        "index.html": { content: files["index.html"] ?? "", contentType: "text/html" },
        "style.css": { content: files["style.css"] ?? "", contentType: "text/css" },
        "script.js": { content: files["script.js"] ?? "", contentType: "text/javascript" },
      };
      if (isTemplateFirst) {
        const evaluation = needsLessonFallback(candidateFiles);
        if (evaluation.invalid) {
          setFastFallbackNotice("템플릿이 더 안정적이라 그대로 유지했어요.");
          setFastFallbackApplied(false);
          const snapshot = templateSnapshotRef.current;
          if (snapshot) {
            onFilesMerged(snapshot);
          }
          setPanelState("READY_TO_GENERATE");
          return { ok: true } as const;
        }
      }
      setPanelState("POSTPROCESSING_FILES");
      const merged = await finalizeFiles(files, "콘텐츠를 적용했어요.", undefined, `apply-${runId}`);
      if (merged.ok) {
        setPanelState("APPLIED");
        setLastApplyOutcome("done");
        setManualFallbackReason(null);
        recordStep("GEN", true, `gen-${runId}`);
        const evaluation = needsLessonFallback(merged.files);
        if (evaluation.invalid) {
          await applyLessonFallback(runId, "주제에 맞는 템플릿으로 다시 완성했어요.");
        }
        return { ok: true } as const;
      }
      setPanelState("GENERATING_FILES");
      return { ok: false, reason: "merge_failed" } as const;
    };

    const attemptGeneration = async (attemptOptions: {
      styleHint?: string;
      templateKey?: string | null;
      temperature?: number;
      forceContentPrompt?: boolean;
      strictLanguage?: boolean;
      preferredModelId?: string | null;
      source?: string;
    }) => {
      const response = await requestOnce(attemptOptions);
      if (signal.aborted) {
        throw createAbortErrorFromSignal(signal);
      }
      if (!response.ok) {
        return {
          ok: false,
          reason:
            response.reason === "timeout"
              ? ("timeout" as const)
              : response.reason === "engine_error"
                ? ("engine_error" as const)
                : ("unknown" as const),
        };
      }

      const parsedData = response.usedResponseFormat
        ? response.data
        : parseFirstJsonObject(response.rawText);
      if (!parsedData) {
        filesFailureDetected = true;
        return {
          ok: false,
          reason: response.usedResponseFormat ? ("zod" as const) : ("schema" as const),
        };
      }

      const filesPayload = parseFilesPayload(parsedData);
      if (filesPayload) {
        if (!filesPayload.ok) {
          filesFailureDetected = true;
          return { ok: false, reason: "schema" as const };
        }
        const handled = await tryHandleFilesPayload(filesPayload.payload, attemptOptions.source ?? "files");
        if (handled.ok) {
          return { ok: true } as const;
        }
        filesFailureDetected = true;
        return { ok: false, reason: "zod" as const };
      }

      const handled = await tryHandleContent(parsedData, attemptOptions.source ?? "unknown");
      if (handled.ok) {
        return { ok: true } as const;
      }

      if (handled.reason === "invalid_language") {
        return { ok: false, reason: "cjk_guard" as const };
      }
      if (handled.reason === "render_fail") {
        return { ok: false, reason: "render" as const };
      }

      return { ok: false, reason: "zod" as const };
    };

    let lastFailureReason:
      | "timeout"
      | "engine_error"
      | "schema"
      | "zod"
      | "cjk_guard"
      | "render"
      | "unknown"
      | null = null;

    const initialAttempt = await attemptGeneration({
      styleHint: resolvedHint,
      temperature: 0.1,
      templateKey: selectedTemplate?.key ?? null,
    });
    if (initialAttempt.ok) {
      return;
    }
    lastFailureReason = initialAttempt.reason;

    if (
      lastFailureReason === "timeout" ||
      lastFailureReason === "schema" ||
      lastFailureReason === "zod"
    ) {
      recordMetric({ t: Date.now(), type: "WARN", code: "RETRY" });
      const retryAttempt = await attemptGeneration({
        styleHint: resolvedHint,
        temperature: 0.1,
        templateKey: selectedTemplate?.key ?? null,
        forceContentPrompt: true,
        source: "retry",
      });
      if (retryAttempt.ok) {
        return;
      }
      lastFailureReason = retryAttempt.reason;
    }

    if (fallbackModelId) {
      recordMetric({ t: Date.now(), type: "WARN", code: "FALLBACK" });
      const fallbackAttempt = await attemptGeneration({
        styleHint: resolvedHint,
        temperature: 0.1,
        templateKey: selectedTemplate?.key ?? null,
        forceContentPrompt: true,
        strictLanguage: lastFailureReason === "cjk_guard",
        preferredModelId: fallbackModelId,
      });
      if (fallbackAttempt.ok) {
        return;
      }
      lastFailureReason = fallbackAttempt.reason;
    }

    if (fastFallbackAppliedRef.current === runId) {
      return;
    }

    if (lastFailureReason === "engine_error") {
      if (filesFailureDetected) {
        setFastFallbackNotice("잠깐 멈췄어. 대신 템플릿으로 시작하자.");
      }
      const fallbackFiles = makeInsuranceTemplate(
        resolvedLessonId,
        lastUserMessage ?? "",
        selectedTemplate?.key ?? null,
      );
      setPanelState("POSTPROCESSING_FILES");
      recordMetric({ t: Date.now(), type: "WARN", code: "FALLBACK" });
      const fallbackHandled = await finalizeFiles(
        fallbackFiles,
        buildErrorMessage({ code: "FALLBACK_APPLIED" }),
        undefined,
        `apply-${runId}`,
      );
      if (fallbackHandled.ok) {
        recordInsuranceTemplateApplied();
        appendMessage("system", buildErrorMessage({ code: "FALLBACK_APPLIED" }));
        setPanelState("APPLIED");
        setLastApplyOutcome("partial");
        setManualFallbackReason(null);
        return;
      }
    }

    if (lastFailureReason === "timeout") {
      recordMetric({ t: Date.now(), type: "HARDFAIL", code: "GEN_TIMEOUT" });
      appendMessage("system", buildErrorMessage({ code: "ENGINE_ERROR", detail: "timeout" }));
    } else if (lastFailureReason === "engine_error") {
      recordMetric({ t: Date.now(), type: "HARDFAIL", code: "ENGINE_ERROR" });
      appendMessage("system", buildErrorMessage({ code: "ENGINE_ERROR" }));
    } else {
      if (lastFailureReason !== "render") {
        recordMetric({ t: Date.now(), type: "HARDFAIL", code: "SCHEMA_INVALID" });
      }
      appendMessage("system", buildErrorMessage({ code: "SCHEMA_FAILED" }));
    }
    setActionPrompt({
      showTemplate: Boolean(onTemplateStart),
      showHelp: false,
      showRetry: false,
      showSelfcheck: false,
      showDiagnostics: false,
      showGenerate: false,
      showGenerateRetry: true,
      showTemplateChips: false,
      showRefresh: false,
    });
    setPanelState("ERROR_RECOVERABLE");
  }, [
    applyLessonFallback,
    appendMessage,
    buildErrorMessage,
    buildTemplateHint,
    currentFiles,
    fallbackModelId,
    finalizeFiles,
    formatPayloadMessage,
    formatTemplateContext,
    isTemplateFirst,
    lastUserMessage,
    messages,
    onFilesMerged,
    onTemplateStart,
    parseFirstJsonObject,
    recordInsuranceTemplateApplied,
    recordMetric,
    recordStep,
    requestContentJson,
    resolveTemplateSelection,
    resolvedLessonId,
    needsLessonFallback,
    scheduleAutosave,
    setActionPrompt,
    setCorsCopyMessage,
    setCorsCopyNotice,
    setFastFallbackNotice,
    setFileProgressMessage,
    setLastApplyOutcome,
    setLastGeneratorNotice,
    setIsDirty,
    setManualFallbackReason,
    setPanelState,
    setProgressMessage,
    setShowDiagnostics,
    setStyleHint,
    setThinking,
    syncCurrentSnapshot,
    takeSnapshotIfPossible,
    styleHint,
  ]);

  const generateFilesFromHistory = useCallback((hint?: string) => {
    if (genFlightRef.current.isRunning()) {
      return;
    }
    if (isOpsModeLocked) {
      if (isTeacherMode) {
        showTeacherToast("간단 모드 또는 AI 끄기가 활성화되어 있어요. 기본으로 되돌리면 실행할 수 있어요.");
      }
      return;
    }
    const runId = (genRunIdRef.current += 1);
    const requestId = startRequest("generateFilesFromHistory");
    abortTelemetryDedupRef.current.clear();
    generatorRequestIdRef.current = requestId;
    requestSeqRef.current += 1;
    const requestSeq = requestSeqRef.current;
    fastFallbackAppliedRef.current = null;
    setFastFallbackApplied(false);
    setFastFallbackNotice(null);
    setDecorateAbortNotice(null);
    setManualFallbackReason(null);
    setLastApplyOutcome(null);
    setIsDirty(true);
    setGenRunning(true);
    renderCountRef.current = 0;
    renderCountActiveRef.current = true;
    logDebug("[edu] webllm.trigger", {
      requestId,
      source: "generateFilesFromHistory",
      reason: "user_action",
      dispatchMode: lessonWebllmDispatchSelector.dispatchMode,
      wouldDispatchToWebllm: lessonWebllmDispatchSelector.wouldDispatchToWebllm,
      dispatchDecisionReason: lessonWebllmDispatchSelector.reason,
    });
    startSlowNudgeTimer(resolvedLessonId, requestSeq);
    scheduleFastFallback(runId);
    if (isTemplateFirst) {
      if (remoteAbortRef.current) {
        remoteAbortRef.current.abort();
        remoteAbortRef.current = null;
      }
      resetChatFallbackUi();
      clearChatRequestTracking();
      clearChatFallbackTimers();
      setThinking(false);
      clearDecorateSafetyTimers();
      setDecorateSlowNotice(false);
      decorateSlowTimerRef.current = window.setTimeout(() => {
        if (genRunIdRef.current !== runId) return;
        if (!genFlightRef.current.isRunning()) return;
        setDecorateSlowNotice(true);
      }, DECORATE_SLOW_NOTICE_MS);
    }
    void genFlightRef.current
      .run(
        (signal) => generateFilesFromHistoryInternal(hint, signal, runId, requestId),
        isTemplateFirst
          ? {
              timeoutMs: resolveGenerateJsonTimeoutMs({
                usingLocalWebLLM: effectiveWebllmEnabled,
                localTimeoutMs: LOCAL_TIMEOUT_MS,
                generatorTimeoutMs: GENERATOR_TIMEOUT_MS,
              }),
              onTimeout: ({ timeoutMs, startedAt }) => {
                if (!Number.isFinite(startedAt)) {
                  void fetch(apiV1Path("ops/log"), {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      level: "error",
                      route: "/edu/lesson",
                      message: "decorate_startedAt_missing",
                      requestId,
                      meta: {
                        phase: "decorate.generateJson",
                        timeoutMs,
                      },
                    }),
                  }).catch(() => undefined);
                  return createAbortMeta({
                    abortReason: "timeout",
                    phase: "decorate.generateJson",
                    usingLocalWebLLM: effectiveWebllmEnabled,
                    timeoutMs,
                    modelId: decorateCoachModelId ?? null,
                    stage: decorateDebugMetrics?.stage ?? "generate_json",
                    retryCount: decorateDebugMetrics?.retryCount ?? 0,
                    slotCandidatesCount: decorateDebugMetrics?.slotCandidatesCount ?? 0,
                    selectedSlotId: decorateDebugMetrics?.selectedSlotId ?? null,
                    selectedSelector: decorateDebugMetrics?.selectedSelector ?? null,
                    slotResolveSource: decorateDebugMetrics?.slotResolveSource ?? null,
                    htmlHashBefore: decorateDebugMetrics?.htmlHashBefore ?? null,
                    htmlHashAfterInjection: decorateDebugMetrics?.htmlHashAfterInjection ?? null,
                  });
                }
                if (
                  process.env.NODE_ENV !== "production" &&
                  decorateDebugMetrics?.stage === "generate_json" &&
                  !decorateDebugMetrics?.slotResolveSource
                ) {
                  console.error("[decorate] resolver_not_executed_before_generate_json", {
                    requestId,
                    phase: "decorate.generateJson",
                  });
                }
                if (
                  !decorateDebugMetrics?.slotResolveSource ||
                  !decorateDebugMetrics?.selectedSelector ||
                  (decorateDebugMetrics?.slotCandidatesCount ?? 0) <= 0
                ) {
                  void fetch(apiV1Path("ops/log"), {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      level: "error",
                      route: "/edu/lesson",
                      message: "decorate_invariant_failed",
                      requestId,
                      meta: {
                        phase: "decorate.generateJson",
                        slotCandidatesCount: decorateDebugMetrics?.slotCandidatesCount ?? null,
                        selectedSelector: decorateDebugMetrics?.selectedSelector ?? null,
                        slotResolveSource: decorateDebugMetrics?.slotResolveSource ?? null,
                    htmlHashBefore: decorateDebugMetrics?.htmlHashBefore ?? null,
                    htmlHashAfterInjection: decorateDebugMetrics?.htmlHashAfterInjection ?? null,
                      },
                    }),
                  }).catch(() => undefined);
                  return createAbortMeta({
                    abortReason: "timeout",
                    phase: "decorate.generateJson",
                    usingLocalWebLLM: effectiveWebllmEnabled,
                    startedAt,
                    timeoutMs,
                    modelId: decorateCoachModelId ?? null,
                    stage: decorateDebugMetrics?.stage ?? "generate_json",
                    retryCount: decorateDebugMetrics?.retryCount ?? 0,
                    slotCandidatesCount: decorateDebugMetrics?.slotCandidatesCount ?? null,
                    selectedSlotId: decorateDebugMetrics?.selectedSlotId ?? null,
                    selectedSelector: decorateDebugMetrics?.selectedSelector ?? null,
                    slotResolveSource: decorateDebugMetrics?.slotResolveSource ?? null,
                    htmlHashBefore: decorateDebugMetrics?.htmlHashBefore ?? null,
                    htmlHashAfterInjection: decorateDebugMetrics?.htmlHashAfterInjection ?? null,
                  });
                }
                return createAbortMeta({
                  abortReason: "timeout",
                  phase: "decorate.generateJson",
                  usingLocalWebLLM: effectiveWebllmEnabled,
                  startedAt,
                  timeoutMs,
                  modelId: decorateCoachModelId ?? null,
                  stage: decorateDebugMetrics?.stage ?? "generate_json",
                  retryCount: decorateDebugMetrics?.retryCount ?? 0,
                  slotCandidatesCount: decorateDebugMetrics?.slotCandidatesCount ?? 0,
                  selectedSlotId: decorateDebugMetrics?.selectedSlotId ?? null,
                  selectedSelector: decorateDebugMetrics?.selectedSelector ?? null,
                  slotResolveSource: decorateDebugMetrics?.slotResolveSource ?? null,
                    htmlHashBefore: decorateDebugMetrics?.htmlHashBefore ?? null,
                    htmlHashAfterInjection: decorateDebugMetrics?.htmlHashAfterInjection ?? null,
                });
              },
            }
          : undefined,
      )
      .catch((error) => {
        if (isAbortError(error)) {
          const abortMeta = getAbortMetaFromError(error);
          if (isTemplateFirst && genRunIdRef.current === runId) {
            const uiAbortReason = classifyTemplateAbortUiReason(abortMeta?.abortReason);
            abortTemplateFirstGeneration(uiAbortReason, abortMeta);
            return;
          }
          if (abortMeta) {
            reportAbortTelemetry(abortMeta, requestId);
          }
          setPanelState("ACTION_PREPARING");
          return;
        }
        if (process.env.NODE_ENV !== "production") {
          console.error(error);
        }
      })
      .finally(() => {
        clearFastFallbackTimer();
        clearSlowNudgeTimer();
        clearDecorateSafetyTimers();
        setDecorateSlowNotice(false);
        if (genRunIdRef.current === runId && !genFlightRef.current.isRunning()) {
          setGenRunning(false);
        }
        if (renderCountActiveRef.current) {
          renderCountActiveRef.current = false;
          logDebug("[edu] render.count", {
            requestId,
            phase: "complete",
            count: renderCountRef.current,
            source: "generateFilesFromHistory",
          });
        }
      });
  }, [
    abortTemplateFirstGeneration,
    clearFastFallbackTimer,
    clearDecorateSafetyTimers,
    clearSlowNudgeTimer,
    clearChatFallbackTimers,
    clearChatRequestTracking,
    generateFilesFromHistoryInternal,
    isOpsModeLocked,
    isTeacherMode,
    isTemplateFirst,
    decorateCoachModelId,
    reportAbortTelemetry,
    resolvedLessonId,
    scheduleFastFallback,
    showTeacherToast,
    startSlowNudgeTimer,
    resetChatFallbackUi,
    lessonWebllmDispatchSelector.dispatchMode,
    lessonWebllmDispatchSelector.reason,
    lessonWebllmDispatchSelector.wouldDispatchToWebllm,
    effectiveWebllmEnabled,
    decorateDebugMetrics,
    logDebug,
    startRequest,
  ]);

  const requestAssistant = useCallback(
    async (
      historyMessages: ChatMessage[],
      assistantId: string,
      options?: {
        temperature?: number;
        signal?: AbortSignal;
        requestId?: string;
        clientMsgId: string;
      },
    ): Promise<
      | { ok: true; responseText: string; notice?: string; started: boolean }
      | { ok: false; aborted?: boolean; started: boolean }
    > => {
    const clientMsgId = options?.clientMsgId ?? "";
    const isActive = () => (clientMsgId ? isActiveMsgId(clientMsgId) : false);
    let hasStarted = false;
    let responseText = "";
    let fallbackTriggered = false;
    let remoteSucceeded = false;
    let simpleCoachLogged = false;
    let fallbackReason: "not_ready" | "no_response" | "degraded" | "blocked" = "no_response";

    const startStreaming = (chunk: string) => {
      if (!isActive()) return;
      if (!hasStarted) {
        hasStarted = true;
        setThinking(false);
        setProgressMessage("");
        setFallbackStage("idle");
        clearChatFallbackTimers();
        markChatSlaFirstResponse(clientMsgId, "local");
      }
      responseText = `${responseText}${chunk}`;
      appendToMessage(assistantId, chunk);
    };

    const { controller, cleanup } = createLinkedAbortController(options?.signal);
    const timeoutId = window.setTimeout(() => controller.abort(), LOCAL_TIMEOUT_MS);
    const localRequestId = options?.requestId ?? createRequestId();
    const requestSeq = (chatRequestSeqRef.current += 1);

    const systemContent = lessonChatPrompt;
    const filteredHistory = historyMessages
      .filter(
        (message): message is ChatMessage & { role: "user" | "assistant" } => message.role !== "system",
      )
      .filter(
        (message) => !(message.role === "assistant" && message.content.trim().length === 0),
      );
    const conversation: LocalChatMessage[] = filteredHistory.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    const localMessages: LocalChatMessage[] = [
      { role: "system", content: systemContent },
      ...conversation.map((message) => ({ role: message.role, content: message.content })),
    ];

    setFallbackRequestId(localRequestId);
    setFallbackErrorCode(null);

    const latestUserMessage =
      [...filteredHistory].reverse().find((message) => message.role === "user")?.content ?? "";

    const showSimpleCoach = () => {
      if (simpleCoachLogged) return;
      if (!isActive()) return;
      const coach = simpleCoach({
        text: latestUserMessage,
        lessonId: resolvedLessonNumber ?? undefined,
        mode: "chat",
      });
      setSimpleCoachHint(coach);
      setFallbackStage((prev) => (prev === "retry" ? "retry" : "coach"));
      simpleCoachLogged = true;
      markChatSlaCoachShown(clientMsgId);
      void recordEduEvent({
        type: "EDU_SIMPLE_COACH_SHOWN",
        boardId: "edu_chat_panel",
        requestId: localRequestId,
        shareCode: shareCode ?? undefined,
        extra: {
          reason: fallbackReason,
        },
      });
    };

    const startRemoteFallback = async (reason: typeof fallbackReason) => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      fallbackReason = reason;
      setFallbackStage("waiting");
      setRateLimitNotice(null);
      setRemoteChatWarning(null);
      if (remoteAbortRef.current) {
        remoteAbortRef.current.abort();
      }
      const remoteController = new AbortController();
      remoteAbortRef.current = remoteController;
      safeAbortWebLLM(localRequestId);
      markChatSlaRemoteStart(clientMsgId, localRequestId);
      const remoteResult = await requestRemoteAssistant(filteredHistory, {
        requestId: localRequestId,
        signal: remoteController.signal,
      });
      if (!isActive()) {
        remoteAbortRef.current = null;
        return;
      }
      setFallbackRequestId(remoteResult.requestId ?? localRequestId);
      setFallbackErrorCode(remoteResult.ok ? null : remoteResult.errorCode);
      persistAiFallbackStatus({
        ok: remoteResult.ok,
        errorCode: remoteResult.ok ? undefined : remoteResult.errorCode,
        latencyMs: remoteResult.latencyMs,
      });
      markChatSlaRemoteStart(clientMsgId, remoteResult.requestId ?? localRequestId);
      if (controller.signal.aborted) {
        return;
      }
      if (!remoteResult.ok && remoteResult.errorCode === "EDU_AI_RATE_LIMITED") {
        void recordEduEvent({
          type: "EDU_AI_RATE_LIMIT_HIT",
          boardId: "edu_ai_fallback",
          requestId: remoteResult.requestId ?? localRequestId,
          shareCode: shareCode ?? undefined,
          extra: {
            rid: remoteResult.requestId ?? localRequestId,
            latencyMs: remoteResult.latencyMs,
            status: remoteResult.status ?? 429,
            modelHost: remoteResult.modelHost ?? null,
          },
        });
        const coach = simpleCoach({
          text: latestUserMessage,
          lessonId: resolvedLessonNumber ?? undefined,
          mode: "chat",
          reason: "rate_limit",
        });
        setSimpleCoachHint(coach);
        setFallbackStage("coach");
        setRateLimitNotice({
          requestId: remoteResult.requestId ?? localRequestId,
          errorCode: remoteResult.errorCode,
        });
        const rateLimitMessage = isTeacherMode ? RATE_LIMIT_TEACHER_MESSAGE : RATE_LIMIT_STUDENT_MESSAGE;
        replaceMessage(assistantId, rateLimitMessage, "assistant");
        setThinking(false);
        setProgressMessage("");
        clearChatFallbackTimers();
        responseText = rateLimitMessage;
        hasStarted = true;
        markChatSlaFirstResponse(clientMsgId, "coach");
        remoteAbortRef.current = null;
        return;
      }
      if (remoteResult.ok) {
        remoteSucceeded = true;
        const formatted = formatRemoteAssistantText(remoteResult.responseText, {
          prefix: simpleCoachLogged ? "추가로 이렇게 할 수 있어요." : null,
        });
        const combined = finalizeCoachText(formatted);
        replaceMessage(assistantId, combined, "assistant");
        setThinking(false);
        setProgressMessage("");
        setFallbackStage("idle");
        clearChatFallbackTimers();
        responseText = combined;
        hasStarted = true;
        markChatSlaFirstResponse(clientMsgId, "remote");
        remoteAbortRef.current = null;
        return;
      }
      const fallbackText = finalizeCoachText(COACH_SAFE_FALLBACK_MESSAGE);
      replaceMessage(assistantId, fallbackText, "assistant");
      setThinking(false);
      setProgressMessage("");
      setFallbackStage("coach");
      clearChatFallbackTimers();
      const remoteUnavailable =
        remoteResult.status === 503 || remoteResult.errorCode === "EDU_AI_NOT_CONFIGURED";
      if (remoteUnavailable) {
        setRemoteChatWarning("원격 AI 연결이 불안정해 로컬 코치로 계속 진행합니다.");
      }
      responseText = fallbackText;
      hasStarted = true;
      markChatSlaFirstResponse(clientMsgId, "coach");
      remoteAbortRef.current = null;
    };

    const degradedSnapshot = readWebllmDegradedGate();
    const degradedActive = Boolean(degradedSnapshot.until && degradedSnapshot.until > Date.now());
    const retryAllowed = degradedActive ? consumeWebllmRetryOnce() : false;
    const initialStatus = getEffectiveWebLLMStatus();
    const canonicalAssetReady = webllmHealthGate?.canonicalStatus === "WEBLLM_READY";
    const containedDispatchPlan = resolveLessonWebllmContainedDispatchPlan({
      bootstrapReady: lessonWebllmReadiness.gate.bootstrapPlan.shouldAttemptLocalInit,
      canonicalAssetReady,
      effectiveWebllmEnabled,
      wouldDispatchToWebllm: lessonWebllmDispatchSelector.wouldDispatchToWebllm,
      initialStatus,
      degradedRetryAllowed: retryAllowed,
    });
    const emitLessonWebllmExperimentOutcome = (input: {
      dispatchFailureReason?: "timeout" | "engine_error" | "no_response" | null;
      localDispatchSucceeded?: boolean;
    }) => {
      const outcome = resolveLessonWebllmExperimentOutcome({
        plan: containedDispatchPlan,
        dispatchFailureReason: input.dispatchFailureReason,
        localDispatchSucceeded: input.localDispatchSucceeded,
      });
      logDebug("[edu] webllm.dispatch.experiment", {
        requestId: localRequestId,
        dispatchMode: lessonWebllmDispatchSelector.dispatchMode,
        dispatchDecisionReason: lessonWebllmDispatchSelector.reason,
        ...outcome,
        audit: resolveLessonWebllmExperimentAuditRecord({
          selector: lessonWebllmDispatchSelector,
          plan: containedDispatchPlan,
          outcome,
        }),
      });
      const lessonScope: WebllmContainedLessonScope =
        lessonWebllmDispatchSelector.reason === "not_in_rollout_scope"
          ? "not_allowlisted"
          : lessonWebllmDispatchSelector.experimentScope.startsWith("in_scope")
            ? "allowlisted"
            : "unknown";
      const rolloutSnapshot = resolveWebllmContainedRolloutSnapshot({
        lessonScope,
        bootstrapReady: lessonWebllmReadiness.gate.bootstrapPlan.shouldAttemptLocalInit,
        canonicalReady: canonicalAssetReady,
        healthReady: webllmHealthGate?.ok === true,
        degradedBlocked: webllmDegradedBlocked,
        killSwitchOn: lessonWebllmDispatchSelector.reason === "dispatch_kill_switch_on",
        dispatchExperiment: readLessonWebllmDispatchExperimentMode(),
        activationExperiment: readLessonWebllmActivationExperimentMode(),
        shouldAttemptLocalInit: containedDispatchPlan.attemptLocalDispatch,
        shouldUseServerFallback:
          !containedDispatchPlan.attemptLocalDispatch || outcome.fallbackReason !== null,
        canonicalStatus: webllmHealthGate?.canonicalStatus ?? null,
        statusCode: lessonWebllmReadiness.gate.bootstrapPlan.statusCode,
        invalidReasons: webllmHealthGate?.invalidReasons ?? [],
      });

      let attemptDecision: WebllmContainedAttemptDecision = "fallback_only";
      if (containedDispatchPlan.attemptLocalDispatch) {
        attemptDecision = "attempted_local";
      } else if (lessonWebllmDispatchSelector.reason === "dispatch_kill_switch_on") {
        attemptDecision = "skipped_kill_switch";
      } else if (!lessonWebllmDispatchSelector.wouldDispatchToWebllm) {
        attemptDecision = "skipped_out_of_scope";
      } else if (
        containedDispatchPlan.noAttemptReason === "not_ready" ||
        containedDispatchPlan.noAttemptReason === "degraded"
      ) {
        attemptDecision = "skipped_not_ready";
      }

      let evidenceOutcome: WebllmContainedAttemptOutcome = "fallback_only";
      if (outcome.successReason) {
        evidenceOutcome = "success";
      } else if (outcome.fallbackReason === "timeout") {
        evidenceOutcome = "timeout";
      } else if (outcome.fallbackReason === "engine_error") {
        evidenceOutcome = "engine_error";
      } else if (outcome.fallbackReason === "no_response") {
        evidenceOutcome = "no_response";
      } else if (outcome.fallbackReason === "blocked") {
        evidenceOutcome = "blocked";
      } else if (
        outcome.fallbackReason === "not_ready" ||
        outcome.fallbackReason === "degraded" ||
        outcome.noAttemptReason === "not_ready" ||
        outcome.noAttemptReason === "degraded"
      ) {
        evidenceOutcome = "not_ready";
      }

      const safeReason =
        outcome.fallbackReason ??
        outcome.noAttemptReason ??
        lessonWebllmDispatchSelector.reason;
      const safeSummary = `${rolloutSnapshot.operatorState} · ${attemptDecision} · ${evidenceOutcome}`;
      appendWebllmContainedRolloutEvidence(
        buildWebllmContainedAttemptEvidence({
          lessonIdSafe: lessonId,
          operatorStateAtAttempt: rolloutSnapshot.operatorState,
          bootstrapReady: rolloutSnapshot.bootstrapReady,
          canonicalReady: rolloutSnapshot.canonicalReady,
          healthReady: rolloutSnapshot.healthReady,
          degradedBlocked: rolloutSnapshot.degradedBlocked,
          killSwitchOn: rolloutSnapshot.killSwitchOn,
          dispatchMode: lessonWebllmDispatchSelector.dispatchMode,
          attemptDecision,
          outcome: evidenceOutcome,
          safeReason,
          safeSummary,
        }),
      );
    };

    if (!containedDispatchPlan.attemptLocalDispatch) {
      emitLessonWebllmExperimentOutcome({});
      const statusDescriptor = getWebLLMStatusDescriptor(initialStatus);
      updateWebLLMStatus(initialStatus, { code: statusDescriptor.code, requestId: localRequestId });
      if (!effectiveWebllmEnabled) {
        if (webllmAuthRequired) {
          setWebllmWarning(buildErrorMessage({ code: "AUTH_ERROR" }));
        } else if (webllmSsotDisabled) {
          setWebllmWarning(buildErrorMessage({ code: "FETCH_BLOCKED" }));
        }
      } else if (initialStatus === "ENV_MISSING") {
        setWebllmWarning(buildErrorMessage({ code: "ENV_MISSING" }));
      } else if (!hasWebllmEnv && hasWebllmEnvEffective) {
        setWebllmWarning(buildErrorMessage({ code: "HEALTH_FALLBACK" }));
      } else if (initialStatus === "ASSET_UNREACHABLE" || initialStatus === "CORS_BLOCKED") {
        setWebllmWarning(buildErrorMessage({ code: "FETCH_BLOCKED" }));
      } else if (initialStatus === "ERROR") {
        setWebllmWarning(buildErrorMessage({ code: "ENGINE_ERROR" }));
      }
      fallbackReason = containedDispatchPlan.fallbackReason ?? "not_ready";
      clearChatFallbackTimers();
      simpleCoachTimerRef.current = window.setTimeout(() => {
        if (chatRequestSeqRef.current !== requestSeq) return;
        if (!isActive()) return;
        if (hasStarted || !fallbackTriggered || remoteSucceeded) return;
        showSimpleCoach();
      }, SIMPLE_COACH_DELAY_MS);
      retryTimerRef.current = window.setTimeout(() => {
        if (chatRequestSeqRef.current !== requestSeq) return;
        if (!isActive()) return;
        if (hasStarted || remoteSucceeded || !fallbackTriggered) return;
        setFallbackStage("retry");
        recordChatSlaOutcome(clientMsgId, "retry_shown", "chat_local_fallback");
      }, RETRY_PROMPT_DELAY_MS);
      await waitMs(WEBLLM_FALLBACK_DELAY_MS);
      if (!fallbackTriggered) {
        await startRemoteFallback(fallbackReason);
      }
      window.clearTimeout(timeoutId);
      cleanup();
      if (!isActive()) {
        return { ok: false, aborted: true, started: hasStarted };
      }
      if (controller.signal.aborted) {
        return { ok: false, aborted: true, started: hasStarted };
      }
      return { ok: true, responseText, notice: "fallback", started: hasStarted };
    }

    clearChatFallbackTimers();
    fallbackTimerRef.current = window.setTimeout(() => {
      if (chatRequestSeqRef.current !== requestSeq) return;
      if (!isActive()) return;
      if (hasStarted || fallbackTriggered) return;
      emitLessonWebllmExperimentOutcome({ dispatchFailureReason: "no_response" });
      void startRemoteFallback("no_response");
    }, WEBLLM_FALLBACK_DELAY_MS);
    simpleCoachTimerRef.current = window.setTimeout(() => {
      if (chatRequestSeqRef.current !== requestSeq) return;
      if (!isActive()) return;
      if (hasStarted || !fallbackTriggered || remoteSucceeded) return;
      showSimpleCoach();
    }, SIMPLE_COACH_DELAY_MS);
    retryTimerRef.current = window.setTimeout(() => {
      if (chatRequestSeqRef.current !== requestSeq) return;
      if (!isActive()) return;
      if (hasStarted || remoteSucceeded || !fallbackTriggered) return;
      setFallbackStage("retry");
      recordChatSlaOutcome(clientMsgId, "retry_shown", "chat_local_fallback");
    }, RETRY_PROMPT_DELAY_MS);

    const temperature = options?.temperature ?? 0.7;
    const inputSummary = buildSafeSummary(
      filteredHistory
        .filter((message) => message.role === "user")
        .map((message) => message.content)
        .join(" "),
      MAX_INPUT_SUMMARY,
    );
    const startTs = typeof performance === "undefined" ? Date.now() : performance.now();
    updateWebLLMStatus("LOADING", { code: "WEBLLM_LOADING", requestId: localRequestId });
    logDebug("[edu] webllm.call", {
      requestId: localRequestId,
      phase: "start",
      mode: "coach_stream",
      inputSummary,
      source: "requestAssistant",
    });
    const unsubscribe = onWebLLMProgress((event) => {
      if (event.requestId !== localRequestId || event.kind !== "streamChat") return;
      if (event.delta) {
        startStreaming(event.delta);
        return;
      }
      if (!hasStarted && isActive()) {
        setProgressMessageThrottled(event.message);
      }
    });
    const abortHandler = () => safeAbortWebLLM(localRequestId);
    controller.signal.addEventListener("abort", abortHandler);
    const response = await safeStartWebLLM(localRequestId, {
      kind: "streamChat",
      messages: localMessages,
      temperature,
      preferredModelId: preferredModelId ?? undefined,
    });
    controller.signal.removeEventListener("abort", abortHandler);
    unsubscribe();
    const localResult =
      response.type === "result" && response.kind === "streamChat"
        ? response.result
        : {
            ok: false,
            reason: "engine_error" as const,
            message:
              response.type === "error"
                ? response.error.message
                : "요청이 중단되었습니다.",
            shouldFallback: false,
          };
    const durationMs = Math.round(
      (typeof performance === "undefined" ? Date.now() : performance.now()) - startTs,
    );
    logDebug("[edu] webllm.call", {
      requestId: localRequestId,
      phase: "end",
      mode: "coach_stream",
      inputSummary,
      outputSnapshot: buildSafeSummary(
        localResult.ok ? responseText : localResult.message ?? "",
        MAX_OUTPUT_SNAPSHOT,
      ),
      durationMs,
      ok: localResult.ok,
    });

    window.clearTimeout(timeoutId);
    cleanup();

    if (!isActive()) {
      return { ok: false, aborted: true, started: hasStarted };
    }

    if (response.type === "aborted") {
      return { ok: false, aborted: true, started: hasStarted };
    }

    if (localResult.ok && "modelChoice" in localResult) {
      emitLessonWebllmExperimentOutcome({ localDispatchSucceeded: true });
      setCoachReady(true);
      setModelChoice(localResult.modelChoice);
      updateWebLLMStatus("READY", { code: "WEBLLM_READY", requestId: localRequestId });
      if (localResult.autoSelected && localResult.requestedModelId) {
        setWebllmAutoSelection({
          requested: localResult.requestedModelId,
          resolved: localResult.modelId,
        });
      }
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("edu:webllm:modelId", localResult.modelId);
          setPreferredModelId(localResult.modelId);
        } catch {
          // ignore storage failures
        }
      }
      if (!hasStarted) {
        replaceMessage(
          assistantId,
          "로컬 모델이 응답했지만 내용이 비어 있어요. 다시 시도해 볼까요?",
        );
        setThinking(false);
        markChatSlaFirstResponse(clientMsgId, "local");
      }
      setFallbackStage("idle");
      clearChatFallbackTimers();
      return { ok: true, responseText, started: hasStarted };
    }

    if (options?.signal?.aborted) {
      return { ok: false, aborted: true, started: hasStarted };
    }

    const localErrorCode = "errorCode" in localResult ? localResult.errorCode : undefined;

    if (shouldFallbackToOpenAiMainline(localResult.reason)) {
      emitLessonWebllmExperimentOutcome({
        dispatchFailureReason:
          localResult.reason === "timeout" || localResult.reason === "engine_error" ? localResult.reason : null,
      });
      if (localResult.reason === "timeout") {
        recordMetric({ t: Date.now(), type: "HARDFAIL", code: "COACH_TIMEOUT" });
      }
      const quotaExceeded = isQuotaExceededError(localResult.message);
      if (quotaExceeded) {
        decorateQuotaExceededRef.current = true;
      }
      const nextCode = quotaExceeded ? "EDU_WEBLLM_QUOTA_EXCEEDED" : localErrorCode ?? "WEBLLM_TIMEOUT";
      recordWebLLMFailure("ERROR", {
        code: nextCode,
        requestId: localRequestId,
      });
      updateWebLLMStatus("DISABLED", { code: nextCode, requestId: localRequestId });
      if (quotaExceeded) {
        setWebllmWarning("시크릿 모드는 저장공간이 제한되어 모델을 저장할 수 없어요. 일반 창에서 실행하거나 저장공간을 확보해 주세요.");
        showFastApplyNotice("시크릿 모드는 저장공간이 제한되어 모델을 저장할 수 없어요. 일반 창에서 실행하거나 저장공간을 확보해 주세요.");
        void reportUiError({
          message: localResult.message,
          route: "/edu/lesson",
          requestId: localRequestId,
          phase: "webllm.init",
          abortReason: "quota_exceeded",
        });
      } else {
        setWebllmWarning("WebLLM 오류로 로컬 AI를 잠시 끄고 서버 응답으로 전환했어요.");
      }
      await startRemoteFallback("no_response");
      setActionPrompt(buildGenerateAction());
      setPanelState("ACTION_PREPARING");
      return { ok: true, responseText, notice: "fallback", started: hasStarted };
    }

    const messageFormatError = isMessageFormatError(localResult.message);
    const isUnsupported = localResult.reason === "unsupported";
    const isFetchError = isEngineFetchError(localResult.message);
    const errorStatus = resolveLessonWebllmErrorStatus({
      errorCode: localErrorCode,
      reason: localResult.reason,
      hasWebllmEnvEffective,
    });
    recordWebLLMFailure(errorStatus, {
      code: localErrorCode ?? "WEBLLM_ERROR",
      requestId: localRequestId,
    });
    const errorCode: ErrorCode = messageFormatError
      ? "MESSAGE_SHAPE"
      : isUnsupported
        ? "RESPONSE_FORMAT_UNSUPPORTED"
        : "ENGINE_FETCH";
    const errorMessage = buildErrorMessage({
      code: errorCode,
      detail: localResult.message,
      includeWifiHint: errorCode === "ENGINE_FETCH" && isFetchError,
    });

    replaceMessage(assistantId, errorMessage, "system");
    setActionPrompt(
      messageFormatError
        ? {
            showTemplate: Boolean(onTemplateStart),
            showHelp: false,
            showRetry: false,
            showSelfcheck: true,
            showDiagnostics: false,
            showGenerate: false,
            showGenerateRetry: false,
            showTemplateChips: false,
            showRefresh: true,
          }
        : {
            showTemplate: Boolean(onTemplateStart),
            showHelp: Boolean(onHelpClick),
            showRetry: true,
            showSelfcheck: true,
            showDiagnostics: true,
            showGenerate: false,
            showGenerateRetry: false,
            showTemplateChips: false,
            showRefresh: false,
          },
    );
    const isCorsFailure = /CORS/i.test(localResult.message);
    setCorsCopyMessage(
      !messageFormatError && isCorsFailure
        ? "로컬 AI가 models.gomdory.com에서 불러오지 못했습니다. 학교/기관 네트워크에서 models.gomdory.com (GET/HEAD) CORS 허용 설정이 필요합니다."
        : null,
    );
    setCorsCopyNotice(null);
    setThinking(false);
    setFallbackStage("idle");
    clearChatFallbackTimers();
    setPanelState("ERROR_RECOVERABLE");
      return { ok: false, started: hasStarted };
    },
    [
      appendToMessage,
      buildErrorMessage,
      buildGenerateAction,
      clearChatFallbackTimers,
      finalizeCoachText,
      formatRemoteAssistantText,
      getEffectiveWebLLMStatus,
      isActiveMsgId,
      isEngineFetchError,
      isMessageFormatError,
      isTeacherMode,
      lessonChatPrompt,
      lessonId,
      logDebug,
      markChatSlaCoachShown,
      markChatSlaFirstResponse,
      markChatSlaRemoteStart,
      onHelpClick,
      onTemplateStart,
      persistAiFallbackStatus,
      preferredModelId,
      recordChatSlaOutcome,
      recordMetric,
      recordWebLLMFailure,
      replaceMessage,
      requestRemoteAssistant,
      lessonWebllmDispatchSelector,
      lessonWebllmReadiness,
      resolvedLessonNumber,
      showFastApplyNotice,
      setActionPrompt,
      setCoachReady,
      setCorsCopyMessage,
      setCorsCopyNotice,
      setFallbackErrorCode,
      setFallbackRequestId,
      setFallbackStage,
      setModelChoice,
      setPanelState,
      setPreferredModelId,
      setProgressMessage,
      setProgressMessageThrottled,
      setRateLimitNotice,
      setSimpleCoachHint,
      setThinking,
      setWebllmAutoSelection,
      shareCode,
      effectiveWebllmEnabled,
      updateWebLLMStatus,
      waitMs,
      webllmAuthRequired,
      webllmHealthGate,
      webllmDegradedBlocked,
      webllmSsotDisabled,
      hasWebllmEnv,
      hasWebllmEnvEffective,
    ],
  );

  const rewriteAssistantOnce = useCallback(
    async (assistantId: string, assistantText: string) => {
      const rewriteResult = await rewriteKoreanOnce({
        text: assistantText,
        systemPrompt: lessonChatPrompt,
        preferredModelId: preferredModelId ?? undefined,
        timeoutMs: LOCAL_TIMEOUT_MS,
      });

      if (rewriteResult.status === "rewritten") {
        replaceMessage(assistantId, finalizeCoachText(rewriteResult.text));
        return;
      }

      replaceMessage(assistantId, finalizeCoachText(assistantText));
    },
    [finalizeCoachText, lessonChatPrompt, preferredModelId, replaceMessage],
  );

  const sendMessageInternal = useCallback(
    async (
      value: string,
      signal: AbortSignal,
      runId: number,
      requestId: string | undefined,
      clientMsgId: string,
      externalSignal?: AbortSignal,
    ) => {
      const trimmed = value.trim();
      if (!trimmed || isGeneratingFiles) {
        return;
      }
      const { controller: mergedController, cleanup: mergedCleanup } = createLinkedAbortController(
        signal,
        externalSignal,
      );
      const mergedSignal = mergedController.signal;
      if (mergedSignal.aborted) {
        mergedCleanup();
        throw createAbortErrorFromSignal(mergedSignal);
      }

      const sanitizedResult = sanitizeUserInput(value);
      try {
        setLastSanitizeFlags(sanitizedResult.flags);
        recordStep("INPUT", true, `input-${runId}`);
        if (sanitizedResult.flags.tooShort) {
          recordMetric({ t: Date.now(), type: "WARN", code: "SLOW" });
        }

        let messageText = trimmed;
        if (sanitizedResult.flags.hasProfanity) {
          messageText = sanitizedResult.sanitized;
          setSanitizePulseTone("alert");
          setSanitizePulseKey((prev) => prev + 1);
          setSanitizeShakeKey((prev) => prev + 1);
        }

        if (lessonLock.enabled && !isTeacherMode) {
          const spec = getLessonSpec(lessonLock.lessonId);
          const isOffTrack = detectOffTrack(messageText, spec);
          if (isOffTrack) {
            recordMetric({ t: Date.now(), type: "WARN", code: "OFFTRACK" });
            setOffTrackPulseKey((prev) => prev + 1);
            setOffTrackVisible(true);
            if (offTrackTimerRef.current) {
              window.clearTimeout(offTrackTimerRef.current);
            }
            offTrackTimerRef.current = window.setTimeout(() => {
              setOffTrackVisible(false);
            }, 300);
          }
        }

        const nextMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: "user",
          content: messageText,
          clientMsgId,
        };

        const assistantId = `${Date.now()}-assistant`;
        const assistantPlaceholder: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          clientMsgId,
        };

        const historyMessages = [...messages, nextMessage];

        setMessages((prev) => [...prev, nextMessage, assistantPlaceholder]);
        setInput("");
        setExamplesOpen(false);
        setThinking(true);
        setProgressMessage("");
        const cachedProgress = lastWebLLMProgressRef.current;
        if (cachedProgress && Date.now() - cachedProgress.at < 15000) {
          setProgressMessageThrottled(cachedProgress.event.message);
        }
        setActionPrompt(null);
        setShowDiagnostics(false);
        setLastUserMessage(messageText);
        setCorsCopyMessage(null);
        setCorsCopyNotice(null);
        setStyleHint(null);
        setCoachAction(null);
        setLastCoachSanitizeFlags(null);
        setPanelState("COACH_STREAMING");
        resetChatFallbackUi();
        setFallbackStage("waiting");
        setFallbackMsgId(clientMsgId);
        fallbackMsgIdRef.current = clientMsgId;
        setRateLimitNotice(null);
        initChatSla(clientMsgId);

        logDebug("[edu] webllm.trigger", {
          requestId,
          source: "sendMessageInternal",
          reason: "user_message",
        });
        const response = await requestAssistant(historyMessages, assistantId, {
          signal: mergedSignal,
          requestId,
          clientMsgId,
        });
        if (!response.ok) {
          if (response.aborted) {
            if (!response.started) {
              removeMessage(assistantId);
            }
            if (coachRunIdRef.current === runId) {
              setThinking(false);
              setPanelState("ACTION_PREPARING");
            }
          }
          return;
        }

        if (mergedSignal.aborted) {
          throw createAbortErrorFromSignal(mergedSignal);
        }

        if (coachRunIdRef.current !== runId || !isActiveMsgId(clientMsgId)) {
          return;
        }

        setActionPrompt(buildGenerateAction());
        setPanelState("ACTION_PREPARING");
        const localCoachAction = deriveLocalCoachAction(messageText);
        if (localCoachAction) {
          setCoachAction(localCoachAction);
        }
        setStyleHint(null);
        if (response.notice !== "fallback") {
          void requestCoachAction(historyMessages, response.responseText, requestId)
            .then((action) => {
              if (action) {
                setCoachAction(action);
              }
            })
            .catch(() => {
              return;
            });
          setIsRewriting(true);
          void rewriteAssistantOnce(assistantId, response.responseText)
            .catch(() => undefined)
            .finally(() => {
              if (coachRunIdRef.current === runId) {
                setIsRewriting(false);
              }
            });
        }
      } finally {
        mergedCleanup();
      }
    },
    [
      buildGenerateAction,
      deriveLocalCoachAction,
      initChatSla,
      isActiveMsgId,
      isGeneratingFiles,
      isTeacherMode,
      lessonLock,
      logDebug,
      messages,
      recordMetric,
      recordStep,
      removeMessage,
      requestAssistant,
      requestCoachAction,
      resetChatFallbackUi,
      rewriteAssistantOnce,
      setActionPrompt,
      setCoachAction,
      setCorsCopyMessage,
      setCorsCopyNotice,
      setExamplesOpen,
      setFallbackMsgId,
      setFallbackStage,
      setInput,
      setIsRewriting,
      setLastCoachSanitizeFlags,
      setLastSanitizeFlags,
      setLastUserMessage,
      setMessages,
      setOffTrackPulseKey,
      setOffTrackVisible,
      setPanelState,
      setProgressMessage,
      setProgressMessageThrottled,
      setRateLimitNotice,
      setSanitizePulseKey,
      setSanitizePulseTone,
      setSanitizeShakeKey,
      setShowDiagnostics,
      setStyleHint,
      setThinking,
    ],
  );

  const sendMessageTemplateFirst = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || isGeneratingFiles) {
        return;
      }
      setManualFallbackReason(null);
      setLastApplyOutcome(null);
      const requestId = startRequest("sendMessageTemplateFirst");
      const sanitizedResult = sanitizeUserInput(value);
      setLastSanitizeFlags(sanitizedResult.flags);
      recordStep("INPUT", true, `input-${Date.now()}`);
      let messageText = trimmed;
      if (sanitizedResult.flags.hasProfanity) {
        messageText = sanitizedResult.sanitized;
        setSanitizePulseTone("alert");
        setSanitizePulseKey((prev) => prev + 1);
        setSanitizeShakeKey((prev) => prev + 1);
      }

      const nextMessage: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: "user",
        content: messageText,
      };

      const assistantId = `${Date.now()}-template-helper`;
      setMessages((prev) => [...prev, nextMessage]);
      setInput("");
      setExamplesOpen(false);
      setThinking(false);
      setProgressMessage("");
      setActionPrompt(buildGenerateAction());
      setShowDiagnostics(false);
      setLastUserMessage(messageText);
      setCorsCopyMessage(null);
      setCorsCopyNotice(null);
      setStyleHint(null);
      setCoachAction(null);
      setLastCoachSanitizeFlags(null);
      setPanelState("ACTION_PREPARING");
      resetChatFallbackUi();
      setIsDirty(true);
      logDebug("[edu] template.trigger", {
        requestId,
        source: "sendMessageTemplateFirst",
        reason: "user_message",
      });
      void runFastApply(messageText, requestId).then((result) => {
        const isSlotChoice = result.reason === "slot_choice";
        const isSlotTargetMissing = result.reason === "slot_target_missing";
        const content = result.applied
          ? "템플릿을 먼저 채워뒀어요. 내용은 직접 고쳐도 되고, 필요하면 아래 “AI로 꾸미기”를 눌러볼까요?"
          : isSlotChoice
            ? "미리보기를 만들 준비가 됐어요. 바로 꾸며볼까요?"
            : isSlotTargetMissing
              ? "바꿀 위치를 다시 찾고 있어요. 바로 미리보기를 이어서 만들게요."
              : "조금 더 빠른 방식으로 미리보기를 만들고 있어요.";
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content,
          },
        ]);
        if (!result.applied) {
          setManualFallbackReason(isSlotChoice || isSlotTargetMissing ? "apply_failed" : "apply_failed");
        }
      });
    },
    [
      buildGenerateAction,
      isGeneratingFiles,
      logDebug,
      recordStep,
      runFastApply,
      setActionPrompt,
      setCoachAction,
      setCorsCopyMessage,
      setCorsCopyNotice,
      setExamplesOpen,
      setInput,
      setLastApplyOutcome,
      setLastCoachSanitizeFlags,
      setLastSanitizeFlags,
      setLastUserMessage,
      setManualFallbackReason,
      setMessages,
      setPanelState,
      setProgressMessage,
      resetChatFallbackUi,
      setSanitizePulseKey,
      setSanitizePulseTone,
      setSanitizeShakeKey,
      setShowDiagnostics,
      setStyleHint,
      setThinking,
      startRequest,
    ],
  );

  const startStudentCoachPipeline = useCallback(async (value: string, requestId: string) => {
    const trimmed = value.trim();
    if (!trimmed || isGeneratingFiles) {
      return null;
    }
    const selectedExample = studentDecorateSelectedExampleRef.current;
    const hasLessonAwareOrigin = Boolean(selectedExample && selectedExample.prompt === trimmed);
    studentDecorateExampleOriginRef.current = hasLessonAwareOrigin && selectedExample
      ? {
          kind: selectedExample.kind,
          promptClass: selectedExample.promptClass,
          index: selectedExample.index,
          lessonAware: selectedExample.lessonAware,
        }
      : null;
    studentDecorateSelectedExampleRef.current = null;
    const clickAt = performance.now();
    studentDecorateClickAtRef.current = clickAt;
    studentDecorateTransactionAtRef.current = null;
    studentDecorateKickoffAtRef.current = null;
    void recordEduEvent({
      type: "decorate_click",
      boardId: "edu_chat_panel",
      requestId,
      shareCode: shareCode ?? undefined,
      extra: { promptLen: trimmed.length, path: "decorate_local", entry: "student_surface" },
    });
    if (performance.now() - clickAt > 100) {
      console.error("[decorate] invariant violation", { missing: "decorate_click_within_100ms", requestId });
      void recordEduEvent({
        type: "decorate_pipeline_invariant_violation",
        boardId: "edu_chat_panel",
        requestId,
        shareCode: shareCode ?? undefined,
        extra: { missing: "decorate_click_within_100ms", path: "decorate_local" },
      });
    }
    setManualFallbackReason(null);
    setLastApplyOutcome(null);
    setLastUserMessage(trimmed);
    const nextMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, nextMessage]);
    setInput("");
    setThinking(false);
    const result = await startDecorateViaController(trimmed);
    if (!result.ok) {
      setManualFallbackReason("apply_failed");
    }
    return result;
  }, [isGeneratingFiles, setLastApplyOutcome, setLastUserMessage, setManualFallbackReason, setMessages, setInput, setThinking, shareCode, startDecorateViaController]);

  const startStudentDecorate = useCallback(async (prompt: string, requestId: string) => {
    setStudentDecorateUiState("sending");
    void recordEduEvent({
      type: "decorate_dispatch_entered",
      boardId: "edu_chat_panel",
      requestId,
      shareCode: shareCode ?? undefined,
      extra: { path: "decorate_local", entry: "student_surface" },
    });
    const result = await startStudentCoachPipeline(prompt, requestId);
    setStudentDecorateUiState(
      resolveStudentDecorateStartOutcomeState({
        ok: result?.ok === true,
        canApplyPreview: Boolean(decoratePendingApplyRef.current?.handoff.applyEligibility),
      }),
    );
  }, [shareCode, startStudentCoachPipeline]);

  useEffect(() => {
    if (studentDecorateSendingTimerRef.current) {
      window.clearTimeout(studentDecorateSendingTimerRef.current);
      studentDecorateSendingTimerRef.current = null;
    }
    if (studentDecorateUiState !== "sending") return;
    studentDecorateSendingTimerRef.current = window.setTimeout(() => {
      setStudentDecorateUiState((prev) => {
        if (prev !== "sending") return prev;
        void recordEduEvent({
          type: "decorate_dispatch_blocked",
          boardId: "edu_chat_panel",
          requestId: decoratePendingApplyRef.current?.requestId ?? null,
          shareCode: shareCode ?? undefined,
          extra: { reason: "invalid_state", detail: "sending_timeout_10s", path: "decorate_local" },
        });
        return "failed";
      });
    }, 10_000);
    return () => {
      if (!studentDecorateSendingTimerRef.current) return;
      window.clearTimeout(studentDecorateSendingTimerRef.current);
      studentDecorateSendingTimerRef.current = null;
    };
  }, [shareCode, studentDecorateUiState]);

  const applyStudentDecoratePreview = useCallback(async () => {
    if (studentDecorateUiState !== "ready") {
      return;
    }
    setStudentDecorateUiState("sending");
    void recordEduEvent({
      type: "decorate_apply_start",
      boardId: "edu_chat_panel",
      requestId: decoratePendingApplyRef.current?.requestId ?? null,
      shareCode: shareCode ?? undefined,
      extra: { path: "decorate_local", entry: "student_surface" },
    });
    const applied = await applyPendingDecorate();
    const appliedRequestId = decoratePendingApplyRef.current?.requestId ?? null;
    if (applied) {
      decoratePendingApplyRef.current = null;
      setDecorateHasPendingApply(false);
      void recordEduEvent({
        type: "student_decorate_state_normalized",
        boardId: "edu_chat_panel",
        requestId: appliedRequestId,
        shareCode: shareCode ?? undefined,
        extra: {
          fromState: "sending",
          toState: "idle",
          reason: "apply_commit",
          path: "decorate_local",
        },
      });
    }
    setStudentDecorateUiState("idle");
  }, [applyPendingDecorate, shareCode, studentDecorateUiState]);

  const studentPrimaryCanApplyPreview =
    decorateHasPendingApply && Boolean(decoratePendingApplyRef.current?.handoff.applyEligibility);
  const studentCtaModel = resolveStudentDecorateCtaModel({
    uiState: studentDecorateUiState,
    canApplyPreview: studentPrimaryCanApplyPreview,
    inputValue: input,
  });
  const studentPrimaryMode = studentCtaModel.mode;
  const studentPrimaryDisabled = studentCtaModel.disabled;
  const studentRenderState = studentCtaModel.state;

  useEffect(() => {
    if (studentCtaModel.normalized && studentDecorateUiState !== studentCtaModel.state) {
      void recordEduEvent({
        type: "student_decorate_state_normalized",
        boardId: "edu_chat_panel",
        requestId: decoratePendingApplyRef.current?.requestId ?? null,
        shareCode: shareCode ?? undefined,
        extra: {
          fromState: studentDecorateUiState,
          toState: studentCtaModel.state,
          reason: studentCtaModel.reason ?? "inconsistent_cta_model",
          path: "decorate_local",
        },
      });
      setStudentDecorateUiState(studentCtaModel.state);
    }
  }, [shareCode, studentCtaModel, studentDecorateUiState]);

  const runStudentPrimaryAction = useCallback((source: StudentDecorateSubmitSource) => {
    const plan = createStudentDecorateActionPlan({
      source,
      uiState: studentDecorateUiState,
      ctaMode: studentCtaModel.mode,
      ctaDisabled: studentCtaModel.disabled,
      inputValue: input,
      shareCode,
      isTeacherMode,
      createRequestId,
      pendingRequestId: decoratePendingApplyRef.current?.requestId ?? null,
    });
    recordStudentChatPanelTelemetryEvents(plan.telemetryEvents, shareCode);
    if (plan.effect.kind === "blocked") {
      return;
    }
    if (plan.effect.kind === "apply") {
      void applyStudentDecoratePreview();
      return;
    }
    void startStudentDecorate(plan.effect.prompt, plan.effect.requestId);
  }, [applyStudentDecoratePreview, input, isTeacherMode, shareCode, startStudentDecorate, studentCtaModel, studentDecorateUiState]);


  const startCoachRequest = useCallback(
    (value: string, requestId: string) => {
      const trimmed = value.trim();
      if (!trimmed || isGeneratingFiles) {
        return;
      }
      setIsDirty(true);
      setManualFallbackReason(null);
      setLastApplyOutcome(null);
      const clientMsgId = createClientMsgId();
      syncActiveMsgId(clientMsgId);
      const chatController = resetChatAbortController();
      clearChatFallbackTimers();
      if (remoteAbortRef.current) {
        remoteAbortRef.current.abort();
        remoteAbortRef.current = null;
      }
      coachRequestIdRef.current = requestId;
      const runId = (coachRunIdRef.current += 1);
      setCoachRunning(true);
      recordStep("COACH", true, `coach-${runId}`);
      void coachFlightRef.current
        .run((signal) =>
          sendMessageInternal(value, signal, runId, requestId, clientMsgId, chatController.signal),
        )
        .catch((error) => {
          if (isAbortError(error)) {
            return;
          }
          if (process.env.NODE_ENV !== "production") {
            console.error(error);
          }
        })
        .finally(() => {
          if (coachRunIdRef.current === runId && !coachFlightRef.current.isRunning()) {
            setCoachRunning(false);
          }
        });
    },
    [
      clearChatFallbackTimers,
      isGeneratingFiles,
      recordStep,
      resetChatAbortController,
      sendMessageInternal,
      syncActiveMsgId,
    ],
  );

  const runCoachPrimaryAction = useCallback(
    (source: StudentCoachSubmitSource, value = input) => {
      if (isTemplateFirst) {
        sendMessageTemplateFirst(value);
        return;
      }
      const plan = createStudentCoachActionPlan({
        source,
        inputValue: value,
        isGeneratingFiles,
        coachUnavailable: opsMode === "ai_off",
        isOpsModeLocked,
        createRequestId: () => startRequest("sendMessage"),
      });
      recordStudentChatPanelTelemetryEvents(plan.telemetryEvents, shareCode);
      if (plan.effect.kind === "blocked") {
        const blockedDecision = plan.decision;
        if (blockedDecision.kind === "blocked" && blockedDecision.reason === "ops_locked" && isTeacherMode) {
          showTeacherToast("현재 운영 바에서 AI를 멈췄어요. 기본으로 되돌리면 다시 실행할 수 있어요.");
        }
        return;
      }
      startCoachRequest(plan.effect.prompt, plan.effect.requestId);
    },
    [
      opsMode,
      input,
      isGeneratingFiles,
      isOpsModeLocked,
      isTeacherMode,
      isTemplateFirst,
      sendMessageTemplateFirst,
      shareCode,
      showTeacherToast,
      startCoachRequest,
      startRequest,
    ],
  );

  const handleAbort = useCallback(() => {
    recordMetric({ t: Date.now(), type: "ACTION", name: "ABORT" });
    if (isTemplateFirst && isGeneratingFiles) {
      abortTemplateFirstGeneration("user");
      return;
    }
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
      chatAbortRef.current = null;
    }
    coachFlightRef.current.abort();
    decorateFlightRef.current.abort(
      buildAbortMetaFromDecorateMetrics(decorateMetricsRef.current, {
        abortReason: "user_cancel",
        phase: "decorate.cancel",
        usingLocalWebLLM: effectiveWebllmEnabled,
        modelId: decorateCoachModelId ?? null,
      }),
    );
    if (coachRequestIdRef.current) {
      safeAbortWebLLM(coachRequestIdRef.current);
    }
    if (generatorRequestIdRef.current) {
      safeAbortWebLLM(generatorRequestIdRef.current);
    }
    setCoachRunning(false);
    setGenRunning(false);
    setThinking(false);
    setProgressMessage("");
    setFileProgressMessage("");
    setPanelState("ACTION_PREPARING");
    setActionPrompt(null);
    setShowDiagnostics(false);
    setCorsCopyMessage(null);
    setCorsCopyNotice(null);
    setLastGeneratorNotice(null);
    setLastCoachSanitizeFlags(null);
    setIsRewriting(false);
    setManualFallbackReason(null);
    setLastApplyOutcome(null);
    resetChatFallbackUi();
    clearChatRequestTracking();
    if (remoteAbortRef.current) {
      remoteAbortRef.current.abort();
      remoteAbortRef.current = null;
    }
  }, [
    abortTemplateFirstGeneration,
    isGeneratingFiles,
    isTemplateFirst,
    recordMetric,
    resetChatFallbackUi,
    clearChatRequestTracking,
    setLastApplyOutcome,
    setManualFallbackReason,
    effectiveWebllmEnabled,
    decorateCoachModelId,
  ]);

  const handleFallbackRetry = useCallback(() => {
    if (!lastUserMessage) return;
    if (!isTeacherMode) return;
    const targetMsgId = fallbackMsgIdRef.current;
    if (!targetMsgId || targetMsgId !== activeMsgIdRef.current) return;
    if (retryConsumedRef.current.has(targetMsgId)) return;
    retryConsumedRef.current.add(targetMsgId);
    handleAbort();
    window.setTimeout(() => {
      runCoachPrimaryAction("fallback_retry", lastUserMessage);
    }, 0);
  }, [handleAbort, isTeacherMode, lastUserMessage, runCoachPrimaryAction]);

  useEffect(() => {
    if (opsMode === "normal") return;
    handleAbort();
  }, [handleAbort, opsMode]);

  const applySnapshotRestore = useCallback((snapshot: FileSnapshot | null) => {
    if (!snapshot) return;
    coachFlightRef.current.abort();
    decorateFlightRef.current.abort(
      buildAbortMetaFromDecorateMetrics(decorateMetricsRef.current, {
        abortReason: "navigation",
        phase: "decorate.navigation",
        usingLocalWebLLM: effectiveWebllmEnabled,
        modelId: decorateCoachModelId ?? null,
      }),
    );
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
      chatAbortRef.current = null;
    }
    if (coachRequestIdRef.current) {
      safeAbortWebLLM(coachRequestIdRef.current);
    }
    if (generatorRequestIdRef.current) {
      safeAbortWebLLM(generatorRequestIdRef.current);
    }
    setCoachRunning(false);
    setGenRunning(false);
    setThinking(false);
    setProgressMessage("");
    setFileProgressMessage("");
    setActionPrompt(null);
    setShowDiagnostics(false);
    setCorsCopyMessage(null);
    setCorsCopyNotice(null);
    setLastGeneratorNotice(null);
    setIsRewriting(false);
    resetChatFallbackUi();
    onFilesMerged(snapshot.files as Record<string, WorkspaceFile>);
    setPanelState("APPLIED");
    setLastApplyOutcome("done");
    setManualFallbackReason(null);
    setUndoPulseKey((prev) => prev + 1);
    setIsDirty(true);
    refreshUndoRedo();
    clearChatRequestTracking();
  }, [
    clearChatRequestTracking,
    onFilesMerged,
    refreshUndoRedo,
    resetChatFallbackUi,
    setLastApplyOutcome,
    setManualFallbackReason,
    effectiveWebllmEnabled,
    decorateCoachModelId,
  ]);

  const handleUndo = useCallback(() => {
    applySnapshotRestore(snapshotRef.current.undo());
  }, [applySnapshotRestore]);

  const handleRedo = useCallback(() => {
    applySnapshotRestore(snapshotRef.current.redo());
  }, [applySnapshotRestore]);

  const getAppBuildId = useCallback(() => {
    if (typeof window === "undefined") return null;
    const nextData = (window as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__;
    return typeof nextData?.buildId === "string" ? nextData.buildId : null;
  }, []);

  const fetchBuildIdFromAsset = useCallback(async () => {
    if (typeof window === "undefined") return null;
    if (buildIdCacheRef.current.fetched) {
      return buildIdCacheRef.current.value;
    }
    const candidates = ["/BUILD_ID", "/_next/static/BUILD_ID"];
    for (const path of candidates) {
      try {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) continue;
        const text = (await response.text()).trim();
        if (text) {
          buildIdCacheRef.current = { fetched: true, value: text };
          return text;
        }
      } catch {
        // ignore fetch failures
      }
    }
    buildIdCacheRef.current = { fetched: true, value: null };
    return null;
  }, []);

  const getSafeBuildId = useCallback(async () => {
    const assetBuildId = await fetchBuildIdFromAsset();
    return assetBuildId ?? getAppBuildId();
  }, [fetchBuildIdFromAsset, getAppBuildId]);

  const buildSafeMetricsExport = useCallback(
    async (options?: { includeEvents?: boolean }) => {
      const buildId = await getSafeBuildId();
      const templateKey = lastTemplateKeyRef.current ?? selectedTemplateKey ?? null;
      return metricsRef.current.exportSafe({
        buildId,
        currentStepId,
        templateKey,
        panelState,
        recentEvents: options?.includeEvents === false ? undefined : safeEventBufferRef.current,
      });
    },
    [currentStepId, getSafeBuildId, panelState, selectedTemplateKey],
  );

  const exportDiagnostics = useCallback(async () => {
    recordMetric({ t: Date.now(), type: "ACTION", name: "EXPORT" });
    const files = currentFiles ?? {};
    const fileNames = Object.keys(files).sort((a, b) => a.localeCompare(b));
    const fileLengths = fileNames.map((name) => files[name]?.content.length ?? 0);
    const codeHash = fileNames.length > 0 ? await hashSnapshotFiles(files) : undefined;
    const metrics = await buildSafeMetricsExport();
    const metricsSummary = normalizeMetricsSummary(metricsRef.current.summary());
    const payload = {
      ts: new Date().toISOString(),
      lesson: { id: metricsSummary.lessonId, locked: metricsSummary.locked },
      progress: {
        pct: metricsSummary.progressPct,
        done: metricsSummary.doneCount,
        warn: metricsSummary.warnCount,
        hardFail: metricsSummary.hardFailCount,
      },
      steps: metricsSummary.step,
      recentWarnCodes: metricsSummary.recentWarnCodes,
      currentStepId,
      phase: panelState,
      coachRunning,
      genRunning,
      dirty: isDirty,
      coachSanitizeFlags: lastCoachSanitizeFlags,
      filesMeta: {
        names: fileNames,
        lens: fileLengths,
        codeHash,
      },
      snapshotCount: snapshotRef.current.size(),
      metrics,
    };
    const content = JSON.stringify(payload, null, 2);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return;
    }
    const blob = new Blob([content], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `edu-safe-export-${Date.now()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }, [
    buildSafeMetricsExport,
    coachRunning,
    currentFiles,
    currentStepId,
    genRunning,
    hashSnapshotFiles,
    isDirty,
    lastCoachSanitizeFlags,
    panelState,
    recordMetric,
  ]);

  const exportSafeErrorDiagnostics = useCallback(
    async (requestId: string) => {
      const files = currentFiles ?? {};
      const codeHash =
        lastCodeHash ?? (Object.keys(files).length > 0 ? await hashSnapshotFiles(files) : undefined);
      const metrics = await buildSafeMetricsExport();
      const payload = {
        ts: new Date().toISOString(),
        requestId,
        currentStepId,
        codeHash,
        metrics,
      };
      const content = JSON.stringify(payload, null, 2);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        return;
      }
      const blob = new Blob([content], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `edu-safe-export-${Date.now()}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
    },
    [buildSafeMetricsExport, currentFiles, currentStepId, hashSnapshotFiles, lastCodeHash],
  );

  const safeMetricsSummary = useMemo(
    () => normalizeMetricsSummary(metricsSummary),
    [metricsSummary],
  );

  const toggleAutosave = useCallback((nextEnabled: boolean) => {
    setAutosaveEnabledState(nextEnabled);
    setAutosaveEnabled(nextEnabled);
    if (!nextEnabled) {
      clearLocalAutosave();
      return;
    }
    scheduleAutosave(currentFiles, { immediate: true });
  }, [currentFiles, scheduleAutosave]);

  const hardResetSession = useCallback(() => {
    recordMetric({ t: Date.now(), type: "ACTION", name: "RESET_SESSION" });
    coachFlightRef.current.abort();
    decorateFlightRef.current.abort(
      buildAbortMetaFromDecorateMetrics(decorateMetricsRef.current, {
        abortReason: "navigation",
        phase: "decorate.navigation",
        usingLocalWebLLM: effectiveWebllmEnabled,
        modelId: decorateCoachModelId ?? null,
      }),
    );
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
      chatAbortRef.current = null;
    }
    setCoachRunning(false);
    setGenRunning(false);
    setThinking(false);
    setProgressMessage("");
    setFileProgressMessage("");
    setActionPrompt(null);
    setShowDiagnostics(false);
    setLastUserMessage(null);
    setCorsCopyMessage(null);
    setCorsCopyNotice(null);
    setLastGeneratorNotice(null);
    setCoachAction(null);
    setLastCoachSanitizeFlags(null);
    setIsRewriting(false);
    setStyleHint(null);
    setSelectedTemplateKey(null);
    setExamplesOpen(false);
    setPresetMoreOpen(false);
    setPanelState("ACTION_PREPARING");
    try {
      window.localStorage.removeItem(chatStorageKey);
    } catch {
      // ignore storage failures
    }
    setMessages(initialMessages);
    setAutoScroll(true);
    setShowJump(false);
    setInput("");
    setIsDirty(false);
    setLastApplyTs(undefined);
    setLastCodeHash(undefined);
    snapshotRef.current.clear();
    recordedStepIdsRef.current.clear();
    safeEventBufferRef.current = [];
    lastLessonMetricRef.current = null;
    lastProgressStepRef.current = null;
    lastTemplateKeyRef.current = null;
    clearChatRequestTracking();
    refreshUndoRedo();
    clearLocalAutosave();
    onTemplateStart?.();
  }, [
    chatStorageKey,
    clearChatRequestTracking,
    initialMessages,
    onTemplateStart,
    recordMetric,
    refreshUndoRedo,
    effectiveWebllmEnabled,
    decorateCoachModelId,
  ]);

  useEffect(() => {
    const handleReset = () => {
      hardResetSession();
    };
    window.addEventListener(CHAT_RESET_EVENT, handleReset);
    return () => window.removeEventListener(CHAT_RESET_EVENT, handleReset);
  }, [hardResetSession]);

  const handleErrorRetry = useCallback(() => {
    hardResetSession();
    setErrorBoundaryKey((prev) => prev + 1);
  }, [hardResetSession]);

  useEffect(() => {
    return () => {
      safeAbortWebLLM(coachRequestIdRef.current);
      safeAbortWebLLM(generatorRequestIdRef.current);
      window.setTimeout(() => {
        try {
          terminateWebLLMWorker();
        } catch {
          // best-effort cleanup
        }
      }, 0);
    };
  }, []);

  useEffect(() => {
    return () => {
      safeAbortWebLLM(coachRequestIdRef.current);
      safeAbortWebLLM(generatorRequestIdRef.current);
      window.setTimeout(() => {
        try {
          terminateWebLLMWorker();
        } catch {
          // best-effort cleanup
        }
      }, 0);
    };
  }, [pathname]);

  const resetEngine = useCallback(async () => {
    if (!effectiveWebllmEnabled) return;
    recordMetric({ t: Date.now(), type: "ACTION", name: "RESET_ENGINE" });
    handleAbort();
    const requestId = createRequestId();
    await Promise.all([
      safeStartWebLLM(`${requestId}-coach`, { kind: "reset", scope: "coach" }),
      safeStartWebLLM(`${requestId}-generator`, { kind: "reset", scope: "generator" }),
    ]);
  }, [effectiveWebllmEnabled, handleAbort, recordMetric]);

  useImperativeHandle(
    ref,
    () => ({
      generate: () => {
        void generateFilesFromHistory();
      },
      abortAll: handleAbort,
      resetEngine: () => {
        void resetEngine();
      },
      hardReset: hardResetSession,
      undo: handleUndo,
      redo: handleRedo,
      exportDiagnostics: () => {
        void exportDiagnostics();
      },
      toggleAutosave: () => toggleAutosave(!autosaveEnabled),
      getMessageCount: () => messages.length,
    }),
    [
      autosaveEnabled,
      exportDiagnostics,
      generateFilesFromHistory,
      handleRedo,
      handleUndo,
      handleAbort,
      hardResetSession,
      messages.length,
      resetEngine,
      toggleAutosave,
    ],
  );

  const isStudentPresentation = presentationMode && !isTeacherMode;
  const isStudentDecorateSurface = isTemplateFirst && !isTeacherMode;
  const effectiveWebllmStatus = getEffectiveWebLLMStatus();
  const coachUnavailable = opsMode === "ai_off";
  const showNetworkBanner = !isTeacherMode && !isStudentPresentation && !isStudentDecorateSurface && networkPrepStatus.stage !== "idle";
  const networkBannerMessage =
    networkPrepStatus.stage === "fallback"
      ? "네트워크가 혼잡해요. 잠시 후 자동으로 진행합니다."
      : "수업 준비 중(최대 8초) …";
  const contextualIntent = useMemo(() => {
    const prompt = lastUserMessage?.trim();
    if (!prompt) return null;
    const intent = routeDecorateIntent(prompt);
    const styleIntent = classifyDecorateStyleIntent({ prompt, intent });
    return { prompt, intent, styleIntent: styleIntent.styleIntent };
  }, [lastUserMessage]);
  const canShowDecorateAssistUi = shouldShowStudentDecorateAssistUi({
    isStudentDecorateSurface,
    isTeacherMode,
  });
  const isImageRequest = Boolean(lastUserMessage && IMAGE_REQUEST_PATTERN.test(lastUserMessage));
  const waitingInitialActions: WaitingActionId[] = ["image-slot", "title-intro"];
  const waitingExpandedActions: WaitingActionId[] = isImageRequest
    ? ["image-slot", "sticker"]
    : ["title-intro", "text-box"];
  const waitingActionIds =
    waitingActionStage === "expanded" ? waitingExpandedActions : waitingInitialActions;
  const showWaitingActions = canShowDecorateAssistUi && waitingActionStage !== "idle";
  const fallbackActionIds = getContextualFallbackActions({
    isStudentDecorateSurface,
    primaryIntent: contextualIntent?.intent.primaryIntent ?? null,
    styleIntent: contextualIntent?.styleIntent ?? null,
    prompt: contextualIntent?.prompt ?? null,
  });
  const showFallbackActions =
    fallbackActionIds.length > 0 &&
    (actionPhase === "partial" || actionPhase === "failed") &&
    (!isStudentDecorateSurface || Boolean(contextualIntent?.prompt));
  const showSlotChoiceActions =
    canShowDecorateAssistUi &&
    actionPhase === "choice" &&
    !(decorateTransactionPhase !== "idle" && decorateTransactionPhase !== "completed" && decorateTransactionPhase !== "error" && decorateTransactionPhase !== "blocked");
  const showFileProgress =
    panelState === "GENERATING_FILES" || panelState === "POSTPROCESSING_FILES";
  const fileProgressLabel = isTemplateFirst
    ? "AI로 꾸미는 중…"
    : panelState === "POSTPROCESSING_FILES"
      ? "파일 정리 중…"
      : "파일 생성 중…";
  const progressPhase =
    panelState === "COACH_STREAMING"
      ? "COACH_STREAMING"
      : panelState === "GENERATING_FILES"
        ? "GENERATING"
        : panelState === "POSTPROCESSING_FILES"
          ? "APPLYING"
          : panelState === "APPLIED"
            ? "DONE"
            : "IDLE";
  const progressIndex =
    panelState === "APPLIED"
      ? 3
      : panelState === "GENERATING_FILES" || panelState === "POSTPROCESSING_FILES"
        ? 2
        : panelState === "READY_TO_GENERATE" || panelState === "ACTION_PREPARING"
          ? 1
          : panelState === "COACH_STREAMING"
            ? 0
          : panelState === "ERROR_RECOVERABLE" && actionPrompt?.showGenerateRetry
            ? 2
            : 1;
  const isFallbackActive = Boolean(fallbackMsgId && fallbackMsgId === activeMsgId);
  const retryUsed = fallbackMsgId ? retryConsumedRef.current.has(fallbackMsgId) : false;
  const recordProgressStepEvent = useCallback(
    (prefix: "step_enter" | "step_complete", stepId: EduPanelStepId) => {
      recordEvent(`${prefix}_${stepId}` as EduMetricEventName, undefined, { stepId });
    },
    [recordEvent],
  );
  useEffect(() => {
    const stepId = currentStepId;
    const previousStep = lastProgressStepRef.current;
    if (previousStep === stepId) return;
    if (previousStep) {
      recordProgressStepEvent("step_complete", previousStep);
    }
    recordProgressStepEvent("step_enter", stepId);
    lastProgressStepRef.current = stepId;
  }, [currentStepId, recordProgressStepEvent]);
  const isDecorateCooldownActive = decorateCooldownUntilMs > Date.now();
  const showGenerateButton = !isStudentDecorateSurface && !isStudentPresentation && !isOpsModeLocked && (isTemplateFirst ? true : panelState !== "APPLIED");
  const showRedoButton = !isTemplateFirst && panelState === "APPLIED";
  const decorateCooldownEnabled = isTemplateFirst && !isTeacherMode && isDecorateCooldownActive;
  const decorateCooldownOnly =
    decorateCooldownEnabled && !isGeneratingFiles && !coachUnavailable;
  const generateButtonLabel = isTemplateFirst
    ? studentPrimaryMode === "apply"
      ? "이대로 적용하기"
      : studentDecorateUiState === "sending"
        ? "적용 중..."
        : decorateCooldownOnly
          ? "잠깐만! (10초)"
          : "AI로 꾸미기"
    : "사이트 생성";
  const generateButtonAriaLabel = isTemplateFirst ? "AI로 꾸미기" : "웹사이트 만들기";
  const generateDisabled = isTemplateFirst && !isTeacherMode
    ? studentPrimaryDisabled
    : isTemplateFirst
      ? isGeneratingFiles
      : !isGenerateReady ||
        !(
          panelState === "READY_TO_GENERATE" ||
          (panelState === "ERROR_RECOVERABLE" && actionPrompt?.showGenerateRetry)
        ) ||
        isOpsModeLocked;
  const redoDisabled = !isGenerateReady || isGeneratingFiles;
  const generateSpinner = isCoachBusy || isGeneratingFiles;
  const showCancelButton = isCoachBusy || isGeneratingFiles;
  const showTemplateApplyButton = canShowDecorateAssistUi && isTemplateFirst && isTeacherMode && Boolean(lastUserMessage);
  const inputPhase = isCoachBusy || isGeneratingFiles
    ? "busy"
    : panelState === "READY_TO_GENERATE"
      ? "ready"
      : panelState === "ERROR_RECOVERABLE"
        ? "error"
        : "idle";
  const sendDisabled =
    !input.trim() ||
    isGeneratingFiles ||
    (!isStudentPresentation && !isTemplateFirst && coachUnavailable) ||
    (!isStudentPresentation && !isTemplateFirst && isOpsModeLocked);
  const inputPlaceholder = isStudentDecorateSurface
    ? studentDecorateInputGuidance.placeholder
    : isTemplateFirst
      ? "내용을 바꿔볼 문장을 적어보세요."
    : isTeacherMode
      ? "AI에게 요청해 보세요"
      : "…";
  const manualFallbackActions = useMemo(() => {
    if (!manualFallbackReason && opsMode !== "simple") return [];
    const actions: {
      id: string;
      label: string;
      onClick: () => void;
    }[] = [];
    if (isTemplateFirst && lastUserMessage) {
      actions.push({
        id: "template-apply",
        label: "문장만 템플릿에 넣기",
        onClick: () => {
          if (decorateHasPendingApply) {
            void applyPendingDecorate();
            return;
          }
          void recordEduEvent({
            type: "decorate_gate_bypassed",
            boardId: "edu_chat_panel",
            shareCode: shareCode ?? undefined,
            extra: { gate: "manual_fallback_actions", path: "decorate_local" },
          });
          void startDecorateViaController(lastUserMessage ?? "").then((result) => {
            if (!result.ok) {
              setManualFallbackReason("apply_failed");
            }
          });
        },
      });
    }
    if (manualFallbackReason === "slot_target_missing" && resolvedLessonId === "P1") {
      void recordEduEvent({
        type: "decorate_gate_removed",
        boardId: "edu_chat_panel",
        shareCode: shareCode ?? undefined,
        extra: { gate: "slot_choice_action", path: "decorate_local" },
      });
    }
    actions.push({
      id: "fallback-template",
      label: "기본 템플릿으로 시작",
      onClick: () => {
        void applyManualFallbackTemplate();
      },
    });
    if (onTemplateStart) {
      actions.push({
        id: "template-reset",
        label: "템플릿 다시 고르기",
        onClick: () => {
          onTemplateStart();
          setManualFallbackReason(null);
        },
      });
    }
    return actions.slice(0, 2);
  }, [
    applyManualFallbackTemplate,
    isTemplateFirst,
    lastUserMessage,
    manualFallbackReason,
    onTemplateStart,
    opsMode,
    resolvedLessonId,
    startDecorateViaController,
    applyPendingDecorate,
    decorateHasPendingApply,
    setManualFallbackReason,
    shareCode,
  ]);
  const showManualFallbackActions =
    canShowDecorateAssistUi &&
    manualFallbackActions.length > 0 &&
    (actionPhase === "failed" || actionPhase === "partial" || opsMode === "simple");
  const headerStatus = useMemo(
    () => ({
      coachRunning,
      genRunning,
      dirty: isDirty,
      lastApplyTs,
      lastCodeHash,
    }),
    [coachRunning, genRunning, isDirty, lastApplyTs, lastCodeHash],
  );
  const webllmStatusDescriptor = useMemo(
    () => getWebLLMStatusDescriptor(effectiveWebllmStatus),
    [effectiveWebllmStatus],
  );
  const webllmUiStatus = useMemo<"downloading" | "initializing" | "ready" | "degraded" | "disabled">(() => {
    if (webllmSsotDisabled) return "disabled";
    if (effectiveWebllmStatus === "READY") return "ready";
    if (effectiveWebllmStatus === "DEGRADED" || effectiveWebllmStatus === "ERROR") return "degraded";
    if (
      effectiveWebllmStatus === "DISABLED" ||
      effectiveWebllmStatus === "ENV_MISSING" ||
      effectiveWebllmStatus === "UNSUPPORTED" ||
      effectiveWebllmStatus === "ASSET_UNREACHABLE" ||
      effectiveWebllmStatus === "MODEL_ID_UNKNOWN" ||
      effectiveWebllmStatus === "CORS_BLOCKED"
    ) {
      return "degraded";
    }
    const latestMessage = lastWebLLMProgressRef.current?.event.message.toLowerCase() ?? "";
    if (latestMessage.includes("download") || latestMessage.includes("fetch") || latestMessage.includes("asset")) {
      return "downloading";
    }
    return "initializing";
  }, [effectiveWebllmStatus, webllmSsotDisabled]);
  const decorateTransactionActive =
    decorateTransactionPhase !== "idle" &&
    decorateTransactionPhase !== "completed" &&
    decorateTransactionPhase !== "error" &&
    decorateTransactionPhase !== "blocked";
  const showWebllmStatusCard = false;
  const studentSuggestionDeemphasized = Boolean(decorateResultReadyState) || decorateHasPendingApply || decorateTransactionActive;
  useEffect(() => {
    if (!isStudentDecorateSurface) return;
    void recordEduEvent({
      type: "decorate_student_surface_rendered",
      boardId: "edu_chat_panel",
      requestId: createRequestId(),
      shareCode: shareCode ?? undefined,
      extra: { path: "decorate_local" },
    });
    void recordEduEvent({
      type: "decorate_coach_ui_suppressed",
      boardId: "edu_chat_panel",
      requestId: createRequestId(),
      shareCode: shareCode ?? undefined,
      extra: { path: "decorate_local" },
    });
  }, [isStudentDecorateSurface, shareCode]);

  useEffect(() => {
    if (!isStudentDecorateSurface || !isTemplateFirst || isTeacherMode) return;
    void recordEduEvent({
      type: "student_decorate_cta_rendered",
      boardId: "edu_chat_panel",
      requestId: null,
      shareCode: shareCode ?? undefined,
      extra: {
        mode: studentPrimaryMode,
        state: studentRenderState,
        disabled: studentPrimaryDisabled,
        canApplyPreview: studentPrimaryCanApplyPreview,
        path: "decorate_local",
      },
    });
  }, [
    isStudentDecorateSurface,
    isTeacherMode,
    isTemplateFirst,
    shareCode,
    studentRenderState,
    studentPrimaryCanApplyPreview,
    studentPrimaryDisabled,
    studentPrimaryMode,
  ]);

  useEffect(() => {
    if (!isStudentDecorateSurface) return;
    if (showWebllmStatusCard || Boolean(webllmWarning) || Boolean(webllmUnavailableGuide)) {
      void recordEduEvent({
        type: "decorate_student_surface_blocked_interference",
        boardId: "edu_chat_panel",
        requestId: createRequestId(),
        shareCode: shareCode ?? undefined,
        extra: { interfererKind: "webllm_or_coach_ui", path: "decorate_local" },
      });
    }
  }, [isStudentDecorateSurface, shareCode, showWebllmStatusCard, webllmUnavailableGuide, webllmWarning]);
  useEffect(() => {
    const requestId = createRequestId();
    void recordEduEvent({
      type: "decorate_eager_prep_started",
      boardId: "edu_chat_panel",
      requestId,
      shareCode: shareCode ?? undefined,
      extra: { path: "decorate_local" },
    });
    void getCommittedEditorHtml()
      .then((snapshot) => {
        const baseHtmlHash = hashCode(snapshot.html);
        const previousBaseHash = decorateCacheLastBaseHashRef.current;
        decorateCacheLastBaseHashRef.current = baseHtmlHash;
        void recordEduEvent({
          type: previousBaseHash === null ? "decorate_eager_prep_refreshed" : previousBaseHash === baseHtmlHash ? "decorate_eager_prep_reused" : "decorate_eager_prep_stale",
          boardId: "edu_chat_panel",
          requestId,
          shareCode: shareCode ?? undefined,
          extra: { previousBaseHash, baseHtmlHash, snapshotVersion: snapshot.snapshotVersion, path: "decorate_local" },
        });
        void recordEduEvent({
          type: "decorate_eager_prep_completed",
          boardId: "edu_chat_panel",
          requestId,
          shareCode: shareCode ?? undefined,
          extra: { snapshotVersion: snapshot.snapshotVersion, baseHtmlHash, path: "decorate_local" },
        });
      })
      .catch(() => undefined);
  }, [getCommittedEditorHtml, shareCode]);

  useEffect(() => {
    const observeLifecycle = (lifecycleEvent: string) => {
      const controller = decorateControllerRef.current;
      const txState = controller?.getState();
      if (!txState?.requestId) return;
      if (txState.phase === "preview_ready" || txState.phase === "applying" || txState.phase === "completed_stabilizing") {
        void recordEduEvent({
          type: "decorate_lifecycle_interference_blocked",
          boardId: "edu_chat_panel",
          requestId: txState.requestId,
          shareCode: shareCode ?? undefined,
          extra: { lifecycleEvent, phase: txState.phase, path: "decorate_local" },
        });
        return;
      }
      void recordEduEvent({
        type: "decorate_lifecycle_resync_observed",
        boardId: "edu_chat_panel",
        requestId: txState.requestId,
        shareCode: shareCode ?? undefined,
        extra: { lifecycleEvent, phase: txState.phase, path: "decorate_local" },
      });
    };
    const onVisibility = () => observeLifecycle("visibilitychange");
    const onFocus = () => observeLifecycle("focus");
    const onPageShow = (event: PageTransitionEvent) => observeLifecycle(event.persisted ? "pageshow_bfcache" : "pageshow");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [shareCode]);
  const opsStudentMessage = useMemo(() => {
    if (isTeacherMode || opsMode === "normal") return null;
    if (opsMode === "ai_off") return "오늘은 버튼으로 만들자!";
    if (opsMode === "simple") return "지금은 버튼으로 간단하게 만들자!";
    return null;
  }, [isTeacherMode, opsMode]);
  const performanceModeMessage = useMemo(
    () => (!isTeacherMode && performanceMode ? "더 부드럽게 보이게 바꿨어!" : null),
    [isTeacherMode, performanceMode],
  );
  useEffect(() => {
    const interferenceKind = actionPhase === "choice" ? "slot_choice" : showWebllmStatusCard ? null : null;
    if (!decorateTransactionActive || !interferenceKind) {
      decorateInterferenceLoggedRef.current = null;
      return;
    }
    const dedupKey = `${decorateTransactionPhase}:${interferenceKind}`;
    if (decorateInterferenceLoggedRef.current === dedupKey) return;
    decorateInterferenceLoggedRef.current = dedupKey;
    void recordEduEvent({
      type: "decorate_ui_interference_blocked",
      boardId: "edu_chat_panel",
      requestId: decorateControllerRef.current?.getState().requestId ?? undefined,
      shareCode: shareCode ?? undefined,
      extra: { interfererKind: interferenceKind, path: "decorate_local" },
    });
  }, [actionPhase, decorateTransactionActive, decorateTransactionPhase, shareCode, showWebllmStatusCard]);

  useEffect(() => {
    if (!isTeacherMode) return;
    if (lastWebllmStatusLoggedRef.current === effectiveWebllmStatus) return;
    lastWebllmStatusLoggedRef.current = effectiveWebllmStatus;
    const descriptor = getWebLLMStatusDescriptor(effectiveWebllmStatus);
    void recordEduEvent({
      type: "EDU_WEBLLM_STATUS",
      boardId: "edu_chat_panel",
      requestId: webllmStatusRid ?? undefined,
      shareCode: shareCode ?? undefined,
      extra: {
        status: effectiveWebllmStatus,
        code: descriptor.code,
        modelHost: webllmHosts.modelHost,
        wasmHost: webllmHosts.wasmHost,
      },
    });
  }, [effectiveWebllmStatus, isTeacherMode, shareCode, webllmHosts.modelHost, webllmHosts.wasmHost, webllmStatusRid]);

  const handleOpsReset = useCallback(() => {
    updateOpsMode("normal");
    if (undoEnabled) {
      handleUndo();
      return;
    }
    void applyManualFallbackTemplate();
  }, [applyManualFallbackTemplate, handleUndo, undoEnabled, updateOpsMode]);

  const handleHealthcheck = useCallback(() => {
    if (!devToolsEnabled) return;
    const results = runCoachHealthcheck({
      inputValue: input,
      sendDisabled,
      examplesOpen,
      showCancelButton,
      actionPhase,
      panelState,
      lastApplyOutcome,
      manualFallbackReason,
      messageCount: messages.length,
    });
    if (typeof console !== "undefined" && console.table) {
      console.table(
        results.map((result) => ({
          id: result.id,
          status: result.ok ? "OK" : "FAIL",
          message: result.message,
        })),
      );
    }
    const okCount = results.filter((result) => result.ok).length;
    setHealthcheckSummary({ ok: okCount, fail: results.length - okCount, at: Date.now() });
  }, [
    actionPhase,
    examplesOpen,
    input,
    lastApplyOutcome,
    manualFallbackReason,
    messages.length,
    panelState,
    sendDisabled,
    showCancelButton,
  ]);

  return (
    <ChatPanelErrorBoundary
      key={errorBoundaryKey}
      codeHash={lastCodeHash}
      onRetry={handleErrorRetry}
      onExportDiagnostics={exportSafeErrorDiagnostics}
      onError={(errorNameHash) => {
        recordEvent("chatpanel_render_error_boundary", errorNameHash);
      }}
    >
      <div
        className={`edu-panel relative flex h-full flex-col bg-white/70${
          performanceMode ? " edu-performance-mode" : ""
        }`}
      >
      {devToolsEnabled ? (
        <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDebugPanelOpen((prev) => !prev)}
              aria-label="Debug Panel"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-[13px] shadow-sm transition hover:border-sky-300"
            >
              <span aria-hidden="true">🛠️</span>
            </button>
            <button
              type="button"
              onClick={handleHealthcheck}
              aria-label="Coach Health Check"
              className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-600"
            >
              진단
            </button>
          </div>
          {healthcheckSummary ? (
            <div
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm ${
                healthcheckSummary.fail > 0
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-emerald-200 bg-emerald-50 text-emerald-600"
              }`}
            >
              OK {healthcheckSummary.ok} · FAIL {healthcheckSummary.fail}
            </div>
          ) : null}
          {debugPanelOpen ? (
            <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-[11px] text-slate-600 shadow-lg">
              <p>isAtBottom: {autoScroll ? "true" : "false"}</p>
              <p>messageCount: {messages.length}</p>
              <p>
                persistedKey: {chatStorageKey} | {persistedKeyExists ? "true" : "false"}
              </p>
              <p>lastSaveOk: {lastSaveOk ? "true" : "false"}</p>
              <p>lastLoadOk: {lastLoadOk ? "true" : "false"}</p>
              <p>isInputFocused: {isInputFocused ? "true" : "false"}</p>
              <p>isComposing: {isComposing ? "true" : "false"}</p>
              <p>decorate.stage: {decorateDebugMetrics?.stage ?? "-"}</p>
              <p>decorate.modelId: {decorateDebugMetrics?.modelId ?? "-"}</p>
              <p>decorate.retryCount: {decorateDebugMetrics?.retryCount ?? 0}</p>
              <p>decorate.parse/schema/apply: {decorateDebugMetrics?.parseFailCount ?? 0}/{decorateDebugMetrics?.schemaFailCount ?? 0}/{decorateDebugMetrics?.applyFailCount ?? 0}</p>
              <p>decorate.slotCandidates: {decorateDebugMetrics?.slotCandidatesCount ?? 0}</p>
              <p>decorate.selectedSlot: {decorateDebugMetrics?.selectedSlotId ?? "-"}</p>
            </div>
          ) : null}
          {isOpsAdmin ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 px-3 py-2 text-[11px] text-indigo-900 shadow-lg">
              <p className="font-semibold">WebLLM gating diagnostics</p>
              <p>gatingMode: {eduFeatureFlags.gatingMode ?? "unknown"}</p>
              <p>reasons: {eduFeatureFlags.reasons?.join(", ") ?? eduFeatureFlags.reason}</p>
              <p>allowlistDecision: {eduFeatureFlags.allowlistDecision ?? "not_applicable"}</p>
              <p>userFlags: {eduFeatureFlags.userFlagsPresent ? "present" : "absent"}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {isTeacherMode ? (
        <div className="sticky top-0 z-40 border-b border-slate-900/30 bg-slate-900/95 px-5 py-2 text-[11px] text-white backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">운영 바</span>
            <button
              type="button"
              onClick={() => updateOpsMode("ai_off")}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                opsMode === "ai_off"
                  ? "border-white bg-white text-slate-900"
                  : "border-white/30 text-white/80 hover:border-white/60 hover:text-white"
              }`}
            >
              AI 잠깐 끄기
            </button>
            <button
              type="button"
              onClick={() => updateOpsMode("simple")}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                opsMode === "simple"
                  ? "border-white bg-white text-slate-900"
                  : "border-white/30 text-white/80 hover:border-white/60 hover:text-white"
              }`}
            >
              간단 모드
            </button>
            <button
              type="button"
              onClick={handleOpsReset}
              className="rounded-full border border-white/40 px-3 py-1 text-[11px] font-semibold text-white/90 transition hover:border-white/70 hover:text-white"
            >
              기본으로 되돌리기
            </button>
            <span className="ml-auto text-[11px] text-slate-300">
              현재: {OPS_MODE_LABELS[opsMode]}
            </span>
          </div>
        </div>
      ) : null}
      {isTeacherMode && teacherToast ? (
        <div className="pointer-events-none absolute right-4 top-14 z-40 max-w-[280px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg">
          {teacherToast}
        </div>
      ) : null}
      <div className="border-b border-slate-200/70 px-5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {isTeacherMode ? (
              <p className="text-xs font-semibold text-sky-600">AI 코치</p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900 lg:text-2xl">{isStudentPresentation && isTemplateFirst ? "AI로 꾸미기" : title}</h2>
              
            </div>
            {coachUnavailable && !isTeacherMode ? (
              <p className="mt-2 text-sm font-semibold text-slate-500">준비중</p>
            ) : null}
            {!isStudentPresentation && !slimMode ? (
              <p className="mt-1 max-w-[72ch] text-xs text-slate-500">{goal}</p>
            ) : null}
            {!isStudentPresentation && modelChoice === "fallback" ? (
              <p className="mt-1 text-[11px] font-semibold text-emerald-600">
                경량 모델 사용 중
              </p>
            ) : null}
            {showNetworkBanner && !slimMode ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {networkBannerMessage}
              </div>
            ) : null}
          </div>
          {onHelpClick && !isStudentPresentation ? (
            <button
              type="button"
              onClick={onHelpClick}
              aria-label="1분 도움말"
              className={
                isTeacherMode
                  ? "rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                  : "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
              }
            >
              {isTeacherMode ? (
                "1분 도움말"
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2.2" />
                  <path d="M12 17.5h.01" />
                </svg>
              )}
            </button>
          ) : null}
        </div>
        {!isStudentDecorateSurface && !decorateTransactionActive && webllmWarning ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {webllmWarning}
          </div>
        ) : null}
        {!isStudentDecorateSurface && !decorateTransactionActive && !webllmWarning && webllmUnavailableGuide ? (
          <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
            {webllmUnavailableGuide}
          </div>
        ) : null}
        {isDev && !isStudentDecorateSurface && effectiveWebllmStatus === "ENV_MISSING" ? (
          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
            <p className="font-semibold">WebLLM env snapshot (dev-only)</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {envSnapshot.map((entry) => (
                <li key={entry.key}>
                  {entry.key}: {entry.isSet ? "set" : "unset"} (len={entry.length}, source={entry.source})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {showWebllmStatusCard && isTeacherMode && !slimMode ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            {!localAiDisabled && webllmUiStatus !== "ready" ? (
              <button
                type="button"
                onClick={() => setLocalAiDisabledState(true)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
              >
                continue without WebLLM
              </button>
            ) : null}
            {(webllmUiStatus === "degraded" || webllmUiStatus === "disabled") ? (
              <button
                type="button"
                onClick={handleWebLLMSessionRetry}
                disabled={webllmSessionRetryUsed}
                className="rounded-full border border-amber-200 bg-white px-2.5 py-1 font-semibold text-amber-700 shadow-sm transition hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {webllmSessionRetryUsed ? "retry used" : "retry WebLLM"}
              </button>
            ) : null}
          </div>
        ) : null}
        {isTeacherMode ? <WebLLMLessonExecutionStrip model={lessonExecutionStripModel} /> : null}
        {isTeacherMode ? (
          <TeacherControlPanel
            isTeacherMode={isTeacherMode}
            lessonLock={lessonLock}
            metricsSummary={safeMetricsSummary}
            onSetLessonId={onSetLessonId}
            onToggleLessonLock={onToggleLessonLock}
            onHardReset={hardResetSession}
            onResetEngine={() => void resetEngine()}
            onAbortAll={handleAbort}
            onExportDiagnostics={() => void exportDiagnostics()}
            onWarmupWebLLM={runManualWarmup}
            autosaveEnabled={autosaveEnabled}
            onToggleAutosave={toggleAutosave}
            undoEnabled={undoEnabled}
            redoEnabled={redoEnabled}
            onUndo={handleUndo}
            onRedo={handleRedo}
            presentationMode={presentationMode}
            onTogglePresentationMode={onTogglePresentationMode}
            status={headerStatus}
          />
        ) : null}
        {isTeacherMode ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">WebLLM 상태</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                {webllmStatusDescriptor.code}
              </span>
              {webllmStatusRid ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-500">
                  RID: {webllmStatusRid}
                </span>
              ) : null}
              {webllmStatusCode && webllmStatusCode !== webllmStatusDescriptor.code ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-500">
                  code: {webllmStatusCode}
                </span>
              ) : null}
              {webllmStatusAt ? (
                <span className="text-[11px] text-slate-400">
                  {new Date(webllmStatusAt).toLocaleTimeString()}
                </span>
              ) : null}
              {webllmPrefetchReady != null ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                  prefetch: {webllmPrefetchReady ? "Ready to load" : "not ready"}
                </span>
              ) : null}
              {webllmAutoSelection ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                  자동 대체: {webllmAutoSelection.requested} → {webllmAutoSelection.resolved}
                </span>
              ) : null}
              {webllmTierDiagnostics ? (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 font-semibold text-sky-700">
                  selectedTier: {webllmTierDiagnostics.selectedTier}
                </span>
              ) : null}
              {webllmTierDiagnostics ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                  tierReason: {webllmTierDiagnostics.tierReason}
                </span>
              ) : null}
              {webllmTierDiagnostics ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                  cooldownActive: {webllmTierDiagnostics.cooldownActive ? "true" : "false"}
                </span>
              ) : null}
            </div>
            {webllmTierDiagnostics ? (
              <div className="mt-2 text-[11px] text-slate-500">
                <p>deviceCaps: mem={String(webllmTierDiagnostics.deviceCaps.deviceMemory ?? "-")} / cores={String(webllmTierDiagnostics.deviceCaps.hardwareConcurrency ?? "-")} / coi={String(webllmTierDiagnostics.deviceCaps.crossOriginIsolated)} / sab={String(webllmTierDiagnostics.deviceCaps.sharedArrayBuffer)}</p>
              </div>
            ) : null}
            {effectiveWebllmStatus !== "READY" ? (
              <div className="mt-2 text-[11px] text-slate-500">
                <p>{webllmStatusDescriptor.teacherMessage}</p>
                <p className="font-semibold text-slate-600">권장 조치: {webllmStatusDescriptor.teacherAction}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto overscroll-contain px-5 py-4"
        >
          {!isStudentPresentation ? (
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              {presetPrompts.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => fillPrompt(preset.prompt)}
                    disabled={thinking}
                    aria-label={preset.label}
                    title={preset.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-slate-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="w-full max-w-2xl space-y-3">
            {hiddenMessageCount > 0 && !isStudentPresentation ? (
              <p className="text-xs text-slate-400">
                이전 대화 {hiddenMessageCount}개는 성능을 위해 숨겨져 있어요.
              </p>
            ) : null}
            {messageItems}
            {!isStudentPresentation && thinking ? (
              <div className="max-w-[70%] rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-[15px] leading-relaxed break-words text-slate-500 [overflow-wrap:anywhere]">
                {progressMessage || "생각 중… (이번 교시 목표에 맞게)"}
                {slowNetworkHint ? (
                  <p className="mt-2 text-xs text-slate-400">
                    네트워크가 느려 응답이 지연될 수 있어요. 필요하면 다시 시도해 주세요.
                  </p>
                ) : null}
              </div>
            ) : null}
            {!isStudentPresentation && simpleCoachHint ? (
              <div className="max-w-[70%] rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-[15px] text-slate-700">
                <p className="text-xs font-semibold text-sky-700">{simpleCoachHint.title}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {simpleCoachHint.tips.map((tip, index) => (
                    <li key={`${tip}-${index}`}>{tip}</li>
                  ))}
                </ul>
                {simpleCoachHint.actions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {simpleCoachHint.actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => fillPrompt(action.value)}
                        className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:text-sky-800"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {!isStudentPresentation && isTeacherMode && rateLimitNotice ? (
              <div className="max-w-[70%] rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[13px] text-amber-800">
                <p className="font-semibold">Rate limit 감지</p>
                <p className="mt-1 text-xs">
                  RID: {rateLimitNotice.requestId} · code: {rateLimitNotice.errorCode}
                </p>
                <p className="mt-1 text-xs">권장: 30초 후 다시 시도</p>
              </div>
            ) : null}
            {!isStudentPresentation && remoteChatWarning ? (
              <div className="max-w-[70%] rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-[13px] text-sky-800">
                <p className="font-semibold">원격 AI 안내</p>
                <p className="mt-1 text-xs">{remoteChatWarning}</p>
              </div>
            ) : null}
            {!isStudentPresentation && isTeacherMode && isFallbackActive && fallbackStage === "retry" ? (
              <div className="max-w-[70%] rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[15px] text-amber-800">
                <p>응답이 늦어요. 다시 시도할까요?</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleFallbackRetry}
                    disabled={retryUsed}
                    className="rounded-full border border-amber-200 bg-white px-3 py-1 font-semibold text-amber-700 shadow-sm transition hover:border-amber-300 hover:text-amber-800"
                  >
                    {retryUsed ? "재시도 완료" : "다시 시도"}
                  </button>
                  {isTeacherMode && fallbackRequestId ? (
                    <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-700">
                      RID: {fallbackRequestId}
                      {fallbackErrorCode ? ` · code: ${fallbackErrorCode}` : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {!isStudentPresentation && showFileProgress ? (
              <div className="max-w-[70%] rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-[15px] leading-relaxed break-words text-emerald-700 [overflow-wrap:anywhere]">
                <p>{fileProgressLabel}</p>
                {fileProgressMessage ? (
                  <p className="mt-2 text-xs text-emerald-700/80">{fileProgressMessage}</p>
                ) : null}
                {decorateSlowNotice && isTemplateFirst ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-emerald-700/80">
                    <p className="flex-1">조금 오래 걸리고 있어요. 취소해도 괜찮아요.</p>
                    <button
                      type="button"
                      onClick={() => abortTemplateFirstGeneration("user")}
                      className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800"
                    >
                      취소
                    </button>
                  </div>
                ) : null}
                {slowGenerationHint ? (
                  <p className="mt-2 text-xs text-emerald-700/80">
                    조금만 기다려주세요… (느리면 템플릿으로 먼저 완성해요)
                  </p>
                ) : null}
                {slowNetworkHint ? (
                  <p className="mt-2 text-xs text-emerald-700/70">
                    다운로드 시간이 길어질 수 있어요. 잠시만 기다려 주세요.
                  </p>
                ) : null}
              </div>
            ) : null}
            {!isStudentPresentation && fastFallbackNotice ? (
              <div className="max-w-[70%] rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-[15px] text-sky-700">
                <p>{fastFallbackNotice}</p>
              </div>
            ) : null}
            {!isStudentPresentation && decorateAbortNotice ? (
              <div className="max-w-[70%] rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[15px] text-amber-700">
                <p>{decorateAbortNotice}</p>
              </div>
            ) : null}
            {!isStudentPresentation && fastApplyNotice ? (
              <div className="max-w-[70%] rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-xs text-emerald-700">
                <p>{fastApplyNotice}</p>
              </div>
            ) : null}
            {decorateResultReadyState ? (
              <div className="max-w-[70%] rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-[13px] text-violet-800">
                <p className="font-semibold">{isStudentPresentation ? "바뀌는 내용" : "AI가 한 일"}</p>
                <p className="mt-1 text-xs">{decorateResultReadyState.summary}</p>
                {isStudentPresentation && decorateResultReadyState.confidenceLine ? <p className="mt-1 text-[11px] text-violet-700/80">{decorateResultReadyState.confidenceLine}</p> : null}
                {isStudentPresentation ? null : <p className="mt-1 text-xs">작업 수: {decorateResultReadyState.opsCount}</p>}
{isStudentPresentation ? null : (
                <div className="mt-2 rounded-xl border border-violet-200/70 bg-white/70 p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">변경 미리보기</p>
                    <button
                      type="button"
                      onClick={() => setDecoratePreviewExpanded((prev) => !prev)}
                      className="text-[11px] font-semibold text-violet-700 underline"
                    >
                      {decoratePreviewExpanded ? "접기" : "펼치기"}
                    </button>
                  </div>
                  {(decorateResultReadyState.changedNodes ?? []).slice(0, 3).map((node, idx) => (
                    <div key={`${node.selector}-${idx}`} className="mt-1 rounded-lg border border-violet-100 bg-white px-2 py-1.5">
                      <p className="text-[11px] font-semibold">{node.summary}</p>
                      <p className="text-[11px] text-violet-700/80">target: {node.selector}</p>
                      {decoratePreviewExpanded ? (
                        <div className="mt-1 grid gap-1 text-[11px] text-violet-800/90">
                          <p>before: {node.beforeSnippet || "-"}</p>
                          <p>after: {node.afterSnippet || "-"}</p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                )}
                {decorateResultReadyState.degraded ? (
                  <p className="mt-2 text-xs">안전 모드: 외부 이미지는 시연용 이미지로 대체되었어요.</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {decorateHasPendingApply ? (
                    <button
                      type="button"
                      onClick={() => {
                        void applyPendingDecorate();
                      }}
                      className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-semibold text-violet-700"
                    >
                      {isStudentPresentation ? "미리보기 적용" : "적용"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      void runDecorateUndo();
                    }}
                    className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-semibold text-violet-700"
                  >
                    {isStudentPresentation ? "이전 상태로 되돌리기" : "되돌리기"}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="max-w-[70%] rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3">
              {performanceModeMessage ? (
                <p className="text-xs font-semibold text-emerald-700" aria-live="polite">
                  {performanceModeMessage}
                </p>
              ) : null}
              {isStudentDecorateSurface ? (
                <p className="text-xs font-semibold text-slate-600" aria-live="polite">
                  {progressMessage || decorateProgressCopyRef.current || "바꾸고 싶은 내용을 적어보세요."}
                </p>
              ) : opsStudentMessage ? (
                <p className="text-xs font-semibold text-slate-600" aria-live="polite">
                  {opsStudentMessage}
                </p>
              ) : (
                <>
                  <GlowProgressBar
                    steps={progressSteps}
                    activeIndex={progressIndex}
                    showTooltips={isTeacherMode}
                    phase={progressPhase}
                    presentationMode={isStudentPresentation}
                  />
                  {actionPhase !== "idle" ? (
                    <div
                      className={`mt-2 flex items-center gap-2 text-xs font-semibold ${
                        ACTION_PHASE_TONE[actionPhase]
                      }`}
                      aria-live="polite"
                    >
                      <span aria-hidden="true">{ACTION_PHASE_ICON[actionPhase]}</span>
                      <span>
                        {isStudentPresentation
                          ? ACTION_PHASE_COPY_STUDENT[actionPhase]
                          : ACTION_PHASE_COPY_TEACHER[actionPhase]}
                      </span>
                    </div>
                  ) : null}
                </>
              )}
            </div>
            {!isStudentDecorateSurface && showWaitingActions ? (
              <div className="max-w-[70%] rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">
                  {waitingActionStage === "expanded" ? "선택 만들기" : "다음 행동 2개"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {waitingActionStage === "expanded"
                    ? "먼저 골라서 바로 완성해요."
                    : "AI가 생각하는 동안 이것부터 할 수 있어요."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {waitingActionIds.map((actionId) => (
                    <button
                      key={actionId}
                      type="button"
                      onClick={() => void runWaitingAction(actionId)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                    >
                      {WAITING_ACTION_LABELS[actionId].label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {!isStudentDecorateSurface && showSlotChoiceActions ? (
              <SlotChoiceActions
                lessonId={resolvedLessonId}
                onSelect={(action) => void runSlotChoiceAction(action)}
              />
            ) : null}
            {!isStudentDecorateSurface && showFallbackActions ? (
              <div className="max-w-[70%] rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-700">
                <p className="font-semibold text-amber-700">잠깐 바빠서 버튼으로 하자.</p>
                <p className="mt-1 text-[11px] text-amber-600">여기서 두 개만 골라서 바로 시작해요.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {fallbackActionIds.map((actionId) => (
                    <button
                      key={actionId}
                      type="button"
                      onClick={() => void runWaitingAction(actionId)}
                      className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm transition hover:border-amber-300 hover:text-amber-800"
                    >
                      {WAITING_ACTION_LABELS[actionId].label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {isTeacherMode && lastGeneratorNotice ? (
              <div className="max-w-[70%] rounded-2xl border border-indigo-200/70 bg-indigo-50/80 px-4 py-3 text-xs text-indigo-700">
                <p className="font-semibold">Generator notice</p>
                <p className="mt-1 whitespace-pre-wrap">{lastGeneratorNotice}</p>
              </div>
            ) : null}
            {!isStudentDecorateSurface && showManualFallbackActions ? (
              <div className="flex flex-wrap gap-2">
                {manualFallbackActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    disabled={isGeneratingFiles}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="safe-action-row relative z-20 flex flex-wrap gap-2 pointer-events-auto">
              {showGenerateButton ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!isTeacherMode && isTemplateFirst) {
                      runStudentPrimaryAction("cta");
                      return;
                    }
                    if (isTemplateFirst && !isTeacherMode && isDecorateCooldownActive) {
                      return;
                    }
                    void generateFilesFromHistory();
                  }}
                  disabled={generateDisabled}
                  aria-disabled={generateDisabled}
                  data-testid={isTemplateFirst && !isTeacherMode ? "student-decorate-primary-cta" : undefined}
                  aria-label={isTemplateFirst && !isTeacherMode ? generateButtonLabel : generateButtonAriaLabel}
                  className="pointer-events-auto inline-flex h-9 items-center justify-center gap-2 rounded-full border border-emerald-500/80 bg-emerald-500 px-3 text-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-60"
                >
                  <span className="icon" aria-hidden="true">
                    {generateSpinner ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent motion-reduce:animate-none" />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-4 w-4"
                      >
                        <path d="m5 19 4-4" />
                        <path d="m7 7 4 4" />
                        <path d="M13 5l6 6" />
                        <path d="M15.5 8.5 18 6" />
                      </svg>
                    )}
                  </span>
                  <span className="label hidden whitespace-nowrap text-xs font-semibold sm:inline">
                    {generateButtonLabel}
                  </span>
                </button>
              ) : null}
              {showTemplateApplyButton ? (
                <button
                  type="button"
                  onClick={() => {
                    if (decorateHasPendingApply) {
                      void applyPendingDecorate();
                      return;
                    }
                    if (lastUserMessage) {
                      void recordEduEvent({
            type: "decorate_gate_bypassed",
            boardId: "edu_chat_panel",
            shareCode: shareCode ?? undefined,
            extra: { gate: "manual_fallback_actions", path: "decorate_local" },
          });
          void startDecorateViaController(lastUserMessage ?? "").then((result) => {
                        if (!result.ok) {
                          setManualFallbackReason("apply_failed");
                        }
                      });
                    }
                  }}
                  disabled={isGeneratingFiles}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="label whitespace-nowrap text-xs font-semibold">{decorateHasPendingApply ? "적용" : "꾸미기 미리보기"}</span>
                </button>
              ) : null}
              {showRedoButton ? (
                <button
                  type="button"
                  onClick={() => {
                    void generateFilesFromHistory();
                  }}
                  disabled={redoDisabled}
                  aria-label="웹사이트 다시 만들기"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-emerald-500/80 bg-emerald-500 px-3 text-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path d="M3 12a9 9 0 1 0 3-6.7" />
                      <path d="M3 4v4h4" />
                    </svg>
                  </span>
                  <span className="label hidden whitespace-nowrap text-xs font-semibold sm:inline">
                    다시 생성
                  </span>
                </button>
              ) : null}
              {fastFallbackApplied ? (
                <button
                  type="button"
                  onClick={() => {
                    void generateFilesFromHistory();
                  }}
                  disabled={isGeneratingFiles}
                  aria-label="다시 생성(천천히 더 예쁘게)"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="label whitespace-nowrap text-xs font-semibold">
                    다시 생성(천천히 더 예쁘게)
                  </span>
                </button>
              ) : null}
              {isRewriting ? (
                <span
                  role="status"
                  aria-label="답변 교정 중"
                  className="inline-flex h-4 w-4 items-center justify-center"
                >
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 motion-reduce:animate-none" />
                </span>
              ) : null}
              {isTeacherMode && actionPrompt?.showGenerateRetry && canSwitchToFallback && fallbackModelId ? (
                <button
                  type="button"
                  onClick={() => {
                    setPreferredModelId(fallbackModelId);
                    try {
                      window.localStorage.setItem("edu:webllm:modelId", fallbackModelId);
                    } catch {
                      // ignore storage failures
                    }
                    void generateFilesFromHistory();
                  }}
                  disabled={!isCoachActionReady || isGeneratingFiles}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  가벼운 모델로 파일 다시 만들기
                </button>
              ) : null}
              {isTeacherMode && actionPrompt?.showRefresh ? (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                >
                  새로고침
                </button>
              ) : null}
              {isTeacherMode && actionPrompt?.showRetry ? (
                <button
                  type="button"
                  onClick={() => {
                    if (lastUserMessage) {
                      void runCoachPrimaryAction("retry", lastUserMessage);
                    }
                  }}
                  aria-label="다시 시도"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 4v4h4" />
                  </svg>
                </button>
              ) : null}
              {isTeacherMode && actionPrompt?.showRetry && canSwitchToFallback && fallbackModelId ? (
                <button
                  type="button"
                  onClick={() => {
                    setPreferredModelId(fallbackModelId);
                    try {
                      window.localStorage.setItem("edu:webllm:modelId", fallbackModelId);
                    } catch {
                      // ignore storage failures
                    }
                    if (lastUserMessage) {
                      void runCoachPrimaryAction("retry", lastUserMessage);
                    }
                  }}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800"
                >
                  가벼운 모델로 다시 시도
                </button>
              ) : null}
              {isTeacherMode && actionPrompt?.showTemplate && onTemplateStart ? (
                <button
                  type="button"
                  onClick={() => {
                    onTemplateStart();
                    setActionPrompt(null);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                >
                  템플릿으로 재설정
                </button>
              ) : null}
              {isTeacherMode && actionPrompt?.showSelfcheck ? (
                <button
                  type="button"
                  onClick={() => window.open("/edu/selfcheck", "_blank", "noopener,noreferrer")}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                >
                  selfcheck 열기
                </button>
              ) : null}
              {isTeacherMode && actionPrompt?.showDiagnostics ? (
                <button
                  type="button"
                  onClick={() => setShowDiagnostics(true)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                >
                  관리자 점검 항목
                </button>
              ) : null}
              {isTeacherMode && corsCopyMessage ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!navigator.clipboard?.writeText) return;
                    await navigator.clipboard.writeText(corsCopyMessage);
                    setCorsCopyNotice("관리자 전달 문구를 복사했습니다.");
                  }}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:text-rose-700"
                >
                  관리자에게 전달할 문구 복사
                </button>
              ) : null}
              {actionPrompt?.showHelp ? (
                <button
                  type="button"
                  onClick={onHelpClick}
                  aria-label="설정 도움말"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2.2" />
                    <path d="M12 17.5h.01" />
                  </svg>
                </button>
              ) : null}
            </div>
            {isTeacherMode && actionPrompt?.showTemplateChips ? (
              <div className="mt-1 flex flex-wrap items-start gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-400">템플릿 선택</span>
                {templateOptions.map((template) => {
                  const isSelected = selectedTemplateKey === template.key;
                  return (
                    <button
                      key={template.key}
                      type="button"
                      onClick={() => handleTemplateSelect(template.key)}
                      disabled={isGeneratingFiles}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition ${
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-sky-300 hover:text-sky-600"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {template.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleTemplateSelect("random")}
                  disabled={isGeneratingFiles}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition ${
                    selectedTemplateKey === "random"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-sky-300 hover:text-sky-600"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  랜덤
                </button>
              </div>
            ) : null}
            {corsCopyNotice ? <p className="text-xs font-semibold text-rose-500">{corsCopyNotice}</p> : null}
            {decorateCooldownEnabled && !isStudentPresentation ? (
              <p className="text-[11px] text-slate-400">먼저 템플릿을 채우고 있어요 🙂</p>
            ) : null}
          </div>
        </div>
        {showJump ? (
          <button
            type="button"
            onClick={() => {
              const container = scrollRef.current;
              if (!container) return;
              const behavior: ScrollBehavior =
                prefersReducedMotion || performanceMode ? "auto" : "smooth";
              container.scrollTo({ top: container.scrollHeight, behavior });
              setAutoScroll(true);
              setShowJump(false);
            }}
            title="Bottom"
            aria-label="Bottom"
            className="absolute bottom-4 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-sm font-semibold text-slate-600 shadow-md transition hover:border-sky-300 hover:text-sky-600"
          >
            <span aria-hidden="true">↓</span>
          </button>
        ) : null}
      </div>

      {isStudentDecorateSurface ? (
        <StudentDecorateSurface
          input={input}
          onInputChange={setInput}
          onEnterSubmit={() => runStudentPrimaryAction("enter")}
          onBottomSendClick={() => runStudentPrimaryAction("send")}
          onPrimaryCtaClick={() => runStudentPrimaryAction("cta")}
          state={studentDecorateUiState}
          primaryDisabled={studentPrimaryDisabled}
          placeholder={studentDecorateInputGuidance.placeholder}
          guidance={studentDecorateInputGuidance}
          suggestions={studentDecorateSuggestions}
          onSuggestionSelect={(index) => {
            const example = studentDecorateSuggestions[index];
            if (example) {
              handleStudentDecorateSuggestionSelect(example, index);
            }
          }}
        />
      ) : (
      <form
        className="sticky bottom-0 border-t border-slate-200/70 bg-white/95 px-5 py-3 backdrop-blur"
        onSubmit={(event) => {
          event.preventDefault();
          runCoachPrimaryAction(coachSubmitSourceRef.current);
          coachSubmitSourceRef.current = "submit";
        }}
      >
        <div className="flex items-center gap-2">
          {!isStudentPresentation ? (
            <div className="flex items-center gap-2 md:hidden">
              <div className="relative">
                <button
                  type="button"
                  ref={examplesMobileButtonRef}
                  onClick={() => toggleExamples("mobile")}
                  aria-haspopup="dialog"
                  aria-expanded={examplesOpen}
                  aria-label={isTeacherMode ? "질문 예시" : "예시"}
                  className={
                    isTeacherMode
                      ? "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                      : "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                  }
                >
                  {isTeacherMode ? "질문 예시" : <LightbulbIcon className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {mobilePresetPrompts.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => fillPrompt(preset.prompt)}
                      disabled={thinking}
                      aria-label={preset.label}
                      title={preset.label}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-slate-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  );
                })}
                {overflowPresetPrompts.length > 0 ? (
                  <div className="relative" ref={presetMoreRef}>
                    <button
                      type="button"
                      onClick={() => setPresetMoreOpen((prev) => !prev)}
                      aria-haspopup="dialog"
                      aria-expanded={presetMoreOpen}
                      aria-label="프리셋 더보기"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-slate-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
                    >
                      <MoreIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {presetMoreOpen ? (
                      <div
                        role="dialog"
                        aria-label="프리셋 더보기"
                        tabIndex={-1}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setPresetMoreOpen(false);
                          }
                        }}
                        className="absolute left-0 top-full z-10 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
                      >
                        <div className="flex flex-wrap gap-2">
                          {overflowPresetPrompts.map((preset) => {
                            const Icon = preset.icon;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                  fillPrompt(preset.prompt);
                                  setPresetMoreOpen(false);
                                }}
                                disabled={thinking}
                                aria-label={preset.label}
                                title={preset.label}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            className="input-shell relative flex-1"
            data-phase={inputPhase}
            data-has-input={input.trim().length > 0}
            data-has-sanitize-flags={Boolean(lastSanitizeFlags)}
            data-alert={sanitizePulseTone}
            data-sanitize-pulse={sanitizePulseActive}
            data-undo-pulse={undoPulseActive}
            data-sanitize-shake={sanitizeShakeActive}
            data-offtrack-pulse={offTrackPulseActive}
          >
            <div className="ghost-hint pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2 text-slate-300/80">
              <span className="ghost-line" />
              <PencilIcon className="h-4 w-4" aria-hidden="true" />
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              rows={2}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (isDev) {
                  console.debug("[chatpanel] input_keydown", {
                    key: event.key,
                    shiftKey: event.shiftKey,
                    metaKey: event.metaKey,
                    ctrlKey: event.ctrlKey,
                    altKey: event.altKey,
                  });
                }
                if (event.key === "Enter" && !event.shiftKey && !isComposing) {
                  event.preventDefault();
                  coachSubmitSourceRef.current = "enter";
                  event.currentTarget.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                }
              }}
              onFocus={() => {
                if (isDev) {
                  console.debug("[chatpanel] input_focus", { length: input.length });
                }
                setIsInputFocused(true);
              }}
              onBlur={() => {
                if (isDev) {
                  console.debug("[chatpanel] input_blur", { length: input.length });
                }
                setIsInputFocused(false);
              }}
              onCompositionStart={() => {
                setIsComposing(true);
              }}
              onCompositionEnd={() => {
                setIsComposing(false);
              }}
              placeholder={inputPlaceholder}
              data-phase={panelState}
              className="relative z-10 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              disabled={isGeneratingFiles || (!isStudentDecorateSurface && coachUnavailable)}
            />
            <div className="pointer-events-none absolute right-2 top-2 flex flex-col gap-2">
              {insuranceSuggestionActive ? (
                <button
                  type="button"
                  onClick={applyInsurancePrompt}
                  aria-label="보험 프롬프트 적용"
                  title="보험 프롬프트"
                  className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                >
                  <ShieldIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
              {sanitizeSuggestionActive ? (
                <button
                  type="button"
                  onClick={applySanitizeSuggestion}
                  aria-label="정리 적용"
                  title="정리 적용"
                  className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                >
                  <WandIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {!isTeacherMode && !isStudentDecorateSurface && offTrackVisible ? (
              <div className="pointer-events-none absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-[13px] text-slate-500 shadow-sm">
                <span aria-hidden="true">🎯</span>
              </div>
            ) : null}
          </div>

          {!isStudentPresentation ? (
            <div className="flex items-center gap-2">
              <span
                aria-label="작업 보호 중"
                className={`flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-500 shadow-sm ${
                  isDirty ? "edu-guard-pulse text-emerald-500" : ""
                }`}
              >
                <ShieldIcon className="h-4 w-4" aria-hidden="true" />
              </span>
              <button
                type="button"
                onClick={handleUndo}
                disabled={!undoEnabled}
                aria-label="되돌리기"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:border-sky-200 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <UndoIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!redoEnabled}
                aria-label="다시하기"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:border-sky-200 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RedoIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={hardResetSession}
                aria-label="초기화"
                className="flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-3 text-xs font-semibold text-slate-500 shadow-sm transition hover:border-sky-200 hover:text-sky-600"
              >
                Reset
              </button>
            </div>
          ) : null}

          {showCancelButton ? (
            <button
              type="button"
              onClick={handleAbort}
              aria-label="중단"
              className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 text-slate-500 shadow-sm transition hover:border-rose-200 hover:text-rose-500"
            >
              <StopIcon className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-semibold">중단</span>
            </button>
          ) : null}

          <button
            type={isStudentDecorateSurface ? "button" : "submit"}
            aria-label={isStudentDecorateSurface ? "AI로 꾸미기" : "보내기"}
            onClick={isStudentDecorateSurface ? () => runStudentPrimaryAction("send") : () => {
              coachSubmitSourceRef.current = "send_button";
            }}
            disabled={isStudentDecorateSurface ? studentPrimaryDisabled : sendDisabled}
            className={isStudentDecorateSurface || isStudentPresentation
              ? "flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              : "flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"}
          >
            {isCoachBusy || isGeneratingFiles ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent motion-reduce:animate-none" />
            ) : isStudentDecorateSurface || isStudentPresentation ? (
              "AI로 꾸미기"
            ) : (
              <SendIcon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
        {isStudentPresentation ? (
          <div
            className={`mt-2 rounded-2xl border px-3 py-2 transition ${studentSuggestionDeemphasized ? "border-slate-100 bg-slate-50/40 text-slate-400" : "border-slate-200 bg-slate-50/70 text-slate-600"}`}
            data-testid="student-decorate-suggestions"
          >
            <p className="text-xs font-medium">{studentDecorateInputGuidance.support}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {studentDecorateSuggestions.map((example, index) => (
                <button
                  key={`${example.kind}-${index}`}
                  type="button"
                  onClick={() => handleStudentDecorateSuggestionSelect(example, index)}
                  disabled={isGeneratingFiles}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${studentSuggestionDeemphasized ? "border-slate-200 bg-white/70 text-slate-400" : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700"}`}
                >
                  {example.prompt}
                </button>
              ))}
            </div>
            {!input.trim() ? <p className="mt-2 text-[11px]">{studentDecorateInputGuidance.emptyHint}</p> : null}
          </div>
        ) : null}
        {!isStudentPresentation ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            {isTeacherMode ? (
              <p className="text-xs text-slate-500">예: ‘내 취미는…’처럼 말해도 좋아요.</p>
            ) : null}
            <div className="relative hidden md:block">
              <button
                type="button"
                ref={examplesButtonRef}
                onClick={() => toggleExamples("desktop")}
                aria-haspopup="dialog"
                aria-expanded={examplesOpen}
                aria-label={isTeacherMode ? "질문 예시" : "예시"}
                className={
                  isTeacherMode
                    ? "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                    : "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                }
              >
                {isTeacherMode ? "질문 예시" : <LightbulbIcon className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        ) : null}
      </form>
      )}
      {!isStudentPresentation ? (
        <ExamplePromptPopover
          open={examplesOpen}
          anchorRef={examplesAnchor === "mobile" ? examplesMobileButtonRef : examplesButtonRef}
          prompts={examplePrompts}
          isTeacherMode={isTeacherMode}
          align={examplesAnchor === "desktop" ? "right" : "left"}
          onSelect={(prompt) => {
            fillPrompt(prompt);
            setExamplesOpen(false);
          }}
          onClose={() => setExamplesOpen(false)}
        />
      ) : null}

      {isTeacherMode && showDiagnostics ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">관리자 점검 항목</h3>
                <p className="mt-1 text-sm text-slate-500">
                  로컬 모델이 실패할 때 아래 항목을 확인해 주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnostics(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
              >
                닫기
              </button>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>
                • 모델 폴더의 mlc-chat-config.json / tokenizer / params_shard 파일이 200으로 열리는지
              </li>
              <li>• wasm 파일이 200으로 열리는지</li>
              <li>• (가능하면) HEAD 요청으로 content-length 확인</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.open("/edu/selfcheck", "_blank", "noopener,noreferrer")}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
              >
                진단 보기
              </button>
              <button
                type="button"
                onClick={() => setShowDiagnostics(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
              >
                나중에
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <style jsx global>{`
        .input-shell::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: 18px;
          background: linear-gradient(
            120deg,
            rgba(56, 189, 248, 0.18),
            rgba(59, 130, 246, 0.18),
            rgba(14, 165, 233, 0.18)
          );
          opacity: 0;
          filter: blur(6px);
          transition: opacity 0.2s ease;
          pointer-events: none;
        }
        .input-shell::after {
          content: "";
          position: absolute;
          inset: 1px;
          border-radius: 16px;
          background: linear-gradient(
            90deg,
            rgba(148, 163, 184, 0) 0%,
            rgba(148, 163, 184, 0.15) 50%,
            rgba(148, 163, 184, 0) 100%
          );
          opacity: 0;
          pointer-events: none;
        }
        .input-shell[data-phase="busy"]::before {
          opacity: 1;
          animation: glow-flow 3.6s ease-in-out infinite;
        }
        .input-shell[data-phase="busy"]::after {
          opacity: 0.6;
          animation: shimmer 2.8s ease-in-out infinite;
        }
        .input-shell[data-phase="ready"]::before,
        .input-shell[data-sanitize-pulse="true"]::before {
          opacity: 0.8;
          animation: glow-pulse 0.3s ease-out 1;
        }
        .input-shell[data-offtrack-pulse="true"]::before {
          opacity: 0.85;
          animation: glow-pulse 0.3s ease-out 1;
          background: linear-gradient(
            120deg,
            rgba(14, 165, 233, 0.25),
            rgba(56, 189, 248, 0.25),
            rgba(14, 165, 233, 0.25)
          );
        }
        .input-shell[data-undo-pulse="true"]::before {
          opacity: 0.85;
          animation: glow-pulse 0.35s ease-out 1;
        }
        .input-shell[data-sanitize-pulse="true"][data-alert="alert"]::before {
          background: linear-gradient(
            120deg,
            rgba(248, 113, 113, 0.25),
            rgba(251, 146, 60, 0.25),
            rgba(248, 113, 113, 0.25)
          );
        }
        .input-shell[data-phase="error"],
        .input-shell[data-sanitize-shake="true"] {
          animation: subtle-shake 0.35s ease-in-out 1;
        }
        .input-shell[data-has-input="true"] .ghost-hint {
          opacity: 0;
        }
        .input-shell:focus-within .ghost-hint {
          opacity: 0;
        }
        .ghost-hint {
          transition: opacity 0.2s ease;
        }
        .ghost-line {
          width: 40px;
          height: 1px;
          background-image: linear-gradient(
            90deg,
            rgba(148, 163, 184, 0.4) 50%,
            rgba(148, 163, 184, 0) 0%
          );
          background-size: 6px 1px;
        }
        .edu-performance-mode {
          scroll-behavior: auto;
        }
        .edu-performance-mode * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
        .edu-performance-mode .input-shell::before,
        .edu-performance-mode .input-shell::after,
        .edu-performance-mode .edu-guard-pulse,
        .edu-performance-mode .animate-spin {
          animation: none !important;
        }
        .edu-performance-mode .edu-guard-pulse {
          box-shadow: none;
        }
        @keyframes glow-flow {
          0% {
            filter: blur(6px);
            opacity: 0.65;
          }
          50% {
            filter: blur(8px);
            opacity: 0.9;
          }
          100% {
            filter: blur(6px);
            opacity: 0.65;
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-30%);
          }
          100% {
            transform: translateX(30%);
          }
        }
        @keyframes glow-pulse {
          0% {
            opacity: 0.2;
          }
          70% {
            opacity: 0.9;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes subtle-shake {
          0% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-2px);
          }
          50% {
            transform: translateX(2px);
          }
          75% {
            transform: translateX(-1px);
          }
          100% {
            transform: translateX(0);
          }
        }
        .edu-guard-pulse {
          animation: guard-pulse 2.8s ease-in-out infinite;
        }
        .edu-lock-active {
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
        }
        @keyframes guard-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 rgba(16, 185, 129, 0);
          }
          50% {
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
          }
        }
      `}</style>
      </div>
    </ChatPanelErrorBoundary>
  );
});

export default ChatPanel;
