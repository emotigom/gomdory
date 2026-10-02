"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/requireUser";
import {
  updateSessionReportMeta,
  type SessionReportMetaInput,
} from "@/lib/data/sessions";
import { parseTemplateId } from "@/lib/recap/templates";

const MAX_LENGTHS = {
  reportTitle: 120,
  schoolName: 120,
  className: 120,
  subject: 120,
  teacherName: 120,
  periodLabel: 60,
  learningGoals: 1000,
} as const;

function normalizeSingleLine(value: FormDataEntryValue | null, limit: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/\r\n/g, "\n").replace(/\n+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, limit);
}

function normalizeMultiLine(value: FormDataEntryValue | null, limit: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, limit);
}

export async function saveSessionReportMeta(
  boardId: string,
  sessionId: string,
  formData: FormData,
) {
  const { user } = await requireUser(`/dashboard/boards/${boardId}/sessions`);

  const reportTemplateRaw = formData.get("report_template");
  const reportTemplate =
    typeof reportTemplateRaw === "string"
      ? parseTemplateId(reportTemplateRaw)
      : parseTemplateId(undefined);

  const payload: SessionReportMetaInput = {
    reportTitle: normalizeSingleLine(formData.get("report_title"), MAX_LENGTHS.reportTitle),
    schoolName: normalizeSingleLine(formData.get("school_name"), MAX_LENGTHS.schoolName),
    className: normalizeSingleLine(formData.get("class_name"), MAX_LENGTHS.className),
    subject: normalizeSingleLine(formData.get("subject"), MAX_LENGTHS.subject),
    teacherName: normalizeSingleLine(formData.get("teacher_name"), MAX_LENGTHS.teacherName),
    periodLabel: normalizeSingleLine(formData.get("period_label"), MAX_LENGTHS.periodLabel),
    learningGoals: normalizeMultiLine(
      formData.get("learning_goals"),
      MAX_LENGTHS.learningGoals,
    ),
    reportTemplate,
  };

  await updateSessionReportMeta(sessionId, user.id, payload);

  revalidatePath(`/dashboard/boards/${boardId}/sessions`);
  revalidatePath(`/dashboard/boards/${boardId}`);
}
