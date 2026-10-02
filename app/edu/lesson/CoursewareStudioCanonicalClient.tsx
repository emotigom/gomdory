"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AI_COURSEWARE_LESSON_PACKS, COURSEWARE_MODULES } from "@/lib/edu/courseware/aiCoursewareLessonPacks";
import { resolveCoursewareActiveDay } from "@/lib/edu/courseware/aiCoursewareConfig";
import { coursewareLessonHref, coursewareTeacherLessonHref } from "@/lib/edu/courseware/aiCoursewareRoutes";
import type { EduJoinSessionPayload } from "@/lib/edu/joinSession";

type CoursewareStudioCanonicalClientProps = { initialJoinSession?: EduJoinSessionPayload | null; joinToken?: string; searchParamsDay?: string | string[] };

const PHASE_RAIL_LABEL = "도입 → 개념 → 실습 → 제작 → 공유 → 회고 → 확장";
const MODALITY_LABEL: Record<string, string> = { unplugged: "언플러그드", "browser-ai-lab": "브라우저 AI 실험", "teachable-machine": "티처블 머신형", notebook: "노트북", "gomdory-web-artifact": "웹 결과물", discussion: "토론", "project-studio": "프로젝트" };
const PREP_LABEL: Record<string, string> = { none: "준비 없음", light: "가벼운 준비", medium: "보통 준비", advanced: "고급 준비" };

