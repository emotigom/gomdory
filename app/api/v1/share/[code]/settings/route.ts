import { getBoardShareSettingsByCode } from "@/lib/data/share";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { computeContractHash } from "@/lib/contracts/contractHash";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { getOrCreateRequestId } from "@/lib/http/requestId";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const requestId = getOrCreateRequestId(request);

  try {
    const settings = await getBoardShareSettingsByCode(code);

    if (!settings) {
      return jsonErrorWithRequestId("invalid_code", "invalid_code", requestId, 404);
    }

    const data = { settings };
    const schemaVersion = SCHEMA_VERSIONS.shareSettings;
    const contractHash = computeContractHash(data);
    return jsonOkWithRequestId({ schemaVersion, contractHash, ...data }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "기본 설정을 불러오지 못했습니다.";
    return jsonErrorWithRequestId("fetch_failed", message, requestId, 400);
  }
}
