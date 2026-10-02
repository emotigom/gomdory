export type BoardBlock = {
  id: string;
  type: string;
  text?: string | null;
  data?: Record<string, unknown> | null;
};

export type BoardCard = {
  id: string;
  title?: string | null;
  blocks: BoardBlock[];
  data?: Record<string, unknown> | null;
};

export type BoardSection = {
  id: string;
  title?: string | null;
  cards: BoardCard[];
  data?: Record<string, unknown> | null;
};

export type BoardModel = {
  sections: BoardSection[];
};

export type BoardBlockPayload = BoardBlock;

export type BoardCardPayload = Omit<BoardCard, "blocks"> & {
  blocks?: BoardBlockPayload[] | null;
};

export type ChangeSetOperation =
  | {
      type: "AddBlock";
      cardId: string;
      blockPayload: BoardBlockPayload;
      position?: number;
    }
  | {
      type: "UpdateBlock";
      blockId: string;
      patch: Partial<BoardBlockPayload>;
    }
  | {
      type: "AddCard";
      sectionId: string;
      cardPayload: BoardCardPayload;
      index?: number;
    }
  | {
      type: "UpdateCard";
      cardId: string;
      patch: Partial<BoardCardPayload>;
    };

export type ChangeSet = ChangeSetOperation[];

export type ChangeSetError = {
  opIndex: number;
  code: string;
  message: string;
};

export type ChangeSetResult = {
  model: BoardModel;
  status: "done" | "partial" | "failed";
  appliedOpsCount: number;
  errors: ChangeSetError[];
};

export type ChangeSetValidationResult = {
  ok: boolean;
  errors: ChangeSetError[];
};

export type ChangeSetGuardResult = {
  allowed: ChangeSet;
  allowedIndices: number[];
  errors: ChangeSetError[];
};

const MAX_BLOCK_PAYLOAD_BYTES = 12 * 1024;
const MAX_CARD_PAYLOAD_BYTES = 18 * 1024;
const MAX_BLOCK_TEXT_LENGTH = 800;
const MAX_CARD_TITLE_LENGTH = 120;
const MAX_BLOCK_KEYS = 12;
const MAX_CARD_KEYS = 16;
const FORBIDDEN_KEY_PATTERNS = [/teacher/i, /admin/i, /private/i, /internal/i, /ui/i];
const STUDENT_ALLOWED_CARD_KEYS = new Set(["id", "title", "blocks"]);
const STUDENT_ALLOWED_CARD_PATCH_KEYS = new Set(["title", "blocks"]);
const STUDENT_ALLOWED_BLOCK_KEYS = new Set(["id", "type", "text"]);
const STUDENT_ALLOWED_BLOCK_PATCH_KEYS = new Set(["text"]);

const byteLength = (value: unknown) => {
  const serialized = JSON.stringify(value);
  if (typeof Buffer !== "undefined") {
    return Buffer.byteLength(serialized);
  }
  return new TextEncoder().encode(serialized).length;
};

const hasForbiddenKeys = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, nested] of entries) {
    if (FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      return key;
    }
    const nestedHit = hasForbiddenKeys(nested);
    if (nestedHit) return nestedHit;
  }
  return null;
};

const hasDisallowedKeys = (value: Record<string, unknown>, allowedKeys: Set<string>) =>
  Object.entries(value).some(([key, entry]) => entry !== undefined && !allowedKeys.has(key));

const pushStudentForbiddenError = (errors: ChangeSetError[], opIndex: number, message: string) => {
  errors.push({ opIndex, code: "student_forbidden_field", message });
};

const guardStudentBlockPayload = (payload: BoardBlockPayload, opIndex: number, errors: ChangeSetError[]) => {
  if (hasDisallowedKeys(payload as Record<string, unknown>, STUDENT_ALLOWED_BLOCK_KEYS)) {
    pushStudentForbiddenError(errors, opIndex, "학생 화면에서는 블록 데이터 필드가 허용되지 않습니다.");
    return false;
  }
  return true;
};

const guardStudentBlockPatch = (patch: Partial<BoardBlockPayload>, opIndex: number, errors: ChangeSetError[]) => {
  if (hasDisallowedKeys(patch as Record<string, unknown>, STUDENT_ALLOWED_BLOCK_PATCH_KEYS)) {
    pushStudentForbiddenError(errors, opIndex, "학생 화면에서는 블록 텍스트 변경만 허용됩니다.");
    return false;
  }
  return true;
};

