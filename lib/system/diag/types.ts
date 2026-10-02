export type SystemDiagResponse =
  | { ok: false; code: string; message?: string; requestId?: string }
  | {
      ok: true;
      now: string;
      host: string | null;
      envName: string;
      buildId: string | null;
      versionId: string | null;
      requestId?: string;
      requiredForSmoke: string[];
      requiredForProd: string[];
      requiredSmokeAuthKeys: string[];
      requiredPostDeployKeys: string[];
      requiredWebllmKeys: string[];
      missingForSmoke: string[];
      missingForProd: string[];
      missingWebllmKeys: string[];
      emptyWebllmKeys: string[];
      webllmEnv: Record<
        string,
        { exists: boolean; nonEmpty: boolean; sourceHint: "cloudflareEnv" | "processEnv" | "missing" }
      >;
      webllmResolved?: {
        source: "runtime" | "build" | "unset";
        hardDisable: boolean;
        hardDisableRaw: string | null;
        modelBase: string;
        libBase: string;
        coachModelId: string | null;
        coachWasmUrl: string | null;
      };
      featureFlags: {
        emergencyMode: boolean;
        emergencyReadOnly: boolean;
        webllmEnabled: boolean;
      };
      global: {
        webllmEnable: boolean;
        webllmLabs: boolean;
        netsaverDefaultMode: "off" | "leaseOnly" | "auto" | "forceP2p" | "p2p";
        webllmPilotAllowlistCount: number;
      };
      perUserFlags?: {
        webllmEnabled: boolean;
        netsaverEnabled: boolean;
        netsaverMode: "leaseOnly" | "auto";
        netsaverP2pTier: "meta" | "smallShards" | "wasm";
        maxBytes: number;
        reason: string;
      };
      effective: {
        webllmFeatureEnabled: boolean;
        webllmDownloadAllowed: boolean;
        webllm: boolean;
        netsaver: boolean;
        netsaverMode: "off" | "leaseOnly" | "auto" | "forceP2p" | "p2p";
        netsaverTier: "meta" | "smallShards" | "wasm";
        gatingMode: "userOnly" | "pilotAllowlist" | "disabled";
        reasons: string[];
        reason: string[];
      };
      checks: {
        env: {
          hasSupabaseUrl: boolean;
          hasSupabaseAnonKey: boolean;
          hasSupabaseServiceRoleKey: boolean;
          hasR2AccessKeyId: boolean;
          hasR2SecretAccessKey: boolean;
          hasR2Bucket: boolean;
          hasTurnstileSecretKey: boolean;
          hasE2ETurnstileSecretKey: boolean;
          turnstileBypassConfigured: boolean;
          hasImagesBinding: boolean;
          hasAssetsBinding: boolean;
          hasRealtimeRoomBinding: boolean;
        };
        auth: { ok: boolean };
        supabase: { ok: boolean; latencyMs: number | null };
        r2: { configured: boolean; ok: boolean; latencyMs: number | null };
        durableObject: { configured: boolean; ok: boolean; latencyMs: number | null };
        decorateReadiness: {
          hasOpenAiKey: boolean;
          hasSupabaseUrl: boolean;
          hasSupabaseAnonKey: boolean;
          hasSupabaseServiceRoleKey: boolean;
          hasRateLimitTableAccess: boolean;
          hasDecoratePlanCacheAccess: boolean;
          hasJoinSessionAccess: boolean;
        };
      };
      eduPublish: {
        r2Target:
          | { configured: false }
          | {
              configured: true;
              r2TargetKind: "rest";
              bucketName: string;
              endpoint: string;
              accountId: string;
            };
        limiter: {
          mode: "success-based";
          dailyLimit: number;
          countsOnly: readonly ["PUBLISHED"];
          excludes: readonly ["PREPARED", "PUBLISHING", "FAILED"];
          timezone: "Asia/Seoul";
          window: "day";
          policySummary: string;
        };
      };
    };

export type SystemDiagSuccess = Extract<SystemDiagResponse, { ok: true }>;
