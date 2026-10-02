export const ErrorCodes = {
  validationFailed: "validation_failed",
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  notFound: "not_found",
  rateLimited: "rate_limited",
  upstreamFailed: "upstream_failed",
  dbFailed: "db_failed",
  timeout: "timeout",
  unknown: "unknown",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export function toHttpStatus(code: ErrorCode): number {
  switch (code) {
    case ErrorCodes.validationFailed:
      return 400;
    case ErrorCodes.unauthorized:
      return 401;
    case ErrorCodes.forbidden:
      return 403;
    case ErrorCodes.notFound:
      return 404;
    case ErrorCodes.rateLimited:
      return 429;
    case ErrorCodes.upstreamFailed:
    case ErrorCodes.dbFailed:
      return 502;
    case ErrorCodes.timeout:
      return 504;
    case ErrorCodes.unknown:
    default:
      return 500;
  }
}
