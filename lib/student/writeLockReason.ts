export type WriteLockReason = "share_locked" | "class_ended" | "turnstile_required";

export type WriteLockCopy = {
  badge: string;
  message: string;
};

export const WRITE_LOCK_COPY: Record<WriteLockReason, WriteLockCopy> = {
  share_locked: {
    badge: "글쓰기 잠김",
    message: "선생님이 글쓰기를 잠궜어요.",
  },
  class_ended: {
    badge: "수업 종료",
    message: "수업이 종료되어 작성할 수 없어요.",
  },
  turnstile_required: {
    badge: "인증 필요",
    message: "인증이 필요해요. 잠시 후 다시 시도해주세요.",
  },
};

export function resolveWriteLockReason(input: {
  shareWriteEnabled: boolean;
  classState: "idle" | "live" | "ended";
}): WriteLockReason | null {
  if (input.classState === "ended") {
    return "class_ended";
  }

  if (!input.shareWriteEnabled) {
    return "share_locked";
  }

  return null;
}
