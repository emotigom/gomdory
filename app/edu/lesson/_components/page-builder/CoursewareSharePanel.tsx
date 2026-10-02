"use client";

import { useState } from "react";

import { buildShareCardModel } from "@/lib/edu/courseware/pageBuilder/aiCoursewareShareCard";
import type { CoursewarePageDraft } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePageTypes";
import { evaluatePublishReadiness } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePublishReadiness";
import { evaluateCoursewarePublishGate } from "@/lib/edu/courseware/safety/aiCoursewarePublishGate";
import { loadSafetyAcknowledgement } from "@/lib/edu/courseware/safety/aiCoursewareSafetyStore";
import CoursewareSafetySummary from "../safety/CoursewareSafetySummary";

import CoursewareQrCard from "./CoursewareQrCard";

export default function CoursewareSharePanel({ draft }: { draft: CoursewarePageDraft }) {
  const [teamLabelKo, setTeamLabelKo] = useState("");
  const card = buildShareCardModel(draft, "웹페이지 초안", teamLabelKo);
  const readiness = evaluatePublishReadiness(draft);
  const gate = evaluateCoursewarePublishGate({ readiness, checklist: loadSafetyAcknowledgement("page-draft", draft.pageId), targetType: "presentation", lessonNumber: draft.lessonNumber });
  return <section className="rounded border bg-white p-3"><h5 className="font-semibold">공유/QR 카드</h5><p className="text-xs text-slate-600">수업에서는 이 요약을 복사하거나 화면 QR 카드로 공유하세요.</p><p className="mt-1 text-xs text-amber-700">{card.classroomNoticeKo}</p><input value={teamLabelKo} onChange={(e) => setTeamLabelKo(e.target.value)} placeholder="팀/이름(선택)" className="mt-2 w-full rounded border px-2 py-1 text-sm" /><pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{card.copyTextKo}</pre><button className="mt-2 rounded border px-2 py-1 text-xs" onClick={async () => navigator.clipboard?.writeText(card.copyTextKo)}>요약 복사</button><CoursewareQrCard placeholder={card.qrPlaceholderKo} /><div className="mt-3"><CoursewareSafetySummary gate={gate} /></div></section>;
}
