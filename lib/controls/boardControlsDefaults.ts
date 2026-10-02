import type { BoardControlHud, BoardControlLocks, BoardReplyTemplate } from "@/lib/types/boardControls";

export const DEFAULT_LOCKS: BoardControlLocks = {
  question: false,
  help: false,
  pulse: false,
};

export const DEFAULT_HUD: BoardControlHud = {
  showRoster: true,
  showPulse: true,
  showPinned: true,
};

export const DEFAULT_REPLY_TEMPLATES: BoardReplyTemplate[] = [
  { id: "t1", label: "좋은 질문", text: "좋은 질문이에요. 잠시만요." },
  { id: "t2", label: "활동 중", text: "지금은 활동 중! 끝나고 질문 주세요." },
  { id: "t3", label: "손들기", text: "조용히 손들고 기다려주세요." },
  { id: "t4", label: "다음 단계", text: "좋아요! 다음 단계로 넘어갈게요." },
  { id: "t5", label: "다시 설명", text: "한 번 더 설명해 줄 사람?" },
  { id: "t6", label: "칭찬", text: "칭찬해요. 아주 잘했어요." },
];

export const CUSTOM_TEMPLATE_IDS = ["custom-1", "custom-2"] as const;
