export type MoveBoundaryInput = {
  requestedBoardId: string;
  cardBoardId: string | null;
  targetWallBoardId: string | null;
};

export function isValidCardMoveBoundary(input: MoveBoundaryInput): boolean {
  if (!input.requestedBoardId) {
    return false;
  }

  if (!input.cardBoardId || !input.targetWallBoardId) {
    return false;
  }

  return input.cardBoardId === input.requestedBoardId
    && input.targetWallBoardId === input.requestedBoardId;
}

