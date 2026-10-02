import { notFound } from "next/navigation";

import PageMarker from "@/app/_components/PageMarker";
import { requireUser } from "@/lib/auth/requireUser";
import { buildSessionReport } from "@/lib/reports/buildSessionReport";
import ReportClient from "./ReportClient";

export default async function ClassSessionReportPage({
  params,
}: {
  params: Promise<{ classId: string; sessionId: string }>;
}) {
  const { classId, sessionId } = await params;
  const { user } = await requireUser(`/dashboard/classes/${classId}`);

  const report = await buildSessionReport({ classId, sessionId, userId: user.id }).catch(() => null);
  if (!report) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <PageMarker page="dashboard" view="class-session-report" extra={{ report: "session" }} />
      <div data-page-marker="dashboard_class_session_report" className="sr-only" />
      <ReportClient classId={classId} sessionId={sessionId} report={report} />
    </div>
  );
}
