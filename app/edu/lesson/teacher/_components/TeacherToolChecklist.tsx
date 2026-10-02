export default function TeacherToolChecklist({ toolHints }: { toolHints: string[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">도구 체크리스트</h2>
      {toolHints.map((hint) => (
        <div key={hint} className="rounded border p-2">{hint} · 준비 완료 / 대체 도구 필요 / 오늘은 생략</div>
      ))}
    </section>
  );
}
