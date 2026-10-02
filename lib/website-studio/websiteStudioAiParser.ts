export function parseWebsiteStudioAiActionResult(rawText: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const normalized = rawText.trim().replace(/^```json\s*/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("shape");
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, error: "AI 제안을 안전한 블록 수정 형식으로 읽지 못했습니다." };
  }
}
