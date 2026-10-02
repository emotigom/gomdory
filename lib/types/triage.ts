export type TriageItem = {
  id: string;
  boardId: string;
  kind: "question" | "help";
  text: string;
  createdAt: string;
  status: "pending" | "approved" | "hidden";
  pinned: boolean;
  authorLabel?: string;
  meta?: { clientRequestId?: string };
};
