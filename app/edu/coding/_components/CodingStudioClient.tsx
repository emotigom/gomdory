"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { assessLessonCheckpoint } from "@/lib/coding-studio/assessment";
import { getAssignmentFixture } from "@/lib/coding-studio/assignmentFixtures";
import {
  activateAssignment,
  advanceAssignmentOnLessonCompletion,
  buildAssignmentEcho,
  loadAssignmentResumeState,
  loadCodingStudioAssignments,
  resetAssignmentResumeProgress,
  resolveActiveAssignment,
  resolveAssignedCurrentLesson,
  touchAssignmentLesson,
  upsertCodingStudioAssignment,
  type CodingStudioAssignmentResumeState,
} from "@/lib/coding-studio/assignmentStore";
import { compileBlocksToIr } from "@/lib/coding-studio/ir";
import { getLessonById, getNextLessonId, STUDIO_LESSON_PACK, STUDIO_LESSON_PATH, STUDIO_LESSON_SCENES } from "@/lib/coding-studio/lessons";
import { loadCodingStudioProgression, markLessonCompleted, saveCodingStudioProgression, updateCurrentLesson } from "@/lib/coding-studio/progressionStore";
import { createLessonTemplateProject } from "@/lib/coding-studio/projectSchema";
import { loadCodingStudioProject, resetCodingStudioProject, saveCodingStudioProject } from "@/lib/coding-studio/projectStore";
import { getLatestFeedbackNotesForLesson } from "@/lib/coding-studio/feedbackStore";
import { buildSubmissionEvidence } from "@/lib/coding-studio/submissionEvidence";
import { buildRevisionSummary, type CodingStudioRevisionSummary } from "@/lib/coding-studio/revisionSummary";
import { getLatestSubmissionForLesson, getSubmissionById, listSubmissionsByLesson, saveCodingStudioSubmission } from "@/lib/coding-studio/submissionStore";
import { CODING_STUDIO_SUBMISSION_UI_COPY } from "@/lib/coding-studio/submissionUiCopy";
import { resolveCurriculumStageByLessonId } from "@/lib/coding-studio/curriculumMap";
import { buildLearningGoalSummary } from "@/lib/coding-studio/learningGoalSummary";
import { CODING_STUDIO_RUBRIC_SCHEMA } from "@/lib/coding-studio/rubricSchema";
import { resolveCodingStudioEntrySource, resolveEntryNotice, resolveReworkEntryNotice, shouldShowStudioFirstEntryOnboarding } from "@/lib/coding-studio/studioEntry";
import type { CodingStudioSubmissionSnapshot } from "@/lib/coding-studio/submissionSchema";
import {
  buildExecutionPlan,
  createInitialStudioRuntimeState,
  stepStudioProgram,
} from "@/lib/coding-studio/interpreter";
import type { CodingStudioAssessmentResult, CodingStudioProgressionState, LessonId, StudioBlockNode, StudioRuntimeState } from "@/lib/coding-studio/types";
import type { StudioInteractiveLessonId } from "@/lib/coding-studio/types";

import { CodingStudioThreeCanvas } from "./CodingStudioThreeCanvas";

const ONBOARDING_DISMISS_KEY = "gom:coding-studio:first-entry-dismissed:v1";

const blockCatalog: Array<{ type: StudioBlockNode["type"]; label: string }> = [
  { type: "move", label: "이동" },
  { type: "turn", label: "회전" },
  { type: "repeat", label: "반복" },
  { type: "if_sensor", label: "조건(감지)" },
  { type: "wait", label: "대기" },
  { type: "set_color", label: "색/상태" },
  { type: "set_goal", label: "목표" },
];

function createBlock(type: StudioBlockNode["type"], index: number): StudioBlockNode {
  if (type === "repeat") {
    return { id: `repeat-${index}`, type, params: { count: 2 }, children: [{ id: `move-${index}`, type: "move", params: { distance: 1 } }] };
  }
  if (type === "if_sensor") {
    return { id: `if-sensor-${index}`, type, children: [{ id: `turn-${index}`, type: "turn", params: { degrees: 45 } }] };
  }
  if (type === "turn") return { id: `turn-${index}`, type, params: { degrees: 45 } };
  if (type === "wait") return { id: `wait-${index}`, type, params: { ticks: 1 } };
  if (type === "set_color") return { id: `set-color-${index}`, type, params: { color: "#8ec5ff" } };
  if (type === "set_goal") return { id: `set-goal-${index}`, type, params: { x: 4, z: 1 } };
  return { id: `move-${index}`, type, params: { distance: 1 } };
}

