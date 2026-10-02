export type EduSafetyResult = { ok: true } | { ok: false; code: string; message: string };

export type EduPublishFileMeta = {
  path: string;
  contentType?: string;
  content?: string;
};

const BLOCK_MESSAGE = "이 수업에서는 안전한 주제로만 만들 수 있어요. 다른 주제로 다시 시도해 주세요.";

const PROMPT_DENYLIST = [
  "porn",
  "sexual",
  "nude",
  "explicit sex",
  "rape",
  "sex video",
  "야동",
  "포르노",
  "음란",
  "누드",
  "섹스",
  "강간",
  "자살",
  "자해",
  "죽고싶",
  "kill yourself",
  "suicide",
  "self-harm",
  "hate speech",
  "혐오",
  "나치",
  "dox",
  "doxx",
  "address",
  "phone number",
  "주민등록번호",
  "전화번호",
  "집 주소",
  "gun",
  "bomb",
  "explosive",
  "knife",
  "무기",
  "총",
  "폭탄",
  "칼",
  "살인",
];

const META_REFRESH_REGEX = /<meta\s+http-equiv=["']?refresh/i;
const SEND_BEACON_REGEX = /navigator\.sendBeacon/i;
const FETCH_HTTP_REGEX = /fetch\s*\(\s*["']https?:\/\//i;

export function basicPromptFilter(text: string): EduSafetyResult {
  const normalized = text.toLowerCase();
  for (const token of PROMPT_DENYLIST) {
    if (normalized.includes(token)) {
      return { ok: false, code: "UNSAFE_PROMPT", message: BLOCK_MESSAGE };
    }
  }
  return { ok: true };
}

export function basicHtmlFilter(files: EduPublishFileMeta[]): EduSafetyResult {
  for (const file of files) {
    if (!file?.content) continue;
    const content = file.content;
    if (META_REFRESH_REGEX.test(content)) {
      return { ok: false, code: "HTML_META_REFRESH", message: BLOCK_MESSAGE };
    }

    if (SEND_BEACON_REGEX.test(content)) {
      return { ok: false, code: "HTML_EXFIL", message: BLOCK_MESSAGE };
    }

    if (FETCH_HTTP_REGEX.test(content)) {
      return { ok: false, code: "HTML_EXFIL", message: BLOCK_MESSAGE };
    }
  }

  return { ok: true };
}
