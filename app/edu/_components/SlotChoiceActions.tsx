"use client";

import type { LessonId } from "@/lib/edu/lesson/lessonLock";
import type { SlotName } from "@/lib/edu/slots/inferSlotFromText";

export type SlotChoiceAction = {
  id: string;
  label: string;
  slot: SlotName;
  value: string;
};

const SLOT_CHOICE_ACTIONS: Record<LessonId, SlotChoiceAction[]> = {
  P1: [
    { id: "p1-keywords", label: "키워드 바꾸기", slot: "keywords", value: "#여유 #웃음 #친절" },
    { id: "p1-goal", label: "목표 바꾸기", slot: "goal", value: "발표 잘하기" },
  ],
  P2: [
    { id: "p2-topic", label: "주제 바꾸기", slot: "p2.topic", value: "공룡" },
    {
      id: "p2-card1-question",
      label: "궁금한 질문 바꾸기",
      slot: "p2.cards.1.body",
      value: "공룡은 왜 멸종했을까?",
    },
  ],
  P3: [
    { id: "p3-title", label: "퀴즈 제목 바꾸기", slot: "p3.title", value: "공룡 퀴즈" },
    { id: "p3-q1", label: "Q1 바꾸기", slot: "p3.projects.1.title", value: "티라노는 뭘 먹을까?" },
  ],
  P4: [
    { id: "p4-title", label: "전시 제목 바꾸기", slot: "p4.title", value: "우리반 작품 전시회" },
    { id: "p4-agenda1", label: "작품1 이름 바꾸기", slot: "p4.agenda.1", value: "돌돌이 게임" },
  ],
};

export const getSlotChoiceActions = (lessonId: LessonId) => SLOT_CHOICE_ACTIONS[lessonId] ?? [];

type SlotChoiceActionsProps = {
  lessonId: LessonId;
  onSelect: (action: SlotChoiceAction) => void;
};

export const SlotChoiceActions = ({ lessonId, onSelect }: SlotChoiceActionsProps) => {
  const actions = getSlotChoiceActions(lessonId);
  if (actions.length === 0) return null;
  return (
    <div className="max-w-[70%] rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-700">
      <p className="font-semibold text-amber-700">잠깐! 버튼으로 먼저 바꿔볼까?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onSelect(action)}
            className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm transition hover:border-amber-300 hover:text-amber-800"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SlotChoiceActions;
