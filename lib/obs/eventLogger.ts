import type { OpsEventInput, OpsEventKind, OpsEventLevel } from "@/lib/ops/recordEvent";
import { recordOpsEvent } from "@/lib/ops/recordEvent";

export type { OpsEventKind, OpsEventLevel };

export type OpsEventPayload = OpsEventInput;

export async function logOpsEvent(payload: OpsEventPayload) {
  await recordOpsEvent(payload);
}
