"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { ActiveLessonSession } from "@/lib/lesson-activities/types";
import type { LessonActivityType } from "@/lib/lesson-activities/registry";
import AiBingoActivity from "./AiBingoActivity";
import AiJudgmentSortActivity from "./AiJudgmentSortActivity";
import WebCodingLiteActivity from "./WebCodingLiteActivity";
import PythonStudioLiteActivity from "./PythonStudioLiteActivity";

function VibeCodingWorkspaceGuide({
  lesson,
  onOpenBoard,
}: {
  lesson: VibeCodingLessonTemplateId;
  onOpenBoard?: () => void;
}) {
  const isLesson03 = lesson === "lesson_03_vibe_app_planning";
  const title = isLesson03
    ? "3차시: Gemini로 앱 기획과 프롬프트 설계"
    : "4차시: Lovable 프로토타입 제작과 제출";
  const body = isLesson03
    ? "오늘은 HTML 코드를 작성하는 시간이 아니라, Gemini로 앱 아이디어를 정리하고 Lovable에 넣을 프롬프트를 준비하는 시간입니다."
    : "Lovable로 만든 결과물 링크, 화면 설명, 실패 기록 중 하나를 Gomdory 카드로 제출합니다.";
  const studentInstruction = isLesson03
    ? "보드에서 카드 작성하기를 누른 뒤 ‘앱 아이디어’ 또는 ‘AI 프롬프트’ 템플릿으로 제출하세요."
    : "링크가 있으면 URL 칸에 붙여넣고, 링크가 없으면 ‘실패 기록’ 템플릿으로 제출하세요.";

  return (
    <div className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 sm:p-6">
      <h3 className="text-lg font-black text-[var(--theme-text)] sm:text-xl">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">{body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onOpenBoard} className="rounded-xl bg-[var(--theme-accent)] px-4 py-2 text-sm font-black text-[var(--theme-accent-text)]">보드 보기로 이동</button>
        <Link href="/edu/vibe-coding/lesson-03-04" target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm font-bold">강의자료 열기</Link>
        <a href="https://gemini.google.com/" target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm font-bold">Gemini 열기</a>
        <a href="https://lovable.dev/" target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm font-bold">Lovable 열기</a>
        {!isLesson03 ? (<><a href="https://bolt.new/" target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm font-bold">Bolt 열기</a><a href="https://replit.com/" target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm font-bold">Replit 열기</a><a href="https://v0.dev/" target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm font-bold">v0 열기</a></>) : null}
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--theme-text)]">{studentInstruction}</p>
      {!isLesson03 ? (
        <p className="mt-3 text-sm font-bold text-rose-600">실명, 전화번호, 주소, 학교명, 얼굴 사진은 넣지 마세요.</p>
      ) : null}
    </div>
  );
}

export type StudentActiveLesson = Pick<
  ActiveLessonSession,
  "templateId" | "title" | "activityTypes"
>;

type ActivityTab = Extract<
  LessonActivityType,
  "ai_bingo" | "ai_judgment_sort" | "web_coding_lite" | "python_studio_lite"
>;

const ACTIVITY_META: Record<
  ActivityTab,
  { label: string; shortLabel: string; description: string }
> = {
  ai_bingo: {
    label: "1단계: AI 빙고",
    shortLabel: "AI 빙고",
    description: "생활 속 AI가 어떤 데이터를 보고 판단하는지 생각해요.",
  },
  ai_judgment_sort: {
    label: "1단계: AI 판단 카드 분류",
    shortLabel: "AI 판단",
    description: "카드를 읽고 AI/사람/협업 판단으로 분류해요.",
  },
  web_coding_lite: {
    label: "선택: 웹 코딩 체험",
    shortLabel: "웹 코딩 체험",
    description: "HTML/CSS/JS로 비슷한 판단 도우미를 만들어 볼 수 있어요.",
  },
  python_studio_lite: {
    label: "2단계: 파이썬 첫걸음",
    shortLabel: "파이썬 실습실",
    description: "파이썬 코드를 쓰고 입력/출력을 확인해요.",
  },
};



type VibeCodingLessonTemplateId =
  | "lesson_03_vibe_app_planning"
  | "lesson_04_vibe_app_prototype_share";

function isVibeCodingLessonTemplateId(
  templateId: StudentActiveLesson["templateId"],
): templateId is VibeCodingLessonTemplateId {
  return (
    templateId === "lesson_03_vibe_app_planning" ||
    templateId === "lesson_04_vibe_app_prototype_share"
  );
}

const LESSON_META_OVERRIDES: Partial<Record<StudentActiveLesson["templateId"], Partial<Record<ActivityTab, { label: string; shortLabel: string; description: string }>>>> = {
  lesson_02_ai_judgment_if_else: {
    ai_judgment_sort: {
      label: "1단계: AI 판단 카드 분류",
      shortLabel: "AI 판단 카드 분류",
      description: "AI가 잘하는 일과 사람의 판단이 필요한 일을 카드로 분류해요.",
    },
    python_studio_lite: {
      label: "2단계: 파이썬 if/else 실습",
      shortLabel: "파이썬 if/else 실습",
      description: "if/elif/else와 and/or로 AI 판단 도우미를 만들어요.",
    },
    web_coding_lite: {
      label: "선택: 웹 코딩 체험",
      shortLabel: "웹 코딩 체험",
      description: "HTML/CSS/JS로 비슷한 판단 도우미를 만들어 볼 수 있어요.",
    },
  },
};

