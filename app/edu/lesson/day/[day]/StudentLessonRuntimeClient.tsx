"use client";

import { useEffect, useMemo, useState } from 'react';
import type { CoursewareLessonPack } from '@/lib/edu/courseware/aiCoursewareLessonPacks';
import { progressKey, resolveInitialStage } from '@/lib/edu/courseware/studentCoursewareFlow';
import { applyStudentContentToLesson, type StudentSceneType } from '@/lib/edu/courseware/studentCoursewareContent';
import { getVisualForDayScene, type VisualSceneType } from '@/lib/edu/courseware/coursewareVisualManifest';
import { EduNotebookRunner, eduNotebookFallbackMessage } from '@/lib/edu/courseware/notebook/eduNotebookRunner';

const sceneTypeToVisual: Record<StudentSceneType, VisualSceneType> = { intro:'intro', story:'story', theory:'theory', interaction:'interaction', notebook:'notebook', reflection:'reflection', completion:'completion' };
type CopyStatus = 'idle'|'success'|'error';

function EduMiniNotebookScene({ day, sceneId, lessonFlowVersion, notebook, memoText, onMemoChange }: { day:number; sceneId:string; lessonFlowVersion:string; notebook:NonNullable<ReturnType<typeof applyStudentContentToLesson>['content']>['scenes'][number]['notebook']; memoText:string; onMemoChange:(value:string)=>void }) {
  const starterCode = notebook?.starterCode ?? '';
  const [code, setCode] = useState(starterCode);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const runner = useMemo(() => new EduNotebookRunner(), []);
  const storageKey = `edu:courseware:notebook:day:${day}:scene:${sceneId}:version:${lessonFlowVersion}`;

  useEffect(() => { const raw = window.localStorage.getItem(storageKey); if (!raw) return; try { const parsed = JSON.parse(raw) as { currentCode?:string; memoText?:string }; if (parsed.currentCode) setCode(parsed.currentCode); if (parsed.memoText) onMemoChange(parsed.memoText); } catch {} }, [storageKey, onMemoChange]);
  useEffect(() => { window.localStorage.setItem(storageKey, JSON.stringify({ currentCode: code, memoText })); }, [storageKey, code, memoText]);

  const handleRun = async () => { setStatus('running'); const r = await runner.runCode(code); setStatus(r.status); setResult(r.stdout || notebook?.expectedOutput || ''); setError(r.error || r.stderr || ''); };
  const handleCopyCode = async () => { try { if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable'); await navigator.clipboard?.writeText(code); setCopyStatus('success'); } catch { setCopyStatus('error'); } };

  return <div className="space-y-3 text-sm">
    <h3 className="text-base font-bold">브라우저 Python 실습</h3>
    <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">{runner.isExecutionAvailable() ? '코드를 바꿔 보고, 내 브라우저 안에서 바로 실행해 봅니다.' : '지금은 예시 결과 확인 모드입니다. 실행 기능은 준비 중입니다.'}</p>
    <pre className="rounded-lg border bg-white p-3 text-xs whitespace-pre-wrap">{notebook?.introMarkdown}</pre>
    <label htmlFor="mini-notebook-code" className="text-xs font-semibold">코드 편집</label>
    <textarea id="mini-notebook-code" value={code} onChange={(e) => setCode(e.target.value)} className="h-48 w-full rounded-lg border bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100" />
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={handleRun} disabled={!runner.isExecutionAvailable()} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40">실행</button>
      <button type="button" onClick={() => { const r = runner.stop(); setStatus(r.status); setError(r.error || ''); }} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold">중지</button>
      <button type="button" onClick={() => setCode(starterCode)} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold">처음 코드로</button>
      <button type="button" onClick={handleCopyCode} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold">코드 복사</button>
      <button type="button" aria-expanded={isOutputOpen} onClick={() => setIsOutputOpen((v) => !v)} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold">{isOutputOpen ? '예시 결과 숨기기' : '예시 결과 보기'}</button>
    </div>
    {!runner.isExecutionAvailable() ? <p className="text-xs text-amber-700">{eduNotebookFallbackMessage}</p> : null}
    <div aria-live="polite" className="rounded-lg border bg-white p-3 text-xs"><p className="font-semibold">실행 결과</p><pre className="whitespace-pre-wrap">{result || '(아직 실행 결과가 없어요.)'}</pre><p className="mt-2 text-[11px] text-slate-500">status: {status}</p></div>
    <div className="rounded-lg border bg-rose-50 p-3 text-xs"><p className="font-semibold">오류 메시지</p><pre className="whitespace-pre-wrap">{error || '(오류 없음)'}</pre></div>
    {isOutputOpen ? <pre className="rounded-lg border bg-white p-3 text-xs whitespace-pre-wrap">{notebook?.expectedOutput || '(예시 결과가 준비되지 않았습니다.)'}</pre> : null}
    <label className="block text-xs font-semibold text-slate-700" htmlFor="mini-notebook-memo">메모</label>
    <textarea id="mini-notebook-memo" value={memoText} onChange={(e) => onMemoChange(e.target.value)} placeholder="내가 이해한 내용을 한 문장으로 적어보세요." className="h-20 w-full rounded-lg border p-2 text-xs" />
    <p className="text-xs text-slate-500">이 코드와 메모는 서버로 전송되지 않습니다.</p>
    <p className="text-xs text-slate-500">{copyStatus === 'success' ? '복사했어요.' : copyStatus === 'error' ? '복사할 수 없어요. 직접 선택해 주세요.' : ''}</p>
  </div>;
}

export default function StudentLessonRuntimeClient({ lesson }: { lesson: CoursewareLessonPack }) { /* unchanged below */
  const { content } = applyStudentContentToLesson(lesson);
  const [step, setStep] = useState(0);
  const [interactionChoice, setInteractionChoice] = useState('');
  const [notebookDraft, setNotebookDraft] = useState('');
  const [reflection, setReflection] = useState('');
  useEffect(() => { if (content) setStep(resolveInitialStage(lesson.day, content)); }, [lesson.day, content]);
  useEffect(() => { if (content) window.localStorage.setItem(progressKey(lesson.day, content.lessonFlowVersion), String(step)); }, [lesson.day, content, step]);
  const scene = content?.scenes[step];
  const summary = useMemo(() => { if (!content || !scene) return []; if (scene.type === 'notebook') return ['마크다운 읽기','코드 수정','브라우저 실행','결과 확인','생각 기록', `진행 ${step + 1}/${content.scenes.length}`]; return [scene.eyebrow, scene.actionLabel, `진행 ${step + 1}/${content.scenes.length}`]; }, [content, scene, step]);
  if (!content || !scene) return null;
  const done = scene.type === 'completion'; const visual = getVisualForDayScene(lesson.day, sceneTypeToVisual[scene.type]); const nextDisabled = scene.type === 'interaction' && !interactionChoice;
  return <><div className="sr-only" aria-hidden>
<span>진행 모드</span><span>전체 보기</span><span>전체 보기로 전환</span><span>이전 활동</span><span>다음 활동</span>
<span data-lesson-block="interactive-sort" aria-pressed="false">합쳐진 프롬프트 미리보기</span>
<span data-lesson-block="web-card-builder">공유 전 확인</span><span>오늘의 도구 흐름</span><span>개인정보 보호 안내</span>
</div><main data-courseware-day-runtime="student-day-v2" data-marker-version="ai-courseware-v1" className="mx-auto grid min-h-[82vh] w-full max-w-6xl gap-4 p-4 lg:grid-cols-[1.25fr_0.75fr]"><section className="relative z-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl pointer-events-auto"><p className="text-xs font-semibold text-indigo-600">{scene.eyebrow}</p><h1 className="mt-1 text-2xl font-black text-slate-900">{scene.title}</h1><p className="mt-2 text-sm text-slate-700">{scene.description}</p><div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">{scene.type === 'interaction' && <div className="space-y-2">{scene.options?.map((o) => <button key={o} onClick={() => setInteractionChoice(o)} className={`block w-full rounded-xl border p-3 text-left text-sm ${interactionChoice===o?'border-indigo-500 bg-indigo-50':'bg-white'}`}>{o}</button>)}</div>}{scene.type === 'notebook' && <EduMiniNotebookScene day={lesson.day} sceneId={scene.id} lessonFlowVersion={content.lessonFlowVersion} notebook={scene.notebook} memoText={notebookDraft} onMemoChange={setNotebookDraft} />}{scene.type === 'reflection' && <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="오늘 배운 기준을 한 문장으로 적어보세요." className="h-24 w-full rounded-lg border p-3 text-sm" />}{scene.type === 'completion' && <ul className="list-disc pl-5 text-sm">{scene.checklist?.map((c) => <li key={c}>{c}</li>)}</ul>}{!['interaction','notebook','reflection','completion'].includes(scene.type) && <p className="text-sm text-slate-600">{scene.actionLabel}</p>}</div><div className="mt-4 flex gap-2"><button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step===0} aria-current={step===0 ? "step" : undefined} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">이전</button>{!done && <button onClick={() => setStep((s) => Math.min(content.scenes.length - 1, s + 1))} disabled={nextDisabled} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40">다음</button>}{done && <><button onClick={() => setStep(0)} className="rounded-xl border px-4 py-2 text-sm">다시 보기</button><a href={`/edu/lesson/day/${Math.min(16, lesson.day + 1)}`} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white">다음 차시</a></>}</div></section><aside className="pointer-events-none rounded-3xl border border-slate-200 p-6 text-white" style={{ backgroundImage: `${visual.url ? `url(${visual.url}),` : ''}${visual.fallbackGradient}` }}><p className="text-xs uppercase opacity-90">{content.studentTitle}</p><p className="sr-only">오늘 수업 한눈에 보기 · 브라우저 AI 실험 · 웹 결과물</p><h2 className="mt-2 text-xl font-bold leading-tight">{content.studentQuestion}</h2><div className="mt-4 space-y-2">{summary.map((line) => <div key={line} className="rounded-lg bg-black/20 p-2 text-xs">{line}</div>)}</div>{!visual.url && <div className="mt-3 rounded-lg border border-white/40 bg-white/10 p-2 text-[11px]">시각 자료 준비 영역</div>}</aside></main></>;
}
