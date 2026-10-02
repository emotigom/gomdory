import type { EduAiTaskKind } from "./aiOrchestratorTypes";

export function buildEduAiSafeFallback(taskKind: EduAiTaskKind) {
  const map: Record<EduAiTaskKind, { resultText: string; nextStudentAction: string }> = {
    explain: { resultText: "핵심을 한 문장으로 다시 적고, 모르는 단어를 하나 골라 질문해 보세요.", nextStudentAction: "핵심 1문장 쓰기" },
    improve: { resultText: "제목, 첫 문장, 예시, 마무리 중 하나를 골라 고쳐 보세요.", nextStudentAction: "한 부분만 고치기" },
    verify: { resultText: "사실/출처/개인정보/저작권 중 하나를 먼저 확인해 보세요.", nextStudentAction: "검증 항목 1개 선택" },
    summarize: { resultText: "핵심 단어 3개와 요약 1문장을 써 보세요.", nextStudentAction: "단어 3개 고르기" },
    generate_hint: { resultText: "문제를 작은 단계로 나누고 첫 단계부터 시도해 보세요.", nextStudentAction: "첫 단계 작성" },
    coding_feedback: { resultText: "한 번에 한 줄만 바꾸고 다시 실행해 보세요. 예상과 실제 결과를 비교하세요.", nextStudentAction: "한 줄 수정 후 실행" },
    courseware_reflection: { resultText: "AI가 도와준 부분과 내가 직접 판단한 부분을 나누어 적어 보세요.", nextStudentAction: "도움/판단 구분 기록" },
  };
  return map[taskKind];
}
