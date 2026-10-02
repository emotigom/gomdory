import { z } from "zod";

import {
  resolvedClassScheduledLaunchTimingSchema,
  studentScheduledLaunchTimingSchema,
} from "@/lib/world-hub/classroom/scheduledLaunch/contracts";

export const metaverseScheduledLaunchTimingSchema = studentScheduledLaunchTimingSchema.extend({
  source: z.object({
    kind: z.enum(["local-preview", "authoritative-worker"]),
    label: z.string().min(1),
    detail: z.string().min(1).nullable().default(null),
  }),
});

export type MetaverseScheduledLaunchTiming = z.infer<typeof metaverseScheduledLaunchTimingSchema>;

export function createDeterministicLocalScheduledLaunchTiming(): MetaverseScheduledLaunchTiming {
  return metaverseScheduledLaunchTimingSchema.parse({
    state: "fallback_preview",
    title: "Preview launch timing is active",
    detail: "Class schedule data is unavailable, so deterministic preview timing is shown.",
    hint: "You can keep exploring safely while class-timed launch services are connected.",
    countdownLabel: null,
    opensAtIso: null,
    closesAtIso: null,
    source: {
      kind: "local-preview",
      label: "Deterministic local class launch timing",
      detail: "Local fallback schedule timing is active.",
    },
  });
}

export function projectMetaverseScheduledLaunchTiming(
  snapshot: z.infer<typeof resolvedClassScheduledLaunchTimingSchema>,
): MetaverseScheduledLaunchTiming {
  const parsed = resolvedClassScheduledLaunchTimingSchema.parse(snapshot);

  return metaverseScheduledLaunchTimingSchema.parse({
    ...parsed.studentTiming,
    source: {
      kind: parsed.source.kind,
      label: parsed.source.label,
      detail: parsed.source.detail,
    },
  });
}
