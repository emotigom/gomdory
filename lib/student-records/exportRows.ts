import type { BrowserStudentRow, RecordGenerationOptions, RecordTone, RecordType } from "./contracts";
import { countCharacters, utf8ByteLength } from "./metrics";

export const EXPORT_HEADERS = ["사용 여부", "번호", "이름", "활동", "강점", "참여 태도", "관찰 메모", "글자 수", "UTF-8 byte", "최종 문구", "교사 메모"] as const;

export type StudentRecordExportRow = {
  useStatus: "사용" | "제외";
  studentNumber: number;
  studentName: string;
  activity: string;
  strength: string;
  attitude: string;
  observation: string;
  characterCount: number;
  utf8Bytes: number;
  generatedText: string;
  teacherMemo: string;
};

export type ExportSummary = { total: number; included: number; excluded: number; emptyGeneratedText: number };
export type ExportSettings = { recordType: string; tone: string; targetLength: string };

const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  "subject-detail": "교과 세부능력 및 특기사항",
  "behavior-summary": "행동 특성 및 종합 의견",
  "autonomous-activity": "자율 활동",
};
const TONE_LABELS: Record<RecordTone, string> = { concise: "간결한 기록체", growth: "성장 중심", objective: "객관적 서술" };

export function hasExportableContent(row: BrowserStudentRow): boolean {
  return [row.studentName, row.activity, row.strength, row.attitude, row.observation, row.generatedText, row.teacherMemo].some((value) => value.trim().length > 0);
}

export function createExportRows(rows: readonly BrowserStudentRow[]): StudentRecordExportRow[] {
  return rows.filter((row) => row.useInExport && hasExportableContent(row)).map((row) => ({
    useStatus: row.useInExport ? "사용" : "제외",
    studentNumber: row.studentNumber,
    studentName: row.studentName,
    activity: row.activity,
    strength: row.strength,
    attitude: row.attitude,
    observation: row.observation,
    characterCount: countCharacters(row.generatedText),
    utf8Bytes: utf8ByteLength(row.generatedText),
    generatedText: row.generatedText,
    teacherMemo: row.teacherMemo,
  }));
}

export function summarizeExportRows(rows: readonly StudentRecordExportRow[]): ExportSummary {
  return {
    total: rows.length,
    included: rows.filter((row) => row.useStatus === "사용").length,
    excluded: rows.filter((row) => row.useStatus === "제외").length,
    emptyGeneratedText: rows.filter((row) => row.generatedText.trim().length === 0).length,
  };
}

export function createExportSettings(options: RecordGenerationOptions): ExportSettings {
  return { recordType: RECORD_TYPE_LABELS[options.recordType], tone: TONE_LABELS[options.tone], targetLength: `${options.targetLength}자` };
}
