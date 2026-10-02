import type { CoursewareStarterTemplate } from "@/lib/edu/courseware/aiCoursewareTypes";

export default function CoursewareStarterTemplates({ templates }: { templates: CoursewareStarterTemplate[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">스타터 템플릿</h3>
      <p className="mt-2 text-sm text-slate-700">기존 4교시 스튜디오는 이제 32차시 안에서 바로 시작할 수 있는 스타터 템플릿으로 사용합니다.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {templates.map((template) => (
          <article key={template.templateId} className="rounded-xl border border-slate-200 p-3">
            <h4 className="font-semibold text-slate-900">{template.titleKo}</h4>
            <p className="mt-1 text-sm text-slate-700">{template.descriptionKo}</p>
            <p className="mt-1 text-xs text-slate-600">기존 라벨: {template.originalLessonLabelKo}</p>
            <p className="mt-1 text-xs text-slate-600">연결 차시: {template.mapsToLessonNumbers.length ? template.mapsToLessonNumbers.join(", ") : "선택형"}</p>
            <p className="mt-1 text-xs font-medium text-violet-700">status: {template.status}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
