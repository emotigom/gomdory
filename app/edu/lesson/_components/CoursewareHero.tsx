export default function CoursewareHero({ totalLessons, totalDays }: { totalLessons: number; totalDays: number }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-900">AI 웹사이트 코스웨어 스튜디오</h2>
      <p className="mt-2 text-base text-slate-700">16일 × 하루 2차시, 매번 작은 결과물을 남기는 중학교 인공지능 수업</p>
      <p className="mt-3 text-sm text-slate-600">오늘의 미션을 고르고, 작은 결과물을 만들고, 마지막에는 웹 포트폴리오로 모아요.</p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">총 수업 {totalLessons}차시</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">총 {totalDays}일 운영</span>
        <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700">45분 안에 끝나는 작은 미션</span>
      </div>
    </section>
  );
}
