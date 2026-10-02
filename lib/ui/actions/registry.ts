import { logActionUsage, type ActionUsageSource } from "@/lib/ui/actions/telemetry";

export type ActionSurface = "palette" | "context";

export type ActionCapability =
  | "authenticated"
  | "teacher"
  | "student"
  | "dashboard"
  | "teacherBoard"
  | "studentBoard"
  | "share"
  | "canSoftDelete"
  | "showAdvancedActions";

export type AppAction<TContext> = {
  id: string;
  label: string;
  keywords?: string[];
  description?: string;
  group: string;
  dangerous?: boolean;
  advanced?: boolean;
  requires?: ActionCapability[];
  surfaces: ActionSurface[];
  when: (context: TContext) => boolean;
  run: (context: TContext) => void;
};

export type ActionResolveOptions = {
  showAdvancedActions: boolean;
  capabilities: Set<ActionCapability>;
};

export type CapabilitySetScope = "Dashboard" | "TeacherBoard" | "StudentBoard" | "Share";

const BASE_CAPABILITY_SETS: Record<CapabilitySetScope, ActionCapability[]> = {
  Dashboard: ["authenticated", "dashboard", "canSoftDelete"],
  TeacherBoard: ["authenticated", "teacher", "teacherBoard", "canSoftDelete"],
  StudentBoard: ["student", "studentBoard", "share"],
  Share: ["share"],
};

export function getCapabilitySet(scope: CapabilitySetScope, options?: { showAdvancedActions?: boolean }): Set<ActionCapability> {
  const capabilities = new Set<ActionCapability>(BASE_CAPABILITY_SETS[scope]);
  if (options?.showAdvancedActions) {
    capabilities.add("showAdvancedActions");
  }
  return capabilities;
}

export type ResolvedAction<TContext> = AppAction<TContext> & {
  enabled: boolean;
};

export function resolveActions<TContext>(
  actions: AppAction<TContext>[],
  context: TContext,
  surface: ActionSurface,
  options: ActionResolveOptions,
): ResolvedAction<TContext>[] {
  return actions
    .filter((action) => action.surfaces.includes(surface))
    .filter((action) => (options.showAdvancedActions ? true : !action.advanced))
    .filter((action) => (action.requires ?? []).every((capability) => options.capabilities.has(capability)))
    .map((action) => ({
      ...action,
      enabled: action.when(context),
    }));
}

export function assertUniqueActionIdsAndLabels<TContext>(actions: AppAction<TContext>[]): void {
  const idSet = new Set<string>();
  const labelSet = new Set<string>();
  for (const action of actions) {
    if (idSet.has(action.id)) {
      throw new Error(`Duplicate action id: ${action.id}`);
    }
    idSet.add(action.id);
    const normalizedLabel = action.label.trim().toLowerCase();
    if (labelSet.has(normalizedLabel)) {
      throw new Error(`Duplicate action label: ${action.label}`);
    }
    labelSet.add(normalizedLabel);
  }
}

export function runActionWithTelemetry<TContext>(options: {
  action: Pick<AppAction<TContext>, "id" | "advanced" | "dangerous" | "run">;
  context: TContext;
  surface: ActionSurface;
  source: ActionUsageSource;
  requestId?: string;
}): void {
  logActionUsage({
    actionId: options.action.id,
    surface: options.surface,
    source: options.source,
    isAdvanced: options.action.advanced ?? false,
    isDangerous: options.action.dangerous ?? false,
    requestId: options.requestId,
  });
  options.action.run(options.context);
}
