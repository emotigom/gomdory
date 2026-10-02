import type { CoursewareArtifactDraft } from "@/lib/edu/courseware/aiCoursewareDraftTypes";

export default function RevisionComparisonEditor({ draft, onChange }: { draft: CoursewareArtifactDraft; onChange: (next: CoursewareArtifactDraft) => void }) {
  return <div className="space-y-2 text-sm"><label className="block">수정 전<textarea className="mt-1 min-h-20 w-full rounded border p-2" value={draft.beforeTextKo ?? ""} onChange={(e) => onChange({ ...draft, beforeTextKo: e.target.value })} /></label><label className="block">수정 후<textarea className="mt-1 min-h-20 w-full rounded border p-2" value={draft.afterTextKo ?? ""} onChange={(e) => onChange({ ...draft, afterTextKo: e.target.value })} /></label><label className="block">수정 이유<textarea className="mt-1 min-h-16 w-full rounded border p-2" value={draft.revisionReasonKo ?? ""} onChange={(e) => onChange({ ...draft, revisionReasonKo: e.target.value })} /></label></div>;
}
