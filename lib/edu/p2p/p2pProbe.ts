import { setP2PStatus } from "./p2pState";
import type { PeerSwarm } from "./peerSwarm";

type ProbeResult = "enabled" | "disabled" | "idle";

const PROBE_TIMEOUT_MS = 2500;

export async function runP2PProbe(swarm: PeerSwarm): Promise<ProbeResult> {
  const startedAt = Date.now();
  const hasConnectedPeers = swarm.getConnectedPeers().length > 0;
  if (!hasConnectedPeers) {
    setP2PStatus("idle", startedAt);
    return "idle";
  }

  const ok = await swarm.probe(PROBE_TIMEOUT_MS);
  const status: ProbeResult = ok ? "enabled" : "disabled";
  setP2PStatus(status, startedAt);
  return status;
}
