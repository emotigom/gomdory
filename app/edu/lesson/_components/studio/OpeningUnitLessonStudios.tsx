"use client";
import { useMemo, useState } from "react";
import { DAY01_AI_ROLE_ASSETS } from "@/lib/edu/courseware/assets/coursewareAssetManifest";
import { DAY02_LESSON_RUNTIME, DAY03_LESSON_RUNTIME, DAY04_LESSON_RUNTIME, DAY05_LESSON_RUNTIME, DAY06_LESSON_RUNTIME, DAY07_LESSON_RUNTIME, DAY08_LESSON_RUNTIME, DAY09_LESSON_RUNTIME, DAY10_LESSON_RUNTIME, DAY11_LESSON_RUNTIME, DAY12_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";
import type { EduLessonRuntime } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeTypes";
import CoursewareAssetImage from "./shared/CoursewareAssetImage";

function Studio({ runtime }: { runtime: EduLessonRuntime }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const total = useMemo(() => runtime.blocks.reduce((n, b) => n + b.estimatedMinutes, 0), [runtime]);
  const isOpeningUnit = runtime.lessonId === "day-2" || runtime.lessonId === "day-3" || runtime.lessonId === "day-4";

  return <section data-courseware-runtime="interactive-lesson-studio-v1" data-lesson-id={runtime.lessonId} data-lesson-volume="45-minute" data-courseware-assets={isOpeningUnit ? "assets-gomdory-opening-unit-v1" : undefined} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-4 md:p-7 overflow-hidden shadow-sm">
    <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900/95 p-5 text-white md:p-7">
      <div className="absolute inset-y-0 right-0 hidden w-40 md:block"><CoursewareAssetImage src={DAY01_AI_ROLE_ASSETS.resultCardTemplate} decorative className="h-full w-full object-cover opacity-35" /></div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">활성 Day 레슨</p>
      <h2 className="mt-1 text-2xl font-bold md:text-3xl">{runtime.titleKo}</h2>
      <p className="mt-2 text-sm text-slate-100">45분 흐름으로 개념 확인부터 활동, 정리까지 이어지는 학습입니다.</p>
      <p className="mt-3 text-sm text-slate-200">{runtime.blocks.filter((b) => b.required && b.kind !== "teacher_guide").length}개 활동 · {total}분</p>
    </header>

    <div className="flex flex-wrap gap-2">
      {runtime.phases.map((phase, index) => <div key={phase.id} className={`rounded-full px-3 py-1.5 text-xs md:text-sm ${index === 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}><b>{phase.titleKo}</b> · {phase.range.labelKo}</div>)}
    </div>

    <div className="space-y-3">
      {runtime.blocks.filter((b) => b.required && b.kind !== "teacher_guide").map((block) => <article key={block.id} className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <h3 className="text-lg font-semibold text-slate-900">{block.title}</h3>
        <p className="mt-1 text-sm text-slate-700 break-words">{block.studentInstructions}</p>
        <div className="mt-3 flex flex-wrap gap-2">{["완료", "다시 보기", "질문 있어요"].map((choice) => <button key={choice} className="rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600" onClick={() => setAnswers((p) => ({ ...p, [block.id]: choice }))}>{choice}</button>)}</div>
        {answers[block.id] ? <p className="mt-2 text-xs text-slate-500">선택: {answers[block.id]}</p> : null}
      </article>)}
    </div>

    <section className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">학습 기록은 로컬 기기에 저장되며 학생 로그인/이름/전화번호/이메일 저장이 필요하지 않습니다.</section>
    <details className="rounded-2xl border border-slate-200 p-4" name="teacher-guide"><summary className="cursor-pointer text-sm font-semibold text-slate-800">교사용 가이드 (보조 패널)</summary><p className="mt-2 text-sm text-slate-600">{runtime.blocks.find((block) => block.kind === "teacher_guide")?.teacherNotes ?? "45분 흐름으로 운영하세요."}</p></details>
  </section>;
}

export function Day02LessonStudio(){ return <Studio runtime={DAY02_LESSON_RUNTIME} />; }
export function Day03LessonStudio(){ return <Studio runtime={DAY03_LESSON_RUNTIME} />; }
export function Day04LessonStudio(){ return <Studio runtime={DAY04_LESSON_RUNTIME} />; }
export function Day05LessonStudio(){ return <Studio runtime={DAY05_LESSON_RUNTIME} />; }
export function Day06LessonStudio(){ return <Studio runtime={DAY06_LESSON_RUNTIME} />; }
export function Day07LessonStudio(){ return <Studio runtime={DAY07_LESSON_RUNTIME} />; }
export function Day08LessonStudio(){ return <Studio runtime={DAY08_LESSON_RUNTIME} />; }
export function Day09LessonStudio(){ return <Studio runtime={DAY09_LESSON_RUNTIME} />; }
export function Day10LessonStudio(){ return <Studio runtime={DAY10_LESSON_RUNTIME} />; }
export function Day11LessonStudio(){ return <Studio runtime={DAY11_LESSON_RUNTIME} />; }
export function Day12LessonStudio(){ return <Studio runtime={DAY12_LESSON_RUNTIME} />; }
