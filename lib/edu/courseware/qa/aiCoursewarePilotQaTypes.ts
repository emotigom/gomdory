export type PilotQaRouteStatus = "확인 필요" | "정상 예상" | "설정 필요";

export type PilotQaRouteCheck = {
  label: string;
  path: string;
  purpose: string;
  marker?: string;
  status: PilotQaRouteStatus;
};

export type PilotQaStorageKeyStatus = "데이터 없음" | "일부 있음" | "손상된 데이터 감지" | "초기화 가능";

export type PilotQaStorageKeyCheck = {
  key: string;
  label: string;
  status: PilotQaStorageKeyStatus;
};

export type PilotQaFeatureGateSummary = {
  publicPublishEnabled: boolean;
  classSessionsEnabled: boolean;
  aiHelperEnabled: boolean;
};
