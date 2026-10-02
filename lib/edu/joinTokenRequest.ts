import { NextResponse, type NextRequest } from "next/server";

export const EDU_JOIN_TOKEN_COOKIE = "__Host-edu_jt";
const EDU_JOIN_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;

export const isLikelyJoinToken = (token: string) => /^[A-Za-z0-9_-]{16,64}$/.test(token);

export const resolveJoinTokenFromRequest = (request: Request): string => {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("jt")?.trim() ?? "";
  if (isLikelyJoinToken(fromQuery)) return fromQuery;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const fromCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${EDU_JOIN_TOKEN_COOKIE}=`))
    ?.slice(`${EDU_JOIN_TOKEN_COOKIE}=`.length)
    ?.trim();
  if (fromCookie && isLikelyJoinToken(fromCookie)) return fromCookie;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refUrl = new URL(referer);
      const fromReferer = refUrl.searchParams.get("jt")?.trim() ?? "";
      if (isLikelyJoinToken(fromReferer)) return fromReferer;
    } catch {
      // ignore invalid referer
    }
  }

  return "";
};

export const setJoinTokenCookie = (
  request: NextRequest,
  response: NextResponse,
  joinToken: string,
) => {
  if (!isLikelyJoinToken(joinToken)) return;

  response.cookies.set({
    name: EDU_JOIN_TOKEN_COOKIE,
    value: joinToken,
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: EDU_JOIN_TOKEN_MAX_AGE_SECONDS,
  });
};

