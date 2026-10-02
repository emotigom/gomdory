import type { CoursewarePublishGateStatus } from "@/lib/edu/courseware/safety/aiCoursewareSafetyTypes";
import CoursewarePublishGateBadge from "./CoursewarePublishGateBadge";

export default function CoursewareSafetySummary({ gate }: { gate: CoursewarePublishGateStatus }) {
  return <section className="rounded border bg-white p-3"><div className="flex items-center justify-between"><h5 className="font-semibold">공개/발표 전 안전 점검</h5><CoursewarePublishGateBadge gate={gate} /></div><p className="mt-1 text-xs text-slate-600">체크한 뒤에도 최종 판단은 내가 해요.</p>{gate.blockingReasonsKo.map((r) => <p key={r} className="mt-1 text-xs text-rose-700">• {r}</p>)}{gate.warningsKo.map((r) => <p key={r} className="mt-1 text-xs text-amber-700">• {r}</p>)}</section>;
}
