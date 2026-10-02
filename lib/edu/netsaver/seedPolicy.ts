import type { NetworkSaverMode } from "./config";

const RECEIVE_WINDOW_MS = 60 * 1000;
const DISCONNECT_WINDOW_MS = 2 * 60 * 1000;
const MAX_RECENT_DISCONNECTS = 1;
const LOW_BATTERY_THRESHOLD = 0.2;

let lastSeedableReceiveAt: number | null = null;
type BatteryManagerLike = {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
};

let batteryState: { supported: boolean; saving: boolean; low: boolean } = {
  supported: false,
  saving: false,
  low: false,
};

const updateBatteryState = (battery: BatteryManagerLike) => {
  const savingRaw = (battery as BatteryManagerLike & { saving?: boolean; savingMode?: boolean })
    .saving ??
    (battery as BatteryManagerLike & { savingMode?: boolean }).savingMode ??
    false;
  const low = battery.level <= LOW_BATTERY_THRESHOLD && !battery.charging;
  batteryState = { supported: true, saving: Boolean(savingRaw), low };
};

export const initSeedPolicy = () => {
  if (typeof navigator === "undefined") return;
  const getBattery = (
    navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> }
  ).getBattery;
  if (!getBattery) return;
  getBattery()
    .then((battery) => {
      updateBatteryState(battery);
      battery.addEventListener("levelchange", () => updateBatteryState(battery));
      battery.addEventListener("chargingchange", () => updateBatteryState(battery));
    })
    .catch(() => {
      batteryState = { supported: false, saving: false, low: false };
    });
};

export const recordSeedableReceive = (kind: "wasm" | "meta") => {
  if (kind !== "wasm" && kind !== "meta") return;
  lastSeedableReceiveAt = Date.now();
};

const isRecentReceive = (now: number) =>
  lastSeedableReceiveAt !== null && now - lastSeedableReceiveAt <= RECEIVE_WINDOW_MS;

const isSlowConnection = () => {
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } })
    .connection;
  const effectiveType = connection?.effectiveType;
  return effectiveType === "2g" || effectiveType === "slow-2g";
};

export type SeedEligibilityInput = {
  mode: NetworkSaverMode;
  p2pProbeStatus: "idle" | "pass" | "fail";
  isTeacher: boolean;
  disconnectTimestamps: number[];
  now?: number;
};

export type SeedEligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

export const evaluateSeedEligibility = (input: SeedEligibilityInput): SeedEligibilityResult => {
  const now = input.now ?? Date.now();
  const reasons: string[] = [];

  if (input.isTeacher) {
    reasons.push("teacher_role");
  }
  if (input.mode !== "auto") {
    reasons.push("mode_not_auto");
  }
  if (input.p2pProbeStatus !== "pass") {
    reasons.push("p2p_probe_not_pass");
  }
  if (!isRecentReceive(now)) {
    reasons.push("no_recent_receive");
  }

  const recentDisconnects = input.disconnectTimestamps.filter(
    (timestamp) => now - timestamp <= DISCONNECT_WINDOW_MS,
  ).length;
  if (recentDisconnects > MAX_RECENT_DISCONNECTS) {
    reasons.push("disconnect_unstable");
  }

  if (typeof navigator !== "undefined" && isSlowConnection()) {
    reasons.push("slow_connection");
  }

  if (batteryState.supported && (batteryState.saving || batteryState.low)) {
    reasons.push(batteryState.saving ? "battery_saving" : "battery_low");
  }

  return { eligible: reasons.length === 0, reasons };
};

export const summarizeDisconnects = (timestamps: number[]) => {
  const now = Date.now();
  return timestamps.filter((timestamp) => now - timestamp <= DISCONNECT_WINDOW_MS).length;
};
