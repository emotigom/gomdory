import type { LessonActivityType } from "@/lib/lesson-activities/registry";

type ActivityPlaceholderProps = {
  compact?: boolean;
};

const baseCardClass =
  "rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/80 p-4 text-[var(--theme-text)] shadow-[0_14px_38px_rgba(8,47,73,0.24)] backdrop-blur-xl";

function ActivityShell({
  eyebrow,
  title,
  description,
  compact = false,
  activityType,
}: ActivityPlaceholderProps & {
  eyebrow: string;
  title: string;
  description: string;
  activityType: LessonActivityType;
}) {
  return (
    <article data-lesson-activity-placeholder={activityType} className={`${baseCardClass} ${compact ? "p-3" : "p-4"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-accent)]">{eyebrow}</p>
      <h3 className="mt-2 text-sm font-semibold tracking-[-0.01em] text-[var(--theme-text)]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">{description}</p>
    </article>
  );
}

export function AiBingoActivityPlaceholder(props: ActivityPlaceholderProps) {
  return (
    <ActivityShell
      {...props}
      activityType="ai_bingo"
      eyebrow="AI Bingo Arena"
      title="AI 빙고 아레나 — 곧 시작됩니다"
      description="학생들이 생활 속 AI 사례를 찾아 빙고판으로 확인하는 활동 자리입니다."
    />
  );
}

export function AiJudgmentSortActivityPlaceholder(props: ActivityPlaceholderProps) {
  return (
    <ActivityShell
      {...props}
      activityType="ai_judgment_sort"
      eyebrow="AI Judgment Sort"
      title="AI 판단 카드 분류 — 준비 중"
      description="AI가 판단할 일과 사람이 검토할 일을 나누는 카드 분류 활동 자리입니다."
    />
  );
}

export function WebCodingLitePlaceholder(props: ActivityPlaceholderProps) {
  return (
    <ActivityShell
      {...props}
      activityType="web_coding_lite"
      eyebrow="Web Studio Lite"
      title="웹 코딩 실습 — 준비 중"
      description="HTML/CSS/JavaScript를 작게 실험하는 웹 스튜디오 자리입니다."
    />
  );
}
