"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { upsertCodingStudioFeedbackNote, listFeedbackNotesForSubmission, removeCodingStudioFeedbackNote } from "@/lib/coding-studio/feedbackStore";
import { CODING_STUDIO_FEEDBACK_NOTE_TYPES, type CodingStudioFeedbackNoteType, type CodingStudioFeedbackTargetArea } from "@/lib/coding-studio/feedbackSchema";
import { getLessonById } from "@/lib/coding-studio/lessons";
import { CODING_STUDIO_RUBRIC_SCHEMA } from "@/lib/coding-studio/rubricSchema";
import { getSubmissionById, listSubmissionsByLesson } from "@/lib/coding-studio/submissionStore";
import { CODING_STUDIO_SUBMISSION_UI_COPY } from "@/lib/coding-studio/submissionUiCopy";

const NOTE_PRESETS: Array<{ type: CodingStudioFeedbackNoteType; label: string; title: string; body: string }> = [
  { type: "praise", label: "강점 확인", title: "이번 시도의 강점", body: "핵심 조건을 안정적으로 맞췄고, 실행 근거를 명확히 확인한 점이 좋았습니다." },
  { type: "correction", label: "정교화", title: "이 부분을 정교화해 봅시다", body: "한 번에 한 항목(거리/각도/분기)만 조정하면 결과 원인을 더 명확히 파악할 수 있습니다." },
  { type: "retry-focus", label: "재시도 초점", title: "다음 재시도 초점", body: "이번에는 장면 관찰 포인트 한 가지를 먼저 확인한 뒤 다시 실행해 보세요." },
  { type: "next-step", label: "다음 연결", title: "다음 단계 연결 제안", body: "이번 수정 근거를 한 문장으로 정리하고 다음 레슨으로 넘어가면 학습 연결성이 좋아집니다." },
];

const TARGET_AREAS: Array<{ value: CodingStudioFeedbackTargetArea; label: string }> = [
  { value: "movement", label: "이동 정확도" },
  { value: "repeat", label: "반복 구조" },
  { value: "sensor", label: "감지 분기" },
  { value: "goal", label: "목표 도달" },
  { value: "scene-outcome", label: "장면 결과" },
];

function createFeedbackId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `feedback-${Date.now()}`;
}

