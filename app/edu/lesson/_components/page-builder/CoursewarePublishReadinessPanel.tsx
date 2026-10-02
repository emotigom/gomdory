import { evaluatePublishReadiness } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePublishReadiness";

export default function CoursewarePublishReadinessPanel({ draft }: { draft: unknown }) {
  const readiness = evaluatePublishReadiness(draft);
  return <section className="rounded border bg-white p-3"><h5 className="font-semibold">공개 배포 전 점검</h5><p className="text-xs text-slate-600">아직 실제 공개 링크는 연결되지 않았어요.</p><ul className="mt-2 space-y-1 text-xs">{readiness.checks.map((c) => <li key={c.id}>[{c.status}] {c.labelKo} - {c.messageKo}</li>)}</ul></section>;
}