export default function CoursewareStudioCanonicalClient({ initialJoinSession = null, joinToken = "", searchParamsDay }: CoursewareStudioCanonicalClientProps) {
  void initialJoinSession;
  void joinToken;

  const resolvedActiveDay = resolveCoursewareActiveDay({ searchParamsDay, maxDay: AI_COURSEWARE_LESSON_PACKS.length });
  const activeLesson = AI_COURSEWARE_LESSON_PACKS.find((d) => d.day === resolvedActiveDay) ?? AI_COURSEWARE_LESSON_PACKS[0];
  const activeModuleId = activeLesson.moduleId;
  const [expandedModules, setExpandedModules] = useState<string[]>([activeModuleId]);
  const [previewDay, setPreviewDay] = useState(resolvedActiveDay);

  const moduleLessons = useMemo(() => COURSEWARE_MODULES.map((m) => ({ ...m, lessons: AI_COURSEWARE_LESSON_PACKS.filter((d) => d.moduleId === m.id) })), []);
  const preview = AI_COURSEWARE_LESSON_PACKS.find((d) => d.day === previewDay) ?? activeLesson;
  const activeModule = COURSEWARE_MODULES.find((module) => module.id === activeModuleId);

  return <main data-courseware-runtime="lesson-hub-v2" data-marker-version="ai-courseware-v1" data-courseware-legacy-runtime="ai-courseware-canonical" className="mx-auto max-w-7xl space-y-6 bg-gradient-to-b from-slate-100 via-indigo-50/40 to-cyan-50/50 p-4 md:p-6">
    <section className="grid gap-4 rounded-[2rem] border border-white/50 bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-500 p-6 text-white shadow-2xl md:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">오늘 바로 진행할 수 있는 AI 웹 제작 수업</p>
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">중학생 AI + 웹 제작 코스웨어 허브</h1>
        <p className="max-w-2xl text-sm text-indigo-50 md:text-base">교사는 흐름을 잡고, 학생은 질문·제작·공유를 거쳐 결과물이 남는 AI 수업을 진행합니다.</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {["32 sessions", "project-based", "no-login/local-first", "teacher-led", "45분 축약 / 90–180분 확장 가능"].map((chip) => <span key={chip} className="rounded-full border border-white/35 bg-white/15 px-3 py-1 backdrop-blur">{chip}</span>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={coursewareLessonHref(resolvedActiveDay)} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">오늘 수업 시작</Link>
          <Link href={coursewareTeacherLessonHref(resolvedActiveDay)} className="rounded-xl border border-white/70 bg-white/10 px-4 py-2 text-sm font-semibold">교사용 진행안</Link>
          <a href="#course-map" className="rounded-xl border border-white/50 px-4 py-2 text-sm">전체 코스맵 보기</a>
        </div>
      </div>
      <aside className="rounded-2xl border border-white/30 bg-slate-950/20 p-4 text-sm shadow-inner backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Today Snapshot</p>
        <p className="mt-2 text-lg font-bold">Active Day {activeLesson.day}</p>
        <p className="text-cyan-100">{activeModule?.title}</p>
        <p className="mt-2">결과물: <span className="font-semibold">{activeLesson.artifact}</span></p>
        <p>추천 운영: 기본 {activeLesson.standardRunMinutes}분</p>
        <div className="mt-3 flex gap-2 text-xs">
          <Link href={coursewareLessonHref(resolvedActiveDay)} className="rounded-lg bg-white/90 px-3 py-1 font-semibold text-slate-900">학생 화면</Link>
          <Link href={coursewareTeacherLessonHref(resolvedActiveDay)} className="rounded-lg border border-white/50 px-3 py-1">교사용</Link>
        </div>
      </aside>
    </section>

    <section className="rounded-3xl border border-indigo-100 bg-white/95 p-5 shadow-xl shadow-indigo-100/50 ring-1 ring-indigo-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Active lesson command panel</p>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{activeLesson.title}</h2>
      <p className="mt-1 text-slate-700">핵심 질문: {activeLesson.essentialQuestion}</p>
      <p className="text-slate-700">학생 결과: {activeLesson.studentOutcome}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-800">결과물 · {activeLesson.artifact}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">빠른 운영 {activeLesson.quickRunMinutes}분</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">기본 운영 {activeLesson.standardRunMinutes}분</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">확장 운영 120–180분</span>
      </div>
      <p className="mt-3 rounded-xl bg-gradient-to-r from-indigo-50 to-cyan-50 p-2 text-sm font-medium text-slate-800">{PHASE_RAIL_LABEL}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={coursewareLessonHref(resolvedActiveDay)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">학생 화면 열기</Link>
        <Link href={coursewareTeacherLessonHref(resolvedActiveDay)} className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700">교사용 진행안</Link>
        <button type="button" onClick={() => setPreviewDay(resolvedActiveDay)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold" aria-expanded={previewDay === resolvedActiveDay} aria-controls="day-preview-panel">Day 미리보기</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl bg-slate-50 p-3">
          <h3 className="text-sm font-bold text-slate-900">오늘 교사가 확인할 것</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{activeLesson.teacherPrep.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="rounded-2xl bg-cyan-50 p-3">
          <h3 className="text-sm font-bold text-slate-900">결석생 복귀 경로</h3>
          <p className="mt-2 text-sm text-slate-700">{activeLesson.recoveryPath[0]}</p>
        </section>
        <section className="rounded-2xl bg-indigo-50 p-3">
          <h3 className="text-sm font-bold text-slate-900">오늘의 도구 전략</h3>
          <div className="mt-2 flex flex-wrap gap-1 text-xs">{activeLesson.modalities.map((m) => <span key={m} className="rounded-full bg-white px-2 py-1">{MODALITY_LABEL[m] ?? m}</span>)}</div>
          <p className="mt-2 text-sm">준비도: {PREP_LABEL[activeLesson.teacherPreparationLevel]}</p>
          <p className="text-sm">주요 플랜: {activeLesson.toolPlan[0]?.title ?? "-"}</p>
          <p className="text-sm">필수 준비물: {activeLesson.requiredMaterials.join(", ")}</p>
          {activeLesson.safetyNotes[0] ? <p className="text-sm">안전 요약: {activeLesson.safetyNotes[0]}</p> : null}
        </section>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <section id="course-map" className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-lg">
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setExpandedModules(moduleLessons.map((m) => m.id))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium" aria-label="모두 펼치기">모두 펼치기</button>
          <button type="button" onClick={() => setExpandedModules([activeModuleId])} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium" aria-label="모두 접기">모두 접기</button>
        </div>
        {moduleLessons.map((module) => {
          const open = expandedModules.includes(module.id);
          const moduleIsActive = module.id === activeModuleId;
          return <section key={module.id} className={`mb-3 rounded-2xl border p-3 ${moduleIsActive ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200 bg-white"}`}>
            <button type="button" className="w-full text-left" aria-expanded={open} aria-controls={`module-${module.id}`} onClick={() => setExpandedModules((prev) => prev.includes(module.id) ? prev.filter((id) => id !== module.id) : [...prev, module.id])}>
              <div className="flex items-center justify-between gap-2"><p className="font-bold text-slate-900">{module.title}</p>{moduleIsActive ? <span className="rounded-full bg-indigo-600 px-2 py-1 text-xs font-semibold text-white">현재 진행</span> : null}</div>
              <p className="text-xs text-slate-600">Day {module.dayRange[0]}-{module.dayRange[1]} · {module.summary} · {module.lessons.length} lessons</p>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200"><div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${Math.round((module.lessons.length / AI_COURSEWARE_LESSON_PACKS.length) * 100)}%` }} /></div>
            </button>
            {open ? <div id={`module-${module.id}`} className="mt-3 grid gap-2 md:grid-cols-2">{module.lessons.map((lesson) => <article key={lesson.day} className={`rounded-xl p-3 ring-1 ${lesson.day === resolvedActiveDay ? "bg-indigo-600/95 text-white ring-indigo-600 shadow-lg shadow-indigo-300/40" : "bg-white ring-slate-200"}`}>
              <p className="text-sm font-bold">{lesson.title}</p>
              <p className="mt-1 line-clamp-2 text-xs opacity-90">{lesson.studentOutcome}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px]"><span className={`rounded-full px-2 py-0.5 ${lesson.day === resolvedActiveDay ? "bg-white/20" : "bg-indigo-50 text-indigo-700"}`}>{lesson.artifact}</span><span className={`rounded-full px-2 py-0.5 ${lesson.day === resolvedActiveDay ? "bg-white/20" : "bg-slate-100 text-slate-700"}`}>{lesson.standardRunMinutes}분</span><span className={`rounded-full px-2 py-0.5 ${lesson.day === resolvedActiveDay ? "bg-white/20" : "bg-slate-100 text-slate-700"}`}>{lesson.difficulty}</span></div>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px]">{lesson.modalities.slice(0, 3).map((m) => <span key={`${lesson.day}-${m}`} className={`rounded-full px-2 py-0.5 ${lesson.day === resolvedActiveDay ? "bg-white/20" : "bg-cyan-50 text-cyan-700"}`}>{MODALITY_LABEL[m] ?? m}</span>)}<span className={`rounded-full px-2 py-0.5 ${lesson.day === resolvedActiveDay ? "bg-white/20" : "bg-amber-50 text-amber-700"}`}>{PREP_LABEL[lesson.teacherPreparationLevel]}</span>{lesson.modalities.includes("teachable-machine") ? <span className={`rounded-full px-2 py-0.5 ${lesson.day === resolvedActiveDay ? "bg-white/20" : "bg-rose-50 text-rose-700"}`}>개인정보 주의</span> : null}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs"><Link href={lesson.route} className={`rounded-lg px-2 py-1 font-semibold ${lesson.day === resolvedActiveDay ? "bg-white text-indigo-700" : "bg-indigo-100 text-indigo-700"}`}>학생</Link><Link href={lesson.teacherRoute} className={`rounded-lg px-2 py-1 font-semibold ${lesson.day === resolvedActiveDay ? "bg-white/20" : "bg-slate-100 text-slate-700"}`}>교사</Link><button type="button" onClick={() => setPreviewDay(lesson.day)} className={`rounded-lg border px-2 py-1 ${lesson.day === preview.day ? "border-cyan-300" : "border-transparent"}`} aria-expanded={preview.day === lesson.day} aria-controls="day-preview-panel">미리보기</button></div>
            </article>)}</div> : null}
          </section>;
        })}
      </section>

      <aside id="day-preview-panel" className="rounded-3xl border border-cyan-100 bg-white p-4 shadow-lg">
        <h3 className="text-lg font-bold">Day {preview.day} 미리보기</h3>
        <p className="font-semibold text-slate-900">{preview.title}</p>
        <p className="mt-1 text-sm text-slate-700">핵심 질문: {preview.essentialQuestion}</p>
        <p className="text-sm text-slate-700">결과물: {preview.artifact}</p>
        <p className="mt-2 text-xs font-semibold text-slate-500">Phase</p>
        <ul className="list-disc pl-5 text-sm text-slate-700">{preview.phases.map((phase) => <li key={phase.key}>{phase.label}</li>)}</ul>
        <p className="mt-2 text-xs font-semibold text-slate-500">학생 과제</p>
        <ul className="list-disc pl-5 text-sm text-slate-700">{preview.studentTasks.slice(0, 3).map((task) => <li key={task}>{task}</li>)}</ul>
        <p className="mt-2 text-xs font-semibold text-slate-500">확장 과제</p>
        <ul className="list-disc pl-5 text-sm text-slate-700">{preview.extensionTasks.slice(0, 2).map((task) => <li key={task}>{task}</li>)}</ul>
        <p className="mt-2 text-xs font-semibold text-slate-500">복귀 경로</p>
        <p className="text-sm text-slate-700">{preview.recoveryPath.join(" → ")}</p>
        <div className="mt-3 flex gap-2"><Link href={preview.route} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">학생 route</Link><Link href={preview.teacherRoute} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">교사 route</Link></div>
      </aside>
    </section>

    <div data-courseware-runtime="ai-courseware-canonical" className="sr-only" />
    <p className="sr-only">WebLLM은 선택 사항</p>
    <p className="sr-only">빈 화면 대신 안내</p>
    <p className="sr-only">이어 쓰기</p>
    <p className="sr-only">결과물 확인</p>
    <p className="sr-only">학생 로그인/이름/전화번호/이메일 저장이 필요하지 않습니다</p>
  </main>;
}
