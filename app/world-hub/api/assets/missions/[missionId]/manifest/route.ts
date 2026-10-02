import { NextResponse } from "next/server";

import { getEdgeMissionRoomAssetManifest } from "@/lib/world-hub/assets/edgeRouteData";

export async function GET(
  _request: Request,
  context: { params: Promise<{ missionId: string }> },
) {
  const { missionId } = await context.params;
  const manifest = getEdgeMissionRoomAssetManifest(missionId);

  if (!manifest) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      "cache-control": "no-store",
    },
  });
}
