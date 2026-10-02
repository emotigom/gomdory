const URL_PATTERN = /https?:\/\/[^\s]+/gi;

function assertNonEmpty(value: string, message: string) {
  if (!value.trim()) {
    throw new Error(message);
  }
}

function assertSafeUrls(value: string, { maxUrls = 3 }: { maxUrls?: number } = {}) {
  const urls = value.match(URL_PATTERN) ?? [];
  if (urls.length > maxUrls) {
    throw new Error("URL은 최대 3개까지만 허용됩니다.");
  }

  for (const raw of urls) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("올바른 URL 형식만 허용됩니다.");
    }

    if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
      throw new Error("http/https URL만 허용됩니다.");
    }

    if (raw.length > 500) {
      throw new Error("URL 길이가 너무 깁니다.");
    }
  }
}

export function validateCommentBody(bodyInput: string) {
  const body = bodyInput.trim().slice(0, 2000);
  assertNonEmpty(body, "댓글 내용을 입력해 주세요.");
  assertSafeUrls(body);
  return body;
}
