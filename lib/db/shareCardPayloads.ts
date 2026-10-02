import "server-only";

import { toSnakeKeys } from "@/lib/standards/fields";

export function buildStudentCardSoftDeletePayload(nowIso: string): Record<string, unknown> {
  return toSnakeKeys({
    deletedAt: nowIso,
    isHidden: true,
    hiddenAt: nowIso,
    deleteReason: "student_deleted",
  });
}

export function buildShareCardPatchPayload(text: string, externalAttachments: unknown[] | null): Record<string, unknown> {
  return toSnakeKeys({ text, externalAttachments });
}

export function buildShareCardMovePayload(wallId: string, updatedAt: string): Record<string, unknown> {
  return toSnakeKeys({ wallId, updatedAt });
}
