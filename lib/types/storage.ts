export type StorageUsageSnapshot = {
  usedBytes: number;
  savedBytes: number;
  updatedAt: string | null;
};

export type StoragePlanLimits = {
  freeLimitBytes: number;
  proLimitBytes: number;
};
