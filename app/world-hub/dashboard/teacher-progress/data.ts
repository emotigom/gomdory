import { readMetaverseLaunchControlState } from "@/lib/world-hub/launch/adapter";
import { readTeacherDashboardMetaverseSummary } from "@/lib/world-hub/dashboard/teacherProgressAdapter";
import { resolveTeacherDashboardMetaverseContext } from "@/lib/world-hub/dashboard/teacherProgressContext";

export async function readTeacherMetaverseProgressSurface(args: {
  classId: string;
  boardIds: string[];
  ownerUserId: string;
}) {
  const classroom = await resolveTeacherDashboardMetaverseContext({
    classId: args.classId,
    boardIds: args.boardIds,
    ownerUserId: args.ownerUserId,
  });

  const [summary, launchControls] = await Promise.all([
    readTeacherDashboardMetaverseSummary({ classroom }),
    readMetaverseLaunchControlState({
      context: {
        classId: classroom.classId,
        worldId: classroom.worldId,
        sessionId: classroom.sessionId,
      },
    }),
  ]);

  return {
    summary,
    launchControls,
  };
}
