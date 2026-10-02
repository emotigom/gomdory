export type StudentExecutionRequestIdOwnership = "new" | "existing" | "none";

export type StudentExecutionBlockedReasonCategory =
  | "input"
  | "state"
  | "availability"
  | "concurrency"
  | "policy";

export type StudentExecutionDispatchMode = "start" | "retry" | "apply";

export const resolveStudentExecutionRequestIdOwnership = (
  requestId: string | null | undefined,
): StudentExecutionRequestIdOwnership => {
  return requestId ? "existing" : "none";
};

export const resolveStudentExecutionRetryMode = <TSource extends string>(input: {
  source: TSource;
  retrySources: readonly TSource[];
}): Extract<StudentExecutionDispatchMode, "start" | "retry"> => {
  return input.retrySources.includes(input.source) ? "retry" : "start";
};
