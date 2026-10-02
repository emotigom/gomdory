import "server-only";

import {
  applyRequestContextHeaders as canonicalApplyRequestContextHeaders,
  getOrCreateRequestId as canonicalGetOrCreateRequestId,
  withRequestContext as canonicalWithRequestContext,
  type RequestContext as CanonicalRequestContext,
} from "@/lib/api/server/requestContext";
import {
  logWithContext as canonicalLogWithContext,
  type LogWithContextInput as CanonicalLogWithContextInput,
} from "@/lib/ops/logWithContext";

/**
 * Compatibility shim for older ops-facing imports.
 *
 * Canonical owner:
 * - request-id/request-context plumbing → `@/lib/api/server/requestContext`
 * - ops structured logging → `@/lib/ops/logWithContext`
 *
 * Keep this module rollback-safe, but do not use it for new imports.
 */

/** @deprecated Import `RequestContext` from `@/lib/api/server/requestContext` instead. */
export type RequestContext = CanonicalRequestContext;

/** @deprecated Import `applyRequestContextHeaders` from `@/lib/api/server/requestContext` instead. */
export const applyRequestContextHeaders = canonicalApplyRequestContextHeaders;

/** @deprecated Import `getOrCreateRequestId` from `@/lib/api/server/requestContext` instead. */
export const getOrCreateRequestId = canonicalGetOrCreateRequestId;

/** @deprecated Import `withRequestContext` from `@/lib/api/server/requestContext` instead. */
export const withRequestContext = canonicalWithRequestContext;

/** @deprecated Import `LogWithContextInput` from `@/lib/ops/logWithContext` instead. */
export type LogWithContextInput = CanonicalLogWithContextInput;

/** @deprecated Import `logWithContext` from `@/lib/ops/logWithContext` instead. */
export const logWithContext = canonicalLogWithContext;
