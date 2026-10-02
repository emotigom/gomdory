import { z } from "zod";

export const configFallbackReasonSchema = z.enum([
  "edge-load-failed",
  "timeout",
  "invalid-payload",
  "unavailable-config",
]);

export type ConfigFallbackReason = z.infer<typeof configFallbackReasonSchema>;
