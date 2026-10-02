import { getP2PProbeTimeoutMs } from "./config";
import { recordNetworkSaverError, recordP2PProbeResult } from "./metrics";

const DISABLED_TTL_MS = 30 * 60 * 1000;

const disabledKey = (code: string) => `edu:netsaver:p2pDisabled:${code}`;

export const isP2PDisabledCached = (code: string) => {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(disabledKey(code));
    if (!raw) return false;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return false;
    if (Date.now() - parsed > DISABLED_TTL_MS) {
      window.localStorage.removeItem(disabledKey(code));
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const cacheP2PDisabled = (code: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(disabledKey(code), String(Date.now()));
  } catch {
    // ignore storage failures
  }
};

const waitForPong = (channel: RTCDataChannel) =>
  new Promise<boolean>((resolve) => {
    let resolved = false;
    const payload = new Uint8Array(16 * 1024);
    let timeoutId: number | null = null;
    const finish = (ok: boolean) => {
      if (resolved) return;
      resolved = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      channel.removeEventListener("message", onMessage);
      resolve(ok);
    };
    const onMessage = () => finish(true);
    channel.addEventListener("message", onMessage);
    try {
      channel.send(payload);
    } catch {
      finish(false);
      return;
    }
    timeoutId = window.setTimeout(() => finish(false), 500);
  });

export const runP2PProbe = async (code: string, timeoutMs = getP2PProbeTimeoutMs()) => {
  if (typeof window === "undefined") return { ok: false, reason: "no_window" };

  const ws = new WebSocket(`/__edu_p2p/ws?code=${encodeURIComponent(code)}&probe=1`);

  return await new Promise<{ ok: boolean; reason?: string }>((resolve) => {
    let finished = false;
    let timeoutId: number | null = null;
    let peer: RTCPeerConnection | null = null;
    let channel: RTCDataChannel | null = null;

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (channel) {
        channel.close();
      }
      if (peer) {
        peer.close();
      }
    };

    const finish = (ok: boolean, reason?: string) => {
      if (finished) return;
      finished = true;
      cleanup();
      ws.close();
      recordP2PProbeResult(ok ? "pass" : "fail");
      resolve({ ok, reason });
    };

    timeoutId = window.setTimeout(() => finish(false, "timeout"), timeoutMs);

    ws.onopen = async () => {
      ws.send(JSON.stringify({ type: "probe_init" }));
    };

    ws.onmessage = async (event) => {
      let message: { type?: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit } = {};
      try {
        message = JSON.parse(event.data as string);
      } catch {
        return;
      }

      if (message.type === "probe_ready" && !peer) {
        peer = new RTCPeerConnection({ iceServers: [] });
        channel = peer.createDataChannel("probe");

        peer.onicecandidate = (ice) => {
          if (!ice.candidate) return;
          ws.send(JSON.stringify({ type: "probe_candidate", candidate: ice.candidate }));
        };

        channel.onopen = () => {
          const activeChannel = channel;
          if (!activeChannel) return;
          void waitForPong(activeChannel).then((ok) => {
            finish(ok, ok ? undefined : "pong_timeout");
          });
        };

        channel.onerror = () => {
          finish(false, "channel_error");
        };

        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "probe_offer", description: offer }));
        } catch (error) {
          const messageText = error instanceof Error ? error.message : "offer_failed";
          recordNetworkSaverError("P2P_PROBE", messageText);
          finish(false, "offer_failed");
        }
        return;
      }

      if (message.type === "probe_answer" && peer && message.description) {
        try {
          await peer.setRemoteDescription(message.description);
        } catch {
          finish(false, "answer_failed");
        }
        return;
      }

      if (message.type === "probe_candidate" && peer && message.candidate) {
        try {
          await peer.addIceCandidate(message.candidate);
        } catch {
          finish(false, "candidate_failed");
        }
      }
    };

    ws.onerror = () => finish(false, "ws_error");
    ws.onclose = () => {
      if (!finished) finish(false, "ws_closed");
    };
  });
};
