import { NextResponse } from "next/server";
import { createClassSession } from "@/lib/edu/courseware/session/aiCoursewareSessionRepository";
import {
  isClassSessionWriteEnabled,
  validateSessionCreateInput,
} from "@/lib/edu/courseware/session/aiCoursewareSessionValidation";

function parseSessionCreateBody(body: unknown): { dayNumber: number; title: string | null | undefined } {
  if (body && typeof body === "object") {
    const data = body as { dayNumber?: unknown; title?: unknown };
    const dayNumber = typeof data.dayNumber === "number" ? data.dayNumber : Number.NaN;
    const title = typeof data.title === "string" || data.title == null ? data.title : undefined;
    return { dayNumber, title };
  }

  return { dayNumber: Number.NaN, title: undefined };
}

export async function POST(req: Request) {
  if (!isClassSessionWriteEnabled()) {
    return NextResponse.json({ status: "disabled" }, { status: 403 });
  }

  const body = await req.json();
  const { dayNumber, title } = parseSessionCreateBody(body);
  const valid = validateSessionCreateInput(dayNumber, title);

  if (!valid) {
    return NextResponse.json({ status: "validation_failed" }, { status: 400 });
  }

  const created = await createClassSession(valid);

  if (!created) {
    return NextResponse.json({ status: "storage_error" }, { status: 503 });
  }

  return NextResponse.json({
    status: "ok",
    sessionId: created.id,
    joinCode: created.joinCode,
    title: created.title,
    dayNumber: created.dayNumber,
    lessonNumbers: created.lessonNumbers,
    statusValue: created.status,
    joinUrl: `/edu/lesson/join?code=${created.joinCode}`,
  });
}
