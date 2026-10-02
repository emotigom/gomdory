const EMAIL_PATTERN = /\b([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const MOBILE_PHONE_PATTERN = /\b(01[0-9])[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b/g;
const LANDLINE_PATTERN = /\b(0[2-9]\d{0,1})[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b/g;
const RRN_PATTERN = /\b(\d{6})[-\s]?(\d{7})\b/g;
const ADDRESS_PATTERN =
  /\b(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{0,20}?(?:시|군|구|읍|면|동|로|길)\s*\d{1,4}\b/gi;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s]+/gi;
const SOCIAL_ID_PATTERN =
  /\b(?:카카오톡|카톡|kakao|인스타|instagram|insta)\s*[:：]?\s*([a-z0-9_.]{2,30})\b/gi;

export type MaskPiiOptions = {
  maskUrls?: boolean;
  allowUrlDomains?: string[];
  maskSocialIds?: boolean;
};

export type PiiMaskResult = {
  text: string;
  hits: string[];
  reasons: string[];
};

function maskEmail(local: string, domain: string) {
  const maskedLocal = `${local.slice(0, 1) || "*"}***`;
  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return `${maskedLocal}@${domain.slice(0, 1) || "*"}***`;
  }
  const tld = domainParts.pop() ?? "";
  const base = domainParts.pop() ?? "";
  const maskedDomain = `${base.slice(0, 1) || "*"}***.${tld}`;
  return `${maskedLocal}@${maskedDomain}`;
}

function extractHost(url: string) {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function maskPII(input: string, options: MaskPiiOptions = {}): PiiMaskResult {
  const { maskUrls = true, allowUrlDomains = [], maskSocialIds = true } = options;
  let text = input ?? "";
  const hits: string[] = [];

  text = text.replace(EMAIL_PATTERN, (_match, local: string, domain: string) => {
    hits.push("pii_email");
    return maskEmail(local, domain);
  });

  text = text.replace(MOBILE_PHONE_PATTERN, (_match, area: string, mid: string, tail: string) => {
    hits.push("pii_phone");
    return `${area}-${"*".repeat(mid.length)}-${"*".repeat(tail.length)}`;
  });

  text = text.replace(LANDLINE_PATTERN, (_match, area: string, mid: string, tail: string) => {
    hits.push("pii_phone");
    return `${area}-${"*".repeat(mid.length)}-${"*".repeat(tail.length)}`;
  });

  text = text.replace(RRN_PATTERN, (_match, front: string) => {
    hits.push("pii_rrn");
    return `${front}-*******`;
  });

  text = text.replace(ADDRESS_PATTERN, () => {
    hits.push("pii_address");
    return "[주소]";
  });

  if (maskUrls) {
    text = text.replace(URL_PATTERN, (match) => {
      const host = extractHost(match);
      if (host && allowUrlDomains.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
        return match;
      }
      hits.push("pii_url");
      return "[링크]";
    });
  }

  if (maskSocialIds) {
    text = text.replace(SOCIAL_ID_PATTERN, () => {
      hits.push("pii_social_id");
      return "[아이디]";
    });
  }

  const uniqueHits = Array.from(new Set(hits));
  return { text, hits: uniqueHits, reasons: uniqueHits };
}

export function maskPii(input: string, options?: MaskPiiOptions): PiiMaskResult {
  return maskPII(input, options);
}
