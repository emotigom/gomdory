"use client";

const STORAGE_KEY = "gom.student.client_id";

function safeUuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const part = () => Math.floor(Math.random() * 1e16).toString(16).padStart(12, "0");
    return `${part()}${part()}`.slice(0, 32);
  }
}

export function getOrCreateStudentDeviceId(): string {
  if (typeof window === "undefined") {
    // Not available during SSR; caller should only use in client components.
    return "";
  }

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && typeof existing === "string" && existing.length >= 16) {
      return existing;
    }

    const next = safeUuid();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return safeUuid();
  }
}
