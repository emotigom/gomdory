import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STUDENT_RECORDS_GUEST_COOKIE, STUDENT_RECORDS_GUEST_MAX_AGE_SECONDS, createGuestCookieValue, getStudentRecordsGuestConfig, isValidGuestInviteToken } from "@/lib/student-records/guestAccess";
import { getRuntimeEnv, readEnvStringFrom } from "@/lib/server/runtimeEnv";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

function Unavailable() { return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-2xl font-bold">체험 링크를 사용할 수 없습니다</h1><p className="mt-3 text-neutral-600">링크가 올바르지 않거나 체험 기간이 종료되었습니다.</p></main>; }

export default async function StudentRecordsInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const config = getStudentRecordsGuestConfig();
  if (!await isValidGuestInviteToken(token, config)) return <Unavailable />;
  const value = await createGuestCookieValue(config);
  if (!value) return <Unavailable />;
  (await cookies()).set({ name: STUDENT_RECORDS_GUEST_COOKIE, value, httpOnly: true, sameSite: "lax", secure: readEnvStringFrom(getRuntimeEnv(), "NODE_ENV") === "production", path: "/", maxAge: STUDENT_RECORDS_GUEST_MAX_AGE_SECONDS });
  redirect("/tools/student-records/try");
}
