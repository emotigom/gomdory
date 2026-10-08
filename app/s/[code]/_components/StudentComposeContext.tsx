"use client";

import { createContext } from "react";

import {
  isStudentRuntimeAuthority,
  type StudentRuntimeAuthority,
} from "@/lib/student/boardSyncContract";

export type StudentComposeBridge = (wallId: string) => void;

export type StudentRuntimeAuthorityEventDetail = StudentRuntimeAuthority & {
  shareCode: string;
};

export const STUDENT_RUNTIME_AUTHORITY_EVENT = "gom:student-runtime-authority";

export function isStudentRuntimeAuthorityEventDetail(
  value: unknown,
): value is StudentRuntimeAuthorityEventDetail {
  if (!value || typeof value !== "object") return false;
  const detail = value as Partial<StudentRuntimeAuthorityEventDetail>;
  return typeof detail.shareCode === "string" && isStudentRuntimeAuthority(detail);
}

export function dispatchStudentRuntimeAuthority(
  detail: StudentRuntimeAuthorityEventDetail,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<StudentRuntimeAuthorityEventDetail>(
      STUDENT_RUNTIME_AUTHORITY_EVENT,
      { detail },
    ),
  );
}

// The SmartLayer provider and the board CTA intentionally import this shared
// module so they always use the same context identity across reloads.
export const StudentSmartComposeContext = createContext<StudentComposeBridge | null>(null);
