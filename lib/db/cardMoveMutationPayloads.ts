import { toSnakeKeys } from "@/lib/standards/fields";

export const cardMoveMutationSelect = [
  "id",
  "scope",
  "actorId:actor_id",
  "boardId:board_id",
  "cardId:card_id",
  "targetWallId:target_wall_id",
  "clientMutationId:client_mutation_id",
].join(", ");

export function buildCardMoveMutationInsertPayload(input: {
  scope: "dashboard" | "share";
  actorId: string;
  boardId: string;
  cardId: string;
  targetWallId: string;
  clientMutationId: string;
}): Record<string, unknown> {
  return toSnakeKeys(input);
}