function isRenderableActivity(
  activityType: LessonActivityType,
): activityType is ActivityTab {
  return (
    activityType === "ai_bingo" ||
    activityType === "ai_judgment_sort" ||
    activityType === "web_coding_lite" ||
    activityType === "python_studio_lite"
  );
}

function renderActivity(
  activityType: ActivityTab,
  shareCode: string,
  displayName?: string | null,
) {
  if (activityType === "ai_bingo")
    return <AiBingoActivity shareCode={shareCode} displayName={displayName} />;
  if (activityType === "ai_judgment_sort")
    return (
      <AiJudgmentSortActivity shareCode={shareCode} displayName={displayName} />
    );
  if (activityType === "python_studio_lite")
    return (
      <PythonStudioLiteActivity
        shareCode={shareCode}
        displayName={displayName}
      />
    );
  return (
    <WebCodingLiteActivity shareCode={shareCode} displayName={displayName} />
  );
}

export default function StudentActivityPanel({
  activeLesson,
  shareCode,
  displayName,
  onOpenBoard,
}: {
  activeLesson: StudentActiveLesson | null;
  shareCode: string;
  displayName?: string | null;
  onOpenBoard?: () => void;
}) {
  const activities = useMemo(
    () => activeLesson?.activityTypes.filter(isRenderableActivity) ?? [],
    [activeLesson?.activityTypes],
  );
  const [selectedActivity, setSelectedActivity] = useState<ActivityTab | null>(
    null,
  );
  if (!activeLesson) return null;

  const vibeCodingLessonTemplateId = isVibeCodingLessonTemplateId(
    activeLesson.templateId,
  )
    ? activeLesson.templateId
    : null;

  const activeActivity =
    selectedActivity && activities.includes(selectedActivity)
      ? selectedActivity
      : (activities[0] ?? null);
  const activityMeta = (activityType: ActivityTab) =>
    LESSON_META_OVERRIDES[activeLesson.templateId]?.[activityType] ??
    ACTIVITY_META[activityType];

  return (
    <section
      data-testid="student-activity-panel"
      className="mx-auto w-full min-w-0 max-w-[1680px] rounded-[2rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-2 text-[var(--theme-text)] shadow-[var(--theme-shadow)] backdrop-blur-xl sm:p-3 lg:p-4"
      aria-label="오늘의 실습"
    >
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--theme-accent)]">
            오늘의 실습
          </p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[var(--theme-text)] sm:text-2xl">
            {activeLesson.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">
            선생님이 실습을 시작했어요. 선택한 활동만 넓게 열고 진행 상황을
            저장합니다.
          </p>
        </div>
        {activities.length > 1 ? (
          <div
            className="flex shrink-0 flex-wrap gap-2"
            role="tablist"
            aria-label="오늘의 실습 단계 선택"
            data-testid="student-activity-switcher"
          >
            {activities.map((activityType) => (
              <button
                key={activityType}
                type="button"
                role="tab"
                aria-selected={activeActivity === activityType}
                onClick={() => setSelectedActivity(activityType)}
                className={`min-h-11 rounded-2xl border px-4 py-2 text-sm font-black transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-focus)] ${activeActivity === activityType ? "border-[var(--theme-border-strong)] bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-[0_0_0_3px_rgba(103,232,249,0.18)]" : "border-[var(--theme-border)] bg-[var(--theme-card-muted)] text-[var(--theme-text)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-accent)]/10"}`}
              >
                {activityMeta(activityType).label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {activities.length > 1 ? (
        <div
          className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3"
          aria-label="실습 단계 상태 요약"
        >
          {activities.map((activityType) => (
            <button
              key={activityType}
              type="button"
              onClick={() => setSelectedActivity(activityType)}
              className={`min-w-0 rounded-2xl border p-3 text-left transition ${activeActivity === activityType ? "border-[var(--theme-border-strong)] bg-[var(--theme-accent)]/15" : "border-[var(--theme-border)] bg-[var(--theme-card)] hover:border-[var(--theme-border-strong)]"}`}
            >
              <span className="block text-[11px] font-black text-[var(--theme-text-muted)]">
                {activeActivity === activityType ? "진행 중" : "열기"}
              </span>
              <span className="mt-1 block text-sm font-black text-[var(--theme-text)]">
                {activityMeta(activityType).shortLabel}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--theme-text-muted)]">
                {activityMeta(activityType).description}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="mt-4 min-w-0 overflow-x-clip"
        data-testid="student-selected-activity"
      >
        {vibeCodingLessonTemplateId ? (
          <VibeCodingWorkspaceGuide
            lesson={vibeCodingLessonTemplateId}
            onOpenBoard={onOpenBoard}
          />
        ) : activeActivity ? (
          renderActivity(activeActivity, shareCode, displayName)
        ) : (
          <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-sm text-[var(--theme-text-muted)]">
            이 수업에서 열 수 있는 학생 실습이 아직 준비되지 않았어요.
          </div>
        )}
      </div>
    </section>
  );
}
