"use client";

import type { ManualFile } from "@/app/dashboard/boards/[boardId]/board/_components/studentAppLocalPreview";
import { STUDENT_APP_MAX_FILE_COUNT, STUDENT_APP_MAX_TOTAL_SIZE_BYTES } from "./fileRules";

// Mirrors the shared submission total limit. The browser-only ZIP parser uses
// this value before the shared validator receives extracted files.
export const STUDENT_APP_ZIP_MAX_BYTES = STUDENT_APP_MAX_TOTAL_SIZE_BYTES;
export const STUDENT_APP_ZIP_MAX_FILES = STUDENT_APP_MAX_FILE_COUNT;

export type StudentAppZipImportResult =
  | { ok: true; files: ManualFile[]; ignoredFiles?: string[]; message: string }
  | { ok: false; message: string };

type ZipImportModule = {
  importStudentStaticSiteZip: (zipFile: File) => Promise<StudentAppZipImportResult>;
};

async function loadZipImportModule(): Promise<ZipImportModule> {
  const specifier = typeof window === "undefined" ? getNodePublicImporterUrl() : "/student-app-zip-import.mjs";
  return import(/* webpackIgnore: true */ specifier) as Promise<ZipImportModule>;
}

function getNodePublicImporterUrl(): string {
  const cwd = (globalThis as { process?: { cwd?: () => string } }).process?.cwd?.() ?? "";
  const normalized = cwd.replace(/\\/g, "/").replace(/^([A-Za-z]:)/, "/$1");
  return `file://${normalized}/public/student-app-zip-import.mjs`;
}

export async function importStudentStaticSiteZip(zipFile: File): Promise<StudentAppZipImportResult> {
  const zipImporter = await loadZipImportModule();
  return zipImporter.importStudentStaticSiteZip(zipFile);
}
