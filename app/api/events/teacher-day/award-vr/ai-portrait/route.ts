import { NextResponse } from "next/server";
import { readEnvString } from "@/lib/server/runtimeEnv";
import type { AwardVrAiPortraitProviderId, AwardVrAiPortraitRequest } from "@/lib/award-vr/ai-portrait";

const ERROR_MESSAGE = "AI 포트레이트 생성은 아직 준비 중입니다.";
const MAX_IMAGE_DATA_URL_BYTES = 4_000_000;
const ALLOWED_MIME_PREFIXES = ["data:image/jpeg", "data:image/png", "data:image/webp"] as const;
const ALLOWED_FRAME_STYLES: AwardVrAiPortraitRequest["frameStyle"][] = ["gold", "stage", "trophy"];
const ALLOWED_BEAUTIFICATION_MODES: AwardVrAiPortraitRequest["beautificationMode"][] = ["natural", "bright", "off"];

function fail(status: number, provider: AwardVrAiPortraitProviderId, error: string) {
  return NextResponse.json({ provider, temporaryOnly: true, error }, { status });
}

export async function POST(request: Request) {
  if (readEnvString("AWARD_VR_AI_PORTRAIT_SERVER_ENABLED") !== "true") {
    return fail(501, "disabled", ERROR_MESSAGE);
  }

  const provider = readEnvString("AWARD_VR_AI_PORTRAIT_PROVIDER");
  if (provider !== "mock") {
    return fail(501, "future", ERROR_MESSAGE);
  }

  const body = (await request.json().catch(() => null)) as Partial<AwardVrAiPortraitRequest> | null;
  if (body?.consent?.aiPortraitUpload !== true) {
    return fail(400, "future", "AI 포트레이트 생성을 위한 동의가 필요합니다.");
  }

  const imageDataUrl = body?.imageDataUrl;
  if (typeof imageDataUrl !== "string" || imageDataUrl.length === 0) {
    return fail(400, "future", "이미지 데이터가 필요합니다.");
  }
  if (!imageDataUrl.startsWith("data:image/")) {
    return fail(400, "future", "이미지 형식이 올바르지 않습니다.");
  }
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => imageDataUrl.startsWith(`${prefix};base64,`))) {
    return fail(400, "future", "지원하지 않는 이미지 형식입니다. JPEG, PNG, WEBP만 가능합니다.");
  }
  if (imageDataUrl.length > MAX_IMAGE_DATA_URL_BYTES) {
    return fail(413, "future", "이미지 크기가 너무 큽니다.");
  }
  if (!ALLOWED_FRAME_STYLES.includes(body?.frameStyle as AwardVrAiPortraitRequest["frameStyle"])) {
    return fail(400, "future", "프레임 스타일이 올바르지 않습니다.");
  }
  if (!ALLOWED_BEAUTIFICATION_MODES.includes(body?.beautificationMode as AwardVrAiPortraitRequest["beautificationMode"])) {
    return fail(400, "future", "보정 모드가 올바르지 않습니다.");
  }

  return NextResponse.json({
    provider: "mock",
    temporaryOnly: true,
    mock: true,
    message: "Mock AI result",
    imageDataUrl,
  });
}
