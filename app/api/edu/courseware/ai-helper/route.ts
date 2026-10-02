import { NextResponse } from "next/server";
import { buildTemplateFallbackSuggestions } from "@/lib/edu/courseware/aiHelper/aiCoursewareAiHelperFallback";
import { isCoursewareAiHelperEnabled, validateAiHelperRequest } from "@/lib/edu/courseware/aiHelper/aiCoursewareAiHelperRequest";

export async function POST(req: Request) {
  const valid = validateAiHelperRequest(await req.json().catch(() => null));
  if (!valid) return NextResponse.json({ status: "validation_failed", suggestions: [] }, { status: 400 });
  const suggestions = buildTemplateFallbackSuggestions(valid);
  if (!isCoursewareAiHelperEnabled()) return NextResponse.json({ status: "unavailable", suggestions, messageKo: "AI 초안을 불러오지 못했어요. 템플릿 예시로 계속할 수 있어요." });
  return NextResponse.json({ status: "ok", suggestions });
}
