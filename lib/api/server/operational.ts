import "server-only";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import {
  jsonErrorWithRequestId,
  jsonOkWithRequestId,
  type JsonData,
} from "@/lib/api/server/response";

export function jsonOperationalOk<T extends JsonData = Record<string, unknown>>(
  data: T,
  requestId: string,
  init?: ResponseInit,
): Response {
  return jsonOkWithRequestId(data, requestId, withNoStoreHeaders(init));
}

export function jsonOperationalError<T extends Record<string, unknown>>(
  code: string,
  message: string | undefined,
  requestId: string,
  status = 400,
  extra?: T,
  init?: ResponseInit,
): Response {
  return jsonErrorWithRequestId(code, message, requestId, status, extra, withNoStoreHeaders(init));
}
