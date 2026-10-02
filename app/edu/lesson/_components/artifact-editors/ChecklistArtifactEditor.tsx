import type { CoursewareArtifactDraft } from "@/lib/edu/courseware/aiCoursewareDraftTypes";

export default function ChecklistArtifactEditor({ draft, onChange }: { draft: CoursewareArtifactDraft; onChange: (next: CoursewareArtifactDraft) => void }) {
  const items = draft.checklistItems ?? [{ id: "1", labelKo: "확인 항목 1", checked: false }];
  return <div className="space-y-2">{items.map((item, idx) => <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.checked} onChange={(e) => { const next = [...items]; next[idx] = { ...item, checked: e.target.checked }; onChange({ ...draft, checklistItems: next }); }} />{item.labelKo}</label>)}</div>;
}
