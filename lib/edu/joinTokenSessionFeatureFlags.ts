export const buildJoinTokenSessionFeatureFlags = (input: {
  globalEnabled: boolean;
  downloadAllowed: boolean;
}) => {
  const reasons: string[] = [];
  if (!input.globalEnabled) reasons.push("global_disabled");
  if (!input.downloadAllowed) reasons.push("sample_lesson_init_blocked");
  reasons.push("join_token_session");

  const webllmEnabled = input.globalEnabled && input.downloadAllowed;

  return {
    userFlagsPresent: false,
    webllmFeatureEnabled: input.globalEnabled,
    webllmDownloadAllowed: input.downloadAllowed,
    webllmEnabled,
    netsaverEnabled: false,
    netsaverMode: "lease_only" as const,
    netsaverP2pTier: "meta" as const,
    maxBytes: 10 * 1024 * 1024,
    reason: reasons[0] ?? "join_token_session",
    reasons,
    gatingMode: "join_token" as const,
    allowlistDecision: "not_applicable" as const,
    errorKind: webllmEnabled ? undefined : ("auth_error" as const),
  };
};
