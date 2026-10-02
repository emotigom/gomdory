import { MAX_REQUEST_BYTES, type GenerateBatchRequest } from "./contracts";
import { contentLengthExceeds, readBodyWithinLimit } from "./bodyReader";
import { parseGenerateBatchRequest, type StudentRecordsInvalidRequestReason } from "./requestContract";

export type ParsedGenerateRequest = { ok: true; value: GenerateBatchRequest } | { ok: false; status: 400 | 413; reason?: StudentRecordsInvalidRequestReason; bodyByteLength?: number; rowCount?: number };
export async function parseStudentRecordsGenerateRequest(request: Request): Promise<ParsedGenerateRequest> {
  if (contentLengthExceeds(request.headers, MAX_REQUEST_BYTES)) return { ok: false, status: 413 };
  const read = await readBodyWithinLimit(request, MAX_REQUEST_BYTES);
  if (!read.ok) return { ok: false, status: 413 };
  const bodyByteLength = new TextEncoder().encode(read.body).byteLength;
  let json: unknown;
  try { json = JSON.parse(read.body) as unknown; } catch { return { ok: false, status: 400, reason: "malformed-json", bodyByteLength }; }
  const parsed = parseGenerateBatchRequest(json);
  return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, status: 400, reason: parsed.safeReason, bodyByteLength, rowCount: parsed.rowCount };
}
