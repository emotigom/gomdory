"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiV1Path } from "@/lib/standards/pathTypes";
import {
  abort as abortWebLLM,
  onProgress as onWebLLMProgress,
  start as startWebLLM,
} from "@/lib/edu/llm/webllmWorkerBridge";
import type {
  LocalChatMessage,
  LocalWebLLMDiagnostics,
} from "@/lib/edu/llm/webllmWorkerTypes";
import { buildCoachChatSystemPrompt, buildCoachFilesSystemPrompt } from "@/lib/edu/prompts";
import { koreanPurityCases } from "@/lib/edu/selfcheck/koreanPurityCases";
import { lessonFlowScenarios, type LessonFlowStep } from "@/lib/edu/selfcheck/lessonFlowScenarios";
import { containsAwkwardKorean, containsHan } from "@/lib/edu/text/koreanGuard";
import { rewriteKoreanOnce } from "@/lib/edu/text/koreanRewrite";
import { ensureRequiredRefs, normalizeFiles } from "@/lib/edu/fileProtocol";
import { detectHan, sanitizeHanAsLastResort } from "@/lib/edu/hanGuard";
import {
  getLessonContentSchema,
  getLessonContentZodSchema,
  lessonInsuranceContent,
  normalizeLessonContent,
} from "@/lib/edu/templates/schema";
import { renderLessonSite } from "@/lib/edu/templates";
import { getWebllmModelIds } from "@/lib/edu/llm/webllmConfig";
import { getWebllmModelRootUrl } from "@/lib/edu/llm/webllmAssetResolver";
import {
  clearEduLocalState,
  getGeneratorOverrideFlags,
  setGeneratorOverrideFlags,
} from "@/lib/edu/llm/diagnostics";
import { allowWebllmRetryOnce, readWebllmDegradedGate } from "@/lib/edu/llm/webllmDegradedGate";
import { hashRoomCodeShort } from "@/lib/edu/netsaver/hash";
import type { LessonId } from "@/lib/edu/lesson/lessonLock";
import { acquireLease, releaseLease, renewLease } from "@/lib/edu/netsaver/leaseClient";
import { getNetworkSaverMetricsSnapshot } from "@/lib/edu/netsaver/metrics";
import { runP2PProbe } from "@/lib/edu/netsaver/p2pProbe";
import {
  buildNetworkSaverRecommendation,
  type NetworkSaverRecommendation,
} from "@/lib/edu/netsaver/recommendation";
import { getResourceJournalSnapshot } from "@/lib/edu/netsaver/resourceJournal";
import { runPrewarm, type PrewarmProgress } from "@/lib/edu/netsaver/prewarm";
import WebLLMSelfcheckCard from "@/app/edu/_components/WebLLMSelfcheckCard";
import { classifyWebllmFailure, reasonLabel } from "@/lib/edu/selfcheck/webllmFailureClassifier";
import { allowedCoachFiles } from "@/lib/edu/llm/coachFilesValidation";
import { finalizeCoachInit, resolveCoachInitPrecondition } from "@/lib/edu/selfcheck/coachInitStatus";
import type { WebllmContainedRolloutSnapshot } from "@/lib/edu/llm/webllmContainedRolloutSnapshot";
import {
  getWebllmContainedRolloutEvidence,
  type WebllmContainedAttemptEvidence,
} from "@/lib/edu/llm/webllmContainedRolloutEvidence";
import { buildWebllmContainedRolloutHandoffPack } from "@/lib/edu/llm/webllmContainedRolloutHandoffPack";

type CheckState = {
  status: "idle" | "loading" | "ok" | "warn" | "error";
  message?: string;
};

type WebLLMHealthResponse =
  | {
      ok: true;
      requestId?: string;
      primary: {
        modelId: string;
        modelConfigUrl: string;
        wasmCandidateUrls: string[];
        selectedWasmUrl: string | null;
      };
      fallback?: {
        modelId: string;
        modelConfigUrl: string;
        wasmCandidateUrls: string[];
        selectedWasmUrl: string | null;
      };
      coach?: {
        modelId: string;
        modelConfigUrl: string;
        wasmCandidateUrls: string[];
        selectedWasmUrl: string | null;
      };
      env?: {
        source?: string;
        missingKeys?: string[];
      };
      hardDisabled?: boolean;
      resolvedConfig?: {
        coachModelId?: string | null;
        coachWasmUrl?: string | null;
        modelBase?: string | null;
        libBase?: string | null;
        hardDisableRaw?: string | null;
      };
      rolloutSnapshot?: WebllmContainedRolloutSnapshot;
    }
  | {
      ok: false;
      requestId?: string;
      missing: string[];
      missingKeys?: string[];
      env?: {
        source?: string;
        missingKeys?: string[];
      };
      message: string;
      rolloutSnapshot?: WebllmContainedRolloutSnapshot;
    };

type StructuredJsonCheckState = {
  status: "idle" | "loading" | "ok" | "error";
  message?: string;
  detail?: string;
  reason?: "response_format_unsupported" | "engine_error" | "model_not_ready" | "auth_error" | "env_missing" | "fetch_blocked";
  usedResponseFormat?: boolean;
  usedFallback?: boolean;
  modelId?: string;
  rawText?: string;
  data?: unknown;
};

type CoachInitCheckState = {
  attempted: boolean;
  status: "idle" | "attempting" | "loaded" | "failed" | "skipped";
  reasonCode: string | null;
  message: string | null;
  modelId: string | null;
  latencyMs: number | null;
};

const createWebLLMRequestId = (prefix: string) => {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const cryptoRef = globalThis.crypto as Crypto | undefined;
    if (cryptoRef?.randomUUID) {
      return `${prefix}-${cryptoRef.randomUUID()}`;
    }
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const buildEmptyDiagnostics = (): LocalWebLLMDiagnostics => {
  const { primaryModelId, fallbackModelId } = getWebllmModelIds();
  return {
    coach: {
      modelId: null,
      loaded: false,
      lastSuccessAt: null,
    },
    generator: {
      modelId: null,
      primaryLoaded: false,
      fallbackLoaded: false,
      lastSuccessAt: null,
    },
    modelIds: {
      primary: primaryModelId,
      fallback: fallbackModelId ?? null,
    },
    loadedModelIds: [],
    lastRequestDurations: {
      coachMs: null,
      generatorMs: null,
    },
    recentCounts: {
      coachStallAborts: 0,
      generatorTimeouts: 0,
      fallbackUsed: 0,
      insuranceTemplateApplied: 0,
      engineResets: 0,
    },
    lastError: null,
  };
};

type KoreanPurityResult = {
  prompt: string;
  rawText: string;
  fixedText: string;
  rawHasHan: boolean;
  rawAwkward: boolean;
  fixedHasHan: boolean;
  rewriteStatus: "skipped" | "rewritten" | "blocked";
};

type FlowCoachMetrics = {
  rawHanDetected: boolean;
  fixedHanDetected: boolean;
  retries: number;
  stalledAbortCount: number;
  engineResetCount: number;
  durationMs: number;
};

type FlowGeneratorMetrics = {
  rawHanDetected: boolean;
  fixedHanDetected: boolean;
  schemaOk: boolean;
  retries: number;
  usedFallbackModel: boolean;
  usedInsuranceTemplate: boolean;
  durationMs: number;
};

type FlowStepResult = {
  step: string;
  status: "ok" | "fail" | "skipped";
  durationMs: number;
  errorCode?: string;
  usedModel?: "primary" | "fallback" | "insurance";
  reason?: "timeout" | "schema" | "zod" | "cjk_guard" | "unknown";
  requestId?: string;
  exportMetrics?: {
    missingRefsDetected: boolean;
    fixedCss: boolean;
    fixedJs: boolean;
    postFixOk: boolean;
  };
};

type FlowRunResult = {
  runId: number;
  requestId: string;
  ok: boolean;
  hardFail?: string;
  lessonId: LessonId;
  schemaValid: boolean;
  renderOk: boolean;
  missingRefs: number;
  codeHash: string | null;
  durationMs: number;
  coach: FlowCoachMetrics;
  generator: FlowGeneratorMetrics;
  steps: FlowStepResult[];
};

type PrewarmState = {
  status: "idle" | "running" | "done" | "aborted";
  progress: PrewarmProgress | null;
  okCount: number;
  failCount: number;
  lastError: string | null;
};

const formatBytes = (value: number) => {
  if (!Number.isFinite(value)) return "";
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)}MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)}GB`;
};

const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const FLOW_GENERATOR_TIMEOUT_MS = 12_000;
const FLOW_COACH_TIMEOUT_MS = 18_000;
const FLOW_EXPORT_TIMEOUT_MS = 4_000;
const FLOW_RUN_COUNT = 10;
const DEFAULT_ALLOWED_FILES = allowedCoachFiles;
const LOCAL_AI_DISABLED_KEY = "gomdory.edu.webllm.disabled";
const LOCAL_AI_DISABLED_EVENT = "edu:webllm:disabled-change";
const AI_FALLBACK_LAST_KEY = "edu:ai:fallback:last";

type FlowPromptSet = {
  id: string;
  label: string;
  coachChat: string;
  buildFilesPrompt: (contentSchema: Record<string, unknown>) => string;
};

const DEFAULT_PROMPT_SET: FlowPromptSet = {
  id: "stable_korean_v1",
  label: "stable_korean_v1",
  coachChat: `
너는 학생을 돕는 친절한 코딩 코치야.
- 반드시 한국어로 말해.
- 한자/중국어/일본어 문자를 절대로 쓰지 마.
- 질문은 1개만, 1~2문장으로 짧게 말해.
- 코드블록 금지, 설명은 짧고 친절하게.
`.trim(),
  buildFilesPrompt: (contentSchema: Record<string, unknown>) => {
    const schemaKeys = Object.keys(contentSchema).join(", ");
    const fileList = DEFAULT_ALLOWED_FILES.join(", ");
    return `
