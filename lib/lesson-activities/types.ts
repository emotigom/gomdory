import type { LessonTemplate } from "@/lib/lesson-activities/registry";

export type ActiveLessonSession = {
  id: string;
  boardId: string;
  templateId: LessonTemplate["id"];
  title: string;
  activityTypes: Array<"ai_bingo" | "ai_judgment_sort" | "web_coding_lite" | "python_studio_lite">;
  startedAt: string;
  endedAt: string | null;
  status: string;
};


export type AiBingoTeacherSummary = {
  activityRunId: string;
  activityTitle: "AI 빙고 아레나";
  participantCount: number;
  completedCount: number;
  selectedTileCount: number;
  recentReasons: Array<{
    id: string;
    displayName: string;
    tileLabel: string;
    reason: string;
    updatedAt: string;
  }>;
};


export type AiJudgmentSortTeacherSummary = {
  activityRunId: string;
  activityTitle: "AI 판단 카드 분류";
  participantCount: number;
  submittedCount: number;
  cards: Array<{
    cardId: string;
    title: string;
    recommendedCategory: "ai_good" | "human_needed" | "collaboration";
    distribution: Record<"ai_good" | "human_needed" | "collaboration", number>;
    responseCount: number;
    topCategory: "ai_good" | "human_needed" | "collaboration" | null;
    topRatio: number;
    discussionRecommended: boolean;
    teacherExplanation: string;
    discussionPrompt?: string;
  }>;
  recentReasons: Array<{
    id: string;
    displayName: string;
    cardTitle: string;
    categoryLabel: string;
    reason: string;
    updatedAt: string;
  }>;
};


export type WebCodingLiteTeacherSummary = {
  activityRunId: string;
  activityTitle: "웹 코딩 실습실";
  hintsEnabled: boolean;
  participantCount: number;
  savedCount: number;
  submittedCount: number;
  recentSubmissions: Array<{
    id: string;
    displayName: string;
    savedAt: string;
    submittedAt: string | null;
    status: "saved" | "submitted";
  }>;
};


export type WebCodingLiteSubmissionReviewItem = {
  id: string;
  studentLabel: string;
  savedAt: string | null;
  submitted: boolean;
  submittedAt: string | null;
  html: string;
  css: string;
  js: string;
  counts: {
    html: { chars: number; lines: number };
    css: { chars: number; lines: number };
    js: { chars: number; lines: number };
    totalChars: number;
    totalLines: number;
  };
};

export type WebCodingLiteSubmissionReviewPayload = {
  activityRunId: string;
  activityTitle: "웹 코딩 실습실";
  submissions: WebCodingLiteSubmissionReviewItem[];
};


export type PythonStudioLiteTeacherSummary = {
  activityRunId: string;
  activityTitle: "파이썬 실습실" | "파이썬 if/else 실습";
  participantCount: number;
  savedCount: number;
  submittedCount: number;
  recentSubmissions: Array<{
    id: string;
    displayName: string;
    savedAt: string;
    submittedAt: string | null;
    status: "saved" | "submitted";
  }>;
};
