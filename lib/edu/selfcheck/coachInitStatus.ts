export type CoachInitStatus = "idle" | "attempting" | "loaded" | "failed" | "skipped";

export type CoachInitTransition = {
  attempted: boolean;
  status: CoachInitStatus;
  reasonCode: string | null;
};

export const resolveCoachInitPrecondition = (input: {
  healthReady: boolean;
  hardDisabled: boolean;
  coachModelId: string | null;
  coachWasmUrl: string | null;
  webGpuSupported: boolean;
}): CoachInitTransition => {
  if (!input.healthReady) return { attempted: false, status: "skipped", reasonCode: "health_not_ready" };
  if (input.hardDisabled) return { attempted: false, status: "skipped", reasonCode: "hard_disabled" };
  if (!input.coachModelId || !input.coachWasmUrl) {
    return { attempted: false, status: "skipped", reasonCode: "coach_config_missing" };
  }
  if (!input.webGpuSupported) return { attempted: false, status: "skipped", reasonCode: "webgpu_unsupported" };
  return { attempted: true, status: "attempting", reasonCode: null };
};

export const finalizeCoachInit = (input: {
  ok: boolean;
  aborted?: boolean;
}): CoachInitTransition => {
  if (input.ok) return { attempted: true, status: "loaded", reasonCode: null };
  if (input.aborted) return { attempted: true, status: "failed", reasonCode: "aborted" };
  return { attempted: true, status: "failed", reasonCode: "init_failed" };
};
