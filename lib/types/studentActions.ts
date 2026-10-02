export type StudentActionKind = "question" | "help" | "pulse";

export type StudentActionHelpReason = "too_fast" | "stuck" | "tech";

export type StudentActionPulseValue = 1 | 2 | 3 | 4 | 5;

export type StudentActionStatus =
  | "idle"
  | "sending"
  | "sent_pending"
  | "accepted"
  | "rejected"
  | "hidden"
  | "failed";

export type StudentActionCounts = {
  question: number;
  help: number;
  pulse: number;
};

export type StudentActionRecord = {
  id: string;
  kind: StudentActionKind;
  text?: string | null;
  reason?: StudentActionHelpReason | null;
  value?: StudentActionPulseValue | null;
  createdAt: number;
};

export type StudentActionTriageStatus = "pending" | "approved" | "hidden" | "pinned" | "rejected";

export type StudentActionTriageEntry = {
  actionId: string;
  kind: StudentActionKind;
  text?: string | null;
  reason?: StudentActionHelpReason | null;
  value?: StudentActionPulseValue | null;
  createdAt: number;
  status: StudentActionTriageStatus;
  handledBy?: string | null;
  handledAt?: number | null;
  replyText?: string | null;
  updatedAt: number;
};

export type StudentActionTriageState = {
  actions: StudentActionTriageEntry[];
  updatedAt: number;
};

export type StudentHudSettings = {
  approvalMode?: "auto" | "teacher_approve";
  announcement?: string | null;
  lockStudentInput?: boolean;
  updatedAt?: number;
};

export type StudentActionSummary = {
  counts: StudentActionCounts;
  recent: StudentActionRecord[];
  pulse?: {
    average: number;
    count: number;
    samples: Array<{ value: StudentActionPulseValue; createdAt: number }>;
  };
  updatedAt: number;
};
