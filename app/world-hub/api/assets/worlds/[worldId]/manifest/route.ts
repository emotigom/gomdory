import { NextResponse } from "next/server";

import { getEdgeWorldHubAssetManifest } from "@/lib/world-hub/assets/edgeRouteData";

export async function GET(
  _request: Request,
  context: { params: Promise<{ worldId: string }> },
) {
  const { worldId } = await context.params;
  const manifest = getEdgeWorldHubAssetManifest(worldId);

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
