import { z } from "zod";

import {
  resolvedTeacherLiveSessionSnapshotSchema,
  studentLiveSessionGuidanceSchema,
} from "@/lib/world-hub/classroom/liveSession/contracts";
import {
  createDeterministicLocalScheduledLaunchTiming,
  metaverseScheduledLaunchTimingSchema,
  projectMetaverseScheduledLaunchTiming,
} from "@/lib/world-hub/classroom/scheduledLaunch/projection";

export const metaverseLiveSessionGuidanceSchema = studentLiveSessionGuidanceSchema.extend({
  launchTiming: metaverseScheduledLaunchTimingSchema,
  source: z.object({
    kind: z.enum(["local-preview", "authoritative-worker"]),
    label: z.string().min(1),
    detail: z.string().min(1).nullable().default(null),
  }),
});

export type MetaverseLiveSessionGuidance = z.infer<typeof metaverseLiveSessionGuidanceSchema>;

export function createDeterministicLocalLiveSessionGuidance(): MetaverseLiveSessionGuidance {
  return metaverseLiveSessionGuidanceSchema.parse({
    status: "self-paced-open",
    missionStart: "self-serve",
    cueState: "none",
    title: "You can start when ready",
    detail: "Basecamp is open for self-paced exploration and optional mission launch.",
    hint: "Walk to a glowing trail and press Enter when your team is ready.",
    guidanceVariant: "trail",
    launchTiming: createDeterministicLocalScheduledLaunchTiming(),
    source: {
      kind: "local-preview",
      label: "Deterministic local teacher session controls",
      detail: "Local fallback guidance is active.",
    },
  });
}

export function projectMetaverseLiveSessionGuidance(
  snapshot: z.infer<typeof resolvedTeacherLiveSessionSnapshotSchema>,
): MetaverseLiveSessionGuidance {
  const parsed = resolvedTeacherLiveSessionSnapshotSchema.parse(snapshot);

  return metaverseLiveSessionGuidanceSchema.parse({
    ...parsed.studentGuidance,
    launchTiming: projectMetaverseScheduledLaunchTiming(parsed.scheduledLaunch),
    source: {
      kind: parsed.source.kind,
      label: parsed.source.label,
      detail: parsed.source.detail,
    },
  });
}
