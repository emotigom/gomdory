export const toDelayBucket = (ms?: number) => {
  if (typeof ms !== "number") return "none" as const;
  if (ms < 2000) return "fast" as const;
  if (ms < 8000) return "normal" as const;
  return "slow" as const;
};

export const toPreviewAgeBucket = (ms?: number) => {
  if (typeof ms !== "number") return "none" as const;
  return ms < 10_000 ? "fresh" : "aged";
};

export const toSatisfactionProxy = (input: {
  applied: boolean;
  undoneAfterApply: boolean;
  abandonedPreview: boolean;
  staleInvalidated: boolean;
}) => {
  if (input.applied && !input.undoneAfterApply) return "positive" as const;
  if (input.undoneAfterApply || input.abandonedPreview || input.staleInvalidated) return "negative" as const;
  return "neutral" as const;
};
