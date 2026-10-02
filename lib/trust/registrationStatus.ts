export type RegistrationStatus = "registered" | "pending";

export type TrustRegistrationEntry = {
  label: string;
  status: RegistrationStatus;
  category: string;
  proofUrl: string | null;
  note: string;
};

export const registrationStatus = {
  eduZip: {
    label: "에듀집",
    status: "registered",
    category: "학습지원 소프트웨어",
    proofUrl: null,
    note: "기관 문의 시 등록 확인 자료를 제공할 수 있습니다.",
  },
  koreaDigitalEducationAssociation: {
    label: "한국디지털교육협회",
    status: "registered",
    category: "학습지원 소프트웨어",
    proofUrl: null,
    note: "기관 문의 시 등록 확인 자료를 제공할 수 있습니다.",
  },
} satisfies Record<string, TrustRegistrationEntry>;

export const registrationCaution =
  "이 등록은 학습지원 소프트웨어로서의 등재/분류 사실을 안내하기 위한 것이며, 보안감사, 조달 승인, 교육청 공식 인증, 개인정보 영향평가 또는 SLA 보장을 대체하지 않습니다.";
