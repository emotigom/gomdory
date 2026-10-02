export { normalizeShareCode } from "@/lib/share/normalizeShareCode";
import { normalizeShareCode } from "@/lib/share/normalizeShareCode";

const SHARE_CODE_CHARSET = "23456789abcdefghjkmnpqrstuvwxyz";
const SHARE_CODE_LENGTH = 6;
const SHARE_CODE_REGEX = new RegExp(`^[${SHARE_CODE_CHARSET}]{${SHARE_CODE_LENGTH}}$`, "i");

export function isValidShareCode(value: string): boolean {
  return SHARE_CODE_REGEX.test(normalizeShareCode(value));
}

export function isShareCodePath(pathname: string): boolean {
  const segments = pathname.toLowerCase().split("/").filter(Boolean);

  if (segments.length === 0) {
    return false;
  }

  const [code, suffix] = segments;

  if (!isValidShareCode(code)) {
    return false;
  }

  if (segments.length === 1) {
    return true;
  }

  if (segments.length === 2 && (suffix === "present" || suffix === "slides")) {
    return true;
  }

  return false;
}
