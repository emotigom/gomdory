import type { LiveSnapshot, LiveSnapshotShareable } from "@/lib/data/liveSession";
import { getBoardLiveSession, getLiveSessionByShareCode } from "@/lib/data/liveSession";
import type { LiveStatus, LiveWarning } from "@/lib/live/liveResponse";

const DEFAULT_TIMEOUT_MS = 2500;

type LiveSnapshotResult = {
  status: LiveStatus;
  snapshot: LiveSnapshot | LiveSnapshotShareable | null;
  warning?: LiveWarning;
  session?: { snapshot: LiveSnapshot; version: number; updated_at: string } | null;
};

type WithTimeoutOptions = {
  timeoutMs?: number;
};

type BoardSnapshotOptions = WithTimeoutOptions & {
  getBoardLiveSessionFn?: typeof getBoardLiveSession;
};

type ShareSnapshotOptions = WithTimeoutOptions & {
  getLiveSessionByShareCodeFn?: typeof getLiveSessionByShareCode;
};

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutLabel: string,
): Promise<T> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort(timeoutLabel);
      reject(new Error(timeoutLabel));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function noLiveSessionWarning(): LiveWarning {
  return {
    code: "no_live_session_yet",
    message: "라이브 세션이 아직 시작되지 않았습니다.",
  };
}

function liveFetchFailedWarning(): LiveWarning {
  return {
    code: "live_fetch_failed",
    message: "라이브 세션을 불러오지 못해 초기 상태로 표시합니다.",
  };
}

export async function getLiveSnapshotByBoard(
  boardId: string,
  options?: BoardSnapshotOptions,
): Promise<LiveSnapshotResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const loadSession = options?.getBoardLiveSessionFn ?? getBoardLiveSession;

  try {
    const session = await withTimeout(() => loadSession(boardId), timeoutMs, "live_session_timeout");
    if (!session?.snapshot) {
      return { status: "uninitialized", snapshot: null, warning: noLiveSessionWarning(), session: null };
    }

    const snapshot = session.snapshot;
    const status: LiveStatus = snapshot.activeSessionId ? "active" : "idle";
    return { status, snapshot, session };
  } catch {
    return { status: "uninitialized", snapshot: null, warning: liveFetchFailedWarning(), session: null };
  }
}

export async function getLiveSnapshotByShareCode(
  code: string,
  options?: ShareSnapshotOptions,
): Promise<LiveSnapshotResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const loadSession = options?.getLiveSessionByShareCodeFn ?? getLiveSessionByShareCode;

  try {
    const snapshot = await withTimeout(() => loadSession(code), timeoutMs, "live_share_timeout");
    if (!snapshot) {
      return { status: "uninitialized", snapshot: null, warning: noLiveSessionWarning(), session: null };
    }

    const status: LiveStatus = snapshot.activeSessionId ? "active" : "idle";
    return { status, snapshot, session: null };
  } catch {
    return { status: "uninitialized", snapshot: null, warning: liveFetchFailedWarning(), session: null };
  }
}
