import { notFound, redirect } from "next/navigation";

import { buildStudentUrl } from "@/lib/http/publicLinks";
import { ensureBoardShareCode, resolveClassByCode } from "@/lib/data/classes.server";
import { tvText } from "@/app/_components/uiTokens";

export const dynamic = "force-dynamic";

export default async function ClassEntryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalizedCode = code?.trim();

  if (!normalizedCode) {
    return notFound();
  }

  const classInfo = await resolveClassByCode(normalizedCode);

  if (!classInfo) {
    return notFound();
  }

  if (!classInfo.active_board_id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-center">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-300">Class Hub</p>
          <h1 className={tvText.tvHeading}>선생님이 수업을 준비 중이에요.</h1>
          <p className={tvText.tvBody}>잠시만 기다려주세요. 곧 학생 화면으로 연결됩니다.</p>
          <p className="text-sm text-slate-400">클래스 코드: {classInfo.short_code}</p>
        </div>
      </main>
    );
  }

  const shareCode = await ensureBoardShareCode(classInfo.active_board_id);
  redirect(buildStudentUrl(`/s/${shareCode}`));
}
