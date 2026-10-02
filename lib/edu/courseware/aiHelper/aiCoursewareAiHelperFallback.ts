import type { CoursewareAiHelperRequest, CoursewareAiSuggestion } from "./aiCoursewareAiHelperTypes";

const now = () => new Date().toISOString();
const mk = (task: CoursewareAiHelperRequest["task"], bodyKo: string): CoursewareAiSuggestion => ({ suggestionId: `${task}-${Math.random().toString(36).slice(2, 9)}`, task, bodyKo, generatedBy: "template-fallback", createdAt: now() });

export function buildTemplateFallbackSuggestions(req: CoursewareAiHelperRequest): CoursewareAiSuggestion[] {
  const topic = req.studentTopicKo?.trim() || "우리 주제";
  const byTask: Record<CoursewareAiHelperRequest["task"], CoursewareAiSuggestion[]> = {
    "title-suggestions": [mk(req.task, `우리 학교 ${topic} 안내`), mk(req.task, `친구들이 쉽게 보는 ${topic} 가이드`), mk(req.task, `AI와 함께 정리한 ${topic}`)],
    "intro-copy": [mk(req.task, `이 페이지는 ${topic}을 어려워하는 친구들을 위해 만들었어요.`)],
    "menu-names": [mk(req.task, "문제 소개 / 조사 결과 / 해결 방법 / FAQ / 출처")],
    "faq-draft": [mk(req.task, `${topic}은 왜 중요한가요?\n어떻게 실천하나요?\n주의할 점은 무엇인가요?`)],
    "recommendation-copy": [mk(req.task, `${topic}을 실천할 때 우리 반 상황에 맞게 단계적으로 적용해요.`)],
    "presentation-summary": [mk(req.task, `우리는 ${topic} 문제를 조사하고 실천 방법을 제안했습니다.`)],
    "reflection-prompts": [mk(req.task, `AI가 도와준 부분은 ${topic} 정리였고, 내가 직접 판단한 부분은 적용 방법입니다.`)],
    "rewrite-student-tone": [mk(req.task, `${topic} 내용을 친구에게 설명하듯 쉬운 말로 바꿔 써요.`)],
    "simplify-middle-school": [mk(req.task, `${topic} 핵심을 중학생 눈높이 문장 3개로 요약해요.`)],
    "source-disclosure-copy": [mk(req.task, "AI 초안을 참고하고 내가 수정했어요. 출처를 함께 확인했어요.")],
  };
  return (byTask[req.task] || []).slice(0, Math.max(1, Math.min(5, req.maxSuggestions)));
}
