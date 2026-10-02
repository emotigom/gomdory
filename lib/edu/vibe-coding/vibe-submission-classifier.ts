export type VibeSubmissionSourceTool =
  | "lovable"
  | "gemini"
  | "canva"
  | "bolt"
  | "replit"
  | "v0"
  | "other_link"
  | "none";

export type VibeSubmissionMode =
  | "idea"
  | "prompt"
  | "work_link"
  | "canva_mockup"
  | "rescue"
  | "peer_feedback"
  | "general";

export type VibeSubmissionClassification = {
  sourceTool: VibeSubmissionSourceTool;
  submissionMode: VibeSubmissionMode;
  hasLink: boolean;
  hasAttachment: boolean;
  isVibeLikely: boolean;
  primaryUrl: string | null;
};

type MinimalAttachment = {
  url?: string | null;
  downloadPath?: string | null;
};

type MinimalVibeCard = {
  text?: string | null;
  url?: string | null;
  external_url?: string | null;
  attachments?: MinimalAttachment[] | null;
  external_attachments?: MinimalAttachment[] | null;
};

const URL_REGEX = /https?:\/\/[^\s)\]}"']+/gi;

function lower(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

function collectUrls(card: MinimalVibeCard): string[] {
  const urls: string[] = [];
  const text = card.text ?? "";
  const textMatches = text.match(URL_REGEX) ?? [];
  urls.push(...textMatches);
  if (card.url) urls.push(card.url);
  if (card.external_url) urls.push(card.external_url);
  for (const item of card.attachments ?? []) {
    if (item?.url) urls.push(item.url);
    if (item?.downloadPath) urls.push(item.downloadPath);
  }
  for (const item of card.external_attachments ?? []) {
    if (item?.url) urls.push(item.url);
    if (item?.downloadPath) urls.push(item.downloadPath);
  }
  return urls;
}

export function classifyVibeSubmission(card: MinimalVibeCard): VibeSubmissionClassification {
  const text = card.text ?? "";
  const textLower = lower(text);
  const urls = collectUrls(card);
  const joined = `${textLower} ${urls.map((u) => lower(u)).join(" ")}`;

  const hasLink = urls.length > 0 || /https?:\/\//i.test(text);
  const hasAttachment = (card.attachments?.length ?? 0) > 0 || (card.external_attachments?.length ?? 0) > 0;

  let sourceTool: VibeSubmissionSourceTool = "none";
  if (joined.includes("lovable.dev")) sourceTool = "lovable";
  else if (joined.includes("gemini.google.com") || joined.includes("gemini")) sourceTool = "gemini";
  else if (joined.includes("canva.com")) sourceTool = "canva";
  else if (joined.includes("bolt.new") || joined.includes("bolt.host")) sourceTool = "bolt";
  else if (joined.includes("replit.com") || joined.includes("replit.app") || joined.includes("replit.dev")) sourceTool = "replit";
  else if (joined.includes("v0.dev") || joined.includes("v0.app") || joined.includes("vercel.app")) sourceTool = "v0";
  else if (hasLink) sourceTool = "other_link";

  let submissionMode: VibeSubmissionMode = "general";
  if (text.includes("[앱 아이디어 제출]") || (text.includes("앱 이름:") && text.includes("이 앱은 누구를 위한 앱"))) submissionMode = "idea";
  else if (text.includes("[AI 프롬프트 제출]") || text.includes("AI에게 입력할 최종 프롬프트") || text.includes("Gemini가 정리해준 Lovable용 프롬프트")) submissionMode = "prompt";
  else if (text.includes("[작품 링크 제출]") || text.includes("작품 링크:")) submissionMode = "work_link";
  else if (text.includes("[Canva 시안 제출]") || text.includes("Canva 링크")) submissionMode = "canva_mockup";
  else if (text.includes("[실패 기록 제출]") || text.includes("막힌 부분:")) submissionMode = "rescue";
  else if (text.includes("[친구 피드백]") || (text.includes("좋았던 점:") && text.includes("추가되면 좋을 기능:"))) submissionMode = "peer_feedback";

  const isVibeLikely =
    submissionMode !== "general" ||
    sourceTool !== "none" ||
    text.includes("AI 프롬프트") ||
    text.includes("Lovable") ||
    text.includes("Canva") ||
    text.includes("실패 기록") ||
    text.includes("앱 아이디어");

  return {
    sourceTool,
    submissionMode,
    hasLink,
    hasAttachment,
    isVibeLikely,
    primaryUrl: urls[0] ?? null,
  };
}
