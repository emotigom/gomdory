import { CANONICAL_BASE_URL } from "@/lib/http/siteConfig";

const SHARE_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;

export interface ParsedTeacherShareLink {
  shareId: string;
  publicUrl: string;
  status: "valid-looking" | "invalid";
}

export function parseTeacherShareInput(input: string, origin = CANONICAL_BASE_URL): ParsedTeacherShareLink | null {
  const value = input.trim();
  if (!value) return null;

  if (SHARE_ID_RE.test(value)) {
    return { shareId: value, publicUrl: `${origin}/edu/courseware/p/${value}`, status: "valid-looking" };
  }

  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (!/(^|\.)gomdory\.com$/.test(url.hostname)) return null;
    const match = url.pathname.match(/\/edu\/courseware\/p\/([a-zA-Z0-9_-]{8,80})$/);
    if (!match) return null;
    const shareId = match[1];
    return { shareId, publicUrl: `${origin}/edu/courseware/p/${shareId}`, status: "valid-looking" };
  } catch {
    return null;
  }
}
