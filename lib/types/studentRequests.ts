export type StudentRequestType = "question" | "help" | "pulse" | "poll";

export type StudentRequestStatus =
  | "queued"
  | "sent"
  | "approved"
  | "hidden"
  | "rejected"
  | "failed";

export type StudentRequestRecord = {
  id: string;
  type: StudentRequestType;
  text: string | null;
  meta: Record<string, unknown>;
  status: StudentRequestStatus;
  createdAt: number;
  decidedAt?: number | null;
  pinned?: boolean;
  errorMessage?: string | null;
};
