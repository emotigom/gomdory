export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { findBoardFileByHash, type BoardFile } from "@/lib/data/boardFiles";
import { getOrCreateRequestId } from "@/lib/http/requestId";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  findBoardFileByHashFn?: typeof findBoardFileByHash;
};

type DedupCheckPayload = {
  sha256?: string | null;
  sizeBytes?: number | null;
  mime?: string | null;
};

function isValidSha256(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length >= 32 && trimmed.length <= 128;
}

export async function POST(request: Request, _context?: unknown, deps?: Dependencies) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const findFile = deps?.findBoardFileByHashFn ?? findBoardFileByHash;
  const requestId = getOrCreateRequestId(request);

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const payload = (await request.json().catch(() => null)) as DedupCheckPayload | null;
  if (!payload || !isValidSha256(payload.sha256)) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  try {
    const existing = await findFile({
      ownerId: userId ?? "",
      sha256: payload.sha256 ?? "",
    });

    const file = existing ? (existing as BoardFile) : undefined;
    return jsonOkWithRequestId(
      {
        exists: Boolean(existing),
        file,
      },
      requestId,
      withNoStoreHeaders(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "중복을 확인하지 못했습니다.";
    return jsonErrorWithRequestId("DEDUP_CHECK_FAILED", message, requestId, 400, undefined, withNoStoreHeaders());
  }
}
