"use client";
import { useState } from "react";
import type { CoursewareAiSuggestion } from "@/lib/edu/courseware/aiHelper/aiCoursewareAiHelperTypes";
import { saveRevisionEvidence } from "@/lib/edu/courseware/aiHelper/aiCoursewareRevisionEvidence";

export default function CoursewareRevisionEvidenceEditor({ suggestion, onApply }: { suggestion: CoursewareAiSuggestion | null; onApply?: (text: string) => void }) {
  const [studentRevisionKo, setStudentRevisionKo] = useState(""); const [reason, setReason] = useState(""); const [confirmed, setConfirmed] = useState(false);
  if (!suggestion) return null;
  return <div className="mt-2 rounded border bg-white p-2 text-sm"><p className="font-semibold">AI 초안</p><p>{suggestion.bodyKo}</p><label className="mt-2 block">내가 고친 문장<textarea className="w-full rounded border p-1" value={studentRevisionKo} onChange={(e) => setStudentRevisionKo(e.target.value)} /></label><label className="mt-2 block">왜 이렇게 고쳤나요?<textarea className="w-full rounded border p-1" value={reason} onChange={(e) => setReason(e.target.value)} /></label><button className="mt-2 rounded bg-slate-900 px-2 py-1 text-white" disabled={!studentRevisionKo.trim()} onClick={() => { setConfirmed(true); saveRevisionEvidence({ evidenceId: `ev-${Date.now()}`, targetType: "artifact-draft", aiDraftKo: suggestion.bodyKo, studentRevisionKo, revisionReasonKo: reason || undefined, studentConfirmed: true, aiTask: suggestion.task, generatedBy: suggestion.generatedBy, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source: "courseware-revision-evidence", version: 1 }); }}>내 문장으로 확정</button><button className="ml-2 rounded border px-2 py-1" disabled={!confirmed} onClick={() => onApply?.(studentRevisionKo)}>적용하기</button></div>;
}
