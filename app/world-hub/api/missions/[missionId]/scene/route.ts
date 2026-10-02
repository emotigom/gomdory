import { NextResponse } from "next/server";

import { getEdgeMissionSceneTemplate } from "@/lib/world-hub/mission/manifest/edgeRouteData";

export async function GET(
  _request: Request,
  context: { params: Promise<{ missionId: string }> },
) {
  const { missionId } = await context.params;
  const sceneTemplate = getEdgeMissionSceneTemplate(missionId);

  if (!sceneTemplate) {
    return NextResponse.json({ error: "mission_scene_config_unavailable" }, { status: 404 });
  }

  return NextResponse.json(sceneTemplate, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
