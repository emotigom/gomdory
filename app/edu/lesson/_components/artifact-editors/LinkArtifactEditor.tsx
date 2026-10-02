import type { CoursewareArtifactDraft } from "@/lib/edu/courseware/aiCoursewareDraftTypes";

export default function LinkArtifactEditor({ draft, onChange }: { draft: CoursewareArtifactDraft; onChange: (next: CoursewareArtifactDraft) => void }) {
  return <div className="space-y-2 text-sm"><label className="block">링크 URL<input className="mt-1 w-full rounded border p-2" value={draft.linkUrl ?? ""} onChange={(e) => onChange({ ...draft, linkUrl: e.target.value })} /></label><label className="block">설명<textarea className="mt-1 min-h-20 w-full rounded border p-2" value={draft.bodyKo ?? ""} onChange={(e) => onChange({ ...draft, bodyKo: e.target.value })} /></label></div>;
}
