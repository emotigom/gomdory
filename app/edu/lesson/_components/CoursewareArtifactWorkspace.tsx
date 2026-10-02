"use client";

import { useMemo, useState } from "react";

import { getDraftStatus, makeEmptyDraftFromLesson, type CoursewareArtifactDraft } from "@/lib/edu/courseware/aiCoursewareDraftTypes";
import { draftToSummaryText, resetDraft, saveDraft } from "@/lib/edu/courseware/aiCoursewareDraftStore";
import type { CoursewareLesson } from "@/lib/edu/courseware/aiCoursewareTypes";

import CoursewareArtifactDraftStatus from "./CoursewareArtifactDraftStatus";
import CoursewareArtifactEditor from "./CoursewareArtifactEditor";
import CoursewareArtifactExportPanel from "./CoursewareArtifactExportPanel";
import CoursewareQuickPageBuilder from "./page-builder/CoursewareQuickPageBuilder";
import CoursewareSafetyChecklistPanel from "./safety/CoursewareSafetyChecklistPanel";
import CoursewareAiHelperPanel from "./ai-helper/CoursewareAiHelperPanel";

export default function CoursewareArtifactWorkspace({ lesson, initialDraft, storeWarning, onDraftChange }: { lesson: CoursewareLesson | null; initialDraft: CoursewareArtifactDraft | null; storeWarning?: string | null; onDraftChange?: (draft: CoursewareArtifactDraft | null) => void }) {
  const [draft, setDraft] = useState<CoursewareArtifactDraft | null>(initialDraft ?? (lesson ? makeEmptyDraftFromLesson(lesson) : null));
  const status = useMemo(() => getDraftStatus(draft), [draft]);
  if (!lesson || !draft) return <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">선택한 수업 정보를 찾지 못했어요. 왼쪽 카드에서 다시 골라주세요.</section>;
  const onChange = (next: CoursewareArtifactDraft) => { setDraft(next); onDraftChange?.(next); };
  const isWebArtifact = ["web-page-draft", "published-page", "info-card-page", "qr-share-card", "interactive-guide", "page-plan"].includes(lesson.artifact.type);
  return <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-lg font-semibold">오늘 남길 결과물</h3><p className="text-sm text-slate-600">{lesson.lessonNumber}차시 · {lesson.titleKo} · {lesson.oneLineActivityKo}</p><p className="text-sm text-blue-700">{lesson.artifact.labelKo}</p><p className="text-xs text-slate-500">45분 안에 작게 완성해요 · 완벽하지 않아도 저장하면 성공이에요</p><p className="text-xs text-rose-700">이름, 얼굴, 전화번호, 주소 같은 개인정보는 적지 않아요.</p><CoursewareArtifactDraftStatus status={status} />{storeWarning ? <p className="text-xs text-amber-700">로컬 저장소를 읽는 중 문제가 있어 임시 메모리로 이어서 진행합니다.</p> : null}<div className="mt-3">{isWebArtifact ? <CoursewareQuickPageBuilder lessonNumber={lesson.lessonNumber} /> : <><CoursewareArtifactEditor draft={draft} onChange={onChange} /><CoursewareAiHelperPanel onApply={(text) => onChange({ ...draft, bodyKo: text })} /></>}</div><div className="mt-3 flex flex-wrap gap-2"><button className="rounded bg-slate-900 px-3 py-1 text-sm text-white" onClick={() => { const result = saveDraft(draft); if (!result.ok) alert("저장소 권한 문제로 브라우저 메모리에만 저장돼요."); onDraftChange?.(draft); }}>임시 저장</button><button className="rounded border px-3 py-1 text-sm" onClick={() => { const next = { ...draft, isComplete: true }; setDraft(next); saveDraft(next); onDraftChange?.(next); }}>완성 표시</button><button className="rounded border px-3 py-1 text-sm" onClick={async () => { await navigator.clipboard?.writeText(draftToSummaryText(draft)); }}>복사하기</button><button className="rounded border border-rose-300 px-3 py-1 text-sm text-rose-700" onClick={() => { if (confirm("처음부터 다시 작성할까요?")) { resetDraft(lesson.lessonNumber); const next = makeEmptyDraftFromLesson(lesson); setDraft(next); onDraftChange?.(null); } }}>처음부터 다시</button></div><p className="mt-3 text-xs text-slate-600">아직 교사용 제출함은 연결되지 않았어요. 지금은 결과물을 복사하거나 링크로 보관하세요.</p><details className="mt-3 rounded border p-3 text-sm"><summary className="font-semibold">지난 시간 못 했나요?</summary><p>{lesson.recovery.summaryKo}</p><button className="mt-2 rounded border px-2 py-1" onClick={() => { if (getDraftStatus(draft) !== "empty" && !confirm("현재 작성 내용을 덮어쓸까요?")) return; const next = { ...draft, bodyKo: `${lesson.recovery.starterArtifactKo}\n${lesson.recovery.catchUpStepsKo.join("\n")}` }; setDraft(next); }}>복구 예시로 시작하기</button></details><div className="mt-3"><CoursewareSafetyChecklistPanel targetType="artifact-draft" targetId={draft.draftId} lessonNumber={lesson.lessonNumber} readiness={{ status: "needs-attention", checks: [{ id: "artifact-safety", labelKo: "결과물 자기 점검", status: "warning", messageKo: "학생 안전 체크를 확인해요.", severity: "warning" }] }} /></div><div className="mt-3"><CoursewareArtifactExportPanel draft={draft} /></div></section>;
}
