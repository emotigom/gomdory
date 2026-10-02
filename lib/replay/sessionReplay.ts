import { SESSION_EVENT_TYPES, type SessionEventType } from "@/lib/types/sessionEvents";

type ReplayPinnedQuestion = {
  id: string;
  title: string | null;
};

type ReplayStep = {
  stepId: string | null;
  label: string | null;
  description: string | null;
  index: number | null;
  timerSeconds: number | null;
  startedAt: string | null;
};

type ReplayPoll = {
  pollId: string | null;
  title: string | null;
  status: "idle" | "open" | "closed";
};

export type ReplayState = {
  ts: number | null;
  currentStep: ReplayStep;
  qaWindow: { open: boolean; prompt: string | null };
  pinnedQuestions: { count: number; recent: ReplayPinnedQuestion[] };
  poll: ReplayPoll;
  presence: { current: number; peak: number };
  pulse: { current: number; peak: number };
};

export type ReplayEvent = {
  ts: string;
  type: SessionEventType;
  payload: Record<string, unknown>;
};

export type ReplayMarker = {
  ts: number;
  type: SessionEventType;
};

export type ReplayTimeline = {
  startTs: number;
  endTs: number;
  keyframes: Array<{ ts: number; state: ReplayState }>;
  markers: ReplayMarker[];
};

const KEY_EVENT_TYPES: SessionEventType[] = [
  "step_changed",
  "poll_opened",
  "poll_closed",
  "question_pinned",
  "qa_window_changed",
];

const KEY_EVENT_SET = new Set(KEY_EVENT_TYPES);
const SESSION_EVENT_SET = new Set(SESSION_EVENT_TYPES as readonly SessionEventType[]);

function toTimestamp(ts: string): number | null {
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? null : parsed;
}

export function createInitialReplayState(): ReplayState {
  return {
    ts: null,
    currentStep: {
      stepId: null,
      label: null,
      description: null,
      index: null,
      timerSeconds: null,
      startedAt: null,
    },
    qaWindow: { open: false, prompt: null },
    pinnedQuestions: { count: 0, recent: [] },
    poll: { pollId: null, title: null, status: "idle" },
    presence: { current: 0, peak: 0 },
    pulse: { current: 0, peak: 0 },
  };
}

