import { PUBLIC_FLAGS_REGISTRY } from "@/lib/dashboard/featureFlags";

type FeatureFlagSnapshotRow = {
  key: string;
  meaning: string;
};

export const FEATURE_FLAG_SNAPSHOT: readonly FeatureFlagSnapshotRow[] = PUBLIC_FLAGS_REGISTRY.map((item) => ({
  key: item.flagName,
  meaning: item.snapshotMeaning,
}));
