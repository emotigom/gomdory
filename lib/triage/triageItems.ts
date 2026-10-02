import type { StudentActionHelpReason, StudentActionTriageEntry } from "@/lib/types/studentActions";
import type { TriageItem } from "@/lib/types/triage";

const HELP_REASON_LABELS: Record<StudentActionHelpReason, string> = {
  too_fast: "속도가 너무 빨라요",
  stuck: "막혔어요",
  tech: "기기/화면 문제",
};

function resolveStatus(entry: StudentActionTriageEntry): { status: TriageItem["status"]; pinned: boolean } {
  if (entry.status === "approved") return { status: "approved", pinned: false };
  if (entry.status === "pinned") return { status: "approved", pinned: true };
  if (entry.status === "hidden" || entry.status === "rejected") return { status: "hidden", pinned: false };
  return { status: "pending", pinned: false };
}

function resolveText(entry: StudentActionTriageEntry): string {
  if (entry.kind === "question") {
    return entry.text?.trim() || "질문";
  }
  if (entry.kind === "help") {
    const reason = entry.reason ? HELP_REASON_LABELS[entry.reason] : null;
    return reason || entry.text?.trim() || "도움 요청";
  }
  return entry.text?.trim() || "요청";
}

export function triageEntryToItem(entry: StudentActionTriageEntry, boardId: string): TriageItem | null {
  if (entry.kind !== "question" && entry.kind !== "help") return null;
  const { status, pinned } = resolveStatus(entry);

  return {
    id: entry.actionId,
    boardId,
    kind: entry.kind,
    text: resolveText(entry),
    createdAt: new Date(entry.createdAt).toISOString(),
    status,
    pinned,
    meta: { clientRequestId: entry.actionId },
  };
}

export function triageEntriesToItems(entries: StudentActionTriageEntry[], boardId: string): TriageItem[] {
  return entries
    .map((entry) => triageEntryToItem(entry, boardId))
    .filter((item): item is TriageItem => Boolean(item));
}
