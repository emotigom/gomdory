import { digestHex } from "@/lib/crypto/webcrypto";
import { subscribeAutoDowngradeEvents } from "@/lib/edu/netsaver/autoDowngrade";
import type { NetworkSaverMode, NetworkSaverTier } from "@/lib/edu/netsaver/config";
import type { PrewarmPlan, runPrewarm as runPrewarmFn } from "@/lib/edu/prewarm";

export type StartClassPhase = "idle" | "prewarm" | "boost" | "quiet" | "done" | "error";

export type StartClassOptions = {
  durationPrewarmMs?: number;
  durationBoostMs?: number;
  allowAuto?: boolean;
};

type StartClassNetsaverState = {
  mode?: NetworkSaverMode;
  tier?: NetworkSaverTier;
  p2pProbeStatus?: "idle" | "pass" | "fail";
  downgraded?: boolean;
};

type StartClassBoostResult = {
  ok: boolean;
  reason?: string;
  downgraded?: boolean;
};

type StartClassArgs = {
  boardId: string;
  classCodeHash?: string | null;
  netsaverState?: StartClassNetsaverState;
  runPrewarm: typeof runPrewarmFn;
  startBoost: (durationMs: number) => Promise<StartClassBoostResult | void>;
  stopBoostAndQuiet: () => void | Promise<void>;
  setPhase: (phase: StartClassPhase) => void;
  recordEduEvent: (input: {
    type: string;
    boardId: string;
    codeHash?: string | null;
    extra?: Record<string, unknown>;
  }) => Promise<void> | void;
  toast?: (message: string) => void;
  signal?: AbortSignal;
  options?: StartClassOptions;
};

const TOTAL_TIMEOUT_MS = 180_000;

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

const waitFor = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (!Number.isFinite(ms) || ms <= 0) {
      resolve();
      return;
    }
    const timeoutId = window.setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(timeoutId);
          resolve();
        },
        { once: true },
      );
    }
  });

const deriveBoardHash = async (boardId: string) => {
  try {
    const digest = await digestHex("SHA-256", boardId);
    return digest.slice(0, 12);
  } catch {
    return null;
  }
};

export async function runStartClass({
  boardId,
  classCodeHash,
  netsaverState,
  runPrewarm,
  startBoost,
  stopBoostAndQuiet,
  setPhase,
  recordEduEvent,
  toast,
  signal,
  options,
}: StartClassArgs): Promise<{ ok: boolean; partial?: boolean; reason?: string }> {
  const resolvedOptions: Required<StartClassOptions> = {
    durationPrewarmMs: 30_000,
    durationBoostMs: 120_000,
    allowAuto: true,
    ...options,
  };
  const plan: PrewarmPlan = {
    wasm: true,
    config: true,
    tokenizer: true,
    shards: false,
  };
  const safeToast = toast ?? (() => {});
  const overallController = new AbortController();
  const timeoutId = window.setTimeout(() => overallController.abort(), TOTAL_TIMEOUT_MS);
  const combinedSignal = combineSignals([signal, overallController.signal]);
  const startAt = Date.now();
  const codeHash = classCodeHash ?? (await deriveBoardHash(boardId));
  const mode = netsaverState?.mode ?? "unknown";
  let partial = false;
  let reason: string | undefined;
  let quieted = false;
  let autoDowngraded = false;
  let autoDowngradeReason: string | null = null;
  const ensureQuiet = async () => {
    if (quieted) return;
    quieted = true;
    await Promise.resolve(stopBoostAndQuiet());
  };

  const recordEvent = (type: string, extra?: Record<string, unknown>) => {
    void recordEduEvent({
      type,
      boardId,
      codeHash: codeHash ?? undefined,
      extra,
    });
  };

  let unsubscribe: (() => void) | null = null;
  try {
    setPhase("prewarm");
    recordEvent("startclass_start", { mode });

    const prewarmResult = await runPrewarm({
      plan,
      durationMs: resolvedOptions.durationPrewarmMs,
      netsaverState: {
        ...netsaverState,
        boardId,
      },
      signal: combinedSignal,
    });

    if (!prewarmResult.ok) {
      partial = true;
      safeToast("사전 준비 일부 실패, 그래도 진행합니다.");
    }

    const shouldBoost =
      resolvedOptions.allowAuto &&
      netsaverState?.mode === "auto" &&
      !netsaverState?.downgraded &&
      !combinedSignal?.aborted;

    if (shouldBoost) {
      setPhase("boost");
      recordEvent("startclass_boost_start");

      unsubscribe = subscribeAutoDowngradeEvents((event) => {
        if (!codeHash || event.codeHash !== codeHash) return;
        autoDowngraded = true;
        autoDowngradeReason = event.reason;
        partial = true;
        recordEvent("netsaver_auto_downgrade", { reason: event.reason, source: "startclass" });
        void ensureQuiet();
      });

      try {
        const boostResult = await startBoost(resolvedOptions.durationBoostMs);
        if (boostResult && boostResult.ok === false) {
          reason = boostResult.reason ?? "boost_failed";
        }
        if (boostResult && boostResult.downgraded) {
          autoDowngraded = true;
          partial = true;
          recordEvent("netsaver_auto_downgrade", { reason: "boost_start", source: "startclass" });
          await ensureQuiet();
        }
      } catch (error) {
        reason = error instanceof Error ? error.message : "boost_failed";
      }

      if (!autoDowngraded && !combinedSignal?.aborted) {
        const remainingBudget = Math.max(0, TOTAL_TIMEOUT_MS - (Date.now() - startAt));
        const waitMs = Math.min(resolvedOptions.durationBoostMs, remainingBudget);
        await waitFor(waitMs, combinedSignal);
      }

      recordEvent("startclass_boost_end", { aborted: combinedSignal?.aborted || false });
    }

    setPhase("quiet");
    await ensureQuiet();
    recordEvent("startclass_quiet", {
      autoDowngraded,
      reason: autoDowngradeReason ?? undefined,
    });

    setPhase("done");
    recordEvent("startclass_done", { partial });

    return { ok: true, partial, reason };
  } catch (error) {
    partial = true;
    reason = error instanceof Error ? error.message : "startclass_failed";
    setPhase("error");
    await ensureQuiet();
    recordEvent("startclass_error", { reason });
    setPhase("done");
    recordEvent("startclass_done", { partial, reason });
    return { ok: false, partial, reason };
  } finally {
    window.clearTimeout(timeoutId);
    unsubscribe?.();
  }
}
