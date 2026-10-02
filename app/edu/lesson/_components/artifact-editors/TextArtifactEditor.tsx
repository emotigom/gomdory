import type { CoursewareArtifactDraft } from "@/lib/edu/courseware/aiCoursewareDraftTypes";

export default function TextArtifactEditor({ draft, onChange }: { draft: CoursewareArtifactDraft; onChange: (next: CoursewareArtifactDraft) => void }) {
  return <label className="block text-sm font-medium text-slate-800">내용<textarea className="mt-1 min-h-28 w-full rounded border p-2" value={draft.bodyKo ?? ""} onChange={(e) => onChange({ ...draft, bodyKo: e.target.value })} /></label>;
}
