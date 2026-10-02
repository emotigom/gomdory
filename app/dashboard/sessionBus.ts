import type { FlowStepActions } from "@/app/dashboard/flows";

export type SessionEvent =
  | {
      type: "FLOW_RUN" | "FLOW_NEXT" | "FLOW_PREV";
      boardId: string;
      flowId: string;
      stepId: string;
      stepIndex: number;
      target: "class" | "share" | "present";
      label: string;
      currentStep?: {
        flowId: string;
        stepIndex: number;
        stepId: string;
        title?: string;
        prompt?: string;
        startedAt: number;
        seconds?: number;
        actions?: FlowStepActions;
        actionsApplied?: boolean;
        paused?: boolean;
        pausedAt?: number;
      };
      ts: number;
    }
  | {
      type: "MODE_CHANGE";
      boardId: string;
      mode: "clean" | "manage" | "focus";
      ts: number;
    }
  | {
      type: "DEMO_STEP_CHANGED";
      boardId: string;
      stepIndex: number;
      ts: number;
    };

export type SessionSnapshot = {
  flowId: string;
  stepId: string;
  stepIndex: number;
  target: "class" | "share" | "present";
  label: string;
  currentStep?: {
    flowId: string;
    stepIndex: number;
    stepId: string;
    title?: string;
    prompt?: string;
    startedAt: number;
    seconds?: number;
    actions?: FlowStepActions;
    actionsApplied?: boolean;
    paused?: boolean;
    pausedAt?: number;
  };
  ts: number;
};

const SNAPSHOT_PREFIX = "DASHBOARD_SESSION_";
const BUS_PREFIX = "gom:dashboard:session";

function getSnapshotKey(boardId: string) {
  return `${SNAPSHOT_PREFIX}${boardId}`;
}

function getBusKey(boardId: string) {
  return `${BUS_PREFIX}:${boardId}`;
}

function getStorageEventKey(boardId: string) {
  return `${getBusKey(boardId)}:event`;
}

export function readSessionSnapshot(boardId: string): SessionSnapshot | null {
  if (typeof window === "undefined") return null;
  if (!boardId) return null;
  try {
    const stored = window.localStorage.getItem(getSnapshotKey(boardId));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as SessionSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.flowId !== "string" || typeof parsed.stepId !== "string") return null;
    if (typeof parsed.stepIndex !== "number" || typeof parsed.label !== "string") return null;
    if (!["class", "share", "present"].includes(parsed.target)) return null;
    if (typeof parsed.ts !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSessionSnapshot(boardId: string, snapshot: SessionSnapshot) {
  if (typeof window === "undefined") return;
  if (!boardId) return;
  try {
    window.localStorage.setItem(getSnapshotKey(boardId), JSON.stringify(snapshot));
  } catch {
    // ignore storage errors
  }
}

export function createBoardBus(boardId: string) {
  const channelName = getBusKey(boardId);
  const storageEventKey = getStorageEventKey(boardId);
  const isFlowEvent = (
    event: SessionEvent,
  ): event is Extract<SessionEvent, { type: "FLOW_RUN" | "FLOW_NEXT" | "FLOW_PREV" }> =>
    event.type === "FLOW_RUN" || event.type === "FLOW_NEXT" || event.type === "FLOW_PREV";

  const publish = (event: SessionEvent) => {
    if (isFlowEvent(event)) {
      writeSessionSnapshot(event.boardId, {
        flowId: event.flowId,
        stepId: event.stepId,
        stepIndex: event.stepIndex,
        target: event.target,
        label: event.label,
        currentStep: event.currentStep,
        ts: event.ts,
      });
    }

    if (typeof BroadcastChannel !== "undefined") {
      let channel: BroadcastChannel | null = null;
      try {
        channel = new BroadcastChannel(channelName);
        channel.postMessage(event);
        return;
      } catch {
        // Fall through to the storage-event transport when BroadcastChannel is blocked.
      } finally {
        channel?.close();
      }
    }

    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        storageEventKey,
        JSON.stringify({
          event,
          nonce: `${Date.now()}_${Math.random()}`,
        }),
      );
    } catch {
      // ignore storage errors
    }
  };

  const subscribe = (handler: (event: SessionEvent) => void) => {
    const snapshot = readSessionSnapshot(boardId);
    if (snapshot) {
      handler({
        type: "FLOW_RUN",
        boardId,
        flowId: snapshot.flowId,
        stepId: snapshot.stepId,
        stepIndex: snapshot.stepIndex,
        target: snapshot.target,
        label: snapshot.label,
        currentStep: snapshot.currentStep,
        ts: snapshot.ts,
      });
    }

    const handleChannelMessage = (message: MessageEvent) => {
      const payload = message.data as SessionEvent | undefined;
      if (!payload || payload.boardId !== boardId) return;
      handler(payload);
    };

    const handleStorageMessage = (event: StorageEvent) => {
      if (event.key !== storageEventKey || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as { event?: SessionEvent };
        if (!parsed?.event || parsed.event.boardId !== boardId) return;
        handler(parsed.event);
      } catch {
        // ignore parse errors
      }
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(channelName);
        channel.addEventListener("message", handleChannelMessage);
      } catch {
        channel = null;
      }
    }
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageMessage);
    }

    return () => {
      channel?.removeEventListener("message", handleChannelMessage);
      channel?.close();
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageMessage);
      }
    };
  };

  return { publish, subscribe };
}
