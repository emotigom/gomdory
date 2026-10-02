export function normalizeChatOutcome(value: unknown): "local" | "remote" | "coach" | "retryShown" | null {
  if (value === "local" || value === "remote" || value === "coach" || value === "retryShown") return value;
  if (value === "retry_shown") return "retryShown";
  return null;
}
