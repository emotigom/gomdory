const BOARD_FORBIDDEN_PATTERNS = ["forbidden", "permission", "unauthorized", "403"];
const BOARD_NOT_FOUND_PATTERNS = ["not found", "no rows", "404", "pgrst116"];

export type BoardRouteFailureReason = "forbidden" | "not-found" | "unknown";

function resolveErrorMessage(error: Error & { cause?: unknown } | null | undefined): string {
  if (!error) return "";

  const parts = [
    error.message,
    typeof error.cause === "string" ? error.cause : null,
    error.cause instanceof Error ? error.cause.message : null,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  return parts.join(" ").toLowerCase();
}

export function resolveBoardRouteFailureReason(error: Error & { cause?: unknown } | null | undefined): BoardRouteFailureReason {
  const message = resolveErrorMessage(error);

  if (BOARD_FORBIDDEN_PATTERNS.some((pattern) => message.includes(pattern))) {
    return "forbidden";
  }

  if (BOARD_NOT_FOUND_PATTERNS.some((pattern) => message.includes(pattern))) {
    return "not-found";
  }

  return "unknown";
}

