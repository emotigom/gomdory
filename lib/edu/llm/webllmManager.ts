import { getEduWebLLMHardDisableFlag } from "@/lib/edu/llm/webllmFeatureFlags";

export type WebLLMManagerState = "idle" | "resolving" | "initializing" | "ready" | "failed_soft" | "disabled_hard";

const MAX_INIT_ATTEMPTS = 2;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 8000;

type SessionState = {
  state: WebLLMManagerState;
  attempts: number;
  nextRetryAt: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
};

const session: SessionState = {
  state: "idle",
  attempts: 0,
  nextRetryAt: 0,
};

const log = (stage: string, payload: Record<string, unknown>) => {
  if (typeof console === "undefined") return;
  console.info("[edu] webllm.manager", { stage, ...payload });
};

const computeBackoffMs = (attempts: number) => {
  const exp = Math.max(0, attempts - 1);
  return Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** exp);
};

export const getWebLLMManagerSnapshot = () => ({ ...session });

export const resetWebLLMManagerSession = () => {
  session.state = getEduWebLLMHardDisableFlag() ? "disabled_hard" : "idle";
  session.attempts = 0;
  session.nextRetryAt = 0;
  session.lastErrorCode = undefined;
  session.lastErrorMessage = undefined;
};

export const assertWebLLMInitAllowed = (requestId: string) => {
  if (getEduWebLLMHardDisableFlag()) {
    session.state = "disabled_hard";
    const error = new Error("WebLLM hard-disabled by EDU_WEBLLM_HARD_DISABLE");
    (error as Error & { code?: string }).code = "EDU_WEBLLM_HARD_DISABLED";
    log("hard_disabled", { requestId, state: session.state });
    throw error;
  }

  const now = Date.now();
  if (session.attempts >= MAX_INIT_ATTEMPTS) {
    session.state = "failed_soft";
    const error = new Error("WebLLM disabled for this session after repeated init failures");
    (error as Error & { code?: string }).code = "EDU_WEBLLM_SESSION_DISABLED";
    log("session_disabled", { requestId, attempts: session.attempts, state: session.state });
    throw error;
  }

  if (session.nextRetryAt > now) {
    const waitMs = session.nextRetryAt - now;
    const error = new Error(`WebLLM backoff active (${waitMs}ms)`);
    (error as Error & { code?: string }).code = "EDU_WEBLLM_BACKOFF";
    log("backoff", { requestId, waitMs, attempts: session.attempts });
    throw error;
  }
};

export const markWebLLMResolving = (requestId: string) => {
  session.state = "resolving";
  log("resolving", { requestId, attempts: session.attempts });
};

export const markWebLLMInitializing = (requestId: string, modelId: string) => {
  session.state = "initializing";
  session.attempts += 1;
  log("initializing", { requestId, modelId, attempts: session.attempts });
};

export const markWebLLMReady = (requestId: string, modelId: string) => {
  session.state = "ready";
  session.nextRetryAt = 0;
  session.lastErrorCode = undefined;
  session.lastErrorMessage = undefined;
  log("ready", { requestId, modelId, attempts: session.attempts });
};

export const markWebLLMInitFailedSoft = (requestId: string, code: string | undefined, message: string) => {
  const backoffMs = computeBackoffMs(session.attempts);
  session.state = "failed_soft";
  session.lastErrorCode = code;
  session.lastErrorMessage = message;
  session.nextRetryAt = Date.now() + backoffMs;
  log("failed_soft", {
    requestId,
    code: code ?? "EDU_WEBLLM_INIT_FAIL",
    attempts: session.attempts,
    backoffMs,
  });
};

export const disableWebLLMForSession = (requestId: string, code: string, message: string) => {
  session.state = "failed_soft";
  session.attempts = MAX_INIT_ATTEMPTS;
  session.nextRetryAt = Number.MAX_SAFE_INTEGER;
  session.lastErrorCode = code;
  session.lastErrorMessage = message;
  log("session_forced_disabled", {
    requestId,
    code,
    attempts: session.attempts,
  });
};

resetWebLLMManagerSession();
