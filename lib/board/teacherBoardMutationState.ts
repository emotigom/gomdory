export type TeacherBoardMutationPhase =
  | "idle"
  | "pending"
  | "awaiting-confirmation"
  | "reconciling"
  | "confirmed"
  | "retryable-error"
  | "terminal-error";

export type TeacherBoardMutationResult =
  | "confirmed"
  | "rolled-back"
  | "reconciled"
  | "retryable-error"
  | "terminal-error";

export type TeacherBoardMutationKind = "visibility" | "move";

export type TeacherBoardOperation = {
  id: string;
  kind: TeacherBoardMutationKind;
  targetId: string;
  expectedVersion: number | null;
};

export type TeacherBoardMutationState = {
  phase: TeacherBoardMutationPhase;
  operation: TeacherBoardOperation | null;
  result: TeacherBoardMutationResult | null;
  staleResponsesIgnored: number;
};

export const idleTeacherBoardMutationState = (): TeacherBoardMutationState => ({
  phase: "idle",
  operation: null,
  result: null,
  staleResponsesIgnored: 0,
});

// The sequence is caller-owned so identities are stable without timestamps or randomness.
export const createTeacherBoardOperation = (
  kind: TeacherBoardMutationKind,
  targetId: string,
  expectedVersion: number | null,
  sequence: number,
): TeacherBoardOperation => ({
  id: `${kind}:${targetId}:${expectedVersion ?? "none"}:${sequence}`,
  kind,
  targetId,
  expectedVersion,
});

export const startTeacherBoardMutation = (
  current: TeacherBoardMutationState,
  operation: TeacherBoardOperation,
): TeacherBoardMutationState => {
  if (current.operation?.id === operation.id || current.phase === "pending") return current;
  return { ...current, phase: "pending", operation, result: null };
};

export const rejectStaleTeacherBoardResponse = (
  current: TeacherBoardMutationState,
  operationId: string,
): TeacherBoardMutationState =>
  current.operation?.id === operationId
    ? current
    : { ...current, staleResponsesIgnored: current.staleResponsesIgnored + 1 };

export const confirmTeacherBoardMutation = (
  current: TeacherBoardMutationState,
  operationId: string,
): TeacherBoardMutationState => {
  if (current.operation?.id !== operationId) return rejectStaleTeacherBoardResponse(current, operationId);
  return { ...current, phase: "confirmed", operation: null, result: "confirmed" };
};

export const reconcileTeacherBoardMutation = (
  current: TeacherBoardMutationState,
  operationId: string,
): TeacherBoardMutationState => {
  if (current.operation?.id !== operationId) return rejectStaleTeacherBoardResponse(current, operationId);
  return { ...current, phase: "reconciling", result: "reconciled" };
};

export const failTeacherBoardMutation = (
  current: TeacherBoardMutationState,
  operationId: string,
  terminal: boolean,
): TeacherBoardMutationState => {
  if (current.operation?.id !== operationId) return rejectStaleTeacherBoardResponse(current, operationId);
  return {
    ...current,
    phase: terminal ? "terminal-error" : "retryable-error",
    operation: null,
    result: terminal ? "terminal-error" : "retryable-error",
  };
};

export const isNewerTeacherBoardVersion = (
  next: number | null | undefined,
  current: number | null | undefined,
) => typeof next === "number" && (typeof current !== "number" || next > current);

export const isStaleTeacherBoardVersion = (
  next: number | null | undefined,
  current: number | null | undefined,
) => typeof next === "number" && typeof current === "number" && next < current;
