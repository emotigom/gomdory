export default function ContactPage() {
  return (
    <main
      className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-12 sm:px-6 lg:px-8"
      data-page-marker="docs-contact"
    >
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">Contact</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">문의</h1>
        <p className="text-lg font-semibold text-slate-700">
          도움이 필요하시면 곰도리 팀에 메시지를 남겨주세요. 빠르게 확인하고 답변드리겠습니다.
        </p>
      </section>
    </main>
  );
}
