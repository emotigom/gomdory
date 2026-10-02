export const composerFeedbackMessages = Object.freeze({
  creating: "카드를 작성하는 중입니다.",
  uploading: "첨부 파일을 업로드하는 중입니다.",
  success: "카드가 추가되었습니다.",
  fileSuccess: "파일 카드가 추가되었습니다.",
  partial: "본문 카드는 유지했어요. 일부 파일을 첨부하지 못했습니다.",
  retryable: "카드 작성에 실패했습니다. 내용을 확인한 뒤 다시 시도해 주세요.",
  terminal: "첨부 업로드에 실패해 카드를 실패 상태로 남겼습니다. 카드를 삭제한 뒤 다시 시도해 주세요.",
});

export function composerFeedbackSemantics(kind) {
  if (kind === "pending" || kind === "success" || kind === "partial-success") {
    return { role: "status", live: "polite" };
  }
  if (kind === "retryable-error" || kind === "terminal-error") {
    return { role: "alert", live: "assertive" };
  }
  return null;
}

export function makeComposerFeedback(kind, operation, message) {
  return { kind, eventKey: `student-compose:${operation}:${kind}`, message };
}

export function isTerminalComposerSuccess(input) {
  return Boolean(input.cardId) && (!input.hasFiles || input.finalizedAttachments === input.selectedAttachments);
}
