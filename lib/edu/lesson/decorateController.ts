import { createDecorateFirstClickSlaGuard, type DecorateFirstClickSlaConfig, type DecorateSlaEvent } from "@/lib/edu/lesson/decorateFirstClickSla";

export type DecorateControllerPhase =
  | "idle"
  | "starting"
  | "server_kickoff"
  | "webllm_kickoff"
  | "fallback_kickoff"
  | "building_preview"
  | "preview_ready"
  | "applying"
  | "completed_stabilizing"
  | "completed"
  | "blocked"
  | "error";

export type DecorateSkipReason =
  | "empty_prompt"
  | "in_flight_duplicate"
  | "pending_preview_exists"
  | "generator_fallback_in_progress"
  | "step_mismatch"
  | "same_prompt_ignored"
  | "controller_busy"
  | "unknown_precondition";

export type DecoratePreviewResult =
  | { ok: true; requestId: string; reason: "preview_ready" | "applied"; mode?: "llm" | "deterministic" }
  | { ok: false; requestId: string; reason: string };

export type DecorateControllerState = {
  phase: DecorateControllerPhase;
  requestId?: string;
  pending?: { requestId: string; prompt: string; mode?: "llm" | "deterministic" } | null;
  inFlightPrompt?: string | null;
  lastCompletedPrompt?: string | null;
  lastError?: string | null;
  completionBarrierUntil?: number | null;
};

type DecorateStartContext = {
  requestId: string;
  signal: AbortSignal;
  setPhase: (phase: Exclude<DecorateControllerPhase, "idle" | "preview_ready" | "applying" | "completed_stabilizing" | "completed" | "error" | "blocked">) => void;
  markServerPlanStart: () => void;
  markServerPlanEnd: () => void;
  shouldFallbackImmediately: () => boolean;
  wasServerPlanStarted: () => boolean;
};

