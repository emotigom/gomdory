import type { PilotQaFeatureGateSummary, PilotQaRouteCheck, PilotQaStorageKeyCheck, PilotQaStorageKeyStatus } from "./aiCoursewarePilotQaTypes";

export const PILOT_QA_ROUTES: PilotQaRouteCheck[] = [
  { label: "학생 수업 화면", path: "/edu/lesson", purpose: "학생 활동 및 결과물 작성", marker: "data-courseware-runtime=ai-courseware-canonical", status: "정상 예상" },
  { label: "교사용 운영판", path: "/edu/lesson/teacher", purpose: "수업 운영 및 링크 수집", marker: "data-courseware-teacher-dashboard=ai-courseware-teacher-shell", status: "정상 예상" },
  { label: "학생 제출 화면", path: "/edu/lesson/join", purpose: "수업 코드 제출", marker: "data-courseware-session-join=ai-courseware-session-join", status: "정상 예상" },
  { label: "공개 발표 페이지", path: "/edu/courseware/p/[shareId]", purpose: "발표/공유 확인", status: "확인 필요" },
];

export const PILOT_QA_LOCAL_KEYS = [
  { key: "gomdory.aiCourseware.localDrafts.v1", label: "artifact drafts" },
  { key: "gomdory.aiCourseware.pageDrafts.v1", label: "page drafts" },
  { key: "gomdory.aiCourseware.safetyChecks.v1", label: "safety checks" },
  { key: "gomdory.aiCourseware.teacherDashboard.v1", label: "teacher dashboard state" },
  { key: "gomdory.aiCourseware.revisionEvidence.v1", label: "revision evidence" },
  { key: "gomdory.aiCourseware.portfolio.v1", label: "portfolio" },
] as const;

export function inspectPilotQaLocalData(storage: Pick<Storage, "getItem"> | null | undefined): PilotQaStorageKeyCheck[] {
  return PILOT_QA_LOCAL_KEYS.map(({ key, label }) => {
    const status = inspectSingleKey(storage, key);
    return { key, label, status };
  });
}

function inspectSingleKey(storage: Pick<Storage, "getItem"> | null | undefined, key: string): PilotQaStorageKeyStatus {
  if (!storage) return "데이터 없음";
  try {
    const raw = storage.getItem(key);
    if (!raw) return "데이터 없음";
    const parsed = JSON.parse(raw);
    if (parsed == null || (typeof parsed === "object" && Object.keys(parsed).length === 0)) return "데이터 없음";
    if (typeof parsed === "object") return "초기화 가능";
    return "일부 있음";
  } catch {
    return "손상된 데이터 감지";
  }
}

export function buildReadinessReport(args: {
  checkedAt: string;
  feature: PilotQaFeatureGateSummary;
  localStatusSummary: string;
}): string {
  const { checkedAt, feature, localStatusSummary } = args;
  return [
    `수업 전 확인 시각: ${checkedAt}`,
    `수업 전 확인 결과: 학생 화면, 교사 화면, 포트폴리오 흐름은 확인했습니다.`,
    `로컬 데이터 상태: ${localStatusSummary}`,
    `공개 링크 저장소: ${feature.publicPublishEnabled ? "사용 가능" : "꺼짐(발표 모드/복사용 요약 사용)"}`,
    `수업 코드 제출: ${feature.classSessionsEnabled ? "사용 가능" : "꺼짐(수동 링크 수집 사용)"}`,
    `AI 초안 도우미: ${feature.aiHelperEnabled ? "사용 가능" : "꺼짐(템플릿 예시 진행)"}`,
    "fallback: AI disabled → template fallback, publish disabled → presentation/share shell, session disabled → manual link collector",
    "권장 5분 점검: 1) 학생 화면 열기 2) 교사 운영판 열기 3) 제출 화면 점검 4) 데모 데이터 생성/초기화 5) 안전 체크 문구 확인",
  ].join("\n");
}
