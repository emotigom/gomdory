export const dynamic = "force-dynamic";

type QuotePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  searchParams: Exclude<Awaited<QuotePageProps["searchParams"]>, undefined>,
  key: string,
  fallback = "",
) {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default async function QuotePrintPage({ searchParams }: QuotePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const orgName = getParam(resolvedSearchParams, "org_name", "학교/기관명");
  const term = getParam(resolvedSearchParams, "term", "1y");
  const seats = Number.parseInt(getParam(resolvedSearchParams, "seats", "1"), 10) || 1;

  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-white px-6 py-10 text-slate-900 print:max-w-none print:px-8">
      <style>{`@media print { .print-hidden { display: none; } body { background: white; } }`}</style>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">견적서 / 구매요청서</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Gomdory Pro</h1>
          <p className="text-sm font-semibold text-slate-600">계약 후 라이선스 키를 제공해드립니다.</p>
        </div>
        <div className="text-right text-sm font-semibold text-slate-600">
          <p>발행일: {new Date().toLocaleDateString()}</p>
          <p>문의: support@gomdory.app</p>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-slate-500">기관명</p>
            <p className="text-lg font-bold text-slate-900">{orgName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">플랜 / 기간</p>
            <p className="text-lg font-bold text-slate-900">
              Pro / {term === "1m" ? "1개월" : "1년"} / {seats}석
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">라이선스 제공 방식</p>
          <p className="text-sm font-semibold text-slate-900">계약 완료 후 라이선스 키 제공</p>
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-500">
          PDF로 저장 후 내부 결재에 활용하세요. 최종 계약 시 발급되는 라이선스 키를 입력하면 Pro가 활성화됩니다.
        </p>
        <p className="mt-2 text-xs text-slate-500">소규모 파일럿(예: 1개 학년/팀)로 먼저 시작한 뒤 좌석을 확장하는 방식도 가능합니다.</p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">금액(표준가)</h2>
        <div className="mt-2 grid grid-cols-3 gap-3 text-sm font-semibold text-slate-900">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">공급가</p>
            <p>표준가 기준</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">부가세</p>
            <p>별도(10%)</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">총액</p>
            <p>협의 후 확정</p>
          </div>
        </div>
      </section>

      <div className="print-hidden rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">
        인쇄 팁: 브라우저에서 Ctrl/Cmd + P → “PDF로 저장”을 선택해 내부 결재에 첨부하세요.
      </div>
    </main>
  );
}
