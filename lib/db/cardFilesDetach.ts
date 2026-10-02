import "server-only";

export const CARD_FILES_TABLE = "card_files";
export const CARD_FILES_CARD_ID_COLUMN = "card_id";
export const CARD_FILES_BOARD_FILE_ID_COLUMN = "board_file_id";

export const buildCardFilesDetachMatch = (cardId: string, boardFileId: string): Record<string, string> => {
  const match: Record<string, string> = {};
  match[CARD_FILES_CARD_ID_COLUMN] = cardId;
  match[CARD_FILES_BOARD_FILE_ID_COLUMN] = boardFileId;
  return match;
};

type DetachCardFileAssociationOptions = {
  supabaseAdmin: {
    from: (table: string) => {
      delete: () => {
        match: (values: Record<string, string>) => PromiseLike<{ error: unknown }>;
      };
    };
  };
  cardId: string;
  boardFileId: string;
};

export class DetachCardFileAssociationError extends Error {
  constructor(message = "detach_failed") {
    super(message);
    this.name = "DetachCardFileAssociationError";
  }
}

export async function detachCardFileAssociation({
  supabaseAdmin,
  cardId,
  boardFileId,
}: DetachCardFileAssociationOptions): Promise<{ ok: true }> {
  const { error } = await supabaseAdmin
    .from(CARD_FILES_TABLE)
    .delete()
    .match(buildCardFilesDetachMatch(cardId, boardFileId));

  if (error) {
    throw new DetachCardFileAssociationError();
  }

  return { ok: true };
}
