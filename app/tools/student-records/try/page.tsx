import { cookies } from "next/headers";
import StudentRecordsToolClient from "@/app/dashboard/tools/student-records/StudentRecordsToolClient";
import { STUDENT_RECORDS_GUEST_COOKIE, STUDENT_RECORDS_GUEST_MAX_STUDENTS, getStudentRecordsGuestConfig, verifyGuestCookieValue } from "@/lib/student-records/guestAccess";
import { api } from "@/lib/standards/routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function StudentRecordsTryPage() {
  const config = getStudentRecordsGuestConfig();
  const allowed = await verifyGuestCookieValue((await cookies()).get(STUDENT_RECORDS_GUEST_COOKIE)?.value, config);
  if (!allowed) return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-2xl font-bold">체험 접근 권한이 없습니다</h1><p className="mt-3 text-neutral-600">체험 링크가 만료되었거나 올바르지 않습니다.</p></main>;
  return <StudentRecordsToolClient providerStatus={{ mode: "openai", generationEnabled: !config.configurationError, availabilityReason: config.configurationError ? "configuration-error" : "ready", label: config.configurationError ? "AI 문구 생성 · 설정 확인 필요" : "저비용 AI 초안 생성 모드" }} generateEndpoint={api.v1("tools", "student-records", "generate-guest")} accessMode="guest" maxStudentCount={STUDENT_RECORDS_GUEST_MAX_STUDENTS} hideStudentName />;
}
