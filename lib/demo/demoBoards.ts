export type DemoBoardAction = {
  label: string;
  href: string;
};

export type DemoBoard = {
  id: string;
  title: string;
  description: string;
  tag: string;
  accent: string;
  gradient: [string, string];
  patternOpacity?: number;
  icon?: string;
  actions: {
    clean: DemoBoardAction;
    focus: DemoBoardAction;
    manage: DemoBoardAction;
    share: DemoBoardAction;
  };
};

export const DEMO_BOARDS: DemoBoard[] = [
  {
    id: "demo-1",
    title: "미래도시 메이커스",
    description: "6학년 창의·융합 프로젝트",
    tag: "초등 · 프로젝트",
    accent: "#2563eb",
    gradient: ["#a5b4fc", "#60a5fa"],
    icon: "🚀",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
  {
    id: "demo-2",
    title: "책 속 한 줄 필사",
    description: "국어 감상문 모음",
    tag: "중등 · 국어",
    accent: "#f97316",
    gradient: ["#fcd34d", "#fb923c"],
    icon: "📝",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
  {
    id: "demo-3",
    title: "기후 위기 타운홀",
    description: "역할극 토론 리허설",
    tag: "중등 · 사회",
    accent: "#14b8a6",
    gradient: ["#a7f3d0", "#22d3ee"],
    icon: "🌏",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
  {
    id: "demo-4",
    title: "AI 윤리 저널",
    description: "실생활 사례 수집",
    tag: "고등 · 정보",
    accent: "#8b5cf6",
    gradient: ["#c4b5fd", "#a855f7"],
    icon: "🤖",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
  {
    id: "demo-5",
    title: "우리 동네 설문소",
    description: "데이터로 보는 생활문제",
    tag: "초등 · 수학",
    accent: "#0ea5e9",
    gradient: ["#bfdbfe", "#22d3ee"],
    icon: "📊",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
  {
    id: "demo-6",
    title: "소리의 과학 스케치",
    description: "파동 탐구 클립보드",
    tag: "중등 · 과학",
    accent: "#10b981",
    gradient: ["#bbf7d0", "#34d399"],
    icon: "🎧",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
  {
    id: "demo-7",
    title: "진로 브랜딩 보드",
    description: "나만의 포트폴리오 준비",
    tag: "고등 · 진로",
    accent: "#ec4899",
    gradient: ["#f9a8d4", "#fb7185"],
    icon: "🎨",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
  {
    id: "demo-8",
    title: "세계문화 미술관",
    description: "국가별 명화 큐레이션",
    tag: "초등 · 미술",
    accent: "#f59e0b",
    gradient: ["#fde68a", "#f97316"],
    icon: "🖼️",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
  {
    id: "demo-9",
    title: "스포츠 전략 보드",
    description: "전술 메모 & 플레이맵",
    tag: "중등 · 체육",
    accent: "#22c55e",
    gradient: ["#bbf7d0", "#86efac"],
    icon: "⚽",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
  {
    id: "demo-10",
    title: "스토리보드 스튜디오",
    description: "영상·연극 스토리라인",
    tag: "고등 · 예술",
    accent: "#2563eb",
    gradient: ["#bfdbfe", "#6366f1"],
    icon: "🎬",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
  {
    id: "demo-11",
    title: "소곤소곤 독서 서클",
    description: "질문·인상·한줄평 모음",
    tag: "초등 · 독서",
    accent: "#06b6d4",
    gradient: ["#a5f3fc", "#38bdf8"],
    icon: "📚",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
  {
    id: "demo-12",
    title: "메타버스 월드빌드",
    description: "스토리·맵·NPC 아이디어",
    tag: "중등 · 메이킹",
    accent: "#d946ef",
    gradient: ["#f0abfc", "#a855f7"],
    icon: "🪐",
    actions: {
      clean: { label: "수업 시작 (Clean)", href: "/dashboard?clean=1" },
      focus: { label: "관제 (Focus)", href: "/dashboard?clean=1&mode=focus" },
      manage: { label: "관리 (Manage)", href: "/dashboard?clean=1&mode=manage" },
      share: { label: "공유 링크 보기", href: "/dashboard?onboarding=1" },
    },
  },
];

export function getDemoBoards() {
  return DEMO_BOARDS;
}
