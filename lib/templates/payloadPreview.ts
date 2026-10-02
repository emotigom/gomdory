import type { SanitizedTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";
import type { TemplatePayload, TemplateCard, TemplateCardAttachment } from "@/lib/templates/sanitize";

const PREVIEW_CARD_LIMIT = 10;
const PREVIEW_TEXT = "미리보기 카드";
const PREVIEW_ATTACHMENT_LABEL = "첨부 자료 미리보기";

type TemplatePayloadLike = SanitizedTemplatePayload | TemplatePayload;

function maskTemplateCard(card: TemplateCard): TemplateCard {
  if (card.type === "text") {
    return { ...card, text: PREVIEW_TEXT };
  }

  const attachments: TemplateCardAttachment[] = Array.isArray(card.attachments) && card.attachments.length > 0
    ? card.attachments.map((attachment) => ({ ...attachment, refId: null }))
    : [{ kind: "file_ref", refId: null }];

  return {
    ...card,
    text: PREVIEW_ATTACHMENT_LABEL,
    attachments,
  };
}

function buildV1Preview(payload: TemplatePayload): TemplatePayload {
  const cards = payload.board.cards.slice(0, PREVIEW_CARD_LIMIT).map(maskTemplateCard);
  return {
    ...payload,
    board: {
      ...payload.board,
      cards,
    },
  };
}

function buildSanitizedPreview(payload: SanitizedTemplatePayload): SanitizedTemplatePayload {
  const cards = payload.cards.slice(0, PREVIEW_CARD_LIMIT).map((card) => {
    if (card.kind === "text") {
      return { ...card, text: PREVIEW_TEXT };
    }
    return {
      ...card,
      attachment: {
        ...card.attachment,
        filename: PREVIEW_ATTACHMENT_LABEL,
        downloadPath: null,
        byteSize: null,
        contentType: card.attachment.contentType ?? null,
      },
    };
  });

  return {
    ...payload,
    cards,
  };
}

export function buildPayloadPreview(payload: TemplatePayloadLike): TemplatePayloadLike {
  if ((payload as TemplatePayload).kind === "board_template") {
    return buildV1Preview(payload as TemplatePayload);
  }
  return buildSanitizedPreview(payload as SanitizedTemplatePayload);
}
