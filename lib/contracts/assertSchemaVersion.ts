type ReportUiError = (input: {
  message: string;
  stack?: string | null;
  route?: string | null;
  requestId?: string | null;
}) => void | Promise<void>;

type SchemaVersionContext = {
  endpoint?: string;
  requestId?: string;
  label?: string;
  reportUiError?: ReportUiError;
};

const reportedKeys = new Set<string>();

export function assertSchemaVersion(
  actual: unknown,
  expected: number | string,
  ctx?: SchemaVersionContext,
): void {
  if (actual === expected) return;

  const actualValue =
    typeof actual === "number" || typeof actual === "string" ? actual : "missing";
  const logPayload = {
    level: "warn",
    stage: "schema_version_mismatch",
    expected,
    actual: actualValue,
    endpoint: ctx?.endpoint ?? null,
    requestId: ctx?.requestId ?? null,
    label: ctx?.label ?? null,
  };

  console.warn(JSON.stringify(logPayload));

  if (!ctx?.reportUiError) return;

  const dedupeKey = `${ctx.endpoint ?? "unknown"}:${expected}:${actualValue}`;
  if (reportedKeys.has(dedupeKey)) return;
  reportedKeys.add(dedupeKey);

  void ctx.reportUiError({
    message: "schema_version_mismatch",
    stack: JSON.stringify(logPayload),
    route: ctx.endpoint ?? null,
    requestId: ctx.requestId ?? null,
  });
}
