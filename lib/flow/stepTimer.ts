export type StepTimerSnapshot = {
  startedAt: number;
  seconds: number;
  paused?: boolean;
  pausedAt?: number;
};

export function getRemainingSeconds(
  { startedAt, seconds, paused, pausedAt }: StepTimerSnapshot,
  now: number = Date.now(),
) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  const effectiveNow = paused && typeof pausedAt === "number" ? pausedAt : now;
  const elapsedSeconds = Math.max(0, Math.floor((effectiveNow - startedAt) / 1000));
  return Math.max(0, Math.round(seconds - elapsedSeconds));
}
