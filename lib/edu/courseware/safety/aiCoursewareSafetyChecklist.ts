import type { CoursewareSafetyCheckId, CoursewareSafetyChecklistItem } from "./aiCoursewareSafetyTypes";

export const COURSEWARE_SAFETY_CHECKLIST: CoursewareSafetyChecklistItem[] = [
  { id: "privacy-no-personal-info", labelKo: "이름, 얼굴, 전화번호, 주소, 위치 같은 개인정보를 넣지 않았어요.", descriptionKo: "친구와 가족 개인정보는 공개하지 않아요.", required: true, severity: "blocking" },
  { id: "privacy-no-face-or-location", labelKo: "사진·지도·화면에 얼굴이나 정확한 위치가 드러나지 않아요.", descriptionKo: "배경 이미지도 한 번 더 확인해요.", required: true, severity: "blocking" },
  { id: "copyright-images-ok", labelKo: "사용한 이미지, 글, 자료가 직접 만든 것이거나 사용할 수 있는 자료예요.", descriptionKo: "저작권 조건을 지켜요.", required: true, severity: "warning" },
  { id: "copyright-text-ok", labelKo: "인용한 문장은 허용 범위에서 사용했고 필요한 표기를 했어요.", descriptionKo: "다른 사람 글을 그대로 복사하지 않아요.", required: true, severity: "warning" },
  { id: "source-links-added", labelKo: "참고한 자료나 링크가 있으면 출처를 적었어요.", descriptionKo: "출처 없음/직접 작성도 괜찮아요.", required: true, severity: "warning" },
  { id: "ai-use-disclosed", labelKo: "AI가 도와준 부분을 숨기지 않고 표시했어요.", descriptionKo: "어디를 AI가 도왔는지 솔직하게 적어요.", required: true, severity: "warning" },
  { id: "ai-output-reviewed", labelKo: "AI가 만든 문장을 그대로 복사하지 않고 내가 직접 확인하고 고쳤어요.", descriptionKo: "AI 문장은 내가 책임지고 고쳐요.", required: true, severity: "warning" },
  { id: "no-dangerous-advice", labelKo: "건강, 법률, 돈, 안전 문제를 확정적으로 지시하지 않았어요.", descriptionKo: "위험한 조언처럼 보이면 수정해요.", required: true, severity: "blocking" },
  { id: "no-medical-legal-financial-claim", labelKo: "의학·법률·금융 결과를 보장하는 표현을 쓰지 않았어요.", descriptionKo: "전문가 상담이 필요한 내용은 안내만 해요.", required: true, severity: "warning" },
  { id: "respectful-language", labelKo: "친구나 특정 집단을 놀리거나 차별하는 표현이 없어요.", descriptionKo: "서로 존중하는 표현을 써요.", required: true, severity: "warning" },
  { id: "teacher-review-needed", labelKo: "선생님 확인이 필요한 내용이 있으면 표시했어요.", descriptionKo: "헷갈리면 체크하고 질문해요.", required: false, severity: "info" },
];

export const REQUIRED_SAFETY_CHECK_IDS = COURSEWARE_SAFETY_CHECKLIST.filter((item) => item.required).map((item) => item.id);
export const PRIVACY_CHECK_IDS: CoursewareSafetyCheckId[] = ["privacy-no-personal-info", "privacy-no-face-or-location"];
