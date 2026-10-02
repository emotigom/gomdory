import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { FollowState, FollowStateUpdateInput } from "./followState";
import { normalizeFollowStateInput } from "./followState";

const PRESENT_STATE_PATH = "https://present-state/__present/state";

export async function savePresentFollowState(input: FollowStateUpdateInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeFollowStateInput(input);
  if (!normalized) {
    return { ok: false, error: "invalid_payload" };
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const id = env.REALTIME_ROOM.idFromName(normalized.boardId);
    const stub = env.REALTIME_ROOM.get(id);
    const response = await stub.fetch(PRESENT_STATE_PATH, {
      method: "POST",
      body: JSON.stringify({
        boardId: normalized.boardId,
        wallId: normalized.wallId,
        focusedCardId: normalized.focusedCardId,
        mode: normalized.mode,
        updatedBy: normalized.updatedBy,
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `do_error_${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed_to_save_present_state";
    return { ok: false, error: message };
  }
}

export async function fetchPresentFollowState(boardId: string): Promise<{ ok: true; state: FollowState | null } | { ok: false; error: string }> {
  if (!boardId) {
    return { ok: false, error: "missing_board" };
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const id = env.REALTIME_ROOM.idFromName(boardId);
    const stub = env.REALTIME_ROOM.get(id);
    const response = await stub.fetch(`${PRESENT_STATE_PATH}?boardId=${encodeURIComponent(boardId)}`, {
      method: "GET",
    });

    if (!response.ok) {
      return { ok: false, error: `do_error_${response.status}` };
    }

    const data = (await response.json()) as { ok?: boolean; state?: FollowState | null };
    if (!data || data.ok === false) {
      return { ok: false, error: "invalid_response" };
    }

    return { ok: true, state: data.state ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed_to_fetch_present_state";
    return { ok: false, error: message };
  }
}
