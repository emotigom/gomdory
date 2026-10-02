const UNSAFE_SERVER_ERROR_PATTERNS = [
  /null value in column/i,
  /violates not-null constraint/i,
  /duplicate key value/i,
  /insert or update on table/i,
  /syntax error at or near/i,
  /postgres/i,
];

type SafeErrorMessageOptions = {
  fallback: string;
};

type ErrorLikeRecord = {
  detail?: unknown;
  error?: unknown;
  message?: unknown;
};

function containsUnsafeServerError(message: string): boolean {
  return UNSAFE_SERVER_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function safeErrorMessage(error: unknown, options: SafeErrorMessageOptions): string {
  if (!(error instanceof Error)) {
    return options.fallback;
  }

  const message = error.message.trim();
  if (!message || containsUnsafeServerError(message)) {
    return options.fallback;
  }

  return message;
}

export function safeDisplayMessage(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error && value.message) {
    return value.message;
  }

  if (value && typeof value === "object") {
    const record = value as ErrorLikeRecord;
    if (typeof record.message === "string") {
      return record.message;
    }
    if (typeof record.error === "string") {
      return record.error;
    }
    if (typeof record.detail === "string") {
      return record.detail;
    }
  }

  return fallback;
}