function getAssessmentToneClass(tone: CodingStudioAssessmentResult["tone"]) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "near-success") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function resolveInteractiveScene(lessonId: LessonId) {
  const lesson = getLessonById(lessonId);
  if (lesson.kind === "interactive") {
    return STUDIO_LESSON_SCENES[lesson.id as StudioInteractiveLessonId];
  }
  return STUDIO_LESSON_SCENES["goal-move"];
}

function createSubmissionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `submission-${Date.now()}`;
}

export default function CodingStudioClient() {
  const searchParams = useSearchParams();
  const entry = searchParams.get("entry");
  const assignmentPreset = searchParams.get("assignment");

  const [progression, setProgression] = useState<CodingStudioProgressionState>(() => loadCodingStudioProgression());
  const [lessonId, setLessonId] = useState<LessonId>(() => loadCodingStudioProgression().currentLessonId);
  const [project, setProject] = useState(() => createLessonTemplateProject(lessonId));
  const initialScene = resolveInteractiveScene(lessonId);
  const [runtimeState, setRuntimeState] = useState<StudioRuntimeState>(() => createInitialStudioRuntimeState(initialScene));
  const [pointer, setPointer] = useState(0);
  const [status, setStatus] = useState("실습 장면 준비 완료");
  const [trace, setTrace] = useState<string[]>([]);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [showDebugDetail, setShowDebugDetail] = useState(false);
  const [assessment, setAssessment] = useState<CodingStudioAssessmentResult | null>(null);
  const [assignmentResume, setAssignmentResume] = useState<CodingStudioAssignmentResumeState>(() => loadAssignmentResumeState());
  const [assignments, setAssignments] = useState(() => loadCodingStudioAssignments());
  const [latestSubmission, setLatestSubmission] = useState<CodingStudioSubmissionSnapshot | null>(null);
  const [submissionHistory, setSubmissionHistory] = useState<CodingStudioSubmissionSnapshot[]>([]);
  const [reviewModeSubmissionId, setReviewModeSubmissionId] = useState<string | null>(null);
  const [revisionSummary, setRevisionSummary] = useState<CodingStudioRevisionSummary | null>(null);
  const [latestLessonFeedbackCount, setLatestLessonFeedbackCount] = useState(0);
  const [latestLessonFeedbackNotes, setLatestLessonFeedbackNotes] = useState(() => getLatestFeedbackNotesForLesson(lessonId));
  const [reworkSourceSubmissionId, setReworkSourceSubmissionId] = useState<string | null>(null);

  const lesson = getLessonById(lessonId);
  const currentStage = resolveCurriculumStageByLessonId(lessonId);
  const rubric = CODING_STUDIO_RUBRIC_SCHEMA[lessonId];
  const lessonRubricCriteria = rubric?.criteria ?? [];
  const sceneTemplate = lesson.kind === "interactive" ? resolveInteractiveScene(lessonId) : null;
  const ir = useMemo(() => compileBlocksToIr(project.blocks), [project.blocks]);
  const executionPlan = useMemo(() => buildExecutionPlan(ir), [ir]);
  const currentInstruction = executionPlan[pointer] ?? null;
  const runFinished = pointer >= executionPlan.length;
  const statusTone = assessment?.tone === "success" ? "success" : assessment?.tone === "near-success" ? "failure" : "neutral";
  const nextLessonId = getNextLessonId(lessonId);
  const activeAssignment = useMemo(
    () => resolveActiveAssignment({ assignments, resume: assignmentResume }),
    [assignments, assignmentResume],
  );
  const assignmentEcho = useMemo(
    () => buildAssignmentEcho({ assignment: activeAssignment, resume: assignmentResume }),
    [activeAssignment, assignmentResume],
  );
  const entrySource = resolveCodingStudioEntrySource({ entry, hasActiveAssignment: Boolean(activeAssignment) });
  const entryNotice = resolveEntryNotice(entrySource);
  const reviewSubmissionId = searchParams.get("reviewSubmissionId");

  useEffect(() => {
    const dismissed = window.sessionStorage.getItem(ONBOARDING_DISMISS_KEY) === "1";
    setOnboardingVisible(shouldShowStudioFirstEntryOnboarding({ entry, dismissed }));
  }, [entry]);

  useEffect(() => {
    const next = loadCodingStudioProgression();
    const nextResume = loadAssignmentResumeState();
    const nextAssignments = loadCodingStudioAssignments();
    const nextActive = resolveActiveAssignment({ assignments: nextAssignments, resume: nextResume });
    const assignedLessonId = resolveAssignedCurrentLesson({ assignment: nextActive, resume: nextResume });
    setProgression(next);
    setAssignmentResume(nextResume);
    setLessonId(assignedLessonId ?? next.currentLessonId);
  }, []);

  useEffect(() => {
    const fixture = getAssignmentFixture(assignmentPreset);
    if (!fixture) return;
    upsertCodingStudioAssignment(fixture);
    const nextResume = activateAssignment({ assignmentId: fixture.assignmentId, preferredLessonId: fixture.recommendedStartLessonId });
    setAssignmentResume(nextResume);
    const nextLesson = resolveAssignedCurrentLesson({ assignment: fixture, resume: nextResume }) ?? fixture.recommendedStartLessonId;
    setLessonId(nextLesson);
    setStatus("오늘의 실습 경로를 불러왔어요. 목표를 확인하고 바로 시작할 수 있어요.");
  }, [assignmentPreset]);

  useEffect(() => {
    setAssignments(loadCodingStudioAssignments());
  }, [assignmentResume.lastOpenedAt]);

  useEffect(() => {
    if (!reviewSubmissionId) {
      setReviewModeSubmissionId(null);
      return;
    }
    const submission = getSubmissionById(reviewSubmissionId);
    if (!submission) return;
    setReviewModeSubmissionId(reviewSubmissionId);
    setLessonId(submission.lessonId);
    setProject(submission.projectSnapshot);
    const nextRuntime = createInitialStudioRuntimeState(resolveInteractiveScene(submission.lessonId));
    nextRuntime.x = submission.replay.runtimeState.x;
    nextRuntime.z = submission.replay.runtimeState.z;
    nextRuntime.heading = submission.replay.runtimeState.heading;
    nextRuntime.stepCount = submission.replay.runtimeState.stepCount;
    nextRuntime.reachedGoal = submission.replay.runtimeState.reachedGoal;
    nextRuntime.blocked = submission.replay.runtimeState.blocked;
    setRuntimeState(nextRuntime);
    setPointer(submission.projectSnapshot.blocks.length);
    setStatus("제출 검토 맥락을 불러왔어요");
  }, [reviewSubmissionId]);

  useEffect(() => {
    const nextProject = loadCodingStudioProject(lessonId);
    setProject(nextProject);
    setAssessment(null);
    if (sceneTemplate) {
      setRuntimeState(createInitialStudioRuntimeState(sceneTemplate));
    }
    setPointer(0);
    setTrace([]);
    setLatestSubmission(getLatestSubmissionForLesson(lessonId));
    setSubmissionHistory(listSubmissionsByLesson(lessonId));
    const latestFeedbackNotes = getLatestFeedbackNotesForLesson(lessonId);
    setLatestLessonFeedbackNotes(latestFeedbackNotes);
    setLatestLessonFeedbackCount(latestFeedbackNotes.length);
    setReworkSourceSubmissionId(latestFeedbackNotes[0]?.submissionId ?? null);
    setRevisionSummary(null);
  }, [lessonId, sceneTemplate]);

  const resetRuntime = () => {
    if (!sceneTemplate) return;
    setRuntimeState(createInitialStudioRuntimeState(sceneTemplate));
    setPointer(0);
    setStatus("초기 상태로 돌아왔어요. 관찰 포인트를 다시 확인해 볼까요?");
    setTrace([]);
    setAssessment(null);
  };

  const runAssessment = (nextRuntimeState: StudioRuntimeState) => {
    const assessed = assessLessonCheckpoint({
      lessonId,
      runtimeState: nextRuntimeState,
      blocks: project.blocks,
    });
    setAssessment(assessed);

    if (!assessed.completed) return;

    const nextProgression = markLessonCompleted(progression, lessonId);
    setProgression(nextProgression);
    const nextResume = advanceAssignmentOnLessonCompletion({
      assignment: activeAssignment,
      resume: assignmentResume,
      completedLessonId: lessonId,
    });
    setAssignmentResume(nextResume);
  };

  const onStep = () => {
    if (!sceneTemplate) return;
    const next = stepStudioProgram({ plan: executionPlan, pointer, scene: sceneTemplate, state: runtimeState });
    setRuntimeState(next.state);
    setPointer(next.pointer);
    setStatus(next.finished ? (next.state.reachedGoal ? "목표 도달을 확인했어요" : "실행을 마쳤어요") : `한 단계 실행 · ${next.actionLabel}`);
    setTrace((prev) => [...next.events.map((event) => `${event.action} · ${event.detail}`), ...prev].slice(0, 6));
    if (next.finished) runAssessment(next.state);
  };

  const onRun = () => {
    if (!sceneTemplate) return;
    let localPointer = pointer;
    let localState = runtimeState;
    const logs: string[] = [];
    while (localPointer < executionPlan.length) {
      const snap = stepStudioProgram({ plan: executionPlan, pointer: localPointer, scene: sceneTemplate, state: localState });
      localPointer = snap.pointer;
      localState = snap.state;
      logs.unshift(...snap.events.map((event) => `${event.action} · ${event.detail}`));
      if (snap.finished) break;
    }
    setRuntimeState(localState);
    setPointer(localPointer);
    setStatus(localState.reachedGoal ? "목표 도달을 확인했어요" : "실행을 마쳤어요");
    setTrace(logs.slice(0, 6));
    runAssessment(localState);
  };

  const onLessonChange = (nextLessonIdValue: LessonId) => {
    if (reviewModeSubmissionId) return;
    if (!progression.unlockedLessonIds.includes(nextLessonIdValue)) return;
    const nextState = updateCurrentLesson(progression, nextLessonIdValue);
    setProgression(nextState);
    setLessonId(nextState.currentLessonId);
    const dismissed = window.sessionStorage.getItem(ONBOARDING_DISMISS_KEY) === "1";
    setOnboardingVisible(shouldShowStudioFirstEntryOnboarding({ entry, dismissed }));
    setAssignmentResume(touchAssignmentLesson({ lessonId: nextLessonIdValue }));
  };

  const continueToNextLesson = () => {
    if (reviewModeSubmissionId) return;
    if (!nextLessonId || !progression.unlockedLessonIds.includes(nextLessonId)) return;
    onLessonChange(nextLessonId);
  };

  const stageLessons = {
    foundation: STUDIO_LESSON_PATH.filter((entryLesson) => entryLesson.stageGroup === "입문 기초"),
    expansion: STUDIO_LESSON_PATH.filter((entryLesson) => entryLesson.stageGroup === "입문 확장"),
    next: STUDIO_LESSON_PATH.filter((entryLesson) => entryLesson.stageGroup === "다음 단계"),
  };

  const completedCount = progression.completedLessonIds.filter((id) => getLessonById(id).stageGroup !== "다음 단계").length;
  const reviewMode = Boolean(reviewModeSubmissionId);
  const learningGoalSummary = buildLearningGoalSummary(lessonId);
  const revisionNotice = resolveReworkEntryNotice({
    latestSubmissionExists: Boolean(latestSubmission),
    feedbackCount: latestLessonFeedbackCount,
    primaryFocus: latestSubmission?.assessment.keyCondition ?? null,
  });

  const onSubmitSnapshot = () => {
    if (!assessment) {
      setStatus("먼저 실행 후 체크포인트를 확인해 주세요");
      return;
    }

    const evidence = buildSubmissionEvidence({
      lessonId,
      project,
      runtimeState,
      assessment,
    });
    const previousSubmission = getLatestSubmissionForLesson(lessonId);
    const snapshot: CodingStudioSubmissionSnapshot = {
      submissionSchemaVersion: 1,
      submissionId: createSubmissionId(),
      assignmentId: assignmentResume.activeAssignmentId,
      lessonId,
      projectSchemaVersion: project.schemaVersion,
      submittedAt: new Date().toISOString(),
      entrySource,
      projectSnapshot: project,
      assessment: {
        tone: assessment.tone,
        summary: assessment.summary,
        retryHint: assessment.retryHint,
        completionReflection: assessment.reflectionLine,
        keyCondition: assessment.keyCondition,
      },
      evidence,
      replay: {
        reviewModeSupported: true,
        runtimeState: {
          x: runtimeState.x,
          z: runtimeState.z,
          heading: runtimeState.heading,
          stepCount: runtimeState.stepCount,
          reachedGoal: runtimeState.reachedGoal,
          blocked: runtimeState.blocked,
        },
        sceneId: lessonId,
      },
      revision: {
        previousSubmissionId: previousSubmission?.submissionId ?? null,
        reworkSourceSubmissionId,
      },
    };
    const all = saveCodingStudioSubmission(snapshot);
    setLatestSubmission(snapshot);
    setSubmissionHistory(all.filter((entry) => entry.lessonId === lessonId));
    const linkedGoalLabels = Array.from(
      new Set(
        latestLessonFeedbackNotes
          .map((note) => note.criterionId)
          .filter((criterionId): criterionId is NonNullable<typeof criterionId> => Boolean(criterionId))
          .map((criterionId) => lessonRubricCriteria.find((criterion) => criterion.criterionId === criterionId)?.label)
          .filter((label): label is string => Boolean(label)),
      ),
    );
    setRevisionSummary(buildRevisionSummary({ previous: previousSubmission, current: snapshot, reworkSourceSubmissionId, linkedGoalLabels }));
    setReworkSourceSubmissionId(null);
    setStatus("실습 결과를 제출했어요. 이전 제출 대비 변화도 함께 확인해 보세요.");
  };

  return (
    <section className="space-y-5" data-testid="edu-coding-studio-shell">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">학생 코딩 스튜디오 · {STUDIO_LESSON_PACK.title}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">아카데미에서 정리한 생각을, 3D 실행·관찰·수정 루프로 완성해요.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">각 레슨은 왜 이 실습을 하는지부터 무엇을 관찰해야 하는지까지 명확하게 안내합니다.</p>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">{entryNotice.title}</p>
          <p className="mt-1 text-slate-600">{entryNotice.detail}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700" href="/world-hub?return=coding-studio">
            월드 허브로 돌아가기
          </Link>
          <p className="text-xs text-slate-500">입문 진행 {completedCount}/5 · 현재 단계 {lesson.order}</p>
        </div>
        {reviewMode ? (
          <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
            <p className="font-semibold">{CODING_STUDIO_SUBMISSION_UI_COPY.reviewModeLabel}</p>
            <p className="mt-1">이 화면은 제출본 검토용으로 열렸어요. 편집/진행 변경은 잠시 비활성화됩니다.</p>
          </div>
        ) : null}
        {!reviewMode && revisionNotice ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-semibold">{CODING_STUDIO_SUBMISSION_UI_COPY.reworkStripTitle} · {revisionNotice.title}</p>
            <p className="mt-1">{revisionNotice.detail}</p>
            <p className="mt-1 text-[11px]">{revisionNotice.focusLine}</p>
            {reworkSourceSubmissionId ? (
              <Link className="mt-2 inline-flex rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900" href={`/edu/coding/review?submissionId=${reworkSourceSubmissionId}`}>
                이전 제출 맥락 보기
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>

      {onboardingVisible ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm">
          <div>
            <p className="font-semibold text-indigo-900">여기는 아카데미 준비를 3D 실행과 수정으로 이어가는 단계형 코딩 스튜디오예요.</p>
            <p className="mt-1 text-xs text-indigo-800/90">
              현재 레슨: {lesson.title} · 먼저 <span className="font-semibold">{lesson.recommendedFirstStep}</span>
            </p>
          </div>
          <button
            className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800"
            onClick={() => {
              window.sessionStorage.setItem(ONBOARDING_DISMISS_KEY, "1");
              setOnboardingVisible(false);
            }}
            type="button"
          >
            바로 시작
          </button>
        </section>
      ) : null}

      {activeAssignment && assignmentEcho ? (
        <section className="rounded-2xl border border-violet-200 bg-violet-50/50 px-4 py-3 text-sm">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-violet-700">오늘의 실습 경로</p>
          <p className="mt-1 font-semibold text-violet-950">{activeAssignment.title}</p>
          <p className="mt-1 text-xs text-violet-900/90">현재 레슨: {getLessonById(assignmentEcho.currentLessonId).title}</p>
          <p className="mt-1 text-xs text-violet-800/85">
            {assignmentEcho.nextLessonId ? `다음 레슨: ${getLessonById(assignmentEcho.nextLessonId).title}` : "경로의 마지막 레슨까지 진행했어요."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-900"
              onClick={() => onLessonChange(assignmentEcho.currentLessonId)}
              type="button"
            >
              지정 레슨 이어가기
            </button>
            <button
              className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs text-violet-700"
              onClick={() => {
                const reset = resetAssignmentResumeProgress();
                setAssignmentResume(reset);
                setStatus("실습 경로 이어하기 상태를 초기화했어요");
              }}
              type="button"
            >
              실습 경로 이어하기 초기화
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">레슨 레일</p>
          <div className="mt-3 space-y-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500">입문 기초</p>
              <div className="mt-2 space-y-2">
                {stageLessons.foundation.map((item) => {
                  const unlocked = progression.unlockedLessonIds.includes(item.id);
                  const completed = progression.completedLessonIds.includes(item.id);
                  const active = item.id === lessonId;
                  return (
                    <button
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                        active
                          ? "border-slate-800 bg-slate-900 text-white"
                          : unlocked
                            ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      }`}
                      disabled={!unlocked}
                      key={item.id}
                    onClick={() => onLessonChange(item.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{item.title}</p>
                        <span className={`text-[11px] ${active ? "text-slate-200" : "text-slate-500"}`}>{completed ? "완료" : unlocked ? "진행 가능" : "잠금"}</span>
                      </div>
                      <p className={`mt-1 text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>{item.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500">입문 확장</p>
              <div className="mt-2 space-y-2">
                {stageLessons.expansion.map((item) => {
                  const unlocked = progression.unlockedLessonIds.includes(item.id);
                  const completed = progression.completedLessonIds.includes(item.id);
                  const active = item.id === lessonId;
                  return (
                    <button
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                        active
                          ? "border-slate-800 bg-slate-900 text-white"
                          : unlocked
                            ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      }`}
                      disabled={!unlocked}
                      key={item.id}
                      onClick={() => onLessonChange(item.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{item.title}</p>
                        <span className={`text-[11px] ${active ? "text-slate-200" : "text-slate-500"}`}>{completed ? "완료" : unlocked ? "진행 가능" : "잠금"}</span>
                      </div>
                      <p className={`mt-1 text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>{item.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500">다음 단계</p>
              {stageLessons.next.map((item) => {
                const unlocked = progression.unlockedLessonIds.includes(item.id);
                return (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600" key={item.id}>
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <p className="mt-1">{unlocked ? item.nextLessonPrompt : item.previewLine}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">오늘의 목표</p>
            <p className="mt-1">{lesson.goalLine}</p>
            <p className="mt-2 text-slate-600">체크포인트 기준: {lesson.assessmentFocus}</p>
            <p className="mt-2 text-slate-600">현재 단계: {currentStage.label}</p>
            <p className="mt-1 text-[11px] text-slate-500">다음 준비: {currentStage.preparesNext}</p>
          </div>

          <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
            <p className="font-semibold">이번 실습에서 연습하는 것</p>
            <p className="mt-1">{learningGoalSummary.currentPractice}</p>
            <p className="mt-2 font-semibold">이번에 다시 다듬을 부분</p>
            <p className="mt-1">{learningGoalSummary.refineFocus}</p>
            <p className="mt-2 font-semibold">다음에 이어서 해볼 것</p>
            <p className="mt-1">{learningGoalSummary.nextBridge}</p>
          </div>
        </aside>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div
            className={`rounded-xl border px-3 py-2 text-xs ${
              statusTone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : statusTone === "failure"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <p className="font-semibold">{status}</p>
            <p className="mt-1">
              {runFinished
                ? assessment?.completed
                  ? `${lesson.completionReflection} ${lesson.nextLessonPrompt}`
                  : lesson.retryHint
                 : `현재 단계: ${pointer + 1} / ${executionPlan.length}${currentInstruction ? ` · 다음 동작 ${currentInstruction.kind}` : ""}`}
            </p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            <p className="font-semibold">이번 제출 전에 확인할 학습 목표</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {[learningGoalSummary.currentPractice, learningGoalSummary.refineFocus].map((goalLine) => (
                <li key={goalLine}>{goalLine}</li>
              ))}
            </ul>
            <p className="mt-2 font-semibold">이번에 다시 다듬을 부분</p>
            <p className="mt-1">{learningGoalSummary.refineFocus}</p>
            <p className="mt-2 font-semibold">다음에 이어서 연습할 것</p>
            <p className="mt-1">{learningGoalSummary.nextBridge}</p>
          </div>

          {lesson.kind === "interactive" ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">블록 워크스페이스</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {blockCatalog.map((block) => (
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                        key={block.type}
                        disabled={reviewMode}
                        onClick={() =>
                          setProject((prev) => ({
                            ...prev,
                            blocks: [...prev.blocks, createBlock(block.type, prev.blocks.length + 1)],
                            metadata: { ...prev.metadata, source: "student", updatedAt: new Date().toISOString() },
                          }))
                        }
                        type="button"
                      >
                        + {block.label}
                      </button>
                    ))}
                  </div>
                  <ol className="mt-4 space-y-2">
                    {project.blocks.map((block, index) => (
                      <li
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          index === pointer && !runFinished ? "border-indigo-300 bg-indigo-50 text-indigo-900" : "border-slate-200 bg-white text-slate-700"
                        }`}
                        key={block.id}
                      >
                        {index + 1}. {block.type}
                      </li>
                    ))}
                  </ol>
                </article>

                <article className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">3D 실행 장면</p>
                  <CodingStudioThreeCanvas runtimeState={runtimeState} sceneTemplate={sceneTemplate ?? STUDIO_LESSON_SCENES["goal-move"]} />
                </article>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={reviewMode} onClick={onRun} type="button">
                  실행
                </button>
                <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={reviewMode} onClick={onStep} type="button">
                  한 단계
                </button>
                <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={reviewMode} onClick={resetRuntime} type="button">
                  리셋
                </button>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  disabled={reviewMode}
                  onClick={() => {
                    saveCodingStudioProject(project);
                    setStatus("프로젝트 저장 완료");
                  }}
                  type="button"
                >
                  저장
                </button>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  disabled={reviewMode}
                  onClick={() => {
                    const loaded = loadCodingStudioProject(lessonId);
                    setProject(loaded);
                    setStatus("저장본 불러오기 완료");
                  }}
                  type="button"
                >
                  불러오기
                </button>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  disabled={reviewMode}
                  onClick={() => {
                    const template = resetCodingStudioProject(lessonId);
                    setProject(template);
                    resetRuntime();
                    setStatus("현재 레슨 템플릿으로 되돌림");
                  }}
                  type="button"
                >
                  레슨 템플릿 복원
                </button>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  disabled={reviewMode}
                  onClick={() => {
                    const resetProgression = loadCodingStudioProgression();
                    saveCodingStudioProgression({
                      ...resetProgression,
                      completedLessonIds: [],
                      unlockedLessonIds: ["goal-move"],
                      currentLessonId: "goal-move",
                      updatedAt: new Date().toISOString(),
                    });
                    const next = loadCodingStudioProgression();
                    setProgression(next);
                    setLessonId(next.currentLessonId);
                    setStatus("전체 학습 진행을 초기화했어요");
                  }}
                  type="button"
                >
                  진행 초기화
                </button>
                <button className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-900 disabled:opacity-40" disabled={reviewMode} onClick={onSubmitSnapshot} type="button">
                  {CODING_STUDIO_SUBMISSION_UI_COPY.submitAction}
                </button>
              </div>
            </>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">준비 중인 다음 단계</p>
              <p className="mt-2">{lesson.nextLessonPrompt}</p>
              <p className="mt-2 text-xs text-slate-600">{lesson.recommendedFirstStep}</p>
            </section>
          )}


          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">왜 이 실습을 하나요?</p>
            <p className="mt-1">{lesson.whyThisMatters}</p>
            <p className="mt-2 font-semibold text-slate-900">장면에서 관찰할 포인트</p>
            <p className="mt-1">{lesson.sceneObservation}</p>
            <p className="mt-2 font-semibold text-slate-900">자주 나오는 실수와 개선 신호</p>
            <p className="mt-1">{lesson.commonMistake}</p>
            <p className="mt-1 text-slate-600">개선 신호: {lesson.improvementSignal}</p>
          </div>

          {rubric ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
              <p className="font-semibold">교사 관찰 기준(요약)</p>
              <p className="mt-1">학습 목표: {rubric.learningGoal}</p>
              <ul className="mt-2 space-y-1">
                {rubric.criteria.slice(0, 2).map((criterion) => (
                  <li key={criterion.criterionId}>· {criterion.label} — {criterion.teacherLookFor}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {assessment ? (
            <div className={`rounded-xl border p-3 text-xs ${getAssessmentToneClass(assessment.tone)}`}>
              <p className="font-semibold">조용한 체크포인트</p>
              <p className="mt-1">핵심 조건: {assessment.keyCondition}</p>
              <p className="mt-1">{assessment.summary}</p>
              <p className="mt-1">다시 시도 힌트: {assessment.retryHint}</p>
              <p className="mt-1 text-[11px] opacity-90">{assessment.reflectionLine}</p>
              {assessment.completed ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {nextLessonId && progression.unlockedLessonIds.includes(nextLessonId) ? (
                    <button
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 font-semibold text-emerald-800"
                      onClick={continueToNextLesson}
                      type="button"
                    >
                      다음 레슨으로 이어가기
                    </button>
                  ) : null}
                  <Link className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 font-semibold text-emerald-800" href="/world-hub?return=coding-studio">
                    아카데미/월드 허브로
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          {latestSubmission ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
              <p className="font-semibold">{CODING_STUDIO_SUBMISSION_UI_COPY.submitSavedTitle}</p>
              <p className="mt-1">입문 진행 {completedCount}/5 · 다음 연결: {learningGoalSummary.nextBridge}</p>
              <p className="mt-1">제출 결과: {latestSubmission.evidence.outcome === "completed" ? "완료로 제출" : "시도본으로 제출"}</p>
              <p className="mt-1">기록 항목: 체크포인트 요약 · 실행 핵심 수치 · 프로젝트 스냅샷</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 font-semibold text-indigo-900" href={`/edu/coding?reviewSubmissionId=${latestSubmission.submissionId}`}>
                  제출본 검토 모드로 열기
                </Link>
                <Link className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 font-semibold text-indigo-900" href={`/edu/coding/review?submissionId=${latestSubmission.submissionId}`}>
                  리뷰 시트 열기
                </Link>
              </div>
            </div>
          ) : null}

          {revisionSummary ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <p className="font-semibold">{CODING_STUDIO_SUBMISSION_UI_COPY.revisionSummaryTitle}</p>
              <p className="mt-1">{revisionSummary.comparison.outcomeLine}</p>
              <p className="mt-1">{revisionSummary.comparison.goalDistanceLine}</p>
              <p className="mt-1">{revisionSummary.comparison.structureLine}</p>
              <p className="mt-1">{revisionSummary.comparison.successLine}</p>
              <p className="mt-1">{revisionSummary.linkedGoalLine}</p>
            </div>
          ) : null}
        </section>

        <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">디버그/관찰</p>
            <button className="text-xs text-slate-500 underline" onClick={() => setShowDebugDetail((prev) => !prev)} type="button">
              {showDebugDetail ? "간단히 보기" : "자세히 보기"}
            </button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p>상태: {status}</p>
            <p>좌표: x {runtimeState.x.toFixed(2)} / z {runtimeState.z.toFixed(2)}</p>
            <p>각도: {runtimeState.heading.toFixed(0)}°</p>
            <p>스텝: {runtimeState.stepCount}</p>
            <p>목표 도달: {runtimeState.reachedGoal ? "예" : "아니오"}</p>
            {showDebugDetail ? (
              <>
                <p>다음 동작: {currentInstruction ? currentInstruction.kind : "없음"}</p>
                <p>리셋 안내: {lesson.resetHint}</p>
                <p>완료 레슨: {progression.completedLessonIds.length}개</p>
              </>
            ) : null}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">최근 실행 로그</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {trace.length === 0 ? <li>아직 실행 로그가 없습니다. 첫 실행으로 장면 반응을 확인해 보세요.</li> : null}
              {trace.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">제출 이력</p>
            <p className="mt-1">현재 레슨 제출 {submissionHistory.length}건</p>
            {submissionHistory.slice(0, 2).map((submission) => (
              <p className="mt-1 text-[11px] text-slate-600" key={submission.submissionId}>
                · {new Date(submission.submittedAt).toLocaleString("ko-KR")} / {submission.evidence.outcome === "completed" ? "완료" : "시도"}
              </p>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
