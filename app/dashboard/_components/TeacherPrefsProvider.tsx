"use client";

import type { ReactNode } from "react";

import { TeacherPrefsContext, useTeacherPrefsController } from "@/lib/teacherPrefs/useTeacherPrefs";

export function TeacherPrefsProvider({ children }: { children: ReactNode }) {
  const value = useTeacherPrefsController();
  return <TeacherPrefsContext.Provider value={value}>{children}</TeacherPrefsContext.Provider>;
}
