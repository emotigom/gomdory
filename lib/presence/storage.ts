const STORAGE_PREFIX = "gom:presence:name";

export function getPresenceNameKey(shareCode: string) {
  return `${STORAGE_PREFIX}:${shareCode.trim().toLowerCase()}`;
}

export function loadPresenceName(shareCode: string): string {
  if (typeof window === "undefined") return "";
  const value = window.localStorage.getItem(getPresenceNameKey(shareCode));
  return value ?? "";
}

export function savePresenceName(shareCode: string, name: string) {
  if (typeof window === "undefined") return;
  const key = getPresenceNameKey(shareCode);
  const trimmed = name.trim();
  if (!trimmed) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, trimmed);
  }
}