export function applyEvent(state: ReplayState, event: ReplayEvent): ReplayState {
  if (!SESSION_EVENT_SET.has(event.type)) {
    return state;
  }

  const nextState: ReplayState = {
    ...state,
    currentStep: { ...state.currentStep },
    qaWindow: { ...state.qaWindow },
    pinnedQuestions: {
      count: state.pinnedQuestions.count,
      recent: [...state.pinnedQuestions.recent],
    },
    poll: { ...state.poll },
    presence: { ...state.presence },
    pulse: { ...state.pulse },
  };

  const eventTs = toTimestamp(event.ts);
  if (eventTs !== null) {
    nextState.ts = eventTs;
  }

  switch (event.type) {
    case "step_changed": {
      const label = typeof event.payload.label === "string" ? event.payload.label : null;
      const description =
        typeof event.payload.description === "string"
          ? event.payload.description
          : typeof event.payload.prompt === "string"
            ? event.payload.prompt
            : null;
      const stepId = typeof event.payload.stepId === "string" ? event.payload.stepId : null;
      const index = typeof event.payload.index === "number" ? event.payload.index : null;
      nextState.currentStep = {
        stepId: stepId ?? nextState.currentStep.stepId,
        label: label ?? nextState.currentStep.label,
        description: description ?? nextState.currentStep.description,
        index: index ?? nextState.currentStep.index,
        timerSeconds: nextState.currentStep.timerSeconds,
        startedAt: event.ts,
      };
      return nextState;
    }
    case "qa_window_changed": {
      const open = typeof event.payload.open === "boolean" ? event.payload.open : nextState.qaWindow.open;
      const prompt =
        typeof event.payload.prompt === "string" || event.payload.prompt === null
          ? (event.payload.prompt as string | null)
          : nextState.qaWindow.prompt;
      nextState.qaWindow = { open, prompt };
      return nextState;
    }
    case "question_pinned": {
      const questionId = typeof event.payload.questionId === "string" ? event.payload.questionId : null;
      if (!questionId) return nextState;
      const title = typeof event.payload.title === "string" ? event.payload.title : null;
      const nextRecent = nextState.pinnedQuestions.recent.filter((item) => item.id !== questionId);
      nextRecent.unshift({ id: questionId, title });
      nextState.pinnedQuestions = {
        count: new Set(nextRecent.map((item) => item.id)).size,
        recent: nextRecent.slice(0, 4),
      };
      return nextState;
    }
    case "poll_opened": {
      const pollId = typeof event.payload.pollId === "string" ? event.payload.pollId : null;
      const title = typeof event.payload.title === "string" ? event.payload.title : null;
      nextState.poll = {
        pollId: pollId ?? nextState.poll.pollId,
        title: title ?? nextState.poll.title,
        status: "open",
      };
      return nextState;
    }
    case "poll_closed": {
      const pollId = typeof event.payload.pollId === "string" ? event.payload.pollId : null;
      if (!pollId || pollId === nextState.poll.pollId) {
        nextState.poll = {
          ...nextState.poll,
          status: "closed",
        };
      }
      return nextState;
    }
    case "pulse_reset": {
      nextState.pulse.current = 0;
      return nextState;
    }
    case "snapshot": {
      const presenceCount =
        typeof event.payload.presenceCount === "number" ? event.payload.presenceCount : nextState.presence.current;
      const pulseCount =
        typeof event.payload.pulseCount === "number" ? event.payload.pulseCount : nextState.pulse.current;
      const activePollId = typeof event.payload.activePollId === "string" ? event.payload.activePollId : null;
      nextState.presence.current = presenceCount;
      nextState.presence.peak = Math.max(nextState.presence.peak, presenceCount);
      nextState.pulse.current = pulseCount;
      nextState.pulse.peak = Math.max(nextState.pulse.peak, pulseCount);
      if (activePollId) {
        nextState.poll = {
          ...nextState.poll,
          pollId: activePollId,
        };
      }
      return nextState;
    }
    case "session_started":
    case "session_ended":
    case "nudge_sent":
    default:
      return nextState;
  }
}

export function buildReplayTimeline(events: ReplayEvent[]): ReplayTimeline {
  const sorted = events
    .filter((event) => SESSION_EVENT_SET.has(event.type))
    .map((event) => ({ event, ts: toTimestamp(event.ts) }))
    .filter((entry): entry is { event: ReplayEvent; ts: number } => entry.ts !== null)
    .sort((a, b) => a.ts - b.ts);

  const keyframes: Array<{ ts: number; state: ReplayState }> = [];
  const markers: ReplayMarker[] = [];
  let state = createInitialReplayState();

  sorted.forEach((entry) => {
    state = applyEvent(state, entry.event);
    keyframes.push({ ts: entry.ts, state });
    if (KEY_EVENT_SET.has(entry.event.type)) {
      markers.push({ ts: entry.ts, type: entry.event.type });
    }
  });

  if (sorted.length === 0) {
    return { startTs: 0, endTs: 0, keyframes: [], markers: [] };
  }

  return {
    startTs: sorted[0].ts,
    endTs: sorted[sorted.length - 1].ts,
    keyframes,
    markers,
  };
}

export function stateAt(events: ReplayEvent[], targetTs: number): ReplayState {
  const sorted = events
    .filter((event) => SESSION_EVENT_SET.has(event.type))
    .map((event) => ({ event, ts: toTimestamp(event.ts) }))
    .filter((entry): entry is { event: ReplayEvent; ts: number } => entry.ts !== null)
    .sort((a, b) => a.ts - b.ts);

  let state = createInitialReplayState();

  for (const entry of sorted) {
    if (entry.ts > targetTs) break;
    state = applyEvent(state, entry.event);
  }

  return state;
}
