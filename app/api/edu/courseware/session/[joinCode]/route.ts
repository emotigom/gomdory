import { NextResponse } from "next/server";
import { parseJoinCode } from "@/lib/edu/courseware/session/aiCoursewareJoinCode";
import {
  getClassSessionByJoinCode,
  listSessionSubmissions,
} from "@/lib/edu/courseware/session/aiCoursewareSessionRepository";

type RouteContext = {
  params: Promise<{ joinCode: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { joinCode: rawJoinCode } = await context.params;
  const joinCode = parseJoinCode(rawJoinCode);

  if (!joinCode) {
    return NextResponse.json({ status: "invalid_join_code" }, { status: 400 });
  }

  const found = await getClassSessionByJoinCode(joinCode);
  if (!found) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const submissions = await listSessionSubmissions(found.session.id);
  return NextResponse.json({
    status: "ok",
    joinCode: found.session.joinCode,
    title: found.session.title,
    dayNumber: found.session.dayNumber,
    lessonNumbers: found.session.lessonNumbers,
    lessons: found.lessons,
    sessionStatus: found.session.status,
    submissions: submissions.map((s) => ({
      id: s.id,
      displayLabel: s.displayLabel,
      titleKo: s.titleKo,
      lessonNumber: s.lessonNumber,
      publicUrl: s.publicUrl,
      submittedAt: s.createdAt,
    })),
  });
}
