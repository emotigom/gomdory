export type BodyReadResult = { ok: true; body: string } | { ok: false; tooLarge: true };
export function contentLengthExceeds(headers: Headers, limit: number): boolean {
  const raw = headers.get("content-length"); if (raw === null || !/^\d+$/.test(raw.trim())) return false;
  const size = Number(raw); return Number.isSafeInteger(size) && size >= 0 && size > limit;
}
export async function readBodyWithinLimit(request: Pick<Request, "body">, limit: number): Promise<BodyReadResult> {
  if (!request.body) return { ok: true, body: "" }; const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); return { ok: false, tooLarge: true }; } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return { ok: true, body: new TextDecoder().decode(body) };
}
