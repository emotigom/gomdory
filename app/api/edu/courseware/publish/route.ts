import { NextResponse } from "next/server";

import { evaluatePublishReadiness } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePublishReadiness";
import { buildCoursewarePublishedSnapshot } from "@/lib/edu/courseware/publish/aiCoursewarePublishSnapshot";
import { savePublishedSnapshot, isCoursewarePublishWriteEnabled } from "@/lib/edu/courseware/publish/aiCoursewarePublishRepository";
import type { CoursewarePageDraft } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePageTypes";
import type { CoursewareSafetyAcknowledgement } from "@/lib/edu/courseware/safety/aiCoursewareSafetyTypes";

type PublishRequestBody = {
  pageDraft?: CoursewarePageDraft | null;
  safetyAcknowledgement?: CoursewareSafetyAcknowledgement | null;
};

export async function POST(req: Request) {
  if (!isCoursewarePublishWriteEnabled()) {
    return NextResponse.json({ status: "disabled" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as PublishRequestBody;
    const readiness = evaluatePublishReadiness(body?.pageDraft ?? null, { privacyAcknowledged: true });
    const snapshot = buildCoursewarePublishedSnapshot({
      pageDraft: body?.pageDraft ?? null,
      readiness,
      safetyAcknowledgement: body?.safetyAcknowledgement ?? null,
    });
    const saved = await savePublishedSnapshot(snapshot);
    if (!saved) return NextResponse.json({ status: "storage_error" }, { status: 503 });
    return NextResponse.json({
      status: "ok",
      shareId: saved.shareId,
      titleKo: saved.titleKo,
      publicUrl: `/edu/courseware/p/${saved.shareId}`,
    });
  } catch {
    return NextResponse.json({ status: "validation_failed" }, { status: 400 });
  }
}