type DecorateControllerOptions = {
  createRequestId: () => string;
  now?: () => number;
  onSkip: (input: { reason: DecorateSkipReason; promptLen: number; inProgress: boolean; hasPendingPreview: boolean; requestId: string }) => void;
  onClick: (input: { requestId: string; promptLen: number; inProgress: boolean; hasPendingPreview: boolean }) => void;
  onInvariantViolation: (input: { requestId: string; promptLen: number; missing: "server_plan_start" }) => void;
  executeStart: (prompt: string, context: DecorateStartContext) => Promise<DecoratePreviewResult>;
  executeRecheckPending?: (pending: { requestId: string; prompt: string; mode?: "llm" | "deterministic" }) => Promise<{ eligible: boolean; reason?: string }>;
  executeApplyPending: (pending: { requestId: string; prompt: string; mode?: "llm" | "deterministic" }) => Promise<void>;
  executeUndo: () => Promise<void>;
  onPhaseTransition?: (input: { requestId: string; phase: DecorateControllerPhase }) => void;
  onCommitBarrierEvent?: (input: { requestId: string; event: "started" | "completed" | "blocked_interference"; phase: DecorateControllerPhase }) => void;
  stabilizationMs?: number;
  slaConfig?: DecorateFirstClickSlaConfig;
  onSlaEvent?: (event: DecorateSlaEvent) => void;
};

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export function createDecorateController(options: DecorateControllerOptions) {
  const now = options.now ?? (() => Date.now());
  let state: DecorateControllerState = {
    phase: "idle",
    pending: null,
    inFlightPrompt: null,
    lastCompletedPrompt: null,
    lastError: null,
    completionBarrierUntil: null,
  };
  let activeAbort: AbortController | null = null;
  let activeRequestId: string | null = null;
  let invariantTimer: ReturnType<typeof setTimeout> | null = null;
  let stabilizationTimer: ReturnType<typeof setTimeout> | null = null;
  let serverPlanStarted = false;
  let activeSla: ReturnType<typeof createDecorateFirstClickSlaGuard> | null = null;

  const setState = (next: DecorateControllerState) => {
    state = next;
    if (next.requestId) {
      options.onPhaseTransition?.({ requestId: next.requestId, phase: next.phase });
    }
  };

  const clearInvariantTimer = () => {
    if (!invariantTimer) return;
    clearTimeout(invariantTimer);
    invariantTimer = null;
  };

  const clearStabilizationTimer = () => {
    if (!stabilizationTimer) return;
    clearTimeout(stabilizationTimer);
    stabilizationTimer = null;
  };

  const scheduleInvariant = (requestId: string, promptLen: number) => {
    clearInvariantTimer();
    serverPlanStarted = false;
    invariantTimer = setTimeout(() => {
      if (serverPlanStarted) return;
      options.onInvariantViolation({ requestId, promptLen, missing: "server_plan_start" });
    }, 300);
  };

  const startDecorate = async (rawPrompt: string): Promise<DecoratePreviewResult> => {
    const prompt = rawPrompt.trim();
    const requestId = options.createRequestId();
    const hasPendingPreview = Boolean(state.pending);
    const inProgress =
      state.phase === "starting" ||
      state.phase === "server_kickoff" ||
      state.phase === "webllm_kickoff" ||
      state.phase === "fallback_kickoff" ||
      state.phase === "building_preview" ||
      state.phase === "applying";
    options.onClick({ requestId, promptLen: prompt.length, inProgress, hasPendingPreview });

    if (!prompt) {
      options.onSkip({ reason: "empty_prompt", promptLen: 0, inProgress, hasPendingPreview, requestId });
      return { ok: false, reason: "empty_prompt", requestId };
    }

    if ((state.phase === "starting" || state.phase === "server_kickoff" || state.phase === "webllm_kickoff" || state.phase === "fallback_kickoff" || state.phase === "building_preview") && state.inFlightPrompt === prompt) {
      options.onSkip({ reason: "in_flight_duplicate", promptLen: prompt.length, inProgress: true, hasPendingPreview, requestId });
      return { ok: false, reason: "in_flight_duplicate", requestId };
    }

    if (state.phase === "preview_ready" && state.pending && state.pending.prompt === prompt) {
      options.onSkip({ reason: "same_prompt_ignored", promptLen: prompt.length, inProgress, hasPendingPreview, requestId });
      return { ok: true, reason: "preview_ready", requestId: state.pending.requestId, mode: state.pending.mode };
    }

    if (activeAbort) {
      activeAbort.abort({ abortReason: "user_cancel", phase: "decorate.controller.replace" });
    }

    clearStabilizationTimer();
    const abortController = new AbortController();
    activeAbort = abortController;
    activeRequestId = requestId;
    setState({
      phase: "starting",
      requestId,
      pending: null,
      inFlightPrompt: prompt,
      lastCompletedPrompt: state.lastCompletedPrompt ?? null,
      lastError: null,
      completionBarrierUntil: null,
    });
    activeSla?.stop();
    activeSla = createDecorateFirstClickSlaGuard({
      requestId,
      now,
      config: options.slaConfig,
      onEvent: (event) => options.onSlaEvent?.(event),
      onBreach: (event) => {
        if (activeRequestId !== requestId) return;
        if (event.checkpoint === "kickoff_visible" && state.phase === "starting") {
          setState({ ...state, phase: "fallback_kickoff", requestId });
        }
        if (event.checkpoint === "preview_or_fallback_visible" && state.phase !== "preview_ready") {
          setState({ ...state, phase: "building_preview", requestId });
        }
      },
    });
    activeSla.checkpoint("transaction_visible");
    scheduleInvariant(requestId, prompt.length);
    const startAt = now();

    try {
      const result = await options.executeStart(prompt, {
        requestId,
        signal: abortController.signal,
        setPhase: (phase) => {
          if (activeRequestId !== requestId) return;
          if (phase === "server_kickoff" || phase === "webllm_kickoff" || phase === "fallback_kickoff") {
            activeSla?.checkpoint("kickoff_visible");
          }
          if (phase === "building_preview") {
            activeSla?.checkpoint("preview_or_fallback_visible");
          }
          setState({ ...state, phase, requestId });
        },
        markServerPlanStart: () => {
          serverPlanStarted = true;
          clearInvariantTimer();
        },
        markServerPlanEnd: () => {
          serverPlanStarted = true;
        },
        shouldFallbackImmediately: () => now() - startAt >= 1000,
        wasServerPlanStarted: () => serverPlanStarted,
      });

      if (activeRequestId !== requestId) {
        return { ok: false, requestId, reason: "stale_request" };
      }

      if (result.ok) {
        if (result.reason === "preview_ready") {
          activeSla?.checkpoint("preview_or_fallback_visible");
          activeSla?.checkpoint("no_hung_state");
          setState({
            phase: "preview_ready",
            requestId,
            pending: { requestId, prompt, mode: result.mode },
            inFlightPrompt: null,
            lastCompletedPrompt: prompt,
            lastError: null,
            completionBarrierUntil: null,
          });
        } else {
          activeSla?.checkpoint("no_hung_state");
          setState({
            phase: "completed",
            requestId,
            pending: null,
            inFlightPrompt: null,
            lastCompletedPrompt: prompt,
            lastError: null,
            completionBarrierUntil: null,
          });
        }
      } else {
        activeSla?.checkpoint("no_hung_state");
        setState({
          phase: result.reason === "blocked_stale_pending" ? "blocked" : "error",
          requestId,
          pending: null,
          inFlightPrompt: null,
          lastCompletedPrompt: state.lastCompletedPrompt ?? null,
          lastError: result.reason,
          completionBarrierUntil: null,
        });
      }
      return result;
    } catch (error) {
      if (isAbortError(error)) {
        return { ok: false, requestId, reason: "user_cancel" };
      }
      setState({
        phase: "error",
        requestId,
        pending: null,
        inFlightPrompt: null,
        lastCompletedPrompt: state.lastCompletedPrompt ?? null,
        lastError: error instanceof Error ? error.message : "unknown_error",
        completionBarrierUntil: null,
      });
      return { ok: false, requestId, reason: "controller_error" };
    } finally {
      activeSla?.stop();
      activeSla = null;
      clearInvariantTimer();
      if (activeAbort === abortController) {
        activeAbort = null;
      }
      if (activeRequestId === requestId) {
        activeRequestId = null;
      }
    }
  };

  const applyPending = async () => {
    const pending = state.pending;
    if (!pending) return;
    if (state.completionBarrierUntil && now() < state.completionBarrierUntil) {
      options.onCommitBarrierEvent?.({ requestId: pending.requestId, event: "blocked_interference", phase: state.phase });
      return;
    }
    if (options.executeRecheckPending) {
      const rechecked = await options.executeRecheckPending(pending);
      if (!rechecked.eligible) {
        setState({
          ...state,
          phase: "blocked",
          pending: null,
          lastError: rechecked.reason ?? "blocked_stale_pending",
          completionBarrierUntil: null,
        });
        return;
      }
    }
    setState({ ...state, phase: "applying", inFlightPrompt: null });
    try {
      await options.executeApplyPending(pending);
      const stabilizationMs = options.stabilizationMs ?? 1200;
      const barrierUntil = now() + stabilizationMs;
      options.onCommitBarrierEvent?.({ requestId: pending.requestId, event: "started", phase: "completed_stabilizing" });
      setState({
        phase: "completed_stabilizing",
        requestId: pending.requestId,
        pending: null,
        inFlightPrompt: null,
        lastCompletedPrompt: state.lastCompletedPrompt ?? pending.prompt,
        lastError: null,
        completionBarrierUntil: barrierUntil,
      });
      clearStabilizationTimer();
      stabilizationTimer = setTimeout(() => {
        setState({
          phase: "completed",
          requestId: pending.requestId,
          pending: null,
          inFlightPrompt: null,
          lastCompletedPrompt: state.lastCompletedPrompt ?? pending.prompt,
          lastError: null,
          completionBarrierUntil: null,
        });
        options.onCommitBarrierEvent?.({ requestId: pending.requestId, event: "completed", phase: "completed" });
      }, stabilizationMs);
    } catch (error) {
      setState({
        ...state,
        phase: "error",
        lastError: error instanceof Error ? error.message : "apply_failed",
        completionBarrierUntil: null,
      });
      throw error;
    }
  };

  const undo = async () => {
    await options.executeUndo();
  };

  return {
    startDecorate,
    applyPending,
    undo,
    getState: () => ({ ...state }),
  };
}
