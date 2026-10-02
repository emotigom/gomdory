import type { PublishFileDebugListing } from "@/lib/edu/publish/commitFileResolution";

export function fileMissingExtra(input: {
  path: string;
  actualPath: string;
  slug: string;
  slugPrefix: string;
  checkedKey: string;
  bucketName: string;
  r2TargetKind: "rest" | "binding";
  endpoint?: string;
  accountId?: string;
  debugListing?: PublishFileDebugListing;
  hasObjectsUnderPrefix?: boolean;
  prefixListingCount?: number;
  prefixSample?: string[];
}): Record<string, unknown> {
  const base = {
    path: input.path,
    actualPath: input.actualPath,
    slug: input.slug,
    checkedKey: input.checkedKey,
    bucketName: input.bucketName,
    r2TargetKind: input.r2TargetKind,
    endpoint: input.endpoint,
    accountId: input.accountId,
    prefix: input.slugPrefix,
    hasObjectsUnderPrefix: Boolean(input.hasObjectsUnderPrefix),
    prefixListingCount: input.prefixListingCount ?? 0,
    prefixSample: input.prefixSample ?? [],
  };

  if (!input.debugListing) {
    return base;
  }

  return {
    ...base,
    topLevelEntries: input.debugListing.topLevelEntries,
    sampleFiles: input.debugListing.sampleFiles,
    detectedRootPaths: input.debugListing.detectedRootPaths,
  };
}
