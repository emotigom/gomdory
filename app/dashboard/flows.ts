export type FlowStepTarget = "class" | "share" | "present";

export type FlowStepActions = {
  qa?: "open" | "close";
  pulse?: "reset";
  poll?: {
    mode: "open" | "close";
    pollId?: string;
  };
};

export type FlowStepV2 = {
  id: string;
  label: string;
  presetId: string;
  target: FlowStepTarget;
  note?: string;
  autoNextAfterMs?: number;
  title?: string;
  prompt?: string;
  seconds?: number;
  actions?: FlowStepActions;
};

export type FlowStep = FlowStepV2;

export type Flow = {
  id: string;
  name: string;
  steps: FlowStep[];
  updatedAt: number;
};

export const DASHBOARD_FLOWS_KEY = "gom:dashboard:flows";
const DASHBOARD_FLOW_ACTIVE_PREFIX = "gom:dashboard:flow-active:";

export function createFlowId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `flow_${Date.now()}`;
}

export function createFlowStepId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `flow_step_${Date.now()}`;
}

function safeParseFlows(raw: string | null): Flow[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((flow) => flow && typeof flow.id === "string" && typeof flow.name === "string");
  } catch {
    return [];
  }
}

function readFlows(): Flow[] {
  if (typeof window === "undefined") return [];
  return safeParseFlows(window.localStorage.getItem(DASHBOARD_FLOWS_KEY));
}

function writeFlows(flows: Flow[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DASHBOARD_FLOWS_KEY, JSON.stringify(flows));
  } catch {
    // ignore storage errors
  }
}

export function listFlows(): Flow[] {
  return readFlows();
}

export function saveFlow(flow: Flow): Flow {
  const flows = readFlows();
  const updated: Flow = {
    ...flow,
    steps: flow.steps.map((step) => normalizeFlowV2(step)),
    updatedAt: Date.now(),
  };
  const next = flows.some((item) => item.id === flow.id)
    ? flows.map((item) => (item.id === flow.id ? updated : item))
    : [updated, ...flows];
  writeFlows(next);
  return updated;
}

export function deleteFlow(flowId: string) {
  const flows = readFlows();
  writeFlows(flows.filter((flow) => flow.id !== flowId));
}

export function duplicateFlow(flowId: string): Flow | null {
  const flows = readFlows();
  const source = flows.find((flow) => flow.id === flowId);
  if (!source) return null;
  const copy: Flow = {
    ...source,
    id: createFlowId(),
    name: `${source.name} 복제본`,
    updatedAt: Date.now(),
    steps: source.steps.map((step) => ({ ...normalizeFlowV2(step), id: createFlowStepId() })),
  };
  writeFlows([copy, ...flows]);
  return copy;
}

export function setActiveFlow(boardId: string, flowId: string | null) {
  if (typeof window === "undefined") return;
  if (!boardId) return;
  const key = `${DASHBOARD_FLOW_ACTIVE_PREFIX}${boardId}`;
  try {
    if (!flowId) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, flowId);
  } catch {
    // ignore storage errors
  }
}

export function getActiveFlow(boardId: string): string | null {
  if (typeof window === "undefined") return null;
  if (!boardId) return null;
  const key = `${DASHBOARD_FLOW_ACTIVE_PREFIX}${boardId}`;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const MAX_TITLE_LENGTH = 80;
const MAX_PROMPT_LENGTH = 500;
const MAX_SECONDS = 3600;

function normalizeText(value: string | undefined, limit: number) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, limit);
}

export function normalizeFlowV2(step: FlowStep): FlowStep {
  const secondsValue = typeof step.seconds === "number" && Number.isFinite(step.seconds)
    ? Math.max(0, Math.min(MAX_SECONDS, Math.round(step.seconds)))
    : undefined;
  const qa = step.actions?.qa === "open" || step.actions?.qa === "close" ? step.actions?.qa : undefined;
  const pulse: FlowStepActions["pulse"] = step.actions?.pulse === "reset" ? "reset" : undefined;
  const pollMode = step.actions?.poll?.mode === "open" || step.actions?.poll?.mode === "close"
    ? step.actions?.poll?.mode
    : undefined;
  const pollId = step.actions?.poll?.pollId?.trim();
  const actions =
    qa || pulse || pollMode
      ? {
          qa,
          pulse,
          poll: pollMode
            ? {
                mode: pollMode,
                pollId: pollId ? pollId : undefined,
              }
            : undefined,
        }
      : undefined;

  return {
    ...step,
    title: normalizeText(step.title, MAX_TITLE_LENGTH),
    prompt: normalizeText(step.prompt, MAX_PROMPT_LENGTH),
    seconds: typeof secondsValue === "number" ? secondsValue : undefined,
    actions,
  };
}
