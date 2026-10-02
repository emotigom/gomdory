import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { getClassById, listClassBoards } from "@/lib/data/classes.server";
import TeacherMetaverseProgressSurface from "@/app/world-hub/dashboard/teacher-progress/TeacherMetaverseProgressSurface";
import { readTeacherMetaverseProgressSurface } from "@/app/world-hub/dashboard/teacher-progress/data";

export const dynamic = "force-dynamic";

export default async function ClassMetaverseProgressPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const { user } = await requireUser(`/dashboard/classes/${classId}/metaverse`);

  const [classInfo, boards] = await Promise.all([getClassById(classId), listClassBoards(classId)]);

  if (!classInfo) {
    return notFound();
  }

  const { summary, launchControls } = await readTeacherMetaverseProgressSurface({
    classId: classInfo.id,
    boardIds: boards.map((board) => board.id),
    ownerUserId: user.id,
  });

  return (
    <TeacherMetaverseProgressSurface
      classId={classInfo.id}
      classTitle={classInfo.title}
      summary={summary}
      launchControls={launchControls}
    />
  );
}
