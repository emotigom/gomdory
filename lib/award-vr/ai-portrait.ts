export type AwardVrAiPortraitProviderId = "disabled" | "mock" | "future";

export type AwardVrAiPortraitRequest = {
  imageDataUrl: string;
  frameStyle: "gold" | "stage" | "trophy";
  beautificationMode: "natural" | "bright" | "off";
  consent: {
    aiPortraitUpload: true;
  };
};

export type AwardVrAiPortraitResult = {
  imageDataUrl?: string;
  error?: string;
  provider: AwardVrAiPortraitProviderId;
  temporaryOnly: true;
  mock?: boolean;
  message?: string;
};

export async function requestAwardVrAiPortrait(payload: AwardVrAiPortraitRequest): Promise<AwardVrAiPortraitResult> {
  const response = await fetch("/api/events/teacher-day/award-vr/ai-portrait", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as AwardVrAiPortraitResult;
  if (!response.ok) {
    return { provider: result.provider ?? "future", temporaryOnly: true, error: result.error ?? "AI 포트레이트 생성은 아직 준비 중입니다." };
  }
  return result;
}
