import type { ShareBoard } from "@/lib/data/share";
import type { BoardShareSettings } from "@/lib/data/boardShareSettingsShared";
import { normalizeStudentView, parseStudentView, type StudentView } from "@/lib/student/view";

type ResolveWallVersionInput = {
  board: ShareBoard;
  shareSettings?: BoardShareSettings | null;
  queryView?: string | null;
};

export type ResolveWallVersionResult = {
  resolvedView: StudentView;
  useWallV2: boolean;
};

export function resolveWallVersionForShare({
  board,
  shareSettings,
  queryView,
}: ResolveWallVersionInput): ResolveWallVersionResult {
  const serverDefaultView = shareSettings?.studentDefaultView ?? undefined;
  const resolvedView =
    parseStudentView(queryView) ?? normalizeStudentView(serverDefaultView ?? null);
  const useWallV2 = resolvedView === "wall" && board.wall_v2_enabled;

  return { resolvedView, useWallV2 };
}
