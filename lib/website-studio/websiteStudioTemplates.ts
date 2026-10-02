import type { WebsiteStudioTemplate } from "@/lib/website-studio/websiteStudioTypes";

export const WEBSITE_STUDIO_ALLOWED_BLOCK_KINDS = new Set(["hero", "text", "cardGrid", "image", "quiz", "linkButton", "footer"] as const);

export const WEBSITE_STUDIO_TEMPLATES: WebsiteStudioTemplate[] = [
  {
    id: "self-intro-ko",
    name: "자기소개 웹사이트",
    description: "나를 소개하는 첫 웹사이트를 블록으로 빠르게 완성해요.",
    recommendedFor: "학급 소개, 동아리 지원, 포트폴리오 시작",
    theme: { id: "calm-indigo", name: "Calm Indigo", accentColor: "#4f46e5", surfaceColor: "#eef2ff", textColor: "#0f172a" },
    starterPages: [{
      id: "home",
      title: "홈",
      slug: "",
      blocks: [
        { id: "hero-1", kind: "hero", title: "안녕하세요! 저는 곰도리예요", content: "좋아하는 것과 목표를 소개할게요." },
        { id: "text-1", kind: "text", title: "나를 한 줄로", content: "저는 문제를 끝까지 해결하는 학생입니다." },
        { id: "card-1", kind: "cardGrid", title: "나의 관심사", items: [{ title: "과학", description: "실험과 관찰을 좋아해요." }, { title: "디자인", description: "깔끔한 화면을 만드는 연습 중이에요." }] },
        { id: "footer-1", kind: "footer", content: "© 2026 나의 소개 페이지" },
      ],
    }],
  },
  {
    id: "interest-research-ko",
    name: "관심사 탐구 웹사이트",
    description: "내가 궁금한 주제를 조사하고 정리하는 탐구형 사이트 템플릿이에요.",
    recommendedFor: "탐구 보고서, 주제 발표, 프로젝트 기록",
    theme: { id: "mint-note", name: "Mint Note", accentColor: "#0f766e", surfaceColor: "#ecfeff", textColor: "#042f2e" },
    starterPages: [{
      id: "research",
      title: "탐구 노트",
      slug: "",
      blocks: [
        { id: "hero-2", kind: "hero", title: "관심 주제 탐구", content: "주제 선정 이유와 핵심 질문을 소개해요." },
        { id: "text-2", kind: "text", title: "핵심 질문", content: "왜 이 현상이 일어날까?" },
        { id: "image-2", kind: "image", title: "관찰 이미지", imageAlt: "탐구 주제 관련 관찰 이미지 자리", imageUrl: "/images/placeholders/research.png" },
        { id: "link-2", kind: "linkButton", buttonLabel: "참고 자료 보기", buttonHref: "#" },
        { id: "footer-2", kind: "footer", content: "탐구는 계속 업데이트됩니다." },
      ],
    }],
  },
  {
    id: "quiz-minigame-ko",
    name: "퀴즈/미니게임 웹사이트",
    description: "학습 내용을 퀴즈로 정리해 친구들과 공유하는 템플릿이에요.",
    recommendedFor: "수업 복습, 팀 활동, 발표 참여 유도",
    theme: { id: "sunset-class", name: "Sunset Class", accentColor: "#ea580c", surfaceColor: "#fff7ed", textColor: "#431407" },
    starterPages: [{
      id: "quiz",
      title: "퀴즈",
      slug: "",
      blocks: [
        { id: "hero-3", kind: "hero", title: "오늘의 퀴즈 챌린지", content: "친구들과 함께 풀어보세요!" },
        { id: "quiz-3", kind: "quiz", title: "미니 퀴즈", content: "문제: 물의 끓는점은 몇 도일까요?" },
        { id: "text-3", kind: "text", title: "정답 확인", content: "정답은 100°C입니다." },
        { id: "footer-3", kind: "footer", content: "재미있게 배우는 퀴즈 수업" },
      ],
    }],
  },

  {
    id: "portfolio-exhibit-ko",
    name: "작품 전시 웹사이트",
    description: "완성한 작품을 발표용으로 정리해 전시하는 템플릿이에요.",
    recommendedFor: "프로젝트 전시, 발표 자료, 포트폴리오 마무리",
    theme: { id: "violet-gallery", name: "Violet Gallery", accentColor: "#7c3aed", surfaceColor: "#f5f3ff", textColor: "#2e1065" },
    starterPages: [{
      id: "exhibit",
      title: "작품 전시",
      slug: "",
      blocks: [
        { id: "hero-4", kind: "hero", title: "나의 작품 전시", content: "작품의 주제와 핵심 메시지를 소개합니다." },
        { id: "text-4", kind: "text", title: "제작 과정", content: "아이디어 → 제작 → 개선 과정을 정리해보세요." },
        { id: "card-4", kind: "cardGrid", title: "배운 점", items: [{ title: "시도", description: "새로운 시도를 했어요." }, { title: "개선", description: "피드백으로 고쳤어요." }, { title: "성장", description: "다음 목표를 정했어요." }] },
        { id: "footer-4", kind: "footer", content: "발표를 들어주셔서 감사합니다." },
      ],
    }],
  },
];
