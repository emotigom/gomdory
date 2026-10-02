import { NextResponse, type NextRequest } from "next/server";

import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { safeStudentText } from "@/lib/safety/safeStudentText";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EduUiErrorPayload = {
  message?: string;
  slug?: string | null;
  lessonId?: number | string | null;
};

const normalizeString = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.slice(0, maxLength) : null;

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const body = (await request.json().catch(() => null)) as EduUiErrorPayload | null;

  if (!body || typeof body.message !== "string") {
    return NextResponse.json(
      { ok: false, error: { message: "invalid_payload" } },
      { status: 400 },
    );
  }

  const messageSafe = safeStudentText(body.message, { maxLength: 500 });
  const slug = normalizeString(body.slug, 140);
  const lessonIdRaw = body.lessonId;
  const lessonId =
    typeof lessonIdRaw === "number"
      ? lessonIdRaw
      : typeof lessonIdRaw === "string"
        ? Number(lessonIdRaw)
        : null;
  const normalizedLessonId = Number.isFinite(lessonId) ? Number(lessonId) : null;

  await recordOpsEvent(
    {
      level: "warn",
      kind: "ui_error",
      request_id: requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        stage: "edu_progress",
        action: "ui_error",
        slug,
        lessonId: normalizedLessonId,
        message: messageSafe.text ?? "",
      },
    },
    { sampleRate: 1, hardLimitPerMinute: 120 },
  );

  return NextResponse.json({ ok: true, requestId });
}
