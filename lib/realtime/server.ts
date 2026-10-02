import { getCloudflareContext } from "@opennextjs/cloudflare";
import { RealtimeEvent, encodeRealtimeEvent } from "./events";

function roomKey(boardId: string, shareCode?: string | null) {
  return shareCode ? `${shareCode}:${boardId}` : boardId;
}

export async function broadcastRealtimeEvent(params: {
  boardId: string;
  shareCode?: string | null;
  event: RealtimeEvent;
}) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const key = roomKey(params.boardId, params.shareCode);
    const id = env.REALTIME_ROOM.idFromName(key);
    const stub = env.REALTIME_ROOM.get(id);
    await stub.fetch("https://realtime.broadcast", {
      method: "POST",
      body: JSON.stringify({ roomKey: key, event: encodeRealtimeEvent(params.event) }),
    });
  } catch (error) {
    console.warn("Realtime broadcast failed", error);
  }
}
