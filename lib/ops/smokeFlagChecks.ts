import { buildSmokeFlagChecks as buildSmokeFlagChecksRuntime } from "@/lib/ops/smokeFlagChecks.mjs";
import { PUBLIC_FLAGS_REGISTRY } from "@/lib/standards/publicFlagsRegistry.mjs";

type PublicFlagRegistryEntry = {
  flagName: string;
  enabledWhen: string;
  domMarkerOn: string;
  domMarkerOff: string;
  smokePath: string;
  snapshotMeaning: string;
  wave?: number;
};

export type SmokeFlagCheck = Readonly<{
  flagName: string;
  path: string;
  domMarkerOn: string;
  domMarkerOff: string;
}>;

export function buildSmokeFlagChecks(
  registry: readonly PublicFlagRegistryEntry[] = PUBLIC_FLAGS_REGISTRY,
): readonly SmokeFlagCheck[] {
  return buildSmokeFlagChecksRuntime([...registry]) as readonly SmokeFlagCheck[];
}
