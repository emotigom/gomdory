import { NextResponse } from "next/server";

import { getEdgeWorldHubManifest } from "@/lib/world-hub/manifest/edgeRouteData";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const manifest = getEdgeWorldHubManifest(searchParams.get("worldId"));

  if (!manifest) {
    return NextResponse.json({ error: "world_hub_manifest_unavailable" }, { status: 404 });
  }

  return NextResponse.json(manifest, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
