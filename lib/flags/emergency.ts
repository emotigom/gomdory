import { readEmergencyModeEnabled, readEmergencyReadonlyEnabled } from "@/lib/env/appConfig";

export function isEmergencyMode(): boolean {
  return readEmergencyModeEnabled();
}

export function isReadOnlyMode(): boolean {
  return readEmergencyReadonlyEnabled();
}
