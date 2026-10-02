import type { CoursewareDraftStatus } from "@/lib/edu/courseware/aiCoursewareDraftTypes";

const labels: Record<CoursewareDraftStatus, string> = { empty: "비어 있음", draft: "작성 중", complete: "완성", "export-ready": "내보내기 준비" };
export default function CoursewareArtifactDraftStatus({ status }: { status: CoursewareDraftStatus }) {
  return <p className="text-xs text-slate-600">상태: {labels[status]}</p>;
}
