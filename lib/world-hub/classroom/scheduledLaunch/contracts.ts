import { z } from "zod";

import { sessionAuthorityScopeSchema } from "@/lib/world-hub/bootstrap/sessionMetadata";
import { configFallbackReasonSchema } from "@/lib/world-hub/config/sourceContracts";

export const classScheduledLaunchStateSchema = z.enum([
  "open_now",
  "opening_soon",
  "closed_for_now",
  "fallback_preview",
]);

export type ClassScheduledLaunchState = z.infer<typeof classScheduledLaunchStateSchema>;

export const classScheduledLaunchWindowSchema = z.object({
  windowId: z.string().min(1),
  opensAtIso: z.string().datetime(),
  closesAtIso: z.string().datetime(),
  sourceLabel: z.string().min(1),
});

export type ClassScheduledLaunchWindow = z.infer<typeof classScheduledLaunchWindowSchema>;

export const classScheduledLaunchContextSchema = z.object({
  scope: sessionAuthorityScopeSchema,
  classId: z.string().min(1).nullable().default(null),
  worldId: z.string().min(1).nullable().default(null),
  missionId: z.string().min(1).nullable().default(null),
  sessionId: z.string().min(1).nullable().default(null),
});

export type ClassScheduledLaunchContext = z.infer<typeof classScheduledLaunchContextSchema>;

export const studentScheduledLaunchTimingSchema = z.object({
  state: classScheduledLaunchStateSchema,
  title: z.string().min(1),
  detail: z.string().min(1),
  hint: z.string().min(1),
  countdownLabel: z.string().min(1).nullable().default(null),
  opensAtIso: z.string().datetime().nullable().default(null),
  closesAtIso: z.string().datetime().nullable().default(null),
});

export type StudentScheduledLaunchTiming = z.infer<typeof studentScheduledLaunchTimingSchema>;

export const resolvedClassScheduledLaunchTimingSchema = z.object({
  studentTiming: studentScheduledLaunchTimingSchema,
  source: z.object({
    kind: z.enum(["local-preview", "authoritative-worker"]),
    label: z.string().min(1),
    detail: z.string().min(1).nullable().default(null),
    fallbackReason: configFallbackReasonSchema.nullable().default(null),
    diagnostics: z.object({
      adapterKind: z.enum(["local-preview", "worker-orchestrated"]),
      scope: sessionAuthorityScopeSchema,
      hasClassContext: z.boolean(),
      hasMissionContext: z.boolean(),
      matchedWindowId: z.string().min(1).nullable().default(null),
      resolvedAtIso: z.string().datetime(),
    }),
  }),
});

export type ResolvedClassScheduledLaunchTiming = z.infer<typeof resolvedClassScheduledLaunchTimingSchema>;

export type ClassScheduledLaunchTimingPort = {
  resolveTiming(args: { context: ClassScheduledLaunchContext }): Promise<ResolvedClassScheduledLaunchTiming>;
};

export function parseResolvedClassScheduledLaunchTiming(input: unknown): ResolvedClassScheduledLaunchTiming {
  return resolvedClassScheduledLaunchTimingSchema.parse(input);
}
