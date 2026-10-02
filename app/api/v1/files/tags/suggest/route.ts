export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { listBoardFileTagSuggestions } from "@/lib/data/boardFiles";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { getOrCreateRequestId } from "@/lib/http/requestId";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  listBoardFileTagSuggestionsFn?: typeof listBoardFileTagSuggestions;
};

export async function GET(request: Request, _context?: unknown, deps?: Dependencies) {
  const requestId = getOrCreateRequestId(request);
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const listTags = deps?.listBoardFileTagSuggestionsFn ?? listBoardFileTagSuggestions;

  try {
    await ensureUser();
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  try {
    const tags = await listTags({ days: 60, limit: 12 });
    return jsonOkWithRequestId({ tags }, requestId, withNoStoreHeaders());
  } catch (error) {
    const message = error instanceof Error ? error.message : "태그를 불러오지 못했습니다.";
    return jsonErrorWithRequestId("SUGGEST_FAILED", message, requestId, 400, undefined, withNoStoreHeaders());
  }
}
