import { digestHex } from "@/lib/crypto/webcrypto";
import type { NetworkSaverMode, NetworkSaverTier } from "@/lib/edu/netsaver/config";

export type EndClassPhase = "idle" | "stopping" | "resetting" | "done" | "error";

type EndClassNetsaverState = {
  mode?: NetworkSaverMode;
  tier?: NetworkSaverTier;
  boostUntil?: number | null;
  downgraded?: boolean;
  seedLiteReady?: boolean;
  prewarmResults?: Record<string, string> | null;
};

type EndClassArgs = {
  boardId: string;
  classCodeHash?: string | null;
  netsaverState?: EndClassNetsaverState;
  forceQuiet: () => void | Promise<void>;
  stopBroadcasts: () => void | Promise<void>;
  abortInFlight: () => void | Promise<void>;
  clearSessionState: () => void | Promise<void>;
  recordEduEvent: (input: {
    type: string;
    boardId: string;
    codeHash?: string | null;
    extra?: Record<string, unknown>;
  }) => Promise<void> | void;
  toast?: (message: string) => void;
  signal?: AbortSignal;
};

const TOTAL_TIMEOUT_MS = 20_000;

const combineSignals = (signals: Array<AbortSignal | undefined>) => {
  const activeSignals = signals.filter(Boolean) as AbortSignal[];
  if (activeSignals.length === 0) return undefined;
  if (activeSignals.length === 1) return activeSignals[0];
  const controller = new AbortController();
  const handleAbort = () => controller.abort();
  activeSignals.forEach((signal) => {
    if (signal.aborted) {
      handleAbort();
      return;
    }
    signal.addEventListener("abort", handleAbort, { once: true });
  });
  return controller.signal;
};

const deriveBoardHash = async (boardId: string) => {
  try {
    const digest = await digestHex("SHA-256", boardId);
    return digest.slice(0, 12);
  } catch {
    return null;
  }
};

export async function runEndClass({
  boardId,
  classCodeHash,
  netsaverState,
  forceQuiet,
  stopBroadcasts,
  abortInFlight,
  clearSessionState,
  recordEduEvent,
  toast,
  signal,
}: EndClassArgs): Promise<{
  ok: boolean;
  partial?: boolean;
  reason?: string;
  summary?: Record<string, unknown>;
}> {
  const safeToast = toast ?? (() => {});
  const overallController = new AbortController();
  const timeoutId = window.setTimeout(() => overallController.abort(), TOTAL_TIMEOUT_MS);
  const combinedSignal = combineSignals([signal, overallController.signal]);
  const startedAt = Date.now();
  let partial = false;
  let reason: string | undefined;
  const failures: string[] = [];

  const codeHash = classCodeHash ?? (await deriveBoardHash(boardId));
  const mode = netsaverState?.mode ?? "unknown";
  const boostUntil = netsaverState?.boostUntil ?? null;
  const boostActive = typeof boostUntil === "number" && boostUntil > startedAt;
  const seedLiteReady = Boolean(netsaverState?.seedLiteReady);
  const summary: Record<string, unknown> = {
    mode,
    boostActive,
    seedLiteReady,
    prewarm: netsaverState?.prewarmResults ?? undefined,
    downgraded: netsaverState?.downgraded ?? undefined,
  };

  const recordEvent = (type: string, extra?: Record<string, unknown>) => {
    try {
      void recordEduEvent({
        type,
        boardId,
        codeHash: codeHash ?? undefined,
        extra,
      });
    } catch {
      // ignore
    }
  };

  const noteFailure = (label: string, error?: unknown) => {
    partial = true;
    failures.push(label);
    if (!reason) {
      if (error instanceof Error) {
        reason = error.message;
      } else if (typeof error === "string") {
        reason = error;
      } else {
        reason = label;
      }
    }
  };

  const shouldAbort = () => combinedSignal?.aborted;

  const safeCall = async (label: string, fn: () => void | Promise<void>) => {
    if (shouldAbort()) {
      noteFailure("timeout");
      return;
    }
    try {
      await Promise.resolve(fn());
    } catch (error) {
      noteFailure(label, error);
    }
  };

  try {
    recordEvent("endclass_start", { mode, boostActive, seedLiteReady });

    await safeCall("abort_inflight", abortInFlight);
    await safeCall("force_quiet", forceQuiet);
    await safeCall("stop_broadcasts", stopBroadcasts);

    await safeCall("clear_session", clearSessionState);

    if (combinedSignal?.aborted) {
      reason = signal?.aborted ? "aborted" : "timeout";
      partial = true;
    }

    if (partial) {
      recordEvent("endclass_partial_fail", {
        reason,
        failures,
      });
    }

    recordEvent("endclass_done", {
      ...summary,
      partial,
      reason,
    });

    if (partial) {
      safeToast("일부 정리 실패, 그래도 완료되었습니다.");
    }

    return { ok: true, partial, reason, summary };
  } catch (error) {
    noteFailure("endclass_failed", error);
    recordEvent("endclass_partial_fail", { reason, failures });
    recordEvent("endclass_done", { ...summary, partial: true, reason });
    safeToast("정리 중 일부 문제가 있었지만 수업 종료는 완료됩니다.");
    return { ok: false, partial: true, reason, summary };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
