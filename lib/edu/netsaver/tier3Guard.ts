const TIER3_DISABLE_TTL_MS = 30 * 60 * 1000;
const TIER3_DISABLED_KEY = (code: string) => `edu:netsaver:tier3Disabled:${code}`;

export type Tier3DisabledState = {
  disabled: boolean;
  reason?: string;
  expiresAt?: number;
};

export const getTier3DisabledState = (code: string): Tier3DisabledState => {
  if (typeof window === "undefined") return { disabled: false };
  try {
    const raw = window.localStorage.getItem(TIER3_DISABLED_KEY(code));
    if (!raw) return { disabled: false };
    const parsed = JSON.parse(raw) as { expiresAt?: number; reason?: string };
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(TIER3_DISABLED_KEY(code));
      return { disabled: false };
    }
    return { disabled: true, reason: parsed.reason, expiresAt: parsed.expiresAt };
  } catch {
    return { disabled: false };
  }
};

export const setTier3Disabled = (code: string, reason?: string) => {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      reason,
      expiresAt: Date.now() + TIER3_DISABLE_TTL_MS,
    };
    window.localStorage.setItem(TIER3_DISABLED_KEY(code), JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
};

export const clearTier3Disabled = (code: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TIER3_DISABLED_KEY(code));
  } catch {
    // ignore storage failures
  }
};
