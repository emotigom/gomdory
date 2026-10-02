import type { CoursewarePublishGateStatus } from "@/lib/edu/courseware/safety/aiCoursewareSafetyTypes";

export default function CoursewarePublishGateBadge({ gate }: { gate: CoursewarePublishGateStatus }) {
  const label = !gate.hasChecklist ? "아직 점검 전이에요" : gate.status === "ready" ? "안전 점검 완료" : gate.status === "blocked" ? "공유 전 수정이 필요해요" : "확인이 더 필요해요";
  return <span className="inline-flex rounded border px-2 py-1 text-xs font-semibold">{label}</span>;
}
