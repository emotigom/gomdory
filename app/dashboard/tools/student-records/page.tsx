import { requireUser } from "@/lib/auth/requireUser";
import { getStudentRecordsProviderConfig, getStudentRecordsProviderConfigInvalidDiagnostic, getStudentRecordsProviderPublicStatus } from "@/lib/student-records/providerConfig";
import StudentRecordsToolClient from "./StudentRecordsToolClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentRecordsToolPage() {
  const { user } = await requireUser("/dashboard/tools/student-records");
  const providerConfig = getStudentRecordsProviderConfig();
  if (providerConfig.configurationError) console.warn(JSON.stringify(getStudentRecordsProviderConfigInvalidDiagnostic()));
  const providerStatus = getStudentRecordsProviderPublicStatus(providerConfig, user.id);
  return <StudentRecordsToolClient providerStatus={providerStatus} />;
}
