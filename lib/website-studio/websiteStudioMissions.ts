import { WEBSITE_STUDIO_ALLOWED_BLOCK_KINDS } from "@/lib/website-studio/websiteStudioTemplates";
import type { WebsiteStudioBlockKind, WebsiteStudioProject } from "@/lib/website-studio/websiteStudioTypes";

export type WebsiteStudioMission = {
  missionId: string;
  label: string;
  studentGoal: string;
  teacherPurpose: string;
  requiredBlockKinds: WebsiteStudioBlockKind[];
  suggestedAiActions: string[];
  completionChecks: string[];
};

export const WEBSITE_STUDIO_MISSIONS: Record<string, WebsiteStudioMission[]> = {
  "self-intro-ko": [
    { missionId: "self-title-intro", label: "제목과 한 줄 소개", studentGoal: "나를 소개하는 제목과 한 줄을 완성해요.", teacherPurpose: "자기표현과 핵심 요약 연습", requiredBlockKinds: ["hero", "text"], suggestedAiActions: ["이 단계 문장 다듬기"], completionChecks: ["hasHeroTitle", "hasIntroText"] },
    { missionId: "self-three-cards", label: "나를 보여주는 카드 3개", studentGoal: "관심사/강점 카드를 3개 작성해요.", teacherPurpose: "정보 구조화 연습", requiredBlockKinds: ["cardGrid"], suggestedAiActions: ["카드 아이디어 받기"], completionChecks: ["hasAtLeastThreeCards"] },
    { missionId: "self-button-footer", label: "버튼과 마무리", studentGoal: "방문자 버튼과 마무리 문장을 넣어요.", teacherPurpose: "행동 유도와 완결 구조", requiredBlockKinds: ["linkButton", "footer"], suggestedAiActions: ["이 단계 문장 다듬기"], completionChecks: ["hasSafeLink", "hasFooterText"] },
  ],
  "interest-research-ko": [
    { missionId: "interest-topic", label: "탐구 주제 소개", studentGoal: "탐구 주제와 질문을 소개해요.", teacherPurpose: "질문 기반 탐구 설계", requiredBlockKinds: ["hero", "text"], suggestedAiActions: ["이 단계 문장 다듬기"], completionChecks: ["hasHeroTitle", "hasIntroText"] },
    { missionId: "interest-three-findings", label: "알게 된 점 3가지", studentGoal: "핵심 발견을 카드 3개로 정리해요.", teacherPurpose: "근거 중심 요약", requiredBlockKinds: ["cardGrid"], suggestedAiActions: ["카드 아이디어 받기"], completionChecks: ["hasAtLeastThreeCards"] },
  ],
  "quiz-minigame-ko": [
    { missionId: "quiz-topic", label: "퀴즈 주제 정하기", studentGoal: "퀴즈의 주제를 한 줄로 정해요.", teacherPurpose: "학습목표 명료화", requiredBlockKinds: ["hero"], suggestedAiActions: ["이 단계 문장 다듬기"], completionChecks: ["hasHeroTitle"] },
    { missionId: "quiz-question-choices", label: "문제와 선택지", studentGoal: "문제와 선택지를 만들어요.", teacherPurpose: "질문 설계 역량", requiredBlockKinds: ["quiz"], suggestedAiActions: ["퀴즈 선택지 다듬기"], completionChecks: ["hasQuizQuestion"] },
  ],
  "portfolio-exhibit-ko": [
    { missionId: "exhibit-title", label: "작품 제목", studentGoal: "작품의 핵심을 제목으로 정해요.", teacherPurpose: "주제 전달력 강화", requiredBlockKinds: ["hero"], suggestedAiActions: ["이 단계 문장 다듬기"], completionChecks: ["hasHeroTitle"] },
    { missionId: "exhibit-process", label: "제작 과정과 배운 점", studentGoal: "과정과 배운 점을 정리해요.", teacherPurpose: "성찰형 발표 준비", requiredBlockKinds: ["text", "footer"], suggestedAiActions: ["이 단계 문장 다듬기"], completionChecks: ["hasIntroText", "hasFooterText"] },
  ],
};

export function getWebsiteStudioMissionsForProject(project: WebsiteStudioProject) {
  return WEBSITE_STUDIO_MISSIONS[project.templateId] ?? WEBSITE_STUDIO_MISSIONS["self-intro-ko"];
}

export function areWebsiteStudioMissionBlockKindsValid(missions: WebsiteStudioMission[]) {
  return missions.every((mission) => mission.requiredBlockKinds.every((kind) => WEBSITE_STUDIO_ALLOWED_BLOCK_KINDS.has(kind)));
}
