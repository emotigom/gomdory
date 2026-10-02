import type { Metadata } from "next";

import { parseRecentMissionResultReturnFromSearchParams, WORLD_HUB_MISSION_RESULT_QUERY_KEY } from "@/lib/world-hub/mission/resultHandoff";

import { WorldHubRouteClient } from "./WorldHubRouteClient";

export const metadata: Metadata = {
  title: "숲속 모험 베이스캠프",
  description: "따뜻한 숲속 베이스캠프에서 오늘의 모험을 고르는 학생 월드 허브입니다.",
};

export default async function WorldHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const launchClassIdRaw = resolvedSearchParams.classId;
  const launchClassId = typeof launchClassIdRaw === "string" && launchClassIdRaw.trim().length > 0 ? launchClassIdRaw.trim() : null;
  const recentMissionResult = parseRecentMissionResultReturnFromSearchParams({
    resultParam: resolvedSearchParams[WORLD_HUB_MISSION_RESULT_QUERY_KEY],
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),#0f172a_28%,#020617_72%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <WorldHubRouteClient launchClassId={launchClassId} recentMissionResult={recentMissionResult} />
      </div>
    </main>
  );
}
