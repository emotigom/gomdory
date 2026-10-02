import { z } from "zod";

import { bootstrapSourceDiagnosticsSchema } from "@/lib/world-hub/bootstrap/sessionMetadata";

export const bootstrapFallbackReasonSchema = z.enum([
  "timeout",
  "invalid-payload",
  "unavailable-bootstrap",
  "worker-request-failed",
  "disabled-worker-mode",
]);

export type BootstrapFallbackReason = z.infer<typeof bootstrapFallbackReasonSchema>;

export const worldHubBootstrapSourceSchema = z.object({
  kind: z.enum(["local-default", "worker-bootstrap"]),
  label: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
  fallbackReason: bootstrapFallbackReasonSchema.nullable().default(null),
  diagnostics: bootstrapSourceDiagnosticsSchema,
});

export type WorldHubBootstrapSource = z.infer<typeof worldHubBootstrapSourceSchema>;

export const missionRoomBootstrapSourceSchema = z.object({
  kind: z.enum(["local-derived", "worker-bootstrap"]),
  label: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
  fallbackReason: bootstrapFallbackReasonSchema.nullable().default(null),
  diagnostics: bootstrapSourceDiagnosticsSchema,
});

export type MissionRoomBootstrapSource = z.infer<typeof missionRoomBootstrapSourceSchema>;
