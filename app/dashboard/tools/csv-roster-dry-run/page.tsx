import { notFound } from "next/navigation";

import { CsvRosterDryRunPreview } from "@/components/roster/CsvRosterDryRunPreview";
import { requireUser } from "@/lib/auth/requireUser";

const ENABLE_CSV_ROSTER_DRY_RUN_PAGE = process.env.ENABLE_CSV_ROSTER_DRY_RUN_PAGE === "1";
const ENABLE_CSV_ROSTER_DRY_RUN_API = process.env.ENABLE_CSV_ROSTER_DRY_RUN_API === "true";

export default async function CsvRosterDryRunToolPage() {
  if (!ENABLE_CSV_ROSTER_DRY_RUN_PAGE) {
    notFound();
  }

  await requireUser("/dashboard/tools/csv-roster-dry-run");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-8" data-page-marker="dashboard-csv-roster-dry-run-tool">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">CSV 로스터 Dry-run 검증</h1>
        <p className="text-sm text-neutral-600">CSV 내용을 저장하지 않고 개인정보 컬럼과 행 오류를 검사합니다.</p>
      </header>

      <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p>이 화면은 내부 검증용입니다. CSV 로스터 가져오기 기능은 아직 정식 제공되지 않습니다.</p>
        <p>검사 결과는 저장되거나 DB에 반영되지 않습니다. 서버 검증을 켠 경우 입력한 CSV 텍스트는 인증된 내부 검증 API로만 전송됩니다.</p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">검증 전 체크리스트</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>전화번호/주소/생년월일/보호자 연락처 컬럼 금지</li>
          <li>표시명/닉네임 사용 권장</li>
          <li>email은 계정 매핑이 필요한 경우에만 선택 사용</li>
          <li>외부ID는 비식별 값 권장</li>
        </ul>
      </section>

      <CsvRosterDryRunPreview enableServerDryRun={ENABLE_CSV_ROSTER_DRY_RUN_API} />
    </main>
  );
}
