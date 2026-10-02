import { NextResponse, type NextRequest } from "next/server";

import { resolveAuthCallbackRedirects } from "@/lib/auth/callbackRedirect";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { getRequestHost, getRequestProto } from "@/lib/http/requestHost";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawReturnTo = searchParams.get("returnTo") ?? searchParams.get("return_to");
  const [host, proto] = await Promise.all([getRequestHost(request.headers), getRequestProto(request.headers)]);
  const { loginUrl, successUrl } = resolveAuthCallbackRedirects({ host, proto, returnTo: rawReturnTo });

  const { supabase, applyCookies, envError } = createSupabaseRouteClient(request);
  let shouldSetOnboardCookie = false;

  if (envError || !supabase) {
    const loginRedirect = NextResponse.redirect(loginUrl);
    return applyCookies(loginRedirect);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Failed to exchange OAuth code", { message: error.message });
      const loginRedirect = NextResponse.redirect(loginUrl);
      return applyCookies(loginRedirect);
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user ?? null;

    if (user?.created_at) {
      const now = Date.now();
      const createdAtMs = Date.parse(user.created_at);
      const lastSignInMs = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : Number.NaN;
      const createdRecently = Number.isFinite(createdAtMs) && now - createdAtMs < 2 * 60 * 1000;
      const firstSignIn =
        Number.isFinite(createdAtMs) &&
        Number.isFinite(lastSignInMs) &&
        Math.abs(lastSignInMs - createdAtMs) < 60 * 1000;
      shouldSetOnboardCookie = createdRecently || firstSignIn;
    }
  }

  const response = NextResponse.redirect(successUrl);
  if (shouldSetOnboardCookie) {
    response.cookies.set({
      name: "__Host-gomdory-onboard",
      value: "1",
      maxAge: 300,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  }
  return applyCookies(response);
}