너는 학생을 돕는 코딩 코치야.
출력 규칙:
- 반드시 JSON만 출력한다. (마크다운/코드블록/설명 금지)
- lessonId에 맞는 content JSON만 출력한다.
- HTML/CSS/JS 출력 금지.
- files/message 출력 금지.
- 한국어 문장에 한자/중국어/일본어 문자 금지.
- 참고: 허용 파일 목록은 ${fileList} 이지만 파일을 직접 만들지 않는다.
- 참고: content schema 키는 ${schemaKeys} 이다.
`.trim();
  },
};

export default function EduSelfcheckPage() {
  const searchParams = useSearchParams();
  const isTeacherMode = true;
  const [health, setHealth] = useState<
    { status: "loading" } | { status: "ready"; data: WebLLMHealthResponse } | { status: "error" }
  >({ status: "loading" });
  const [localAiDisabled, setLocalAiDisabled] = useState(false);
  const [retryArmed, setRetryArmed] = useState(false);

  const [modelStatus, setModelStatus] = useState<CheckState>({ status: "idle" });
  const [wasmPrimaryStatus, setWasmPrimaryStatus] = useState<CheckState>({ status: "idle" });
  const [wasmFallbackStatus, setWasmFallbackStatus] = useState<CheckState>({ status: "idle" });
  const [headChecks, setHeadChecks] = useState<Record<string, CheckState>>({});
  const [webGpuStatus, setWebGpuStatus] = useState<CheckState>({ status: "idle" });
  const [eduviewOriginStatus, setEduviewOriginStatus] = useState<CheckState>({ status: "idle" });
  const [eduviewKvStatus, setEduviewKvStatus] = useState<CheckState>({ status: "idle" });
  const [structuredJsonStatus, setStructuredJsonStatus] = useState<StructuredJsonCheckState>({
    status: "idle",
  });
  const [koreanOnlyStatus, setKoreanOnlyStatus] = useState<CheckState>({
    status: "idle",
  });
  const [koreanPurityStatus, setKoreanPurityStatus] = useState<CheckState>({
    status: "idle",
  });
  const [koreanPurityResults, setKoreanPurityResults] = useState<KoreanPurityResult[]>([]);
  const [flowRunStatus, setFlowRunStatus] = useState<CheckState>({ status: "idle" });
  const [flowRunResults, setFlowRunResults] = useState<FlowRunResult[]>([]);
  const [flowProgress, setFlowProgress] = useState({
    current: 0,
    total: FLOW_RUN_COUNT,
  });
  const [flowRunning, setFlowRunning] = useState(false);
  const [flowLessonId, setFlowLessonId] = useState<LessonId>("P1");
  const [useDefaultPromptSet, setUseDefaultPromptSet] = useState(true);
  const flowAbortRef = useRef<AbortController | null>(null);
  const flowStopRequestedRef = useRef(false);
  const structuredJsonProgressRef = useRef<string | null>(null);
  const structuredJsonRanRef = useRef(false);
  const [eduviewOrigin, setEduviewOrigin] = useState<string>("");
  const [copiedGuide, setCopiedGuide] = useState<string | null>(null);
  const [copiedDiagnostic, setCopiedDiagnostic] = useState(false);
  const [copiedFlowReport, setCopiedFlowReport] = useState(false);
  const [copiedFlowExport, setCopiedFlowExport] = useState(false);
  const [preferredModelId, setPreferredModelId] = useState<string>("");
  const [canSelectModel, setCanSelectModel] = useState(false);
  const [diagnostics, setDiagnostics] = useState(buildEmptyDiagnostics());
  const [coachInitState, setCoachInitState] = useState<CoachInitCheckState>({
    attempted: false,
    status: "idle",
    reasonCode: null,
    message: null,
    modelId: null,
    latencyMs: null,
  });
  const [generatorOverrides, setGeneratorOverrides] = useState(getGeneratorOverrideFlags());
  const [netsaverMetrics, setNetsaverMetrics] = useState(getNetworkSaverMetricsSnapshot());
  const boostEndsAt = netsaverMetrics.boost.startAt
    ? netsaverMetrics.boost.startAt + netsaverMetrics.boost.durationMs
    : null;
  const boostRemainingMs = boostEndsAt ? Math.max(0, boostEndsAt - Date.now()) : null;
  const boostActive = boostRemainingMs !== null && boostRemainingMs > 0;
  const [netsaverRoomHash, setNetsaverRoomHash] = useState<string>("-");
  const [netsaverProbeStatus, setNetsaverProbeStatus] = useState<CheckState>({
    status: "idle",
  });
  const [netsaverLeaseStatus, setNetsaverLeaseStatus] = useState<CheckState>({
    status: "idle",
  });
  const [netsaverJournal, setNetsaverJournal] = useState<Awaited<
    ReturnType<typeof getResourceJournalSnapshot>
  > | null>(null);
  const [netsaverRecommendation, setNetsaverRecommendation] =
    useState<NetworkSaverRecommendation | null>(null);
  const [prewarmState, setPrewarmState] = useState<PrewarmState>({
    status: "idle",
    progress: null,
    okCount: 0,
    failCount: 0,
    lastError: null,
  });

  const refreshDiagnostics = useCallback(async () => {
    const response = await startWebLLM(createWebLLMRequestId("diagnostics"), {
      kind: "diagnostics",
    });
    if (response.type === "result" && response.kind === "diagnostics") {
      setDiagnostics(response.result);
    }
  }, []);

  const recordInsuranceTemplateApplied = useCallback(() => {
    void startWebLLM(createWebLLMRequestId("insurance"), { kind: "recordInsurance" }).catch(
      () => undefined,
    );
  }, []);

  const runCompleteText = useCallback(
    async (options: {
      messages: LocalChatMessage[];
      temperature?: number;
      preferredModelId?: string;
      signal?: AbortSignal;
    }) => {
      const requestId = createWebLLMRequestId("complete-text");
      const abortHandler = () => abortWebLLM(requestId);
      if (options.signal) {
        options.signal.addEventListener("abort", abortHandler);
      }
      const response = await startWebLLM(requestId, {
        kind: "completeText",
        messages: options.messages,
        temperature: options.temperature,
        preferredModelId: options.preferredModelId,
      });
      if (options.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
      if (response.type === "result" && response.kind === "completeText") {
        return response.result;
      }
      return {
        ok: false,
        reason: response.type === "aborted" ? ("timeout" as const) : ("engine_error" as const),
        message:
          response.type === "error" ? response.error.message : "요청이 중단되었습니다.",
        shouldFallback: false,
      };
    },
    [],
  );

  const runGenerateJson = useCallback(
    async (options: {
      messages: LocalChatMessage[];
      schema?: Record<string, unknown>;
      temperature?: number;
      preferredModelId?: string;
      timeoutMs?: number;
      engineTimeoutMs?: number;
      signal?: AbortSignal;
    }) => {
      const requestId = createWebLLMRequestId("generate-json");
      const abortHandler = () => abortWebLLM(requestId);
      if (options.signal) {
        options.signal.addEventListener("abort", abortHandler);
      }
      const response = await startWebLLM(requestId, {
        kind: "generateJson",
        messages: options.messages,
        schema: options.schema,
        temperature: options.temperature,
        preferredModelId: options.preferredModelId,
        timeoutMs: options.timeoutMs,
        engineTimeoutMs: options.engineTimeoutMs,
      });
      if (options.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
      if (response.type === "result" && response.kind === "generateJson") {
        return response.result;
      }
      return {
        ok: false,
        reason: response.type === "aborted" ? ("timeout" as const) : ("engine_error" as const),
        message:
          response.type === "error" ? response.error.message : "요청이 중단되었습니다.",
        shouldFallback: false,
      };
    },
    [],
  );

  const runStreamChat = useCallback(
    async (options: {
      messages: LocalChatMessage[];
      temperature?: number;
      preferredModelId?: string;
      stallTimeoutMs?: number;
      signal?: AbortSignal;
      onChunk: (chunk: string) => void;
    }) => {
      const requestId = createWebLLMRequestId("stream-chat");
      const abortHandler = () => abortWebLLM(requestId);
      if (options.signal) {
        options.signal.addEventListener("abort", abortHandler);
      }
      const unsubscribe = onWebLLMProgress((event) => {
        if (event.requestId !== requestId || event.kind !== "streamChat") return;
        if (event.delta) {
          options.onChunk(event.delta);
        }
      });
      const response = await startWebLLM(requestId, {
        kind: "streamChat",
        messages: options.messages,
        temperature: options.temperature,
        preferredModelId: options.preferredModelId,
        stallTimeoutMs: options.stallTimeoutMs,
      });
      unsubscribe();
      if (options.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
      if (response.type === "result" && response.kind === "streamChat") {
        return response.result;
      }
      return {
        ok: false,
        reason: response.type === "aborted" ? ("timeout" as const) : ("engine_error" as const),
        message:
          response.type === "error" ? response.error.message : "요청이 중단되었습니다.",
        shouldFallback: false,
        stalledAbortCount: 0,
        engineResetCount: 0,
      };
    },
    [],
  );
  const koreanPurityPrompt = useMemo(() => buildCoachChatSystemPrompt(), []);
  const flowAllowedFiles = useMemo(() => [...DEFAULT_ALLOWED_FILES], []);
  const flowContentSchema = useMemo(() => getLessonContentSchema(flowLessonId), [flowLessonId]);
  const flowFilesPrompt = useMemo(() => {
    if (useDefaultPromptSet) {
      return DEFAULT_PROMPT_SET.buildFilesPrompt(flowContentSchema);
    }
    return buildCoachFilesSystemPrompt({ lessonId: flowLessonId, allowedFiles: flowAllowedFiles });
  }, [flowAllowedFiles, flowContentSchema, flowLessonId, useDefaultPromptSet]);
  const flowChatPrompt = useMemo(() => {
    if (useDefaultPromptSet) {
      return DEFAULT_PROMPT_SET.coachChat;
    }
    return buildCoachChatSystemPrompt({ lessonId: flowLessonId });
  }, [flowLessonId, useDefaultPromptSet]);

  useEffect(() => {
    let cancelled = false;
    const loadHealth = async () => {
      try {
        const response = await fetch(apiV1Path("edu/webllm/health"));
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as WebLLMHealthResponse;
        if (!cancelled) {
          setHealth({ status: "ready", data });
        }
      } catch {
        if (!cancelled) {
          setHealth({ status: "error" });
        }
      }
    };
    void loadHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasWebGpu = "gpu" in navigator;
    setWebGpuStatus({
      status: hasWebGpu ? "ok" : "error",
      message: hasWebGpu ? "WebGPU 사용 가능" : "WebGPU 비활성",
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("edu:webllm:modelId");
      setPreferredModelId(stored ?? "");
    } catch {
      setPreferredModelId("");
    }
  }, []);

  useEffect(() => {
    setCanSelectModel(isTeacherMode);
  }, [isTeacherMode]);

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
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!isTeacherMode) return;
    void refreshDiagnostics();
    const intervalId = window.setInterval(() => {
      void refreshDiagnostics();
      setNetsaverMetrics(getNetworkSaverMetricsSnapshot());
    }, 1500);
    return () => window.clearInterval(intervalId);
  }, [isTeacherMode, refreshDiagnostics]);

  useEffect(() => {
    if (!isTeacherMode) return;
    const code = searchParams.get("code");
    if (!code) {
      setNetsaverRoomHash("-");
      return;
    }
    void hashRoomCodeShort(code).then(setNetsaverRoomHash).catch(() => setNetsaverRoomHash("-"));
  }, [isTeacherMode, searchParams]);

  useEffect(() => {
    if (!isTeacherMode) return;
    const code = searchParams.get("code");
    if (!code) {
      setNetsaverJournal(null);
      setNetsaverRecommendation(null);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      const snapshot = await getResourceJournalSnapshot(code);
      if (cancelled) return;
      setNetsaverJournal(snapshot);
      const metricsSnapshot = getNetworkSaverMetricsSnapshot();
      setNetsaverRecommendation(
        buildNetworkSaverRecommendation({ journal: snapshot, metrics: metricsSnapshot }),
      );
    };
    void refresh();
    const intervalId = window.setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isTeacherMode, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const loadEduview = async () => {
      setEduviewOriginStatus({ status: "loading" });
      setEduviewKvStatus({ status: "loading" });
      const publicOrigin =
        process.env.NEXT_PUBLIC_EDUVIEW_ORIGIN ?? "https://eduview.gkrry.com";
      const normalizedOrigin = publicOrigin.replace(/\/$/, "");
      const healthUrl = `${normalizedOrigin}/v1/health/visibility`;
      try {
        setEduviewOrigin(normalizedOrigin);
        let originResponse: Response | null = null;
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            originResponse = await fetchWithTimeout(healthUrl, 4500);
            if (originResponse.ok || originResponse.status === 404) {
              break;
            }
            lastError = new Error(`HTTP ${originResponse.status}`);
          } catch (originError) {
            lastError = originError;
          }
        }
        if (cancelled) return;
        if (originResponse && (originResponse.ok || originResponse.status === 404)) {
          setEduviewOriginStatus({
            status: originResponse.ok ? "ok" : "warn",
            message: `HTTP ${originResponse.status}`,
          });
        } else {
          setEduviewOriginStatus({
            status: "warn",
            message: lastError instanceof Error ? lastError.message : "요청 실패",
          });
        }

        const kvResponse = await fetchWithTimeout(apiV1Path("edu/eduview/health"), 4500).catch(
          () => null,
        );
        if (cancelled) return;
        if (!kvResponse) {
          setEduviewKvStatus({ status: "warn", message: "숨김 KV 체크 실패" });
          return;
        }
        const data = (await kvResponse.json().catch(() => null)) as
          | { ok: true; visibilityKv: "enabled" | "disabled"; status: number; origin: string }
          | { ok: false; message?: string }
          | null;
        if (!kvResponse.ok || !data || !data.ok) {
          setEduviewKvStatus({
            status: "warn",
            message: data && "message" in data ? data.message ?? "응답 오류" : "응답 오류",
          });
          return;
        }
        const isEnabled = data.visibilityKv === "enabled";
        setEduviewKvStatus({
          status: "ok",
          message: isEnabled ? "숨김 KV 체크 가능" : "숨김 KV 비활성",
        });
      } catch (error) {
        if (!cancelled) {
          setEduviewOriginStatus({
            status: "warn",
            message: error instanceof Error ? error.message : "요청 실패",
          });
          setEduviewKvStatus({
            status: "warn",
            message: "상태 확인 실패",
          });
        }
      }
    };
    void loadEduview();
    return () => {
      cancelled = true;
    };
  }, []);

  const runCheck = useCallback(
    async (url: string, setter: (next: CheckState) => void, method: "GET" | "HEAD" = "HEAD") => {
      setter({ status: "loading" });
      try {
        let response = await fetch(url, { method });
        if (method === "HEAD" && [405, 501].includes(response.status)) {
          response = await fetch(url, { method: "GET" });
        }
        if (!response.ok) {
          setter({ status: "error", message: `HTTP ${response.status}` });
          return;
        }
        const length = response.headers.get("content-length");
        const lengthLabel =
          length && Number.isFinite(Number(length)) ? ` • ${formatBytes(Number(length))}` : "";
        setter({ status: "ok", message: `HTTP ${response.status}${lengthLabel}` });
      } catch (error) {
        setter({
          status: "error",
          message: error instanceof Error ? error.message : "요청에 실패했어요.",
        });
      }
    },
    [],
  );

  const config = useMemo(() => {
    if (health.status === "error") {
      return { ok: false as const, message: "진단 API를 불러오지 못했어요." };
    }
    if (health.status !== "ready") {
      return { ok: false as const, message: "로컬 모델 정보를 불러오는 중입니다." };
    }
    if (!health.data.ok) {
      return { ok: false as const, message: health.data.message, data: health.data };
    }
    return { ok: true as const, data: health.data };
  }, [health]);

  const healthEnvSource = useMemo(() => {
    if (health.status !== "ready") return null;
    if (health.data.env?.source) return health.data.env.source;
    return "server_runtime_next_public";
  }, [health]);

  const healthMissingKeys = useMemo(() => {
    if (health.status !== "ready") return [] as string[];
    if (health.data.ok) {
      return health.data.env?.missingKeys ?? [];
    }
    return health.data.env?.missingKeys ?? health.data.missingKeys ?? health.data.missing ?? [];
  }, [health]);

  const networkTestTargets = useMemo(() => {
    if (health.status !== "ready" || !health.data.ok) {
      return { modelConfigUrls: [] as string[], wasmUrl: null as string | null };
    }
    return {
      modelConfigUrls: health.data.primary.modelConfigUrl ? [health.data.primary.modelConfigUrl] : [],
      wasmUrl:
        health.data.primary.selectedWasmUrl ??
        health.data.primary.wasmCandidateUrls?.[0] ??
        null,
    };
  }, [health]);

  const rolloutSnapshot = useMemo(() => {
    if (health.status !== "ready") return null;
    return health.data.rolloutSnapshot ?? null;
  }, [health]);
  const [containedEvidenceRows, setContainedEvidenceRows] = useState<WebllmContainedAttemptEvidence[]>([]);
  const [handoffCopyState, setHandoffCopyState] = useState<"idle" | "copied" | "error">("idle");

  const handoffPack = useMemo(() => {
    if (!rolloutSnapshot) return null;
    return buildWebllmContainedRolloutHandoffPack({
      snapshot: rolloutSnapshot,
      evidenceRows: containedEvidenceRows,
    });
  }, [containedEvidenceRows, rolloutSnapshot]);

  const handleCopyHandoff = useCallback(async () => {
    if (!handoffPack) return;
    try {
      await navigator.clipboard.writeText(handoffPack.safeCopyText);
      setHandoffCopyState("copied");
    } catch {
      setHandoffCopyState("error");
    }
  }, [handoffPack]);

  useEffect(() => {
    if (handoffCopyState === "idle") return;
    const timeoutId = window.setTimeout(() => setHandoffCopyState("idle"), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [handoffCopyState]);

  const modelUrl = config.ok ? getWebllmModelRootUrl(config.data.primary.modelConfigUrl) : "";
  const wasmPrimaryUrl = config.ok
    ? config.data.primary.selectedWasmUrl ?? config.data.primary.wasmCandidateUrls?.[0] ?? ""
    : "";
  const wasmFallbackUrl = config.ok
    ? config.data.fallback?.selectedWasmUrl ?? config.data.fallback?.wasmCandidateUrls?.[0] ?? ""
    : "";
  const configModelId = config.ok ? config.data.primary.modelId : null;
  const configFallbackModelId = config.ok ? config.data.fallback?.modelId ?? null : null;
  const modelConfigUrl = config.ok ? config.data.primary.modelConfigUrl : "";
  const resolvedCoachModelId = config.ok ? config.data.resolvedConfig?.coachModelId ?? config.data.coach?.modelId ?? null : null;
  const resolvedCoachWasmUrl = config.ok
    ? config.data.resolvedConfig?.coachWasmUrl ?? config.data.coach?.selectedWasmUrl ?? null
    : null;
  const resolvedLibBase = config.ok ? config.data.resolvedConfig?.libBase ?? null : null;
  const resolvedModelBase = config.ok ? config.data.resolvedConfig?.modelBase ?? null : null;
  const hardDisableFinal = config.ok ? Boolean(config.data.hardDisabled) : false;
  const hardDisableRaw = config.ok ? config.data.resolvedConfig?.hardDisableRaw ?? null : null;
  const adminChecks = modelUrl
    ? [
        { label: "model/tokenizer.json", url: `${modelUrl}tokenizer.json` },
        { label: "model/params_shard_0.bin", url: `${modelUrl}params_shard_0.bin` },
        { label: "model/params_shard_1.bin", url: `${modelUrl}params_shard_1.bin` },
        { label: "model/ndarray-cache.json (옵션)", url: `${modelUrl}ndarray-cache.json` },
        { label: "model/vocab.json (옵션)", url: `${modelUrl}vocab.json` },
        { label: "model/merges.txt (옵션)", url: `${modelUrl}merges.txt` },
      ]
    : [];

  const modelOptions = useMemo(() => {
    if (!config.ok) return [];
    const options = [{ id: config.data.primary.modelId, label: "Primary" }];
    if (config.data.fallback?.modelId) {
      options.push({ id: config.data.fallback.modelId, label: "Fallback" });
    }
    return options;
  }, [config]);

  useEffect(() => {
    if (!config.ok || modelOptions.length === 0) return;
    if (preferredModelId && modelOptions.some((option) => option.id === preferredModelId)) {
      return;
    }
    setPreferredModelId(config.data.primary.modelId);
  }, [config, modelOptions, preferredModelId]);

  const currentModelLabel = useMemo(() => {
    if (!config.ok) return "";
    if (preferredModelId && preferredModelId === config.data.fallback?.modelId) {
      return "Fallback";
    }
    return "Primary";
  }, [config, preferredModelId]);
  const eduviewHealthUrl = useMemo(() => {
    if (!eduviewOrigin) return "";
    return `${eduviewOrigin.replace(/\/$/, "")}/v1/health/visibility`;
  }, [eduviewOrigin]);

  const resolveStatusLabel = (status: CheckState, idleText = "대기 중") => {
    if (status.status === "loading") {
      return { text: "확인 중…", tone: "text-slate-500" };
    }
    if (status.status === "ok") {
      return { text: status.message ?? "정상", tone: "text-emerald-600" };
    }
    if (status.status === "warn") {
      return { text: status.message ?? "주의", tone: "text-amber-600" };
    }
    if (status.status === "error") {
      return { text: status.message ?? "오류", tone: "text-rose-600" };
    }
    return { text: idleText, tone: "text-slate-400" };
  };

  const resolveStatusBadge = (status: CheckState) => {
    if (status.status === "loading") {
      return { text: "확인중", className: "bg-slate-100 text-slate-500" };
    }
    if (status.status === "ok") {
      return { text: "정상", className: "bg-emerald-100 text-emerald-700" };
    }
    if (status.status === "warn") {
      return { text: "주의", className: "bg-amber-100 text-amber-700" };
    }
    if (status.status === "error") {
      return { text: "오류", className: "bg-rose-100 text-rose-700" };
    }
    return { text: "대기", className: "bg-slate-100 text-slate-400" };
  };

  const adminGuides = useMemo(() => {
    const parseHttpStatus = (message?: string) => {
      if (!message) return null;
      const match = message.match(/HTTP\s(\d{3})/);
      if (!match) return null;
      const code = Number(match[1]);
      return Number.isFinite(code) ? code : null;
    };
    const guides: { key: string; title: string; description: string; message: string }[] = [];
    const modelStatusCode = parseHttpStatus(modelStatus.message);
    const wasmPrimaryStatusCode = parseHttpStatus(wasmPrimaryStatus.message);
    const wasmFallbackStatusCode = parseHttpStatus(wasmFallbackStatus.message);
    const eduviewStatusCode = parseHttpStatus(eduviewOriginStatus.message);

    if (webGpuStatus.status === "error") {
      guides.push({
        key: "webgpu",
        title: "WebGPU 비활성",
        description: "Chrome/Edge 최신 버전과 하드웨어 가속을 확인하고 WebGPU가 활성화되어야 합니다.",
        message:
          "WebGPU가 비활성입니다. Chrome/Edge 최신 버전 설치 후 하드웨어 가속을 켜고 브라우저를 재시작해 주세요.",
      });
    }

    if (modelStatus.status === "error" && (modelStatusCode === 404 || modelStatusCode === 403)) {
      guides.push({
        key: "model-json",
        title: "모델 설정 JSON 응답 오류",
        description: "모델 경로 또는 스토리지 공개 권한 문제일 수 있습니다.",
        message:
          "모델 설정 JSON 요청이 실패했습니다(404/403). 모델 경로와 스토리지 공개 권한(R2/CORS)을 확인해 주세요.",
      });
    }

    const isWasmError =
      (wasmPrimaryStatus.status === "error" &&
        (wasmPrimaryStatusCode === 404 || wasmPrimaryStatusCode === 403)) ||
      (wasmFallbackStatus.status === "error" &&
        (wasmFallbackStatusCode === 404 || wasmFallbackStatusCode === 403));

    if (isWasmError) {
      guides.push({
        key: "wasm",
        title: "WASM 파일 응답 오류",
        description: "WASM 파일이 누락되었거나 접근 권한이 없을 수 있습니다.",
        message:
          "WASM 파일 요청이 실패했습니다(404/403). wasm 경로와 스토리지 공개 권한을 확인해 주세요.",
      });
    }

    if (eduviewOriginStatus.status === "error") {
      const label =
        eduviewStatusCode === 404
          ? "EduView 상태 endpoint 확인 필요"
          : "EduView origin 연결 실패";
      guides.push({
        key: "eduview-origin",
        title: label,
        description: "EduView origin이 CORS 차단 또는 네트워크 오류일 수 있습니다.",
        message:
          "EduView origin 접근이 실패했습니다. CORS 허용과 /v1/health/visibility endpoint를 확인해 주세요.",
      });
    }

    return guides;
  }, [eduviewOriginStatus, modelStatus, wasmFallbackStatus, wasmPrimaryStatus, webGpuStatus]);

  const handleCopyGuide = useCallback(async (text: string, key: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedGuide(key);
        window.setTimeout(() => setCopiedGuide((current) => (current === key ? null : current)), 1500);
      }
    } catch {
      setCopiedGuide(null);
    }
  }, []);

  useEffect(() => {
    if (!config.ok) return;
    if (modelConfigUrl) {
      void runCheck(modelConfigUrl, setModelStatus, "GET");
    }
    if (wasmPrimaryUrl) {
      void runCheck(wasmPrimaryUrl, setWasmPrimaryStatus, "GET");
    }
    if (wasmFallbackUrl) {
      void runCheck(wasmFallbackUrl, setWasmFallbackStatus, "GET");
    }
  }, [config.ok, modelConfigUrl, runCheck, wasmFallbackUrl, wasmPrimaryUrl]);

  useEffect(() => {
    if (!config.ok) return;
    if (preferredModelId) return;
    setPreferredModelId(config.data.primary.modelId);
  }, [config, preferredModelId]);

  const structuredJsonSchema = useMemo(
    () => ({
      type: "object",
      properties: {
        ok: { const: true },
      },
      required: ["ok"],
      additionalProperties: false,
    }),
    [],
  );

  useEffect(() => {
    if (!config.ok) return;
    if (!preferredModelId) return;
    if (structuredJsonRanRef.current) return;
    structuredJsonRanRef.current = true;

    const controller = new AbortController();
    setStructuredJsonStatus({ status: "loading", message: "모델 준비 중…" });
    structuredJsonProgressRef.current = null;

    const requestId = createWebLLMRequestId("structured-json");
    const unsubscribe = onWebLLMProgress((event) => {
      if (event.requestId !== requestId || event.kind !== "generateJson") return;
      structuredJsonProgressRef.current = event.message;
      setStructuredJsonStatus((prev) =>
        prev.status === "loading" ? { ...prev, message: event.message } : prev,
      );
    });
    const abortHandler = () => abortWebLLM(requestId);
    controller.signal.addEventListener("abort", abortHandler);

    startWebLLM(requestId, {
      kind: "generateJson",
      messages: [
        { role: "system", content: "다음 요청에 대해 JSON 객체만 출력하세요." },
        { role: "user", content: "ok가 true인 JSON을 반환해 주세요." },
      ],
      schema: structuredJsonSchema,
      temperature: 0,
      preferredModelId,
    })
      .then((response) => {
        const result =
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
        if (!result.ok) {
          const detail = result.message ?? "";
          const reason = classifyWebllmFailure({
            healthMissingKeys,
            detail,
            resultReason: result.reason,
            progressMessage: structuredJsonProgressRef.current,
          });
          const reasonMessage = reasonLabel(reason);
          setStructuredJsonStatus({
            status: "error",
            message: reasonMessage,
            detail: result.message,
            reason,
          });
          return;
        }

        if (!("data" in result)) {
          setStructuredJsonStatus({
            status: "error",
            message: "engine error",
            detail: "schema 응답 데이터가 없습니다.",
            reason: "engine_error",
          });
          return;
        }

        const data = result.data as { ok?: unknown } | null;
        const isOk = Boolean(data && typeof data === "object" && data.ok === true);

        if (!result.usedResponseFormat) {
          setStructuredJsonStatus({
            status: "error",
            message: "response_format unsupported",
            detail: "schema 응답이 response_format 없이 생성되었습니다.",
            reason: "response_format_unsupported",
            usedResponseFormat: result.usedResponseFormat,
            usedFallback: result.usedFallback,
            modelId: result.modelId,
            rawText: result.rawText,
            data: result.data,
          });
          return;
        }

        if (!isOk) {
          setStructuredJsonStatus({
            status: "error",
            message: "engine error",
            detail: "schema 응답이 기대값과 다릅니다.",
            reason: "engine_error",
            usedResponseFormat: result.usedResponseFormat,
            usedFallback: result.usedFallback,
            modelId: result.modelId,
            rawText: result.rawText,
            data: result.data,
          });
          return;
        }

        setStructuredJsonStatus({
          status: "ok",
          message: "PASS",
          detail: "response_format 기반 JSON 생성에 성공했습니다.",
          usedResponseFormat: result.usedResponseFormat,
          usedFallback: result.usedFallback,
          modelId: result.modelId,
          rawText: result.rawText,
          data: result.data,
        });
      })
      .catch((error) => {
        setStructuredJsonStatus({
          status: "error",
          message: "engine error",
          detail: error instanceof Error ? error.message : "요청 실패",
          reason: /401|unauthorized|auth/i.test(error instanceof Error ? error.message : "") ? "auth_error" : "engine_error",
        });
      })
      .finally(() => {
        controller.signal.removeEventListener("abort", abortHandler);
        unsubscribe();
      });

    return () => {
      controller.abort();
    };
  }, [config.ok, healthMissingKeys, preferredModelId, structuredJsonSchema]);

  const runKoreanOnlyCheck = useCallback(async () => {
    if (!preferredModelId) {
      setKoreanOnlyStatus({ status: "error", message: "모델을 먼저 선택해 주세요." });
      return;
    }
    setKoreanOnlyStatus({ status: "loading", message: "검사 중…" });
    const controller = new AbortController();
    const result = await runCompleteText({
      messages: [
        { role: "system", content: "다음 요청에 대해 한글로만 답하세요." },
        { role: "user", content: "‘수영이 취미예요’라고 한글만으로 한 문장 만들어줘." },
      ],
      temperature: 0.2,
      preferredModelId,
      signal: controller.signal,
    });

    if (!result.ok) {
      setKoreanOnlyStatus({ status: "error", message: result.message });
      return;
    }

    if (!("content" in result)) {
      setKoreanOnlyStatus({ status: "error", message: "응답이 비어 있습니다." });
      return;
    }

    const responseText = result.content.trim();
    if (containsHan(responseText)) {
      setKoreanOnlyStatus({
        status: "error",
        message: "이 모델은 가끔 한자를 섞습니다. 자동 정제 기능이 작동합니다.",
      });
      return;
    }

    setKoreanOnlyStatus({ status: "ok", message: "PASS" });
  }, [preferredModelId, runCompleteText]);

  const runKoreanPurityTest = useCallback(async () => {
    if (!preferredModelId) {
      setKoreanPurityStatus({ status: "error", message: "모델을 먼저 선택해 주세요." });
      return;
    }
    setKoreanPurityStatus({ status: "loading", message: "20문항 검사 중…" });
    setKoreanPurityResults([]);

    const results: KoreanPurityResult[] = [];
    for (const prompt of koreanPurityCases) {
      const completion = await runCompleteText({
        messages: [
          { role: "system", content: koreanPurityPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        preferredModelId,
      });

      if (!completion.ok) {
        setKoreanPurityStatus({ status: "error", message: completion.message });
        return;
      }

      if (!("content" in completion)) {
        setKoreanPurityStatus({ status: "error", message: "응답이 비어 있습니다." });
        return;
      }

      const rawText = completion.content.trim();
      const rawHasHan = containsHan(rawText);
      const rawAwkward = containsAwkwardKorean(rawText);
      const rewriteResult = await rewriteKoreanOnce({
        text: rawText,
        systemPrompt: koreanPurityPrompt,
        preferredModelId,
      });
      const fixedText = sanitizeHanAsLastResort(rewriteResult.text);
      const fixedHasHan = containsHan(fixedText);

      results.push({
        prompt,
        rawText,
        fixedText,
        rawHasHan,
        rawAwkward,
        fixedHasHan,
        rewriteStatus: rewriteResult.status,
      });
    }

    setKoreanPurityResults(results);
    setKoreanPurityStatus({ status: "ok", message: "완료" });
  }, [koreanPurityPrompt, preferredModelId, runCompleteText]);

  const runLessonFlow = useCallback(
    async (runId: number): Promise<FlowRunResult> => {
      const scenario = lessonFlowScenarios[runId];
      if (!scenario) {
        return {
          runId,
          requestId: `flow-${runId}-${Date.now()}`,
          ok: false,
          hardFail: "scenario_missing",
          lessonId: flowLessonId,
          schemaValid: false,
          renderOk: false,
          missingRefs: 0,
          codeHash: null,
          durationMs: 0,
          coach: {
            rawHanDetected: false,
            fixedHanDetected: false,
            retries: 0,
            stalledAbortCount: 0,
            engineResetCount: 0,
            durationMs: 0,
          },
          generator: {
            rawHanDetected: false,
            fixedHanDetected: false,
            schemaOk: false,
            retries: 0,
            usedFallbackModel: false,
            usedInsuranceTemplate: false,
            durationMs: 0,
          },
          steps: [],
        };
      }
      const coachMetrics: FlowCoachMetrics = {
        rawHanDetected: false,
        fixedHanDetected: false,
        retries: 0,
        stalledAbortCount: 0,
        engineResetCount: 0,
        durationMs: 0,
      };
      const generatorMetrics: FlowGeneratorMetrics = {
        rawHanDetected: false,
        fixedHanDetected: false,
        schemaOk: true,
        retries: 0,
        usedFallbackModel: false,
        usedInsuranceTemplate: false,
        durationMs: 0,
      };
      const stepResults: FlowStepResult[] = [];
      let hardFailReason: string | undefined;
      let renderOk = false;
      let missingRefs = 0;
      let codeHash: string | null = null;

      const chatSystemPrompt = flowChatPrompt;
      const createStepController = (timeoutMs: number) => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
        const parentSignal = flowAbortRef.current?.signal;
        const onAbort = () => controller.abort();
        if (parentSignal) {
          if (parentSignal.aborted) {
            controller.abort();
          } else {
            parentSignal.addEventListener("abort", onAbort);
          }
        }
        return {
          signal: controller.signal,
          cleanup: () => {
            window.clearTimeout(timeoutId);
            if (parentSignal) {
              parentSignal.removeEventListener("abort", onAbort);
            }
          },
        };
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

      const streamCoachOnce = async (userMessage: string) => {
        const started = performance.now();
        let responseText = "";
        const stepController = createStepController(FLOW_COACH_TIMEOUT_MS);
        const result = await runStreamChat({
          messages: [
            { role: "system", content: chatSystemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.4,
          preferredModelId,
          signal: stepController.signal,
          onChunk: (chunk) => {
            responseText += chunk;
          },
        });
        stepController.cleanup();
        const durationMs = performance.now() - started;
        coachMetrics.durationMs += durationMs;
        coachMetrics.stalledAbortCount += result.stalledAbortCount ?? 0;
        coachMetrics.engineResetCount += result.engineResetCount ?? 0;
        if (!result.ok) {
          return {
            ok: false,
            reason: result.reason === "timeout" ? ("timeout" as const) : ("unknown" as const),
            text: sanitizeHanAsLastResort("지금은 잠깐 쉬었다가 다시 시작해도 좋아요."),
          };
        }
        return { ok: true, text: responseText.trim() };
      };

      const rewriteCoachOnce = async (rawText: string) => {
        const rawHasHan = detectHan(rawText);
        coachMetrics.rawHanDetected = coachMetrics.rawHanDetected || rawHasHan;
        if (!rawHasHan && !containsAwkwardKorean(rawText)) {
          return rawText;
        }
        coachMetrics.retries += 1;
        const rewriteResult = await rewriteKoreanOnce({
          text: rawText,
          systemPrompt: chatSystemPrompt,
          preferredModelId,
        });
        const fixedText = rewriteResult.text;
        const sanitized = sanitizeHanAsLastResort(fixedText);
        const fixedHasHan = detectHan(sanitized);
        coachMetrics.fixedHanDetected = coachMetrics.fixedHanDetected || fixedHasHan;
        return sanitized;
      };

      const buildFlowContentMessages = (
        conversation: Array<{ role: "user" | "assistant"; content: string }>,
        instruction: string,
        options?: { strictLanguage?: boolean; repairJson?: boolean },
      ): LocalChatMessage[] => {
        const strictNotice = options?.strictLanguage
          ? "한자/중국어/일본어 문자 금지. 반드시 한글로만 작성."
          : "";
        const repairNotice = options?.repairJson
          ? "이전 응답이 JSON 스키마를 지키지 못했습니다. 이번에는 반드시 스키마와 일치하는 JSON 객체만 출력하세요."
          : "";
        const schemaNotice = `content 스키마: ${JSON.stringify(flowContentSchema)}`;
        const systemContent = [flowFilesPrompt, schemaNotice, strictNotice, repairNotice]
          .filter(Boolean)
          .join("\n\n");
        const resolvedInstruction = `lessonId=${flowLessonId}\n${instruction}`;
        return [
          { role: "system", content: systemContent },
          ...conversation.map((message) => ({ role: message.role, content: message.content })),
          { role: "user", content: resolvedInstruction },
        ];
      };
      const parseFirstJsonObject = (rawText: string) => {
        if (!rawText) return null;
        const codeBlock = rawText.match(/```json\\s*([\\s\\S]*?)```/i);
        const candidate = codeBlock?.[1]?.trim() ?? null;
        if (candidate) {
          try {
            return JSON.parse(candidate) as unknown;
          } catch {
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
              } catch {
                return null;
              }
            }
          }
        }
        return null;
      };

      const detectHanInContent = (content: unknown) =>
        collectContentStrings(content).some((text) => detectHan(text));

      const runContentGeneration = async (
        conversation: Array<{ role: "user" | "assistant"; content: string }>,
        instruction: string,
      ): Promise<{
        content: unknown;
        files: Record<string, string>;
        meta: { usedModel: "primary" | "fallback" | "insurance"; reason?: FlowStepResult["reason"] };
      }> => {
        const overrides = getGeneratorOverrideFlags();
        if (overrides.forceTemplate) {
          generatorMetrics.usedInsuranceTemplate = true;
          generatorMetrics.schemaOk = false;
          recordInsuranceTemplateApplied();
          return {
            content: lessonInsuranceContent(flowLessonId),
            files: renderLessonSite(flowLessonId, lessonInsuranceContent(flowLessonId)),
            meta: { usedModel: "insurance", reason: "unknown" },
          };
        }
        const started = performance.now();
        const fallbackModelId = config.ok ? config.data.fallback?.modelId : undefined;
        const attempt = async (options: {
          strictLanguage?: boolean;
          repairJson?: boolean;
          preferredModelId?: string;
        }) => {
          const response = await runGenerateJson({
            messages: buildFlowContentMessages(conversation, instruction, {
              strictLanguage: options.strictLanguage,
              repairJson: options.repairJson,
            }),
            schema: flowContentSchema,
            temperature: 0.1,
            preferredModelId: options.preferredModelId ?? preferredModelId,
            timeoutMs: FLOW_GENERATOR_TIMEOUT_MS,
          });
          if (!response.ok) {
            const schemaFailure =
              typeof response.message === "string" &&
              /response_format|JSON|json|schema|스키마/i.test(response.message);
            return {
              ok: false,
              reason:
                response.reason === "timeout"
                  ? ("timeout" as const)
                  : schemaFailure
                    ? ("schema" as const)
                    : ("unknown" as const),
            } as const;
          }
          if (!("usedFallback" in response)) {
            return { ok: false, reason: "unknown" as const } as const;
          }
          if (response.usedFallback || response.modelChoice === "fallback") {
            generatorMetrics.usedFallbackModel = true;
          }
          const parsedData = response.usedResponseFormat
            ? response.data
            : parseFirstJsonObject(response.rawText);
          if (!parsedData) {
            return { ok: false, reason: "schema" as const } as const;
          }
          const rawHasHan = detectHanInContent(parsedData);
          generatorMetrics.rawHanDetected = generatorMetrics.rawHanDetected || rawHasHan;
          if (rawHasHan) {
            return { ok: false, reason: "cjk_guard" as const } as const;
          }
          const normalized = normalizeLessonContent(flowLessonId, parsedData);
          const parsed = getLessonContentZodSchema(flowLessonId).safeParse(normalized);
          if (!parsed.success) {
            return { ok: false, reason: "zod" as const } as const;
          }
          const fixedHasHan = detectHanInContent(parsed.data);
          generatorMetrics.fixedHanDetected = generatorMetrics.fixedHanDetected || fixedHasHan;
          if (fixedHasHan) {
            return { ok: false, reason: "cjk_guard" as const } as const;
          }
          return {
            ok: true,
            content: parsed.data,
            files: renderLessonSite(flowLessonId, parsed.data),
            usedModel: response.modelChoice,
          } as const;
        };

        let failureReason: FlowStepResult["reason"] | undefined;
        let response = await attempt({});
        if (!response.ok) {
          failureReason = response.reason;
          if (response.reason === "timeout" || response.reason === "schema" || response.reason === "zod") {
            generatorMetrics.retries += 1;
            response = await attempt({ repairJson: true });
          }
        }
        if (!response.ok) {
          failureReason = response.reason;
          if (fallbackModelId && preferredModelId && fallbackModelId !== preferredModelId) {
            generatorMetrics.retries += 1;
            response = await attempt({
              preferredModelId: fallbackModelId,
              repairJson: response.reason === "schema" || response.reason === "zod",
              strictLanguage: response.reason === "cjk_guard",
            });
          }
        }

        generatorMetrics.durationMs += performance.now() - started;
        if (!response.ok) {
          generatorMetrics.usedInsuranceTemplate = true;
          generatorMetrics.schemaOk = false;
          recordInsuranceTemplateApplied();
          return {
            content: lessonInsuranceContent(flowLessonId),
            files: renderLessonSite(flowLessonId, lessonInsuranceContent(flowLessonId)),
            meta: { usedModel: "insurance", reason: failureReason ?? "unknown" },
          };
        }

        generatorMetrics.schemaOk = true;
        return {
          content: response.content,
          files: response.files,
          meta: {
            usedModel: response.usedModel === "fallback" ? "fallback" : "primary",
            reason: failureReason,
          },
        };
      };

      const requestId = `flow-${runId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const runStartedAt = performance.now();
      try {
        const conversation: Array<{ role: "user" | "assistant"; content: string }> = [];
        let currentFiles: Record<string, string> = {};
        let currentContent: unknown = null;

        const validateExport = async (files: Record<string, string>) => {
          const normalized = normalizeFiles(files, { allowedFilenames: flowAllowedFiles });
          if (Object.keys(normalized).length === 0) {
            return { ok: false, reason: "files_missing" } as const;
          }
          const requiredFiles = flowAllowedFiles;
          for (const filename of requiredFiles) {
            const content = normalized[filename]?.content ?? "";
            if (content.trim().length < 8) {
              return { ok: false, reason: `empty_${filename}` } as const;
            }
          }
          const fixed = ensureRequiredRefs(normalized);
          const html = fixed.files["index.html"]?.content ?? "";
          const postFixOk = html.includes("style.css") && html.includes("script.js");
          const missingRefs = fixed.metrics.missingRefsDetected ? 1 : 0;
          if (!postFixOk) {
            return {
              ok: false,
              reason: "missing_refs",
              metrics: { ...fixed.metrics, postFixOk },
              missingRefs,
              renderOk: false,
              codeHash: null,
            } as const;
          }
          const hasHan = Object.values(fixed.files).some((file) => detectHan(file.content));
          if (hasHan) {
            return { ok: false, reason: "han_detected" } as const;
          }
          const codeHashSource = requiredFiles
            .map((filename) => fixed.files[filename]?.content ?? "")
            .join("\n");
          const codeHash = await hashRoomCodeShort(codeHashSource, 8);
          return {
            ok: true,
            metrics: { ...fixed.metrics, postFixOk },
            missingRefs,
            renderOk: true,
            codeHash,
          } as const;
        };

        const getStepLabel = (type: LessonFlowStep["type"]) => {
          switch (type) {
            case "coach_chat":
              return "A_coach";
            case "generator_create_files":
              return "B_generate";
            case "generator_update_files":
              return "C_update";
            case "export_sim":
              return "D_publish";
            default:
              return "step";
          }
        };

        for (const step of scenario.steps) {
          const stepLabel = getStepLabel(step.type);
          if (flowStopRequestedRef.current) {
            stepResults.push({
              step: stepLabel,
              status: "skipped",
              durationMs: 0,
              requestId,
            });
            continue;
          }
          if (step.type === "coach_chat") {
            const stepStarted = performance.now();
            const coachResult = await streamCoachOnce(step.prompt);
            const coachFixed = await rewriteCoachOnce(coachResult.text);
            conversation.push({ role: "user", content: step.prompt });
            conversation.push({ role: "assistant", content: coachFixed });
            const durationMs = performance.now() - stepStarted;
            const status = coachResult.ok ? "ok" : "fail";
            if (!coachResult.ok && !hardFailReason) {
              hardFailReason = `coach_${coachResult.reason ?? "unknown"}`;
            }
            stepResults.push({
              step: stepLabel,
              status,
              durationMs,
              reason: coachResult.ok ? undefined : coachResult.reason,
              errorCode: coachResult.ok ? undefined : coachResult.reason,
              requestId,
            });
          }
          if (step.type === "generator_create_files") {
            const stepStarted = performance.now();
            const generation = await runContentGeneration(conversation, step.instruction);
            currentFiles = generation.files;
            currentContent = generation.content;
            const durationMs = performance.now() - stepStarted;
            const status = generation.meta.usedModel === "insurance" ? "fail" : "ok";
            if (status === "fail" && !hardFailReason) {
              hardFailReason = "generator_create_failed";
            }
            stepResults.push({
              step: stepLabel,
              status,
              durationMs,
              usedModel: generation.meta.usedModel,
              reason: generation.meta.reason,
              errorCode: generation.meta.reason,
              requestId,
            });
          }
          if (step.type === "generator_update_files") {
            const stepStarted = performance.now();
            const updateInstruction = `${step.instruction}\n\n현재 content JSON:\n${JSON.stringify(
              currentContent ?? {},
            )}`;
            const generation = await runContentGeneration(conversation, updateInstruction);
            currentFiles = generation.files;
            currentContent = generation.content;
            const durationMs = performance.now() - stepStarted;
            const status = generation.meta.usedModel === "insurance" ? "fail" : "ok";
            if (status === "fail" && !hardFailReason) {
              hardFailReason = "generator_update_failed";
            }
            stepResults.push({
              step: stepLabel,
              status,
              durationMs,
              usedModel: generation.meta.usedModel,
              reason: generation.meta.reason,
              errorCode: generation.meta.reason,
              requestId,
            });
          }
          if (step.type === "export_sim") {
            const stepStarted = performance.now();
            const stepController = createStepController(FLOW_EXPORT_TIMEOUT_MS);
            const exportResult = await validateExport(currentFiles);
            const aborted = stepController.signal.aborted;
            stepController.cleanup();
            const durationMs = performance.now() - stepStarted;
            if (aborted && !hardFailReason) {
              hardFailReason = "export_timeout";
            } else if (!exportResult.ok && !hardFailReason) {
              hardFailReason = exportResult.reason;
            }
            if (exportResult.ok) {
              renderOk = exportResult.renderOk;
              missingRefs = exportResult.missingRefs;
              codeHash = exportResult.codeHash;
            } else if (exportResult.missingRefs !== undefined) {
              missingRefs = exportResult.missingRefs;
            }
            stepResults.push({
              step: stepLabel,
              status: exportResult.ok && !aborted ? "ok" : "fail",
              durationMs,
              errorCode: aborted ? "timeout" : exportResult.ok ? undefined : exportResult.reason,
              requestId,
              exportMetrics: exportResult.metrics,
            });
          }
        }

        return {
          runId,
          requestId,
          ok: !hardFailReason,
          hardFail: hardFailReason,
          lessonId: flowLessonId,
          schemaValid: generatorMetrics.schemaOk,
          renderOk,
          missingRefs,
          codeHash,
          durationMs: performance.now() - runStartedAt,
          coach: coachMetrics,
          generator: generatorMetrics,
          steps: stepResults,
        };
      } catch (error) {
        return {
          runId,
          requestId,
          ok: false,
          hardFail: error instanceof Error ? error.message : "unknown_error",
          lessonId: flowLessonId,
          schemaValid: generatorMetrics.schemaOk,
          renderOk,
          missingRefs,
          codeHash,
          durationMs: performance.now() - runStartedAt,
          coach: coachMetrics,
          generator: generatorMetrics,
          steps: stepResults,
        };
      }
    },
    [
      config,
      flowAllowedFiles,
      flowChatPrompt,
      flowFilesPrompt,
      flowContentSchema,
      flowLessonId,
      preferredModelId,
      recordInsuranceTemplateApplied,
      runGenerateJson,
      runStreamChat,
    ],
  );

  const runLessonFlowBatch = useCallback(async () => {
    if (!preferredModelId) {
      setFlowRunStatus({ status: "error", message: "모델을 먼저 선택해 주세요." });
      return;
    }
    const runTotal = FLOW_RUN_COUNT;
    setFlowRunning(true);
    flowStopRequestedRef.current = false;
    const abortController = new AbortController();
    flowAbortRef.current = abortController;
    setFlowRunStatus({
      status: "loading",
      message: `${runTotal}회 실행 중…`,
    });
    setFlowRunResults([]);
    setFlowProgress({ current: 0, total: runTotal });
    const results: FlowRunResult[] = [];
    try {
      for (let index = 0; index < runTotal; index += 1) {
        if (flowStopRequestedRef.current) {
          break;
        }
        setFlowProgress({ current: index + 1, total: runTotal });
        const result = await runLessonFlow(index);
        results.push(result);
        setFlowRunResults([...results]);
      }
    } finally {
      setFlowRunning(false);
      flowAbortRef.current = null;
    }
    const hardFails = results.filter((result) => !result.ok);
    if (flowStopRequestedRef.current) {
      setFlowRunStatus({ status: "warn", message: "중지됨" });
      return;
    }
    setFlowRunStatus(
      hardFails.length === 0
        ? { status: "ok", message: "PASS" }
        : { status: "warn", message: `${hardFails.length}회 실패` },
    );
  }, [preferredModelId, runLessonFlow]);

  const handleStopFlowRunner = useCallback(() => {
    flowStopRequestedRef.current = true;
    flowAbortRef.current?.abort();
    setFlowRunning(false);
    setFlowRunStatus({ status: "warn", message: "중지 요청됨" });
  }, []);

  const exportFlowResults = useCallback(() => {
    const appBuildId =
      typeof window !== "undefined"
        ? (window as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__?.buildId ?? null
        : null;
    const exportId = `flow-export-${Date.now()}`;
    const exportTimestamp = new Date().toISOString();
    const webgpuEnabled = typeof navigator !== "undefined" && "gpu" in navigator;
    const envSummary = {
      language: typeof navigator !== "undefined" ? navigator.language : null,
      platform: typeof navigator !== "undefined" ? navigator.platform : null,
      hardwareConcurrency:
        typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? null : null,
      deviceMemory:
        typeof navigator !== "undefined"
          ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null
          : null,
      timeZone:
        typeof Intl !== "undefined" && Intl.DateTimeFormat
          ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
          : null,
      webgpu: webgpuEnabled,
    };
    const exportPayload = {
      exportedAt: exportTimestamp,
      timestamp: exportTimestamp,
      exportId,
      buildId: appBuildId,
      promptSetId: useDefaultPromptSet ? DEFAULT_PROMPT_SET.id : "custom",
      runCount: flowRunResults.length,
      note: "프롬프트/학생 입력/생성 코드 원문은 포함하지 않음",
      env: envSummary,
      model: {
        preferredModelId: preferredModelId || null,
        primaryModelId: configModelId,
        fallbackModelId: configFallbackModelId,
        modelUrl: modelUrl || null,
        wasmPrimaryUrl: wasmPrimaryUrl || null,
        wasmFallbackUrl: wasmFallbackUrl || null,
        webgpu: webgpuEnabled,
      },
      flowRuns: flowRunResults.map((run) => ({
        runId: run.runId,
        lastRequestId: run.requestId,
        ok: run.ok,
        hardFail: run.hardFail ?? null,
        lessonId: run.lessonId,
        schemaValid: run.schemaValid,
        renderOk: run.renderOk,
        missingRefs: run.missingRefs,
        codeHash: run.codeHash,
        durationMs: Math.round(run.durationMs),
        steps: run.steps.map((step) => ({
          step: step.step,
          status: step.status,
          durationMs: Math.round(step.durationMs),
          errorCode: step.errorCode ?? null,
          usedModel: step.usedModel ?? null,
          lastRequestId: step.requestId ?? run.requestId,
          exportMetrics: step.exportMetrics ?? null,
        })),
      })),
    };
    const payloadText = JSON.stringify(exportPayload, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(payloadText)
        .then(() => {
          setCopiedFlowExport(true);
          window.setTimeout(() => setCopiedFlowExport(false), 1500);
        })
        .catch(() => setCopiedFlowExport(false));
    }
    const blob = new Blob([payloadText], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `edu-flow-results-${exportId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [
    configFallbackModelId,
    configModelId,
    flowRunResults,
    modelUrl,
    preferredModelId,
    useDefaultPromptSet,
    wasmFallbackUrl,
    wasmPrimaryUrl,
  ]);

  const handlePrewarm = useCallback(async () => {
    if (!isTeacherMode || prewarmState.status === "running") return;
    const code = searchParams.get("code");
    if (!code) return;
    setPrewarmState({
      status: "running",
      progress: { index: 0, total: 0, resource: null },
      okCount: 0,
      failCount: 0,
      lastError: null,
    });
    const result = await runPrewarm(
      {
        code,
        tier: netsaverMetrics.tier,
        includeWasm: true,
        includeMeta: true,
        includeSmallShards: false,
      },
      (progress) => setPrewarmState((prev) => ({ ...prev, progress })),
    );
    setPrewarmState((prev) => ({
      ...prev,
      status: "done",
      okCount: result.okCount,
      failCount: result.failCount,
      lastError: result.lastError,
    }));
  }, [isTeacherMode, netsaverMetrics.tier, prewarmState.status, searchParams]);

  const koreanPuritySummary = useMemo(() => {
    const total = koreanPurityResults.length;
    if (total === 0) {
      return {
        total,
        rawHanRate: null,
        fixedHanRate: null,
        awkwardRate: null,
        pass: null,
      };
    }
    const rawHanRate = koreanPurityResults.filter((item) => item.rawHasHan).length / total;
    const fixedHanRate = koreanPurityResults.filter((item) => item.fixedHasHan).length / total;
    const awkwardRate = koreanPurityResults.filter((item) => item.rawAwkward).length / total;
    return {
      total,
      rawHanRate,
      fixedHanRate,
      awkwardRate,
      pass: fixedHanRate === 0,
    };
  }, [koreanPurityResults]);

  const flowSummary = useMemo(() => {
    const total = flowRunResults.length;
    if (total === 0) {
      return {
        total,
        okCount: 0,
        hardFailCount: 0,
        coachHanRate: 0,
        generatorHanRate: 0,
        insuranceRate: 0,
      };
    }
    const okCount = flowRunResults.filter((run) => run.ok).length;
    const hardFailCount = flowRunResults.filter((run) => !run.ok).length;
    const coachHanRate =
      flowRunResults.filter((run) => run.coach.fixedHanDetected).length / total;
    const generatorHanRate =
      flowRunResults.filter((run) => run.generator.fixedHanDetected).length / total;
    const insuranceRate =
      flowRunResults.filter((run) => run.generator.usedInsuranceTemplate).length / total;
    return {
      total,
      okCount,
      hardFailCount,
      coachHanRate,
      generatorHanRate,
      insuranceRate,
    };
  }, [flowRunResults]);

  const getAppBuildId = useCallback(() => {
    if (typeof window === "undefined") return null;
    const nextData = (window as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__;
    return typeof nextData?.buildId === "string" ? nextData.buildId : null;
  }, []);

  const handleCopyFlowReport = useCallback(async () => {
    if (flowRunResults.length === 0) return;
    const total = flowRunResults.length;
    const fallbackUsedCount = flowRunResults.filter((run) => run.generator.usedFallbackModel).length;
    const insuranceUsedCount = flowRunResults.filter(
      (run) => run.generator.usedInsuranceTemplate,
    ).length;
    const appBuildId = getAppBuildId();
    const modelJson404 = Boolean(modelStatus.message && modelStatus.message.includes("404"));
    const lastErrorTime = diagnostics.lastError
      ? new Date(diagnostics.lastError.at).toISOString()
      : "-";
    const lastRequestId = flowRunResults[flowRunResults.length - 1]?.requestId ?? "-";
    const coachStallCount = flowRunResults.reduce(
      (sum, run) => sum + run.coach.stalledAbortCount,
      0,
    );
    const generatorTimeoutFallbackCount = flowRunResults.reduce((sum, run) => {
      const timedOut = run.steps.some(
        (step) =>
          step.reason === "timeout" &&
          (step.usedModel === "fallback" || step.usedModel === "insurance"),
      );
      return sum + (timedOut ? 1 : 0);
    }, 0);
    const eduviewWarn =
      eduviewOriginStatus.status === "warn" || eduviewOriginStatus.status === "error";
    const report = [
      "# Flow Runner Bug Report",
      `1) buildId: ${appBuildId ?? "-"}`,
      `2) runs: ${total} (hardFail ${flowSummary.hardFailCount})`,
      `3) fallbackUsed: ${fallbackUsedCount} / insuranceUsed: ${insuranceUsedCount}`,
      `4) model json 404: ${modelJson404 ? "yes" : "no"}`,
      `5) coach stall watchdog: ${coachStallCount}`,
      `6) generator timeout→fallback: ${generatorTimeoutFallbackCount}`,
      `7) eduview warn: ${eduviewWarn ? "yes" : "no"}`,
      `8) last requestId: ${lastRequestId}`,
      `9) last error time: ${lastErrorTime}`,
    ].join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
        setCopiedFlowReport(true);
        window.setTimeout(() => setCopiedFlowReport(false), 1500);
      }
    } catch {
      setCopiedFlowReport(false);
    }
  }, [
    diagnostics,
    eduviewOriginStatus.status,
    flowRunResults,
    flowSummary.hardFailCount,
    getAppBuildId,
    modelStatus.message,
  ]);

  const handleToggleLocalAiDisabled = useCallback(() => {
    const next = !localAiDisabled;
    setLocalAiDisabled(next);
    try {
      if (next) {
        window.localStorage.setItem(LOCAL_AI_DISABLED_KEY, "1");
      } else {
        window.localStorage.removeItem(LOCAL_AI_DISABLED_KEY);
      }
      window.dispatchEvent(new Event(LOCAL_AI_DISABLED_EVENT));
    } catch {
      // ignore storage failures
    }
  }, [localAiDisabled]);

  const handleCopyDiagnostic = useCallback(async () => {
    const data = health.status === "ready" ? health.data : null;
    const okData = data && data.ok ? data : null;
    const requestId = data?.requestId ?? "-";
    const modelUrl = okData?.primary.modelConfigUrl
      ? getWebllmModelRootUrl(okData.primary.modelConfigUrl)
      : null;
    const wasmUrl =
      okData?.primary.selectedWasmUrl ?? okData?.primary.wasmCandidateUrls?.[0] ?? null;
    const resolveHost = (value?: string | null) => {
      if (!value) return "-";
      try {
        return new URL(value).host;
      } catch {
        return "-";
      }
    };
    const modelHost = resolveHost(modelUrl);
    const wasmHost = resolveHost(wasmUrl);
    const degradedSnapshot = readWebllmDegradedGate();
    const fallbackRaw = (() => {
      try {
        const stored = window.localStorage.getItem(AI_FALLBACK_LAST_KEY);
        return stored ? (JSON.parse(stored) as { ok?: boolean; errorCode?: string; latencyMs?: number }) : null;
      } catch {
        return null;
      }
    })();
    const fallbackStatus = fallbackRaw
      ? fallbackRaw.ok
        ? "ok"
        : `fail(${fallbackRaw.errorCode ?? "unknown"},${fallbackRaw.latencyMs ?? "-"}ms)`
      : "unknown";
    const report = [
      "EDU_DIAG v1",
      `time=${new Date().toISOString()}`,
      `rid=${requestId}`,
      `webllm_status=${health.status}`,
      `model_host=${modelHost}`,
      `wasm_host=${wasmHost}`,
      `ai_fallback_last=${fallbackStatus}`,
      `degraded_until=${degradedSnapshot.until ?? "-"}`,
    ].join("\n");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
        setCopiedDiagnostic(true);
        window.setTimeout(() => setCopiedDiagnostic(false), 1500);
      }
    } catch {
      setCopiedDiagnostic(false);
    }
  }, [health]);

  const handleAllowLocalRetry = useCallback(() => {
    allowWebllmRetryOnce();
    setRetryArmed(true);
    window.setTimeout(() => setRetryArmed(false), 1500);
  }, []);

  const handleOverrideToggle = useCallback(
    (key: "forceFallback" | "forceTemplate") => {
      const next = { ...generatorOverrides, [key]: !generatorOverrides[key] };
      setGeneratorOverrides(next);
      setGeneratorOverrideFlags(next);
    },
    [generatorOverrides],
  );

  const handleResetEngine = useCallback(
    async (scope: "coach" | "generator") => {
      await startWebLLM(createWebLLMRequestId("reset"), { kind: "reset", scope });
      await refreshDiagnostics();
    },
    [refreshDiagnostics],
  );

  const handleCoachInitTest = useCallback(async () => {
    const precondition = resolveCoachInitPrecondition({
      healthReady: config.ok,
      hardDisabled: hardDisableFinal,
      coachModelId: resolvedCoachModelId,
      coachWasmUrl: resolvedCoachWasmUrl,
      webGpuSupported: typeof navigator === "undefined" ? false : "gpu" in navigator,
    });
    if (!precondition.attempted) {
      setCoachInitState({
        attempted: precondition.attempted,
        status: precondition.status,
        reasonCode: precondition.reasonCode,
        message: precondition.reasonCode,
        modelId: resolvedCoachModelId,
        latencyMs: null,
      });
      return;
    }

    setCoachInitState({
      attempted: true,
      status: "attempting",
      reasonCode: null,
      message: null,
      modelId: resolvedCoachModelId,
      latencyMs: null,
    });
    const startedAt = performance.now();
    const response = await startWebLLM(createWebLLMRequestId("coach-warmup"), {
      kind: "warmup",
      preferredModelId: resolvedCoachModelId ?? undefined,
    });
    if (response.type === "result" && response.kind === "warmup") {
      const transition = finalizeCoachInit({ ok: response.result.ok });
      if (response.result.ok) {
        setCoachInitState({
          attempted: transition.attempted,
          status: transition.status,
          reasonCode: transition.reasonCode,
          message: "coach init 성공",
          modelId: response.result.modelId ?? resolvedCoachModelId,
          latencyMs: performance.now() - startedAt,
        });
      } else {
        setCoachInitState({
          attempted: transition.attempted,
          status: transition.status,
          reasonCode: transition.reasonCode,
          message: response.result.message ?? "coach init 실패",
          modelId: resolvedCoachModelId,
          latencyMs: performance.now() - startedAt,
        });
      }
      await refreshDiagnostics();
      return;
    }
    const transition = finalizeCoachInit({ ok: false, aborted: response.type === "aborted" });
    setCoachInitState({
      attempted: transition.attempted,
      status: transition.status,
      reasonCode: transition.reasonCode ?? "worker_error",
      message: response.type === "error" ? response.error.message : "init 중단됨",
      modelId: resolvedCoachModelId,
      latencyMs: performance.now() - startedAt,
    });
  }, [config, hardDisableFinal, refreshDiagnostics, resolvedCoachModelId, resolvedCoachWasmUrl]);

  const handleClearLocalState = useCallback(() => {
    clearEduLocalState();
    setGeneratorOverrides(getGeneratorOverrideFlags());
    setPreferredModelId("");
  }, [setGeneratorOverrides, setPreferredModelId]);

  const handleQuickResourceCheck = useCallback(() => {
    if (!config.ok) return;
    if (modelConfigUrl) {
      void runCheck(modelConfigUrl, setModelStatus, "GET");
    }
    if (wasmPrimaryUrl) {
      void runCheck(wasmPrimaryUrl, setWasmPrimaryStatus, "GET");
    }
    if (wasmFallbackUrl) {
      void runCheck(wasmFallbackUrl, setWasmFallbackStatus, "GET");
    }
  }, [config.ok, modelConfigUrl, runCheck, wasmFallbackUrl, wasmPrimaryUrl]);

  const handleP2PProbe = useCallback(async () => {
    const code = searchParams.get("code");
    if (!code) return;
    setNetsaverProbeStatus({ status: "loading" });
    try {
      const result = await runP2PProbe(code);
      setNetsaverProbeStatus(
        result.ok ? { status: "ok" } : { status: "error", message: result.reason },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "probe_failed";
      setNetsaverProbeStatus({ status: "error", message });
    }
    setNetsaverMetrics(getNetworkSaverMetricsSnapshot());
  }, [searchParams]);

  const handleLeaseRoundtrip = useCallback(async () => {
    const code = searchParams.get("code");
    if (!code) return;
    setNetsaverLeaseStatus({ status: "loading" });
    const acquired = await acquireLease(code);
    if (!acquired.ok || !acquired.leaseId) {
      setNetsaverLeaseStatus({ status: "error", message: "lease acquire failed" });
      return;
    }
    const renewed = await renewLease(code, acquired.leaseId);
    if (!renewed) {
      setNetsaverLeaseStatus({ status: "warn", message: "lease renew failed" });
    }
    const released = await releaseLease(code, acquired.leaseId);
    setNetsaverLeaseStatus({
      status: released ? "ok" : "warn",
      message: released ? undefined : "lease release failed",
    });
  }, [searchParams]);

  useEffect(() => {
    const readEvidence = () => {
      setContainedEvidenceRows(getWebllmContainedRolloutEvidence(10).slice().reverse());
    };
    readEvidence();
    const intervalId = window.setInterval(readEvidence, 2000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg">
      <WebLLMSelfcheckCard />
      {rolloutSnapshot ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-slate-600">Contained rollout snapshot</p>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
              {rolloutSnapshot.operatorState}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-700">{rolloutSnapshot.summaryLabel}</p>
          <p className="mt-1 text-xs text-slate-500">{rolloutSnapshot.safeAuditSummary}</p>
          <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            {rolloutSnapshot.safeEvidenceRows.map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-1">
                <span className="text-slate-500">{row.label}</span>
                <span className={row.ok ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {handoffPack ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-600">Go/No-Go handoff</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  handoffPack.decision === "go"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : handoffPack.decision === "hold"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {handoffPack.decision.toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyHandoff}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-sky-300 hover:text-sky-700"
            >
              handoff copy
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-700">{handoffPack.headline}</p>
          <p className="mt-1 text-xs text-slate-500">{handoffPack.recentWindowSummary}</p>
          <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            {handoffPack.requiredChecks.map((check) => (
              <div key={check.key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                <span className="text-slate-500">{check.label}</span>
                <span className={check.ok ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                  {check.ok ? "ok" : "hold"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {handoffCopyState === "copied"
              ? "handoff summary copied"
              : handoffCopyState === "error"
                ? "copy failed"
                : "copy includes safe summary only"}
          </p>
        </section>
      ) : null}

      {containedEvidenceRows.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600">Contained recent attempts (safe)</p>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {containedEvidenceRows.length} rows
            </span>
          </div>
          <div className="mt-2 space-y-2">
            {containedEvidenceRows.map((row) => (
              <div key={`${row.attemptedAt}-${row.lessonIdSafe}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                <p className="font-semibold text-slate-700">
                  {row.operatorStateAtAttempt} · {row.attemptDecision} · {row.outcome}
                </p>
                <p className="text-slate-500">{row.safeSummary}</p>
                <p className="text-slate-400">
                  lesson={row.lessonIdSafe} · mode={row.dispatchMode} · reason={row.safeReason} · at={row.attemptedAt}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <div>
        <p className="text-sm font-semibold text-sky-600">EDU 로컬 모델 selfcheck</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">모델 경로 확인</h2>
        <p className="mt-2 text-sm text-slate-500">
          모델과 WASM 경로를 직접 호출해서 응답 상태를 확인해 주세요.
        </p>
        <p className="mt-2 text-xs text-slate-400">교사용 도구는 교사 도메인에서만 표시됩니다.</p>
        {config.ok ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              현재 모델: {currentModelLabel || "Primary"}
            </span>
            {canSelectModel && modelOptions.length > 1 ? (
              <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                <span className="text-slate-500">모델 선택</span>
                <select
                  className="bg-transparent text-slate-700 outline-none"
                  value={preferredModelId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setPreferredModelId(next);
                    try {
                      window.localStorage.setItem("edu:webllm:modelId", next);
                    } catch {
                      // ignore storage failures
                    }
                  }}
                >
                  {modelOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
      </div>

      {!config.ok ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {config.message}
          {config.data ? (
            <div className="mt-2 text-xs text-amber-700">
              {config.data.missing.length > 0 ? (
                <div>누락: {config.data.missing.join(", ")}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div>
            <span className="font-semibold text-slate-600">modelUrl</span>
            <div className="mt-1 break-all text-slate-700">{modelUrl}</div>
          </div>
          <div>
            <span className="font-semibold text-slate-600">wasmUrl (Primary)</span>
            <div className="mt-1 break-all text-slate-700">{wasmPrimaryUrl}</div>
            {wasmFallbackUrl ? (
              <>
                <span className="mt-3 block font-semibold text-slate-600">wasmUrl (Fallback)</span>
                <div className="mt-1 break-all text-slate-700">{wasmFallbackUrl}</div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {isTeacherMode ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-700">현장 운영 도구</p>
              <p className="mt-1 text-xs text-slate-500">
                이 기기에서만 로컬 AI를 끄거나 즉시 재시도를 허용합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleLocalAiDisabled}
              className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition ${
                localAiDisabled
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              로컬 AI {localAiDisabled ? "비활성화됨" : "사용 중"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <button
              type="button"
              onClick={handleCopyDiagnostic}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              Copy Diagnostic
            </button>
            {copiedDiagnostic ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                복사됨
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleAllowLocalRetry}
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700 shadow-sm transition hover:border-amber-300 hover:text-amber-800"
            >
              지금 다시 로컬 시도
            </button>
            {retryArmed ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                1회 재시도 준비됨
              </span>
            ) : null}
          </div>
          {networkTestTargets.modelConfigUrls.length > 0 || networkTestTargets.wasmUrl ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">네트워크 테스트 링크</p>
              <div className="mt-2 space-y-1">
                {networkTestTargets.modelConfigUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-sky-600 hover:text-sky-700"
                  >
                    {url}
                  </a>
                ))}
                {networkTestTargets.wasmUrl ? (
                  <a
                    href={networkTestTargets.wasmUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-sky-600 hover:text-sky-700"
                  >
                    {networkTestTargets.wasmUrl}
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm">
        <div>
          <p className="text-sm font-semibold text-slate-700">빠른 진단</p>
          <p className="mt-1 text-xs text-slate-500">클릭 없이 현재 상태를 먼저 확인합니다.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">WebGPU</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveStatusBadge(
                  webGpuStatus,
                ).className}`}
              >
                {resolveStatusBadge(webGpuStatus).text}
              </span>
            </div>
            <p className={`mt-1 text-xs font-semibold ${resolveStatusLabel(webGpuStatus).tone}`}>
              {resolveStatusLabel(webGpuStatus).text}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">model json (200)</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveStatusBadge(
                  modelStatus,
                ).className}`}
              >
                {resolveStatusBadge(modelStatus).text}
              </span>
            </div>
            <p className={`mt-1 text-xs font-semibold ${resolveStatusLabel(modelStatus).tone}`}>
              {resolveStatusLabel(modelStatus).text}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">WASM Primary (200)</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveStatusBadge(
                  wasmPrimaryStatus,
                ).className}`}
              >
                {resolveStatusBadge(wasmPrimaryStatus).text}
              </span>
            </div>
            <p className={`mt-1 text-xs font-semibold ${resolveStatusLabel(wasmPrimaryStatus).tone}`}>
              {resolveStatusLabel(wasmPrimaryStatus).text}
            </p>
          </div>
          {wasmFallbackUrl ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">WASM Fallback (200)</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveStatusBadge(
                    wasmFallbackStatus,
                  ).className}`}
                >
                  {resolveStatusBadge(wasmFallbackStatus).text}
                </span>
              </div>
              <p
                className={`mt-1 text-xs font-semibold ${resolveStatusLabel(wasmFallbackStatus).tone}`}
              >
                {resolveStatusLabel(wasmFallbackStatus).text}
              </p>
            </div>
          ) : null}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">EduView origin</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveStatusBadge(
                  eduviewOriginStatus,
                ).className}`}
              >
                {resolveStatusBadge(eduviewOriginStatus).text}
              </span>
            </div>
            <p
              className={`mt-1 text-xs font-semibold ${resolveStatusLabel(eduviewOriginStatus).tone}`}
            >
              {eduviewOriginStatus.status === "warn"
                ? "주의(Warning): Failed to fetch (EduView는 선택 기능)"
                : resolveStatusLabel(eduviewOriginStatus).text}
            </p>
            {eduviewOrigin ? (
              <p className="mt-1 break-all text-[10px] text-slate-400">{eduviewOrigin}</p>
            ) : null}
            {eduviewHealthUrl ? (
              <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                <p>EduView 연결은 경고(Warning)만 표시됩니다.</p>
                <a
                  className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700"
                  href={eduviewHealthUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open health URL →
                </a>
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">숨김 KV 체크</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveStatusBadge(
                  eduviewKvStatus,
                ).className}`}
              >
                {resolveStatusBadge(eduviewKvStatus).text}
              </span>
            </div>
            <p className={`mt-1 text-xs font-semibold ${resolveStatusLabel(eduviewKvStatus).tone}`}>
              {resolveStatusLabel(eduviewKvStatus).text}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">Structured JSON 테스트</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveStatusBadge(
                  structuredJsonStatus,
                ).className}`}
              >
                {resolveStatusBadge(structuredJsonStatus).text}
              </span>
            </div>
            <p
              className={`mt-1 text-xs font-semibold ${resolveStatusLabel(structuredJsonStatus).tone}`}
            >
              {resolveStatusLabel(structuredJsonStatus, "대기 중").text}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {structuredJsonStatus.status === "ok"
                ? "이 기기는 파일 생성 모드 안정적"
                : structuredJsonStatus.status === "error"
                  ? "이 기기는 폴백(보험/템플릿) 중심"
                  : "schema JSON 생성 상태를 확인합니다."}
            </p>
            <details className="mt-2 text-[11px] text-slate-500">
              <summary className="cursor-pointer text-[11px] font-semibold text-slate-600">
                env 판정 source
              </summary>
              <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                <p>health env source: {healthEnvSource ?? "-"}</p>
                <p>
                  health missing keys: {healthMissingKeys.length > 0 ? healthMissingKeys.join(", ") : "(none)"}
                </p>
              </div>
            </details>
            <details className="mt-2 text-[11px] text-slate-500">
              <summary className="cursor-pointer text-[11px] font-semibold text-slate-600">
                자세히
              </summary>
              <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                <p>상태: {structuredJsonStatus.message ?? "-"}</p>
                <p>분류: {structuredJsonStatus.reason ?? "-"}</p>
                <p>모델: {structuredJsonStatus.modelId ?? "-"}</p>
                <p>
                  response_format:{" "}
                  {typeof structuredJsonStatus.usedResponseFormat === "boolean"
                    ? structuredJsonStatus.usedResponseFormat
                      ? "사용"
                      : "미사용"
                    : "-"}
                </p>
                <p>
                  fallback:{" "}
                  {typeof structuredJsonStatus.usedFallback === "boolean"
                    ? structuredJsonStatus.usedFallback
                      ? "사용"
                      : "미사용"
                    : "-"}
                </p>
                <p>메시지: {structuredJsonStatus.detail ?? "-"}</p>
                <p className="break-all">
                  data: {structuredJsonStatus.data ? JSON.stringify(structuredJsonStatus.data) : "-"}
                </p>
                <p className="break-all">
                  raw: {structuredJsonStatus.rawText ? structuredJsonStatus.rawText : "-"}
                </p>
              </div>
            </details>
          </div>
          {canSelectModel ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">Korean-only 출력 테스트</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveStatusBadge(
                    koreanOnlyStatus,
                  ).className}`}
                >
                  {resolveStatusBadge(koreanOnlyStatus).text}
                </span>
              </div>
              <p className={`mt-1 text-xs font-semibold ${resolveStatusLabel(koreanOnlyStatus).tone}`}>
                {resolveStatusLabel(koreanOnlyStatus, "대기 중").text}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {koreanOnlyStatus.message ?? "한글만 출력하는지 확인합니다."}
              </p>
              <button
                type="button"
                onClick={runKoreanOnlyCheck}
                className="mt-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
              >
                Korean-only output test
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {isTeacherMode ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">한글 순도 테스트</p>
              <p className="mt-1 text-xs text-slate-500">
                20문항 응답에서 한자/어색한 표현을 확인하고 1회 정제 후 결과를 요약합니다.
              </p>
            </div>
            <button
              type="button"
              disabled={!config.ok || koreanPurityStatus.status === "loading"}
              onClick={runKoreanPurityTest}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              한글 순도 테스트
            </button>
          </div>
          <p className={`text-xs font-semibold ${resolveStatusLabel(koreanPurityStatus).tone}`}>
            {resolveStatusLabel(koreanPurityStatus, "대기 중").text}
          </p>
          {koreanPuritySummary.total > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                rawHanRate {Math.round((koreanPuritySummary.rawHanRate ?? 0) * 100)}%
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                fixedHanRate {Math.round((koreanPuritySummary.fixedHanRate ?? 0) * 100)}%
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                awkwardRate {Math.round((koreanPuritySummary.awkwardRate ?? 0) * 100)}%
              </span>
              <span
                className={`rounded-full px-2.5 py-1 ${
                  koreanPuritySummary.pass
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {koreanPuritySummary.pass ? "PASS" : "FAIL"}
              </span>
            </div>
          ) : null}
          {koreanPurityResults.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
              <table className="min-w-[720px] table-fixed text-xs text-slate-600">
                <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="w-[22%] px-3 py-2 text-left">Prompt</th>
                    <th className="w-[28%] px-3 py-2 text-left">Raw sample</th>
                    <th className="w-[28%] px-3 py-2 text-left">Fixed sample</th>
                    <th className="w-[22%] px-3 py-2 text-left">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {koreanPurityResults.map((result, index) => (
                    <tr key={`${result.prompt}-${index}`} className="border-b border-slate-100">
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        {result.prompt}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                        {result.rawText || "-"}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                        {result.fixedText || "-"}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        <div className="flex flex-wrap gap-1.5">
                          {result.rawHasHan ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                              rawHan
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-500">
                              rawHan 0
                            </span>
                          )}
                          {result.rawAwkward ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                              awkward
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-500">
                              awkward 0
                            </span>
                          )}
                          {result.fixedHasHan ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                              fixedHan
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                              fixedHan 0
                            </span>
                          )}
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                            {result.rewriteStatus}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {isTeacherMode ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">수업 시작 전 체크</p>
              <p className="mt-1 text-xs text-slate-500">
                프리워밍과 현재 네트워크 세팅을 빠르게 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handlePrewarm()}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              Prewarm 시작 {prewarmState.status === "running" ? "(진행 중)" : ""}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-600">
              <p className="text-xs font-semibold text-slate-600">현재 설정</p>
              <p className="mt-1">mode: {netsaverMetrics.mode}</p>
              <p>tier: {netsaverMetrics.tier}</p>
              <p>rampup: {netsaverMetrics.rampup.enabled ? "enabled" : "disabled"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-600">
              <p className="text-xs font-semibold text-slate-600">최근 5분 지표</p>
              <p className="mt-1">origin fetch: {netsaverMetrics.origin.recent5m}</p>
              <p>p2p hit: {netsaverMetrics.p2p.recent5m}</p>
              <p>lease wait: {netsaverMetrics.lease.waitRecent5m}</p>
              <p>rampup wait: {netsaverMetrics.rampup.waitSlotCount}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-600">
            <p className="text-xs font-semibold text-slate-600">Prewarm 진행 상황</p>
            <p className="mt-1">
              진행: {prewarmState.progress?.index ?? 0}/{prewarmState.progress?.total ?? 0}
            </p>
            <p>파일: {prewarmState.progress?.resource?.pathname ?? "-"}</p>
            <p>
              결과: 성공 {prewarmState.okCount} / 실패 {prewarmState.failCount}
            </p>
            <p>마지막 오류: {prewarmState.lastError ?? "-"}</p>
          </div>
        </div>
      ) : null}

      {isTeacherMode ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Network Saver</p>
              <p className="mt-1 text-xs text-slate-500">
                현재 모드/lease/p2p 상태를 관측하고 즉시 재프로브/lease roundtrip을 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNetsaverMetrics(getNetworkSaverMetricsSnapshot())}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              상태 새로고침
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-600">
              <p className="text-xs font-semibold text-slate-600">현재 상태</p>
              <p className="mt-1">mode: {netsaverMetrics.mode}</p>
              <p>tier: {netsaverMetrics.tier}</p>
              <p>WASM P2P: {netsaverMetrics.wasm.p2pEnabled ? "enabled" : "disabled"}</p>
              <p>allowlist: {netsaverMetrics.allowlistCount}</p>
              <p>room hash: {netsaverRoomHash}</p>
              <p>
                p2p probe: {netsaverMetrics.p2pProbe.status} @{" "}
                {netsaverMetrics.p2pProbe.lastAt
                  ? new Date(netsaverMetrics.p2pProbe.lastAt).toLocaleTimeString()
                  : "-"}
              </p>
              <p>p2p connections: {netsaverMetrics.p2p.connectionCount}</p>
              <p>p2p hits (5m): {netsaverMetrics.p2p.recent5m}</p>
              <p>origin downloads (5m): {netsaverMetrics.origin.recent5m}</p>
              <p>
                rampup window remaining:{" "}
                {netsaverMetrics.rampup.windowRemainingMs !== null
                  ? `${Math.round(netsaverMetrics.rampup.windowRemainingMs / 1000)}s`
                  : "-"}
              </p>
              <p>rampup last slot: {netsaverMetrics.rampup.lastSlot ?? "-"}</p>
              <p>
                rampup wait total/max-hit: {Math.round(netsaverMetrics.rampup.waitMsTotal)}ms/
                {netsaverMetrics.rampup.maxWaitHitCount}
              </p>
              <p className="mt-1">
                boost status:{" "}
                {boostActive ? "active" : netsaverMetrics.quietMode.enabled ? "quiet" : "-"}
              </p>
              <p>
                boost remaining:{" "}
                {boostActive && boostRemainingMs !== null
                  ? `${Math.ceil(boostRemainingMs / 1000)}s`
                  : "-"}
              </p>
              <p>
                quiet entered:{" "}
                {netsaverMetrics.boost.quietEnteredAt
                  ? new Date(netsaverMetrics.boost.quietEnteredAt).toLocaleTimeString()
                  : "-"}
              </p>
              <p>boost rearm: {netsaverMetrics.boost.rearmCount}</p>
              <p>quiet p2p skipped: {netsaverMetrics.quietMode.p2pSkippedCount}</p>
              <p>wasm p2p hits (5m): {netsaverMetrics.wasm.p2pRecent5m}</p>
              <p>meta p2p hits (5m): {netsaverMetrics.meta.p2pRecent5m}</p>
              <p>shard p2p hits (5m): {netsaverMetrics.shard.p2pRecent5m}</p>
              <p>lease wait (5m): {netsaverMetrics.lease.waitRecent5m}</p>
              <p>
                wasm p2p/origin: {netsaverMetrics.wasm.p2pHitCount}/
                {netsaverMetrics.wasm.originFetchCount}
              </p>
              <p>
                meta p2p/origin: {netsaverMetrics.meta.p2pHitCount}/
                {netsaverMetrics.meta.originFetchCount}
              </p>
              <p>
                tier3 disabled: {netsaverMetrics.shard.tier3Disabled ? "yes" : "no"}
                {netsaverMetrics.shard.tier3DisabledReason
                  ? ` (${netsaverMetrics.shard.tier3DisabledReason})`
                  : ""}
              </p>
              <p>range bypass: {netsaverMetrics.rangeBypassCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-600">
              <p className="text-xs font-semibold text-slate-600">lease 상태</p>
              <p className="mt-1">active: {netsaverMetrics.lease.active ? "yes" : "no"}</p>
              <p>acquired: {netsaverMetrics.lease.acquiredCount}</p>
              <p>wait count: {netsaverMetrics.lease.waitCount}</p>
              <p>wait (5m): {netsaverMetrics.lease.waitRecent5m}</p>
              <p>wait total: {Math.round(netsaverMetrics.lease.waitMsTotal)}ms</p>
              <p>bypass: {netsaverMetrics.lease.bypassCount}</p>
              <p>wasm wait/bypass: {netsaverMetrics.wasm.leaseWaitCount}/{netsaverMetrics.wasm.leaseBypassCount}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-600">
            <p className="text-xs font-semibold text-slate-600">WASM P2P 미니 진단</p>
            <p className="mt-1">probe: {netsaverMetrics.p2pProbe.status}</p>
            <p>peers: {netsaverMetrics.p2p.connectionCount}</p>
            <p>
              wasm p2p/origin: {netsaverMetrics.wasm.p2pHitCount}/
              {netsaverMetrics.wasm.originFetchCount}
            </p>
            <p>
              meta p2p/origin: {netsaverMetrics.meta.p2pHitCount}/
              {netsaverMetrics.meta.originFetchCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-600">
            <p className="text-xs font-semibold text-slate-600">Network Saver 추천</p>
            <p className="mt-1">
              추천 모드/티어: {netsaverRecommendation?.mode ?? "-"} /{" "}
              {netsaverRecommendation?.tier ?? "-"}
            </p>
            <p>추천 allowlist: {netsaverRecommendation?.p2pAllowlist.length ?? 0}</p>
            <p>추천 rampup: {netsaverRecommendation?.rampupEnabled ? "on" : "off"}</p>
            <p>code hash: {netsaverJournal?.codeHash ?? "-"}</p>
            {netsaverRecommendation?.notes.length ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-slate-400">
                {netsaverRecommendation.notes.map((note, index) => (
                  <li key={`${note}-${index}`}>{note}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">추천 근거 없음</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleP2PProbe()}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              P2P 재프로브 ({netsaverProbeStatus.status})
            </button>
            <button
              type="button"
              onClick={() => void handleLeaseRoundtrip()}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              lease roundtrip ({netsaverLeaseStatus.status})
            </button>
          </div>
          {netsaverProbeStatus.message || netsaverLeaseStatus.message ? (
            <p className="text-[11px] text-amber-600">
              {netsaverProbeStatus.message ?? netsaverLeaseStatus.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {isTeacherMode ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Teacher Diagnostics & Recovery</p>
              <p className="mt-1 text-xs text-slate-500">
                수업이 멈춘 듯 보일 때 즉시 복구하고, 강제 폴백/보험 템플릿을 설정합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshDiagnostics()}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              상태 새로고침
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs font-semibold text-slate-600">Coach 엔진</p>
              <p className="mt-1 text-xs text-slate-500">
                loaded: {diagnostics.coach.loaded ? "1" : "0"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                model: {diagnostics.coach.modelId ?? "-"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                resolved coach model: {resolvedCoachModelId ?? "-"}
              </p>
              <p className="mt-1 break-all text-[11px] text-slate-500">
                resolved coach wasm: {resolvedCoachWasmUrl ?? "-"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                lib/model base: {resolvedLibBase ?? "-"} / {resolvedModelBase ?? "-"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                hard disable final: {hardDisableFinal ? "true" : "false"}
                {hardDisableRaw ? ` (raw=${hardDisableRaw})` : ""}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                coach init attempted: {coachInitState.attempted ? "yes" : "no"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                coach init status: {coachInitState.status}
                {coachInitState.reasonCode ? ` (${coachInitState.reasonCode})` : ""}
              </p>
              {coachInitState.message ? (
                <p className="mt-1 text-[11px] text-slate-500">message: {coachInitState.message}</p>
              ) : null}
              <p className="mt-1 text-[11px] text-slate-500">
                init latency: {coachInitState.latencyMs ? `${Math.round(coachInitState.latencyMs)}ms` : "-"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                last duration:{" "}
                {diagnostics.lastRequestDurations.coachMs
                  ? `${Math.round(diagnostics.lastRequestDurations.coachMs)}ms`
                  : "-"}
              </p>
              <button
                type="button"
                onClick={() => void handleCoachInitTest()}
                className="mt-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
              >
                Coach init test
              </button>
              <button
                type="button"
                onClick={() => void handleResetEngine("coach")}
                className="mt-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
              >
                Reset Coach Engine
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs font-semibold text-slate-600">Generator 엔진</p>
              <p className="mt-1 text-xs text-slate-500">
                primary loaded: {diagnostics.generator.primaryLoaded ? "1" : "0"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                fallback ready: {diagnostics.generator.fallbackLoaded ? "1" : "0"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                model: {diagnostics.generator.modelId ?? "-"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                last duration:{" "}
                {diagnostics.lastRequestDurations.generatorMs
                  ? `${Math.round(diagnostics.lastRequestDurations.generatorMs)}ms`
                  : "-"}
              </p>
              <button
                type="button"
                onClick={() => void handleResetEngine("generator")}
                className="mt-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
              >
                Reset Generator Engine
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:col-span-2">
              <p className="text-xs font-semibold text-slate-600">최근 오류</p>
              <p className="mt-1 text-xs text-slate-500">
                {diagnostics.lastError
                  ? `${diagnostics.lastError.scope} · ${diagnostics.lastError.message}`
                  : "최근 오류 없음"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                code: {diagnostics.lastError?.code ?? "-"} / time:{" "}
                {diagnostics.lastError
                  ? new Date(diagnostics.lastError.at).toLocaleTimeString()
                  : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:col-span-2">
              <p className="text-xs font-semibold text-slate-600">현장 상태 요약</p>
              <div className="mt-2 grid gap-2 text-[11px] text-slate-500 sm:grid-cols-2">
                <div>
                  <p>coach model: {diagnostics.coach.modelId ?? "-"}</p>
                  <p>primary model: {diagnostics.modelIds.primary}</p>
                  <p>fallback model: {diagnostics.modelIds.fallback ?? "-"}</p>
                </div>
                <div>
                  <p>
                    last success (coach):{" "}
                    {diagnostics.coach.lastSuccessAt
                      ? new Date(diagnostics.coach.lastSuccessAt).toLocaleTimeString()
                      : "-"}
                  </p>
                  <p>
                    last success (generator):{" "}
                    {diagnostics.generator.lastSuccessAt
                      ? new Date(diagnostics.generator.lastSuccessAt).toLocaleTimeString()
                      : "-"}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                  5m coach stall {diagnostics.recentCounts.coachStallAborts}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                  5m generator timeout {diagnostics.recentCounts.generatorTimeouts}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                  5m fallback {diagnostics.recentCounts.fallbackUsed}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                  5m insurance {diagnostics.recentCounts.insuranceTemplateApplied}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                  5m engine reset {diagnostics.recentCounts.engineResets}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={generatorOverrides.forceFallback}
                onChange={() => handleOverrideToggle("forceFallback")}
              />
              Generator Fallback (0.5B) 강제
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={generatorOverrides.forceTemplate}
                onChange={() => handleOverrideToggle("forceTemplate")}
              />
              보험 템플릿 강제
            </label>
            <button
              type="button"
              onClick={handleQuickResourceCheck}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              네트워크/리소스 재검사
            </button>
            <button
              type="button"
              onClick={handleClearLocalState}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              Clear local state
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            토글은 sessionStorage에 저장되며, 브라우저 캐시 삭제를 의미하지 않습니다.
          </p>
        </div>
      ) : null}

      {isTeacherMode ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Flow Runner (10x)</p>
              <p className="mt-1 text-xs text-slate-500">
                COACH/GENERATOR/EXPORT 시나리오를 10회 실행하고, 중지/보고서를 제공합니다.
              </p>
              <label className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={useDefaultPromptSet}
                  onChange={() => setUseDefaultPromptSet((prev) => !prev)}
                />
                Use default prompt set ({DEFAULT_PROMPT_SET.id})
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] font-semibold text-slate-600">
                <span className="mr-1 text-slate-500">Lesson</span>
                {(["P1", "P2", "P3", "P4"] as const).map((lesson) => (
                  <button
                    key={lesson}
                    type="button"
                    onClick={() => setFlowLessonId(lesson)}
                    className={`rounded-full border px-2 py-1 ${
                      flowLessonId === lesson
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    {lesson}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!config.ok || flowRunning}
                onClick={runLessonFlowBatch}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Run 10x
              </button>
              <button
                type="button"
                disabled={!flowRunning}
                onClick={handleStopFlowRunner}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Stop
              </button>
              <button
                type="button"
                disabled={flowRunResults.length === 0}
                onClick={exportFlowResults}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copiedFlowExport ? "Exported + Copied" : "Export JSON"}
              </button>
              {flowRunResults.length > 0 ? (
                <button
                  type="button"
                  disabled={flowRunning}
                  onClick={handleCopyFlowReport}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copiedFlowReport ? "Copied" : "Copy Bug Report"}
                </button>
              ) : null}
            </div>
          </div>
          <p className={`text-xs font-semibold ${resolveStatusLabel(flowRunStatus).tone}`}>
            {resolveStatusLabel(flowRunStatus, "대기 중").text}
          </p>
          {flowRunning ? (
            <p className="text-xs text-slate-500">
              진행 중: {flowProgress.current}/{flowProgress.total}
            </p>
          ) : null}
          {flowSummary.total > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                ok {flowSummary.okCount}/{flowSummary.total}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                hardFail {flowSummary.hardFailCount}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                coach fixedHan {Math.round(flowSummary.coachHanRate * 100)}%
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                generator fixedHan {Math.round(flowSummary.generatorHanRate * 100)}%
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                insurance {Math.round(flowSummary.insuranceRate * 100)}%
              </span>
            </div>
          ) : null}
          {flowRunResults.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
              <table className="min-w-[1200px] table-fixed text-xs text-slate-600">
                <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="w-[6%] px-3 py-2 text-left">Run</th>
                    <th className="w-[6%] px-3 py-2 text-left">Lesson</th>
                    <th className="w-[24%] px-3 py-2 text-left">Step Status</th>
                    <th className="w-[8%] px-3 py-2 text-left">Schema</th>
                    <th className="w-[8%] px-3 py-2 text-left">Render</th>
                    <th className="w-[8%] px-3 py-2 text-left">MissingRefs</th>
                    <th className="w-[10%] px-3 py-2 text-left">CodeHash</th>
                    <th className="w-[10%] px-3 py-2 text-left">Duration</th>
                    <th className="w-[10%] px-3 py-2 text-left">HardFail</th>
                    <th className="w-[10%] px-3 py-2 text-left">Fallback Used</th>
                    <th className="w-[20%] px-3 py-2 text-left">Last Request ID</th>
                  </tr>
                </thead>
                <tbody>
                  {flowRunResults.map((run) => (
                    <tr key={`flow-run-${run.runId}`} className="border-b border-slate-100">
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        #{run.runId + 1}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        {run.lessonId}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        <div className="flex flex-wrap gap-1">
                          {run.steps.map((step) => (
                            <span
                              key={`${run.runId}-${step.step}`}
                              className={`rounded-full px-2 py-0.5 ${
                                step.status === "ok"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : step.status === "skipped"
                                    ? "bg-slate-100 text-slate-500"
                                    : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {step.step}:{step.status} ({Math.round(step.durationMs)}ms)
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        {run.schemaValid ? "true" : "false"}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        {run.renderOk ? "true" : "false"}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        {run.missingRefs}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        {run.codeHash ?? "-"}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        {Math.round(run.durationMs)}ms
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        {run.hardFail ?? "-"}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        {run.generator.usedFallbackModel || run.generator.usedInsuranceTemplate
                          ? "1"
                          : "0"}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                        {run.requestId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm">
        <div>
          <p className="text-sm font-semibold text-slate-700">문제 해결 안내</p>
          <p className="mt-1 text-xs text-slate-500">
            오류가 있을 때는 아래 문구를 복사해 관리자에게 전달해 주세요.
          </p>
        </div>
        {adminGuides.length === 0 ? (
          <p className="text-xs text-emerald-600">현재 확인된 문제는 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {adminGuides.map((guide) => (
              <div key={guide.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{guide.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{guide.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyGuide(guide.message, guide.key)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                  >
                    {copiedGuide === guide.key ? "복사됨" : "문구 복사"}
                  </button>
                </div>
                <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                  <p className="text-[10px] font-semibold text-slate-400">관리자 전달 문구</p>
                  <p className="mt-1 whitespace-pre-line">{guide.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!config.ok || modelStatus.status === "loading"}
            onClick={() => runCheck(modelConfigUrl, setModelStatus, "HEAD")}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            모델 설정 JSON 확인
          </button>
          <span className="text-xs text-slate-500">
            {modelConfigUrl || "모델 URL이 필요합니다."}
          </span>
          {modelStatus.status !== "idle" ? (
            <span
              className={`text-xs font-semibold ${
                modelStatus.status === "ok"
                  ? "text-emerald-600"
                  : modelStatus.status === "loading"
                    ? "text-slate-500"
                    : "text-rose-600"
              }`}
            >
              {modelStatus.status === "loading" ? "확인 중…" : modelStatus.message}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!config.ok || wasmPrimaryStatus.status === "loading"}
            onClick={() => runCheck(wasmPrimaryUrl, setWasmPrimaryStatus, "HEAD")}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            WASM Primary 확인
          </button>
          <span className="text-xs text-slate-500">
            {wasmPrimaryUrl || "WASM URL이 필요합니다."}
          </span>
          {wasmPrimaryStatus.status !== "idle" ? (
            <span
              className={`text-xs font-semibold ${
                wasmPrimaryStatus.status === "ok"
                  ? "text-emerald-600"
                  : wasmPrimaryStatus.status === "loading"
                    ? "text-slate-500"
                    : "text-rose-600"
              }`}
            >
              {wasmPrimaryStatus.status === "loading" ? "확인 중…" : wasmPrimaryStatus.message}
            </span>
          ) : null}
        </div>
        {wasmFallbackUrl ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!config.ok || wasmFallbackStatus.status === "loading"}
              onClick={() => runCheck(wasmFallbackUrl, setWasmFallbackStatus, "HEAD")}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              WASM Fallback 확인
            </button>
            <span className="text-xs text-slate-500">
              {wasmFallbackUrl || "WASM URL이 필요합니다."}
            </span>
            {wasmFallbackStatus.status !== "idle" ? (
              <span
                className={`text-xs font-semibold ${
                  wasmFallbackStatus.status === "ok"
                    ? "text-emerald-600"
                    : wasmFallbackStatus.status === "loading"
                      ? "text-slate-500"
                      : "text-rose-600"
                }`}
              >
                {wasmFallbackStatus.status === "loading"
                  ? "확인 중…"
                  : wasmFallbackStatus.message}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
        <div>
          <p className="text-sm font-semibold text-slate-700">관리자 점검 항목 (HEAD)</p>
          <p className="mt-1 text-xs text-slate-500">
            tokenizer / params_shard / (optional) cache·vocab·merges 파일이 200으로 열리는지 확인해 주세요.
          </p>
        </div>
        {adminChecks.length === 0 ? (
          <p className="text-xs text-slate-500">모델 URL이 준비되면 항목이 표시됩니다.</p>
        ) : (
          <div className="space-y-3">
            {adminChecks.map((check) => {
              const status = headChecks[check.url] ?? { status: "idle" as const };
              return (
                <div key={check.url} className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!config.ok || status.status === "loading"}
                    onClick={() => {
                      runCheck(
                        check.url,
                        (next) =>
                          setHeadChecks((prev) => ({ ...prev, [check.url]: next })),
                        "HEAD",
                      );
                    }}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {check.label} 확인
                  </button>
                  <span className="text-xs text-slate-500">{check.url}</span>
                  {status.status !== "idle" ? (
                    <span
                      className={`text-xs font-semibold ${
                        status.status === "ok"
                          ? "text-emerald-600"
                          : status.status === "loading"
                            ? "text-slate-500"
                            : "text-rose-600"
                      }`}
                    >
                      {status.status === "loading" ? "확인 중…" : status.message}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
