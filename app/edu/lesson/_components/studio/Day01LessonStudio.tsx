"use client";
/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { DAY01_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";
import { DAY01_AI_ROLE_ASSETS } from "@/lib/edu/courseware/assets/coursewareAssetManifest";
import { DAY01_BINGO_ITEMS, DAY01_CLASSIFIER_STATEMENTS, DAY01_ROLE_CARDS, DAY01_SITUATION_MISSIONS, countBingoLines, loadDay01Progress, resetDay01Progress, saveDay01Progress, type Day01RoleBucket } from "@/lib/edu/courseware/lessonRuntime/day01AiBingoRuntime";

const BUCKETS: { id: Day01RoleBucket; label: string }[] = [{ id: "ai_first", label: "AI에게 먼저" }, { id: "human_first", label: "사람이 먼저" }, { id: "human_ai_together", label: "함께 하기" }];

export default function Day01LessonStudio() {
  const [progress, setProgress] = useState(() => loadDay01Progress());
  const [classifier, setClassifier] = useState<Record<string, string>>({});
  const [result, setResult] = useState({ ai1: "", ai2: "", aiWork: "", humanWork: "" });
  const [showCourseMap, setShowCourseMap] = useState(false);
  const total = useMemo(() => DAY01_LESSON_RUNTIME.blocks.reduce((s, b) => s + b.estimatedMinutes, 0), []);
  const selected = progress.selectedBingoIds;
  const lines = countBingoLines(selected, 4);

  const patch = (next: typeof progress) => { setProgress(next); saveDay01Progress(next); };

  return <section data-courseware-runtime="ai-bingo-role-studio-v1" data-courseware-assets="assets-gomdory-day01-v1" data-lesson-id="day-1" data-lesson-volume="45-minute" className="space-y-8 rounded-3xl border border-slate-200 bg-white p-4 md:p-8 shadow-sm">
    <header className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">AI 웹사이트 코스웨어 스튜디오</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white px-2.5 py-1 text-slate-600">16일 코스</span><span className="rounded-full bg-white px-2.5 py-1 text-slate-600">45분 수업</span><span className="rounded-full bg-slate-900 px-2.5 py-1 text-white">현재 Day 1</span></div>
        </div>
        <button type="button" aria-expanded={showCourseMap} onClick={() => setShowCourseMap((v) => !v)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">코스 개요 보기</button>
      </div>
    </header>

    <section className="relative overflow-hidden rounded-2xl bg-slate-900 p-6 text-white md:p-8">
      <img src={DAY01_AI_ROLE_ASSETS.layoutDashboardBear} alt="Day 1 대시보드 일러스트" loading="lazy" decoding="async" className="absolute -right-6 -top-4 hidden h-44 w-auto opacity-70 md:block" />
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">활성 레슨</p>
      <h2 className="mt-2 text-3xl font-bold md:text-4xl">Day 1 · AI와 사람의 역할</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">생활 속 AI를 찾고, AI에게 맡길 일과 사람이 판단할 일을 구분해요.</p>
      <p className="mt-3 text-sm text-slate-300">6개 활동 · {total}분</p>
      <div className="mt-4 flex flex-wrap gap-2"><button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900">활동 시작</button><button className="rounded-full border border-slate-400 px-4 py-2 text-sm text-white">교사 가이드</button></div>
    </section>

    <div className="flex flex-wrap gap-2">{DAY01_LESSON_RUNTIME.phases.map((p, i) => <div key={p.id} className={`rounded-full px-3 py-1.5 text-xs md:text-sm ${i === 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}><b>{p.titleKo}</b> · {p.range.labelKo}</div>)}</div>

    {showCourseMap ? <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-800">전체 코스 맵 (보조 패널)</p><p className="mt-1 text-xs text-slate-600">현재 Day 1이 기본이며, 상단 Day 선택으로 Day 2~Day 16 흐름을 탐색할 수 있습니다.</p></section> : null}

    <article className="rounded-2xl border border-slate-200 p-4 md:p-5"><h3 className="text-lg font-semibold">생활 속 AI 빙고</h3><p className="mt-1 text-sm text-slate-600">생활 속 AI 사례를 고르며 어떤 근거로 AI라고 판단하는지 생각해 보세요.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">{DAY01_BINGO_ITEMS.map((item, index) => <button key={item.id} onClick={() => patch({ ...progress, selectedBingoIds: selected.includes(item.id) ? selected.filter((v) => v !== item.id) : [...selected, item.id], completedBingoLines: lines })} className={`rounded-xl border p-2 text-left text-sm ${selected.includes(item.id) ? "border-slate-900 bg-slate-900 text-white" : "bg-white"}`}>{index === 0 ? <img src={DAY01_AI_ROLE_ASSETS.voiceAssistantIcon} alt="음성 비서" className="mb-1 h-6 w-6" /> : index === 1 ? <img src={DAY01_AI_ROLE_ASSETS.videoRecommendationIcon} alt="영상 추천" className="mb-1 h-6 w-6" /> : index === 2 ? <img src={DAY01_AI_ROLE_ASSETS.routeRecommendationIcon} alt="경로 추천" className="mb-1 h-6 w-6" /> : null}{item.label}</button>)}</div>
      <p className="mt-2 text-xs text-slate-500">{selected.length}/16 선택 · 줄 {lines}</p>
    </article>

    <article className="rounded-2xl border border-slate-200 p-4 md:p-5"><h3 className="text-lg font-semibold">AI인지 아닌지 빠른 판별</h3><p className="mt-1 text-sm text-slate-600">패턴 인식, 추천, 언어/시각 상호작용 여부로 빠르게 판단해 보세요.</p>
      {DAY01_CLASSIFIER_STATEMENTS.map((s) => <div key={s.id} className="mt-3 text-sm"><div>{s.text}</div><div className="mt-1 flex flex-wrap gap-1">{[["ai", "AI일 가능성"], ["not_ai", "AI 아님"], ["depends", "상황에 따라"]].map(([id, lab]) => <button key={id} className="rounded-full border px-2.5 py-1" onClick={() => setClassifier({ ...classifier, [s.id]: id as string })}>{lab}</button>)}</div>{classifier[s.id] && <div className="mt-1 text-xs text-slate-500">{classifier[s.id] === s.correct ? "좋아요!" : "다시 생각해봐요."}</div>}</div>)}
    </article>

    <article className="rounded-2xl border border-slate-200 p-4 md:p-5"><h3 className="text-lg font-semibold">AI와 사람 역할 구분</h3><p className="mt-1 text-sm text-slate-600">AI가 도울 일과 사람이 판단할 일을 나눠 보세요.</p>{DAY01_ROLE_CARDS.map((card) => <div key={card.id} className="mt-3 rounded-xl border border-slate-200 p-3 text-sm"><div>{card.scenario}</div><div className="mt-2 flex flex-wrap gap-1">{BUCKETS.map((b) => <button key={b.id} className="rounded-full border px-2.5 py-1" onClick={() => patch({ ...progress, roleCardPlacements: { ...progress.roleCardPlacements, [card.id]: b.id } })}>{b.label}</button>)}</div></div>)}</article>

    <article className="rounded-2xl border border-slate-200 p-4 md:p-5"><h3 className="text-lg font-semibold">상황 판단 미션</h3><p className="mt-1 text-sm text-slate-600">개인정보, 공정성, 책임을 중심으로 판단해 보세요.</p>{DAY01_SITUATION_MISSIONS.map((m) => <div key={m.id} className="mt-3 text-sm"><p>{m.scenario}</p>{m.choices.map((c) => <button key={c.id} className="mr-1 mt-1 rounded-full border px-2.5 py-1" onClick={() => patch({ ...progress, situationAnswers: { ...progress.situationAnswers, [m.id]: c.id } })}>{c.label}</button>)}</div>)}</article>

    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5"><h3 className="text-lg font-semibold">나의 AI 역할 구분 카드</h3><p className="mt-1 text-sm text-slate-600">오늘 활동을 한 장의 카드로 정리해 저장하세요.</p>
      <input className="mt-2 w-full rounded-lg border p-2" placeholder="생활 속 AI 1" value={result.ai1} onChange={(e) => setResult({ ...result, ai1: e.target.value })} />
      <input className="mt-2 w-full rounded-lg border p-2" placeholder="생활 속 AI 2" value={result.ai2} onChange={(e) => setResult({ ...result, ai2: e.target.value })} />
      <input className="mt-2 w-full rounded-lg border p-2" placeholder="AI가 도와준 일" value={result.aiWork} onChange={(e) => setResult({ ...result, aiWork: e.target.value })} />
      <input className="mt-2 w-full rounded-lg border p-2" placeholder="사람이 판단할 일" value={result.humanWork} onChange={(e) => setResult({ ...result, humanWork: e.target.value })} />
      <div className="mt-2 flex flex-wrap gap-2"><button className="rounded-full border px-3 py-1.5" onClick={() => navigator.clipboard?.writeText(`나의 AI 역할 구분 카드\n생활 속 AI: ${result.ai1}, ${result.ai2}`)}>Copy text</button><button className="rounded-full border px-3 py-1.5" onClick={() => resetDay01Progress()}>Reset</button></div>
    </article>

    <details className="rounded-2xl border border-slate-200 p-4" name="teacher-guide"><summary className="cursor-pointer text-sm font-semibold">교사 가이드 (보조 섹션)</summary><p className="mt-2 text-sm text-slate-600">0–4분 입장 질문, 4–14분 빙고, 14–19분 빠른 판별, 19–31분 역할 구분, 31–38분 상황판단, 38–45분 결과카드·퇴장티켓.</p></details>
  </section>;
}
