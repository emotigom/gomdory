import { buildPreviewHtml } from "@/lib/labs/buildPreviewHtml";

export const PRACTICE_SNAPSHOT_LIMITS = {
  title: 120,
  html: 40_000,
  css: 30_000,
  js: 30_000,
} as const;

export type PracticeSnapshotAttachment = {
  kind: "practice";
  title: string;
  html: string;
  css: string;
  js: string;
  createdAt: string;
};

function capText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\r\n/g, "\n");
  return normalized.slice(0, max);
}

export function normalizePracticeSnapshotAttachment(value: unknown): PracticeSnapshotAttachment | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "practice") return null;

  const title = capText(record.title, PRACTICE_SNAPSHOT_LIMITS.title).trim() || "실습 제출";
  const html = capText(record.html, PRACTICE_SNAPSHOT_LIMITS.html);
  const css = capText(record.css, PRACTICE_SNAPSHOT_LIMITS.css);
  const js = capText(record.js, PRACTICE_SNAPSHOT_LIMITS.js);
  const createdAtRaw = typeof record.createdAt === "string" ? record.createdAt : "";
  const createdAt = Number.isNaN(new Date(createdAtRaw).getTime()) ? new Date().toISOString() : createdAtRaw;

  return { kind: "practice", title, html, css, js, createdAt };
}

export function createPracticeSnapshotAttachment(input: {
  title?: string;
  html: string;
  css: string;
  js: string;
  createdAt?: string;
}): PracticeSnapshotAttachment {
  return (
    normalizePracticeSnapshotAttachment({
      kind: "practice",
      title: input.title ?? "실습 제출",
      html: input.html,
      css: input.css,
      js: input.js,
      createdAt: input.createdAt ?? new Date().toISOString(),
    }) ?? {
      kind: "practice",
      title: "실습 제출",
      html: "",
      css: "",
      js: "",
      createdAt: new Date().toISOString(),
    }
  );
}

export function buildPracticePreviewHtml(attachment: PracticeSnapshotAttachment): string {
  return buildPreviewHtml({ html: attachment.html, css: attachment.css, js: attachment.js });
}