const guardStudentCardPayload = (payload: BoardCardPayload, opIndex: number, errors: ChangeSetError[]) => {
  if (hasDisallowedKeys(payload as Record<string, unknown>, STUDENT_ALLOWED_CARD_KEYS)) {
    pushStudentForbiddenError(errors, opIndex, "학생 화면에서는 카드 데이터 필드가 허용되지 않습니다.");
    return false;
  }
  const blocks = payload.blocks ?? null;
  if (Array.isArray(blocks)) {
    for (const block of blocks) {
      if (!guardStudentBlockPayload(block, opIndex, errors)) {
        return false;
      }
    }
  }
  return true;
};

const guardStudentCardPatch = (patch: Partial<BoardCardPayload>, opIndex: number, errors: ChangeSetError[]) => {
  if (hasDisallowedKeys(patch as Record<string, unknown>, STUDENT_ALLOWED_CARD_PATCH_KEYS)) {
    pushStudentForbiddenError(errors, opIndex, "학생 화면에서는 카드 텍스트 변경만 허용됩니다.");
    return false;
  }
  const blocks = patch.blocks ?? null;
  if (Array.isArray(blocks)) {
    for (const block of blocks) {
      if (!guardStudentBlockPayload(block, opIndex, errors)) {
        return false;
      }
    }
  }
  return true;
};

export function guardStudentChangeSet(changeset: ChangeSet): ChangeSetGuardResult {
  const errors: ChangeSetError[] = [];
  const allowed: ChangeSet = [];
  const allowedIndices: number[] = [];

  changeset.forEach((op, opIndex) => {
    let ok = true;
    switch (op.type) {
      case "AddBlock":
        ok = guardStudentBlockPayload(op.blockPayload, opIndex, errors);
        break;
      case "UpdateBlock":
        ok = guardStudentBlockPatch(op.patch, opIndex, errors);
        break;
      case "AddCard":
        ok = guardStudentCardPayload(op.cardPayload, opIndex, errors);
        break;
      case "UpdateCard":
        ok = guardStudentCardPatch(op.patch, opIndex, errors);
        break;
      default:
        errors.push({ opIndex, code: "student_op_forbidden", message: "학생 화면에서 허용되지 않는 작업입니다." });
        ok = false;
    }

    if (ok) {
      allowed.push(op);
      allowedIndices.push(opIndex);
    }
  });

  return { allowed, allowedIndices, errors };
}

const validateBlockPayload = (payload: BoardBlockPayload): string | null => {
  if (!payload || typeof payload !== "object") return "block_payload_invalid";
  if (!payload.id || typeof payload.id !== "string") return "block_id_required";
  if (!payload.type || typeof payload.type !== "string") return "block_type_required";
  if (payload.text && payload.text.length > MAX_BLOCK_TEXT_LENGTH) return "block_text_too_long";
  if (Object.keys(payload).length > MAX_BLOCK_KEYS) return "block_payload_too_many_fields";
  if (byteLength(payload) > MAX_BLOCK_PAYLOAD_BYTES) return "block_payload_too_large";
  const forbiddenKey = hasForbiddenKeys(payload);
  if (forbiddenKey) return "block_payload_forbidden_key";
  return null;
};

const validateCardPayload = (payload: BoardCardPayload): string | null => {
  if (!payload || typeof payload !== "object") return "card_payload_invalid";
  if (!payload.id || typeof payload.id !== "string") return "card_id_required";
  if (payload.title && payload.title.length > MAX_CARD_TITLE_LENGTH) return "card_title_too_long";
  if (Object.keys(payload).length > MAX_CARD_KEYS) return "card_payload_too_many_fields";
  if (byteLength(payload) > MAX_CARD_PAYLOAD_BYTES) return "card_payload_too_large";
  const forbiddenKey = hasForbiddenKeys(payload);
  if (forbiddenKey) return "card_payload_forbidden_key";
  const blocks = payload.blocks ?? null;
  if (Array.isArray(blocks)) {
    for (const block of blocks) {
      const blockError = validateBlockPayload(block);
      if (blockError) return blockError;
    }
  }
  return null;
};

const collectIds = (model: BoardModel) => {
  const sectionIds = new Set<string>();
  const cardIds = new Set<string>();
  const blockIds = new Set<string>();
  model.sections.forEach((section) => {
    sectionIds.add(section.id);
    section.cards.forEach((card) => {
      cardIds.add(card.id);
      card.blocks.forEach((block) => {
        blockIds.add(block.id);
      });
    });
  });
  return { sectionIds, cardIds, blockIds };
};

