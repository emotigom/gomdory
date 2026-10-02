import { normalizeReturnTo } from "@/lib/auth/returnTo";
import { isTrustedTeacherPreviewHost } from "@/lib/http/hosts";

type CallbackRedirectInput = {
  host: string | null | undefined;
  proto: "http" | "https";
  returnTo: string | null | undefined;
};

export function resolveAuthCallbackRedirects({ host, proto, returnTo }: CallbackRedirectInput) {
  // Only the exact preview hostname may influence a callback origin. All other
  // request hosts retain the established canonical production callback policy.
  const trustedPreviewHost =
    typeof host === "string" && isTrustedTeacherPreviewHost(host) ? host : null;
  const { path, redirectHost } = normalizeReturnTo(trustedPreviewHost, returnTo);
  const origin = `${proto}://${redirectHost}`;
  const loginUrl = new URL("/auth/login", origin);
  loginUrl.searchParams.set("returnTo", path);

  return {
    loginUrl,
    successUrl: new URL(path, origin),
  };
}
