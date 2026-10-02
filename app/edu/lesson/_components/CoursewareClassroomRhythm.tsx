const RHYTHM_ITEMS = [
  "1교시: 맛보기와 따라하기",
  "2교시: 내 것으로 바꾸고 결과물 남기기",
  "결석 학생: 3분 복구팩으로 오늘 수업부터 참여",
  "교사 운영: 하루 결과물 1개만 확인",
];

export default function CoursewareClassroomRhythm() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-lg font-semibold text-slate-900">오늘의 AI 메뉴</h3>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {RHYTHM_ITEMS.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </section>
  );
}
