import type { Metadata } from "next";
import { LESSON_03_04_VIBE_CODING_CONTENT as content } from "@/lib/edu/vibe-coding/lesson-03-04-content";

export const metadata: Metadata = {
  title: content.metadata.title,
  description: content.metadata.subtitle,
  alternates: { canonical: "/edu/vibe-coding/lesson-03-04" }
};

type SectionProps = {
  id: string;
  title: string;
  children: React.ReactNode;
};

function Section({ id, title, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5 border-b border-slate-200 pb-10">
      <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{title}</h2>
      {children}
    </section>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <article className={`rounded-xl border border-slate-300 bg-white p-6 shadow-sm ${className}`}>{children}</article>;
}

function Checklist({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2 text-lg leading-relaxed text-slate-900">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden className="mt-1 text-indigo-700">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Timeline({ entries }: { entries: ReadonlyArray<{ time: string; activity: string }> }) {
  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={`${entry.time}-${entry.activity}`} className="grid gap-1 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[140px_1fr] md:gap-4">
          <p className="text-base font-bold text-indigo-700">{entry.time}</p>
          <p className="text-lg text-slate-900">{entry.activity}</p>
        </li>
      ))}
    </ol>
  );
}

function ScriptBlock({ title, script }: { title: string; script: string }) {
  return (
    <Card>
      <h4 className="text-xl font-bold text-slate-950">{title}</h4>
      <p className="mt-3 text-lg leading-relaxed text-slate-800">{script}</p>
    </Card>
  );
}

function WorksheetBlock({ title, fields }: { title: string; fields: readonly string[] }) {
  return (
    <Card>
      <h4 className="text-xl font-bold text-slate-950">{title}</h4>
      <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-100 p-4 text-sm leading-relaxed text-slate-900">{fields.join("\n")}</pre>
    </Card>
  );
}

