"use client";

import { useMemo, useState } from "react";

import { COURSEWARE_SAFETY_CHECKLIST } from "@/lib/edu/courseware/safety/aiCoursewareSafetyChecklist";
import { evaluateCoursewarePublishGate } from "@/lib/edu/courseware/safety/aiCoursewarePublishGate";
import { loadSafetyAcknowledgement, resetSafetyAcknowledgement, saveSafetyAcknowledgement } from "@/lib/edu/courseware/safety/aiCoursewareSafetyStore";
import type { CoursewarePublishReadiness } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePublishReadiness";
import type { CoursewareSafetyAcknowledgement, CoursewareSafetyCheckId } from "@/lib/edu/courseware/safety/aiCoursewareSafetyTypes";
import CoursewarePublishGateBadge from "./CoursewarePublishGateBadge";

export default function CoursewareSafetyChecklistPanel({ targetType, targetId, lessonNumber, readiness }: { targetType: "artifact-draft" | "page-draft" | "presentation"; targetId: string; lessonNumber?: number; readiness: CoursewarePublishReadiness }) {
  const loaded = useMemo(() => loadSafetyAcknowledgement(targetType, targetId), [targetId, targetType]);
  const [checkedIds, setCheckedIds] = useState<CoursewareSafetyCheckId[]>(loaded?.checkedIds ?? []);
  const [notesKo, setNotesKo] = useState(loaded?.notesKo ?? "");
  const checklist: CoursewareSafetyAcknowledgement | null =
    checkedIds.length > 0 || notesKo
      ? {
          targetType,
          targetId,
          lessonNumber,
          checkedIds,
          notesKo,
          updatedAt: new Date().toISOString(),
          source: "local-safety-check",
          version: 1,
        }
      : null;
  const gate = evaluateCoursewarePublishGate({ readiness, checklist, targetType, lessonNumber });
  return <section className="rounded border bg-white p-3"><div className="flex items-center justify-between"><h5 className="font-semibold">공개/발표 전 안전 점검</h5><CoursewarePublishGateBadge gate={gate} /></div><p className="text-xs text-slate-600">체크한 뒤에도 최종 판단은 내가 해요.</p><p className="text-xs text-slate-600">개인정보와 출처를 확인하면 학교에서도 안심하고 공유할 수 있어요.</p><p className="mt-1 text-xs text-slate-500">완벽하지 않아도 괜찮아요. 위험한 정보만 먼저 확인해요.</p><div className="mt-2 space-y-1">{COURSEWARE_SAFETY_CHECKLIST.map((item) => <label key={item.id} className="block text-xs"><input type="checkbox" checked={checkedIds.includes(item.id)} onChange={(e) => setCheckedIds((prev) => e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))} /> {item.labelKo} {item.required ? "(필수)" : "(선택)"}</label>)}</div><textarea className="mt-2 w-full rounded border p-2 text-xs" placeholder="메모(선택)" value={notesKo} onChange={(e) => setNotesKo(e.target.value)} /><div className="mt-2 flex gap-2"><button className="rounded bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => saveSafetyAcknowledgement({ targetType, targetId, lessonNumber, checkedIds, notesKo, updatedAt: new Date().toISOString(), source: "local-safety-check", version: 1 })}>save checklist</button><button className="rounded border px-2 py-1 text-xs" onClick={() => { setCheckedIds([]); setNotesKo(""); resetSafetyAcknowledgement(targetType, targetId); }}>reset checklist</button></div><p className="mt-2 text-xs text-slate-600">친구가 봐도 괜찮은 내용인지 다시 확인해요. AI가 쓴 문장은 내가 책임지고 고쳐요.</p><p className="mt-1 text-xs text-blue-700">이 점검은 학생 자기 점검입니다. 실제 공개 배포 전에는 교사 확인 흐름을 추가할 예정입니다.</p></section>;
}
