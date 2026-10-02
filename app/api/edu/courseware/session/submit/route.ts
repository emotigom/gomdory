import { NextResponse } from "next/server";
import { getPublishedSnapshot } from "@/lib/edu/courseware/publish/aiCoursewarePublishRepository";
import {
  getClassSessionByJoinCode,
  submitClassSessionLink,
} from "@/lib/edu/courseware/session/aiCoursewareSessionRepository";
import {
  isClassSessionWriteEnabled,
  sanitizeOptionalText,
  validateSubmissionInput,
} from "@/lib/edu/courseware/session/aiCoursewareSessionValidation";

type SessionSubmitBody = {
  publicUrl?: string;
  shareId?: string;
  joinCode?: string;
  displayLabel?: string;
  noteKo?: string;
};

function parseSessionSubmitBody(body: unknown): SessionSubmitBody {
  if (!body || typeof body !== "object") {
    return {};
  }

  const data = body as Record<string, unknown>;
  return {
    publicUrl: typeof data.publicUrl === "string" ? data.publicUrl : undefined,
    shareId: typeof data.shareId === "string" ? data.shareId : undefined,
    joinCode: typeof data.joinCode === "string" ? data.joinCode : undefined,
    displayLabel:
      typeof data.displayLabel === "string" ? data.displayLabel : undefined,
    noteKo: typeof data.noteKo === "string" ? data.noteKo : undefined,
  };
}

export async function POST(req: Request) {
  if (!isClassSessionWriteEnabled()) {
    return NextResponse.json({ status: "disabled" }, { status: 403 });
  }

  const body = parseSessionSubmitBody(await req.json());
  const parsed = validateSubmissionInput(
    { publicUrl: body.publicUrl, shareId: body.shareId },
    new URL(req.url).origin,
  );

  if (!parsed) {
    return NextResponse.json({ status: "invalid_url" }, { status: 400 });
  }

  const found = await getClassSessionByJoinCode(
    (body.joinCode ?? "").trim().toUpperCase(),
  );

  if (!found || found.session.status !== "active") {
    return NextResponse.json({ status: "session_unavailable" }, { status: 404 });
  }

  const snapshot = await getPublishedSnapshot(parsed.shareId);
  const saved = await submitClassSessionLink({
    sessionId: found.session.id,
    shareId: parsed.shareId,
    publicUrl: parsed.publicUrl,
    displayLabel: sanitizeOptionalText(body.displayLabel, 40),
    lessonNumber: snapshot?.lessonNumber ?? null,
    titleKo: snapshot?.titleKo ?? null,
    noteKo: sanitizeOptionalText(body.noteKo, 120),
    status: "submitted",
  });

  if (!saved) {
    return NextResponse.json({ status: "storage_error" }, { status: 503 });
  }

  return NextResponse.json({
    status: "ok",
    submittedAt: saved.createdAt,
    publicUrl: saved.publicUrl,
    displayLabel: saved.displayLabel,
    titleKo: saved.titleKo,
  });
}