export default function CodingStudioSubmissionReviewPage() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("submissionId") ?? "";
  const submission = useMemo(() => getSubmissionById(submissionId), [submissionId]);
  const sameLessonSubmissions = useMemo(() => (submission ? listSubmissionsByLesson(submission.lessonId) : []), [submission]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<CodingStudioFeedbackNoteType>("retry-focus");
  const [selectedArea, setSelectedArea] = useState<CodingStudioFeedbackTargetArea | "">("goal");
  const [title, setTitle] = useState("다음 재시도 초점");
  const [body, setBody] = useState("이번에는 장면 관찰 포인트 한 가지를 먼저 확인한 뒤 다시 실행해 보세요.");
  const [recommendedAction, setRecommendedAction] = useState("다음 실행 전 수정할 항목 한 가지를 먼저 적기");

  const [selectedCriterionId, setSelectedCriterionId] = useState<string | "">("");

  const feedbackNotes = submission
    ? listFeedbackNotesForSubmission(submission.submissionId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    : [];

  if (!submission) {
    return (
      <main className="mx-auto w-full max-w-[920px] px-4 py-8 md:px-6 md:py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">제출본을 찾지 못했어요.</p>
          <p className="mt-2">제출 기록이 없거나 링크가 만료되었을 수 있어요.</p>
          <Link className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800" href="/edu/coding">
            코딩 스튜디오로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const lesson = getLessonById(submission.lessonId);
  const rubric = CODING_STUDIO_RUBRIC_SCHEMA[submission.lessonId];
  const currentIndex = sameLessonSubmissions.findIndex((entry) => entry.submissionId === submission.submissionId);
  const previous = sameLessonSubmissions[currentIndex + 1] ?? null;
  const next = currentIndex > 0 ? sameLessonSubmissions[currentIndex - 1] : null;

  const continuity = {
    rubricTarget: rubric?.criteria[0]?.label ?? lesson.assessmentFocus,
    revisionFocus: lesson.retryHint,
  };
  const rubricCriteria = (rubric?.criteria ?? []).map((criterion) => ({
    criterionId: criterion.criterionId,
    teacherLabel: criterion.label,
    shortLabel: criterion.label,
  }));
  const getRubricCriterionById = (criterionId: string) =>
    rubricCriteria.find((criterion) => criterion.criterionId === criterionId);

  const canSaveMore = feedbackNotes.length < 3 || Boolean(editingId);

  return (
    <main className="mx-auto w-full max-w-[920px] space-y-4 px-4 py-8 md:px-6 md:py-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{CODING_STUDIO_SUBMISSION_UI_COPY.reviewSheetTitle}</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{lesson.title}</h1>
        <p className="mt-2 text-sm text-slate-600">학습 목표: {lesson.goalLine}</p>
        <p className="mt-1 text-xs text-slate-500">교사용 목적: {lesson.teacherPurpose}</p>
      </header>

      {rubric ? (
        <section className="rounded-2xl border border-violet-200 bg-violet-50 p-6 text-sm text-violet-900">
          <p className="font-semibold">루브릭 연결 요약</p>
          <p className="mt-2">학습 목표: {rubric.learningGoal}</p>
          <ul className="mt-2 space-y-1 text-xs">
            {rubric.criteria.map((criterion) => (
              <li key={criterion.criterionId}>· {criterion.label} — {criterion.teacherLookFor}</li>
            ))}
          </ul>
        </section>
      ) : null}


      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3">
        <Image alt="제출-리뷰-재제출 루프 다이어그램" className="h-auto w-full" height={420} src="/edu/coding/review-rework-loop.svg" width={1200} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">검토 요약</p>
        <p className="mt-2">제출 시각: {new Date(submission.submittedAt).toLocaleString("ko-KR")}</p>
        <p className="mt-1">제출 상태: {submission.evidence.outcome === "completed" ? "완료 제출" : "재시도 필요 제출"}</p>
        <p className="mt-1">핵심 기준(루브릭): {continuity.rubricTarget}</p>
        <p className="mt-1">다음 수정 초점: {continuity.revisionFocus}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">학습 근거(Evidence)</p>
        <ul className="mt-2 space-y-1">
          <li>실행 스텝: {submission.evidence.runtime.stepCount}</li>
          <li>최종 좌표: x {submission.evidence.runtime.finalPosition.x}, z {submission.evidence.runtime.finalPosition.z}</li>
          <li>반복/회전/감지: {submission.evidence.structure.repeatCount} / {submission.evidence.structure.turnCount} / {submission.evidence.structure.sensorCount}</li>
          <li>목표까지 거리: {submission.evidence.scene.goalDistance}</li>
          <li>{submission.evidence.lessonSignal.successReason ?? submission.evidence.lessonSignal.retryReason}</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">{CODING_STUDIO_SUBMISSION_UI_COPY.feedbackPanelTitle}</p>
        <p className="mt-1 text-xs text-slate-500">짧고 선명한 메모 1~3개로 다음 수정 방향을 남겨주세요.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {NOTE_PRESETS.map((preset) => (
            <button
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs text-slate-700"
              key={preset.type}
              onClick={() => {
                setSelectedType(preset.type);
                setTitle(preset.title);
                setBody(preset.body);
              }}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="text-xs">
            메모 유형
            <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5" onChange={(event) => setSelectedType(event.target.value as CodingStudioFeedbackNoteType)} value={selectedType}>
              {CODING_STUDIO_FEEDBACK_NOTE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            대상 영역(선택)
            <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5" onChange={(event) => setSelectedArea(event.target.value as CodingStudioFeedbackTargetArea | "")} value={selectedArea}>
              <option value="">선택 안 함</option>
              {TARGET_AREAS.map((area) => (
                <option key={area.value} value={area.value}>{area.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs md:col-span-2">
            학습 목표 정렬(선택)
            <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5" onChange={(event) => setSelectedCriterionId(event.target.value as string)} value={selectedCriterionId}>
              <option value="">선택 안 함</option>
              {rubricCriteria.map((criterion) => (
                <option key={criterion.criterionId} value={criterion.criterionId}>{criterion.teacherLabel}</option>
              ))}
            </select>
          </label>
          <label className="text-xs md:col-span-2">
            제목
            <input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5" maxLength={60} onChange={(event) => setTitle(event.target.value)} value={title} />
          </label>
          <label className="text-xs md:col-span-2">
            메모
            <textarea className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5" maxLength={240} onChange={(event) => setBody(event.target.value)} rows={3} value={body} />
          </label>
          <label className="text-xs md:col-span-2">
            권장 액션(선택)
            <input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5" maxLength={120} onChange={(event) => setRecommendedAction(event.target.value)} value={recommendedAction} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 disabled:opacity-40"
            disabled={!canSaveMore || title.trim().length === 0 || body.trim().length === 0}
            onClick={() => {
              if (!canSaveMore || title.trim().length === 0 || body.trim().length === 0) return;
              upsertCodingStudioFeedbackNote({
                feedbackSchemaVersion: 1,
                feedbackId: editingId ?? createFeedbackId(),
                submissionId: submission.submissionId,
                lessonId: submission.lessonId,
                createdAt: new Date().toISOString(),
                source: { sourceType: "teacher-local", authorId: "teacher-local", authorLabel: "교사" },
                noteType: selectedType,
                title: title.trim(),
                body: body.trim(),
                ...(selectedArea ? { targetArea: selectedArea } : {}),
                ...(selectedCriterionId ? { criterionId: selectedCriterionId } : {}),
                ...(recommendedAction.trim() ? { recommendedAction: recommendedAction.trim() } : {}),
              });
              setEditingId(null);
            }}
            type="button"
          >
            {editingId ? "메모 수정 저장" : "메모 저장"}
          </button>
          <p className="text-xs text-slate-500">현재 {feedbackNotes.length}/3개</p>
        </div>

        <ul className="mt-3 space-y-2">
          {feedbackNotes.map((note) => (
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" key={note.feedbackId}>
              <p className="text-xs font-semibold text-slate-900">[{note.noteType}] {note.title}</p>
              <p className="mt-1 text-xs text-slate-700">{note.body}</p>
              {note.targetArea ? <p className="mt-1 text-[11px] text-slate-600">대상: {note.targetArea}</p> : null}
              {note.criterionId ? <p className="mt-1 text-[11px] text-slate-600">학습 목표: {getRubricCriterionById(note.criterionId)?.shortLabel ?? note.criterionId}</p> : null}
              {note.recommendedAction ? <p className="mt-1 text-[11px] text-slate-600">다음 액션: {note.recommendedAction}</p> : null}
              <div className="mt-2 flex gap-2">
                <button
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px]"
                  onClick={() => {
                    setEditingId(note.feedbackId);
                    setSelectedType(note.noteType);
                    setSelectedArea(note.targetArea ?? "");
                    setSelectedCriterionId(note.criterionId ?? "");
                    setTitle(note.title);
                    setBody(note.body);
                    setRecommendedAction(note.recommendedAction ?? "");
                  }}
                  type="button"
                >
                  수정
                </button>
                <button
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px]"
                  onClick={() => {
                    removeCodingStudioFeedbackNote(note.feedbackId);
                          if (editingId === note.feedbackId) setEditingId(null);
                  }}
                  type="button"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
          {feedbackNotes.length === 0 ? <li className="text-xs text-slate-500">아직 남겨진 피드백 메모가 없어요.</li> : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">리플레이/검토</p>
        <p className="mt-2">프로젝트 스냅샷: {submission.projectSnapshot ? "포함됨" : "없음"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900" href={`/edu/coding?reviewSubmissionId=${submission.submissionId}`}>
            검토 모드로 리플레이
          </Link>
          {previous ? (
            <Link className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800" href={`/edu/coding/review?submissionId=${previous.submissionId}`}>
              이전 제출
            </Link>
          ) : null}
          {next ? (
            <Link className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800" href={`/edu/coding/review?submissionId=${next.submissionId}`}>
              다음 제출
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
