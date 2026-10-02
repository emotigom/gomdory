"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { aiCoursewareDayHref, aiCoursewareOverviewHref } from "@/lib/edu/courseware/aiCoursewareRoutes";
import type { AiCoursewareDay } from "@/lib/edu/courseware/aiCoursewareSyllabus";
import { buildAiCoursewareSrcDoc, buildAiCoursewareStorageKey } from "@/lib/edu/courseware/aiCoursewareWorkspace";

export default function AiCoursewareLessonStudio({ lesson, boardId }: { lesson: AiCoursewareDay; boardId?: string }) {
  const storageKey = buildAiCoursewareStorageKey(lesson.day, boardId);
  const [html, setHtml] = useState(lesson.studio.starterHtml ?? "<main><h1>Day workspace</h1></main>");
  const [css, setCss] = useState(lesson.studio.starterCss ?? "body{font-family:system-ui;padding:16px;}");
  const [js, setJs] = useState(lesson.studio.starterJs ?? "");
  const [reflection, setReflection] = useState("");
  const [activeActivity, setActiveActivity] = useState<string[]>([]);
  const srcDoc = useMemo(() => buildAiCoursewareSrcDoc(html, css, js), [html, css, js]);
  const prev = lesson.day > 1 ? aiCoursewareDayHref(lesson.day - 1, { boardId }) : null;
  const next = lesson.day < 32 ? aiCoursewareDayHref(lesson.day + 1, { boardId }) : null;
  const bingoLineCount = useMemo(() => {
    if (lesson.interactiveActivity?.type !== "bingo" || lesson.interactiveActivity.items.length < 9) return 0;
    const checked = new Set(activeActivity);
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    return lines.filter((line) => line.every((idx) => checked.has(lesson.interactiveActivity?.items[idx] ?? ""))).length;
  }, [activeActivity, lesson.interactiveActivity]);

  const toggleActivityItem = (item: string) => {
    setActiveActivity((prevList) => (prevList.includes(item) ? prevList.filter((entry) => entry !== item) : [...prevList, item]));
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { html?: string; css?: string; js?: string; reflection?: string; activity?: string[] };
      if (typeof parsed.html === "string") setHtml(parsed.html);
      if (typeof parsed.css === "string") setCss(parsed.css);
      if (typeof parsed.js === "string") setJs(parsed.js);
      if (typeof parsed.reflection === "string") setReflection(parsed.reflection);
      if (Array.isArray(parsed.activity)) {
        setActiveActivity(parsed.activity.filter((entry): entry is string => typeof entry === "string"));
      }
    } catch {}
  }, [storageKey]);

  return <main className="mx-auto max-w-6xl space-y-6 p-6">
    <header className="rounded border p-4"><h1 className="text-2xl font-bold">{lesson.title}</h1><p>{lesson.subtitle}</p><p>{lesson.durationMinutes}분(+확장 {lesson.expansionMinutes}분) · {lesson.phase}</p><div className="mt-2 flex gap-2">{prev ? <Link className="rounded border px-2" href={prev}>이전 Day</Link> : null}{next ? <Link className="rounded border px-2" href={next}>다음 Day</Link> : null}<Link className="rounded border px-2" href={aiCoursewareOverviewHref({ boardId })}>개요로</Link></div></header>
    <section className="rounded border p-4"><h2 className="font-semibold">오늘 수업 한눈에</h2><ul className="list-disc pl-5">{lesson.goals.map((g)=> <li key={g}>{g}</li>)}</ul></section>
    <section className="rounded border p-4"><h2 className="font-semibold">{lesson.durationMinutes}분 운영 흐름</h2>{lesson.lessonFlow.map((f)=> <div key={f.minutes} className="mt-2 border-t pt-2"><p>{f.minutes} · {f.title}</p><p>교사: {f.teacherAction}</p><p>학생: {f.studentAction}</p></div>)}</section>
    <section className="rounded border p-4"><h2 className="font-semibold">90분 이상 확장 운영(선택)</h2>{lesson.extensionFlow.map((f)=> <div key={f.minutes} className="mt-2 border-t pt-2"><p>{f.minutes} · {f.title}</p><p>교사: {f.teacherAction}</p><p>학생: {f.studentAction}</p></div>)}</section>
    {lesson.interactiveActivity ? <section className="rounded border p-4"><h2 className="font-semibold">인터랙티브 활동 · {lesson.interactiveActivity.title}</h2><p>{lesson.interactiveActivity.instructions}</p><p className="mt-1 text-sm text-slate-600">선택한 항목: {activeActivity.length}개</p>{lesson.interactiveActivity.type === "bingo" ? <p className="text-sm text-slate-600">완성된 빙고 줄: {bingoLineCount}줄 / 목표 {lesson.interactiveActivity.targetCount ?? 3}줄</p> : null}<div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">{lesson.interactiveActivity.items.map((item)=><button key={item} className={`rounded border p-2 text-left ${activeActivity.includes(item) ? "bg-emerald-100" : ""}`} onClick={()=>toggleActivityItem(item)}>{item}</button>)}</div></section> : null}
    <section className="rounded border p-4"><h2 className="font-semibold">{lesson.notebookLab.title}</h2><p>{lesson.notebookLab.summary}</p><div className="mt-2 flex flex-wrap gap-2"><a className="rounded border px-2 py-1" href={lesson.notebookLab.launchUrl} target="_blank" rel="noreferrer">JupyterLite 열기</a><button className="rounded border px-2 py-1" onClick={()=>navigator.clipboard.writeText(lesson.notebookLab.notebookJson)}>노트북(JSON) 복사</button></div><ul className="mt-2 list-disc pl-5">{lesson.notebookLab.tasks.map((task)=><li key={task}>{task}</li>)}</ul></section>
    <section className="rounded border p-4"><h2 className="font-semibold">학생 미션</h2><p>{lesson.studentMission.brief}</p><ul className="list-disc pl-5">{lesson.studentMission.steps.map((s)=><li key={s}>{s}</li>)}</ul></section>
    <section className="rounded border p-4"><h2 className="font-semibold">수업 스튜디오</h2><div className="grid gap-3 md:grid-cols-2"><textarea className="min-h-32 border p-2" value={html} onChange={(e)=>setHtml(e.target.value)} /><textarea className="min-h-32 border p-2" value={css} onChange={(e)=>setCss(e.target.value)} /><textarea className="min-h-32 border p-2 md:col-span-2" value={js} onChange={(e)=>setJs(e.target.value)} /></div><div className="mt-2 flex gap-2"><button className="rounded border px-2" onClick={()=>{setHtml(lesson.studio.starterHtml ?? "");setCss(lesson.studio.starterCss ?? "");setJs(lesson.studio.starterJs ?? "");}}>초기화</button><button className="rounded border px-2" onClick={()=>localStorage.setItem(storageKey, JSON.stringify({ html, css, js, reflection, activity: activeActivity }))}>로컬 저장</button><button className="rounded border px-2" onClick={()=>navigator.clipboard.writeText(`${html}
<style>${css}</style>
<script>${js}</script>`)}>코드 복사</button></div><iframe title={`day-${lesson.day}-preview`} sandbox="allow-scripts" className="mt-3 h-72 w-full border" srcDoc={srcDoc} /></section>
    <section className="rounded border p-4"><h2 className="font-semibold">성찰 / 퇴장 티켓</h2><ul className="list-disc pl-5">{lesson.reflectionPrompts.map((p)=><li key={p}>{p}</li>)}</ul><textarea className="mt-2 min-h-24 w-full border p-2" value={reflection} onChange={(e)=>setReflection(e.target.value)} /><button className="mt-2 rounded border px-2" onClick={()=>navigator.clipboard.writeText(reflection)}>성찰 복사</button></section>
    <section className="rounded border p-4"><h2 className="font-semibold">교사 운영 노트</h2><ul className="list-disc pl-5">{lesson.teacherNotes.map((n)=><li key={n}>{n}</li>)}</ul></section>
  </main>;
}
