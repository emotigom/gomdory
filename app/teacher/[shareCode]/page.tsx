import TeacherDashboard from "@/components/teacher/TeacherDashboard";

export default async function TeacherShareCodePage({ params }: { params: Promise<{ shareCode: string }> }) {
  const { shareCode } = await params;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <TeacherDashboard shareCode={shareCode} />
    </div>
  );
}