const clampIndex = (value: number | undefined, max: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return max;
  return Math.min(Math.max(value, 0), max);
};

export function validateChangeSet(changeset: ChangeSet, boardSnapshot: BoardModel): ChangeSetValidationResult {
  const errors: ChangeSetError[] = [];
  const { sectionIds, cardIds, blockIds } = collectIds(boardSnapshot);

  changeset.forEach((op, opIndex) => {
    switch (op.type) {
      case "AddBlock": {
        if (!cardIds.has(op.cardId)) {
          errors.push({ opIndex, code: "card_not_found", message: "카드를 찾을 수 없습니다." });
        }
        if (blockIds.has(op.blockPayload.id)) {
          errors.push({ opIndex, code: "block_exists", message: "이미 존재하는 블록 ID입니다." });
        }
        const blockError = validateBlockPayload(op.blockPayload);
        if (blockError) {
          errors.push({ opIndex, code: blockError, message: "블록 payload가 유효하지 않습니다." });
        }
        break;
      }
      case "UpdateBlock": {
        if (!blockIds.has(op.blockId)) {
          errors.push({ opIndex, code: "block_not_found", message: "블록을 찾을 수 없습니다." });
        }
        const patchError = validateBlockPayload({
          id: op.blockId,
          type: typeof op.patch.type === "string" ? op.patch.type : "text",
          text: op.patch.text ?? null,
          data: op.patch.data ?? null,
        });
        if (patchError && patchError !== "block_type_required") {
          errors.push({ opIndex, code: patchError, message: "블록 patch가 유효하지 않습니다." });
        }
        break;
      }
      case "AddCard": {
        if (!sectionIds.has(op.sectionId)) {
          errors.push({ opIndex, code: "section_not_found", message: "섹션을 찾을 수 없습니다." });
        }
        if (cardIds.has(op.cardPayload.id)) {
          errors.push({ opIndex, code: "card_exists", message: "이미 존재하는 카드 ID입니다." });
        }
        const cardError = validateCardPayload(op.cardPayload);
        if (cardError) {
          errors.push({ opIndex, code: cardError, message: "카드 payload가 유효하지 않습니다." });
        }
        break;
      }
      case "UpdateCard": {
        if (!cardIds.has(op.cardId)) {
          errors.push({ opIndex, code: "card_not_found", message: "카드를 찾을 수 없습니다." });
        }
        const patchError = validateCardPayload({
          id: op.cardId,
          title: op.patch.title ?? null,
          data: op.patch.data ?? null,
          blocks: op.patch.blocks ?? null,
        });
        if (patchError && patchError !== "card_id_required") {
          errors.push({ opIndex, code: patchError, message: "카드 patch가 유효하지 않습니다." });
        }
        break;
      }
      default:
        errors.push({ opIndex, code: "unknown_op", message: "지원하지 않는 작업입니다." });
    }
  });

  return { ok: errors.length === 0, errors };
}

const locateCard = (model: BoardModel, cardId: string) => {
  for (let sectionIndex = 0; sectionIndex < model.sections.length; sectionIndex += 1) {
    const cardIndex = model.sections[sectionIndex]?.cards.findIndex((card) => card.id === cardId) ?? -1;
    if (cardIndex >= 0) {
      return { sectionIndex, cardIndex };
    }
  }
  return null;
};

const locateBlock = (model: BoardModel, blockId: string) => {
  for (let sectionIndex = 0; sectionIndex < model.sections.length; sectionIndex += 1) {
    const cards = model.sections[sectionIndex]?.cards ?? [];
    for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
      const blockIndex = cards[cardIndex]?.blocks.findIndex((block) => block.id === blockId) ?? -1;
      if (blockIndex >= 0) {
        return { sectionIndex, cardIndex, blockIndex };
      }
    }
  }
  return null;
};

const buildStatus = (appliedOpsCount: number, totalOps: number) => {
  if (appliedOpsCount === 0) return "failed";
  if (appliedOpsCount === totalOps) return "done";
  return "partial";
};

