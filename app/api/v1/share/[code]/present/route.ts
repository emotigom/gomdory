import { loadPresentSnapshot } from "@/app/s/[code]/present/loadPresentData";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { computeContractHash } from "@/lib/contracts/contractHash";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { getOrCreateRequestId } from "@/lib/http/requestId";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { searchParams } = new URL(request.url);
  const wallId = searchParams.get("wall");
  const { code } = await params;
  const requestId = getOrCreateRequestId(request);

  try {
    const snapshot = await loadPresentSnapshot(code, wallId);

    if (!snapshot) {
      return jsonErrorWithRequestId(
        "SNAPSHOT_NOT_FOUND",
        "유효하지 않은 코드이거나 만료된 공유 링크입니다.",
        requestId,
        404,
      );
    }

    const data = snapshot as Record<string, unknown>;
    const schemaVersion = SCHEMA_VERSIONS.sharePresent;
    const contractHash = computeContractHash(data);

    return jsonOkWithRequestId(
      { schemaVersion, contractHash, ...data },
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.";
    return jsonErrorWithRequestId("PRESENT_FAILED", message, requestId, 400);
  }
}
