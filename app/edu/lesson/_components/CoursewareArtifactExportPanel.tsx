import type { CoursewareArtifactDraft } from "@/lib/edu/courseware/aiCoursewareDraftTypes";
import { draftToSummaryText } from "@/lib/edu/courseware/aiCoursewareDraftStore";

export default function CoursewareArtifactExportPanel({ draft }: { draft: CoursewareArtifactDraft }) {
  return <details className="rounded border p-3 text-sm"><summary className="cursor-pointer font-semibold">복사용 요약 / JSON</summary><pre className="mt-2 overflow-auto rounded bg-slate-50 p-2">{draftToSummaryText(draft)}</pre><pre className="mt-2 overflow-auto rounded bg-slate-50 p-2">{JSON.stringify(draft, null, 2)}</pre></details>;
}