export function applyChangeSet(boardModel: BoardModel, changeset: ChangeSet): ChangeSetResult {
  let current = boardModel;
  const errors: ChangeSetError[] = [];
  let appliedOpsCount = 0;

  changeset.forEach((op, opIndex) => {
    switch (op.type) {
      case "AddCard": {
        const sectionIndex = current.sections.findIndex((section) => section.id === op.sectionId);
        if (sectionIndex < 0) {
          errors.push({ opIndex, code: "section_not_found", message: "섹션을 찾을 수 없습니다." });
          return;
        }
        const section = current.sections[sectionIndex];
        const insertIndex = clampIndex(op.index, section.cards.length);
        const nextCard: BoardCard = {
          id: op.cardPayload.id,
          title: op.cardPayload.title ?? null,
          data: op.cardPayload.data ?? null,
          blocks: (op.cardPayload.blocks ?? []).map((block) => ({ ...block })),
        };
        const nextCards = [...section.cards];
        nextCards.splice(insertIndex, 0, nextCard);
        const nextSections = [...current.sections];
        nextSections[sectionIndex] = { ...section, cards: nextCards };
        current = { ...current, sections: nextSections };
        appliedOpsCount += 1;
        return;
      }
      case "UpdateCard": {
        const location = locateCard(current, op.cardId);
        if (!location) {
          errors.push({ opIndex, code: "card_not_found", message: "카드를 찾을 수 없습니다." });
          return;
        }
        const section = current.sections[location.sectionIndex];
        const card = section.cards[location.cardIndex];
        const nextBlocks = op.patch.blocks
          ? op.patch.blocks.map((block) => ({ ...block }))
          : card.blocks;
        const nextCard = {
          ...card,
          ...op.patch,
          blocks: nextBlocks,
        } satisfies BoardCard;
        const nextCards = [...section.cards];
        nextCards[location.cardIndex] = nextCard;
        const nextSections = [...current.sections];
        nextSections[location.sectionIndex] = { ...section, cards: nextCards };
        current = { ...current, sections: nextSections };
        appliedOpsCount += 1;
        return;
      }
      case "AddBlock": {
        const location = locateCard(current, op.cardId);
        if (!location) {
          errors.push({ opIndex, code: "card_not_found", message: "카드를 찾을 수 없습니다." });
          return;
        }
        const section = current.sections[location.sectionIndex];
        const card = section.cards[location.cardIndex];
        const insertIndex = clampIndex(op.position, card.blocks.length);
        const nextBlocks = [...card.blocks];
        nextBlocks.splice(insertIndex, 0, { ...op.blockPayload });
        const nextCard = { ...card, blocks: nextBlocks };
        const nextCards = [...section.cards];
        nextCards[location.cardIndex] = nextCard;
        const nextSections = [...current.sections];
        nextSections[location.sectionIndex] = { ...section, cards: nextCards };
        current = { ...current, sections: nextSections };
        appliedOpsCount += 1;
        return;
      }
      case "UpdateBlock": {
        const location = locateBlock(current, op.blockId);
        if (!location) {
          errors.push({ opIndex, code: "block_not_found", message: "블록을 찾을 수 없습니다." });
          return;
        }
        const section = current.sections[location.sectionIndex];
        const card = section.cards[location.cardIndex];
        const block = card.blocks[location.blockIndex];
        const nextBlock = { ...block, ...op.patch, id: block.id };
        const nextBlocks = [...card.blocks];
        nextBlocks[location.blockIndex] = nextBlock;
        const nextCard = { ...card, blocks: nextBlocks };
        const nextCards = [...section.cards];
        nextCards[location.cardIndex] = nextCard;
        const nextSections = [...current.sections];
        nextSections[location.sectionIndex] = { ...section, cards: nextCards };
        current = { ...current, sections: nextSections };
        appliedOpsCount += 1;
        return;
      }
      default:
        errors.push({ opIndex, code: "unknown_op", message: "지원하지 않는 작업입니다." });
    }
  });

  return {
    model: current,
    status: buildStatus(appliedOpsCount, changeset.length),
    appliedOpsCount,
    errors,
  };
}

export function applyStudentChangeSet(boardModel: BoardModel, changeset: ChangeSet): ChangeSetResult {
  const guard = guardStudentChangeSet(changeset);
  if (guard.allowed.length === 0) {
    return {
      model: boardModel,
      status: "failed",
      appliedOpsCount: 0,
      errors: guard.errors,
    };
  }

  const applied = applyChangeSet(boardModel, guard.allowed);
  const mappedErrors = applied.errors.map((error) => ({
    ...error,
    opIndex: guard.allowedIndices[error.opIndex] ?? error.opIndex,
  }));
  const appliedOpsCount = applied.appliedOpsCount;
  const status: ChangeSetResult["status"] =
    appliedOpsCount === 0 ? "failed" : appliedOpsCount === changeset.length ? "done" : "partial";

  return {
    model: applied.model,
    status,
    appliedOpsCount,
    errors: [...guard.errors, ...mappedErrors],
  };
}