function SimpleTable({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
      <table className="min-w-full border-collapse text-left text-lg">
        <thead className="bg-slate-100">
          <tr>
            <th className="border-b border-slate-300 px-4 py-3 font-bold text-slate-950">문제 상황</th>
            <th className="border-b border-slate-300 px-4 py-3 font-bold text-slate-950">즉시 전환</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([issue, action]) => (
            <tr key={`${issue}-${action}`} className="align-top">
              <td className="border-b border-slate-200 px-4 py-3 text-slate-900">{issue}</td>
              <td className="border-b border-slate-200 px-4 py-3 text-slate-900">{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Page() {
  const lesson03Scripts = content.teacherScripts.filter((s) => s.title.startsWith("3차시"));
  const lesson04Scripts = content.teacherScripts.filter((s) => s.title.startsWith("4차시"));

  return (
    <main className="mx-auto max-w-7xl space-y-10 bg-white px-6 py-8 text-slate-950 print:max-w-none print:px-0">
      <nav className="sticky top-0 z-20 -mx-2 rounded-lg border border-slate-300 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
        <ul className="flex flex-wrap gap-3 text-sm font-bold text-slate-800 md:text-base">
          {[
            ["overview", "개요"],
            ["goals", "목표"],
            ["core-lecture", "핵심 강의"],
            ["success", "성공 기준"],
            ["board", "보드 구성"],
            ["rehearsal", "리허설"],
            ["prep", "준비"],
            ["lesson03", "3차시"],
            ["lesson04", "4차시"],
            ["worksheets", "활동지"],
            ["prompts", "프롬프트"],
            ["safety", "안전"],
            ["fallback", "대체 플랜"],
            ["rubric", "평가"]
          ].map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="rounded px-2 py-1 hover:bg-slate-100">{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="overview" title="개요">
        <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-5xl">{content.metadata.title}</h1>
        <p className="text-xl leading-relaxed text-slate-800 md:text-2xl">{content.metadata.subtitle}</p>
        <Card className="bg-slate-50">
          <p className="text-xl font-semibold">대상: {content.metadata.target}</p>
          <p className="text-xl font-semibold">시간: {content.metadata.duration}</p>
          <p className="text-xl font-semibold">도구: {content.metadata.tools.join(", ")}</p>
          <p className="mt-4 rounded-lg bg-amber-100 p-4 text-xl font-bold text-amber-900">완성된 앱보다 모든 학생의 제출물이 남는 것이 목표입니다.</p>
        </Card>
      </Section>

      <Section id="goals" title="수업 목표"><Checklist items={content.lessonGoals} /></Section>

      <Section id="core-lecture" title="리서치 기반 핵심 강의">
        <div className="grid gap-4 lg:grid-cols-2">
          {content.researchBasedLectureFlow.map((block) => (
            <Card key={block.key} className="break-inside-avoid print:break-inside-avoid">
              <p className="text-base font-black text-indigo-700">{block.key}</p>
              <h4 className="mt-1 text-2xl font-black leading-tight text-slate-950">{block.title}</h4>
              <ul className="mt-3 space-y-2 text-lg leading-relaxed text-slate-900">
                {block.bullets.map((item) => (
                  <li key={item} className="flex gap-2"><span aria-hidden className="text-indigo-700">•</span><span>{item}</span></li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="success" title="성공 기준">
        <Checklist items={content.classSuccessCriteria} />
        <p className="rounded-lg bg-emerald-100 p-4 text-lg font-semibold text-emerald-900">아래 4가지 중 하나만 제출해도 성공으로 인정합니다: Lovable 작품 링크 · Canva 시안 링크 · 앱 기획서 + 프롬프트 · 실패 기록</p>
      </Section>

      <Section id="board" title="보드 구성">
        <p className="text-lg text-slate-800">Gomdory/GKrry 보드 추천 섹션</p>
        <Checklist items={content.boardSetup} />
      </Section>


      <Section id="rehearsal" title="수업 전 리허설 체크리스트">
        <p className="text-lg text-slate-800">수업 시작 전, 교사 계정부터 학생 제출/검토/실패 대비까지 전체 흐름을 빠르게 점검합니다.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {content.preflightChecklist.map((group) => (
            <Card key={group.title}>
              <h4 className="text-xl font-bold text-slate-950">{group.title}</h4>
              <div className="mt-3">
                <Checklist items={group.items} />
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="prep" title="교사 준비 체크리스트"><Checklist items={content.teacherPreparationChecklist} /></Section>

      <Section id="lesson03" title={content.lessonPlans[0].title}>
        <Timeline entries={content.lessonPlans[0].timeline} />
        <div className="grid gap-4">{lesson03Scripts.map((script) => <ScriptBlock key={script.title} title={script.title} script={script.script} />)}</div>
      </Section>

      <Section id="lesson04" title={content.lessonPlans[1].title}>
        <Timeline entries={content.lessonPlans[1].timeline} />
        <div className="grid gap-4">{lesson04Scripts.map((script) => <ScriptBlock key={script.title} title={script.title} script={script.script} />)}</div>
      </Section>

      <Section id="worksheets" title="학생 활동지">
        <div className="grid gap-4 md:grid-cols-2">{content.worksheets.map((sheet) => <WorksheetBlock key={sheet.key} title={sheet.title} fields={sheet.fields} />)}</div>
      </Section>

      <Section id="prompts" title="프롬프트 예시">
        <Card>
          <h4 className="text-xl font-bold">기본 Lovable 프롬프트</h4>
          <p className="mt-3 text-lg leading-relaxed">{content.promptExamples.basicLovablePrompt}</p>
        </Card>
        <Card>
          <h4 className="text-xl font-bold">개선된 프롬프트 구조</h4>
          <Checklist items={content.promptExamples.improvedPromptStructure} />
        </Card>
        <Card>
          <h4 className="text-xl font-bold">빠른 수정 프롬프트</h4>
          <Checklist items={content.promptExamples.quickFixPrompts} />
        </Card>
      </Section>

      <Section id="safety" title="개인정보 안전">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-red-300 bg-red-50">
            <h4 className="text-xl font-bold text-red-900">입력 금지</h4>
            <Checklist items={content.safetyChecklist.forbidden} />
          </Card>
          <Card className="border-emerald-300 bg-emerald-50">
            <h4 className="text-xl font-bold text-emerald-900">입력 가능</h4>
            <Checklist items={content.safetyChecklist.allowed} />
          </Card>
        </div>
      </Section>

      <Section id="fallback" title="문제 상황별 대체 플랜"><SimpleTable rows={content.fallbackPlan} /></Section>

      <Section id="rubric" title="평가 루브릭">
        <Card>
          <p className="text-lg font-semibold">공통 채점 기준: 3점(명확하고 구체적) · 2점(기본 충족) · 1점(미흡)</p>
          <ul className="mt-4 space-y-2 text-lg">
            {content.rubric.map((item) => (
              <li key={item} className="rounded bg-slate-100 p-3">{item}</li>
            ))}
          </ul>
        </Card>
      </Section>
    </main>
  );
}
