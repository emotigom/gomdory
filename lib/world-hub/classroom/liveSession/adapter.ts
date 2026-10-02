import {
  resolvedTeacherLiveSessionSnapshotSchema,
  type TeacherLiveSessionControlContext,
  type TeacherLiveSessionControlPort,
} from "@/lib/world-hub/classroom/liveSession/contracts";
import {
  createLocalPreviewClassScheduledLaunchAdapter,
} from "@/lib/world-hub/classroom/scheduledLaunch/adapter";
import type { ClassScheduledLaunchTimingPort } from "@/lib/world-hub/classroom/scheduledLaunch/contracts";

function nowIso(now: Date) {
  return now.toISOString();
}

function resolveLocalPreviewState(context: TeacherLiveSessionControlContext) {
  const hasClassContext = Boolean(context.classId);
  const hasMissionContext = Boolean(context.missionId);

  if (hasMissionContext) {
    return {
      phase: "mission-transition" as const,
      missionStartPolicy: "teacher-cued" as const,
      guidanceLevel: "focused" as const,
      guidanceVariant: "launchpad" as const,
    };
  }

  if (hasClassContext) {
    return {
      phase: "guided-briefing" as const,
      missionStartPolicy: "teacher-cued" as const,
      guidanceLevel: "focused" as const,
      guidanceVariant: "campfire" as const,
    };
  }

  return {
    phase: "open-exploration" as const,
    missionStartPolicy: "open" as const,
    guidanceLevel: "ambient" as const,
    guidanceVariant: "trail" as const,
  };
}

function projectStudentGuidance(state: ReturnType<typeof resolveLocalPreviewState>) {
  if (state.phase === "mission-transition") {
    return {
      status: "mission-starting-soon" as const,
      missionStart: "teacher-cued" as const,
      cueState: "start_mission" as const,
      title: "Mission start is being staged",
      detail: "Stay with your group while your teacher cues the next launch window.",
      hint: "Use this moment to review your objective and keep your team together.",
      guidanceVariant: state.guidanceVariant,
    };
  }

  if (state.phase === "guided-briefing") {
    return {
      status: "teacher-guided" as const,
      missionStart: "teacher-cued" as const,
      cueState: "gather_at_plaza" as const,
      title: "Teacher-guided session is active",
      detail: "Explore the basecamp while waiting for the shared mission start cue.",
      hint: "Follow teacher prompts from the academy post and suggested trails.",
      guidanceVariant: state.guidanceVariant,
    };
  }

  return {
    status: "self-paced-open" as const,
    missionStart: "self-serve" as const,
    cueState: "none" as const,
    title: "You can start when ready",
    detail: "Basecamp is open for self-paced exploration and optional mission launch.",
    hint: "Walk to a glowing trail and press Enter when your team is ready.",
    guidanceVariant: state.guidanceVariant,
  };
}

export function createLocalPreviewTeacherLiveSessionControlAdapter(args?: {
  now?: () => Date;
  scheduledLaunchTiming?: ClassScheduledLaunchTimingPort;
}): TeacherLiveSessionControlPort {
  const now = args?.now ?? (() => new Date());
  const scheduledLaunchTiming =
    args?.scheduledLaunchTiming ??
    createLocalPreviewClassScheduledLaunchAdapter({
      now,
    });

  return {
    async resolveSnapshot({ context }) {
      const state = resolveLocalPreviewState(context);
      const studentGuidance = projectStudentGuidance(state);
      const resolvedAt = now();
      const scheduledLaunch = await scheduledLaunchTiming.resolveTiming({ context });

      return resolvedTeacherLiveSessionSnapshotSchema.parse({
        state,
        studentGuidance,
        scheduledLaunch,
        source: {
          kind: "local-preview",
          label: "Deterministic local teacher session controls",
          detail: "Using local classroom preview heuristics until worker orchestration is configured.",
          fallbackReason: null,
          diagnostics: {
            adapterKind: "local-preview",
            scope: context.scope,
            hasClassContext: Boolean(context.classId),
            hasMissionContext: Boolean(context.missionId),
            resolvedAtIso: nowIso(resolvedAt),
          },
        },
      });
    },
  };
}
