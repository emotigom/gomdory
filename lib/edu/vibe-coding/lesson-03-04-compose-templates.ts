import { LESSON_03_04_VIBE_CODING_CONTENT } from "@/lib/edu/vibe-coding/lesson-03-04-content";

type VibeComposeTemplate = {
  key: string;
  label: string;
  body: string;
};

const composeLabelByWorksheetKey: Record<string, string> = {
  idea: "앱 아이디어 제출",
  prompt: "AI 프롬프트 제출",
  work: "작품 링크 제출",
  canva: "Canva 시안 제출",
  fail: "실패 기록 제출",
  peer: "친구 피드백",
};

const worksheetByKey = new Map(
  LESSON_03_04_VIBE_CODING_CONTENT.worksheets.map((worksheet) => [worksheet.key, worksheet]),
);

function buildTemplateBody(worksheetKey: string): string {
  const worksheet = worksheetByKey.get(worksheetKey);
  if (!worksheet) return "";
  return [`[${worksheet.title}]`, "", ...worksheet.fields].join("\n");
}

export const VIBE_COMPOSE_TEMPLATES: VibeComposeTemplate[] = Object.entries(composeLabelByWorksheetKey)
  .map(([key, label]) => ({
    key,
    label,
    body: buildTemplateBody(key),
  }))
  .filter((template) => Boolean(template.body));

export function insertVibeTemplateText(currentText: string, templateBody: string): string {
  if (!currentText.trim()) {
    return templateBody;
  }
  return `${currentText.trimEnd()}\n\n${templateBody}`;
}
