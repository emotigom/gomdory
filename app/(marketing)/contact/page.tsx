import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "운영 문의",
  description: "학교 도입, 운영 지원, 개인정보와 보안 문의 채널입니다.",
  alternates: { canonical: "/contact" },
};

type ContactChannel = {
  title: string;
  description: string;
  value: string;
  href: string;
  external: boolean;
};

const channels = [
  {
    title: "이메일",
    description: "장애 · 도입 · 정책 문의",
    value: "support@gomdory.app",
    href: "mailto:support@gomdory.app",
    external: true,
  },
  {
    title: "커뮤니티",
    description: "수업 사례 · 활용 팁",
    value: "커뮤니티 열기",
    href: "/community",
    external: false,
  },
  {
    title: "운영 정보",
    description: "서비스 상태 · 운영 안내",
    value: "운영 정보 보기",
    href: "/operator",
    external: false,
  },
] as const satisfies readonly ContactChannel[];

const includeItems = [
  "보드 ID",
  "요청 ID(화면에 표시된 경우)",
  "예상한 결과와 실제로 보인 화면",
  "발생 시간과 영향을 받은 수업",
] as const;

export default function MarketingContactPage() {
  return (
    <section
      data-contact-interaction-scope
      className="contact-workdesk relative isolate overflow-hidden border-y-2 border-[var(--theme-border-strong)] bg-transparent"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[linear-gradient(rgba(25,36,58,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(25,36,58,0.055)_1px,transparent_1px)] [background-size:24px_24px]" aria-hidden />

      <div className="border-b-2 border-[var(--theme-border-strong)] px-5 py-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-black tracking-[0.14em] text-[var(--theme-text-muted)]">
          <span>GOMDORY SUPPORT DESK</span>
          <span className="border border-[var(--theme-border-strong)] bg-[#e6f05a] px-3 py-1 text-[#19243a]">접수 안내</span>
        </div>
      </div>

      <header className="grid gap-8 border-b-2 border-[var(--theme-border-strong)] px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-12">
        <div className="max-w-3xl">
          <p className="text-xs font-black tracking-[0.16em] text-[var(--theme-accent)]">운영 지원 데스크</p>
          <h1 className="mt-5 text-[clamp(2.75rem,7vw,5.75rem)] font-black leading-[0.96] tracking-[-0.065em] text-[var(--theme-text)]">
            필요한 곳으로,<br />바로 문의하세요.
          </h1>
        </div>
        <div className="border-2 border-[var(--theme-border-strong)] border-l-8 bg-[#f28a52] p-5 text-[#19243a] shadow-[4px_4px_0_#19243a] sm:p-6">
          <p className="text-[11px] font-black tracking-[0.15em]">접수 전 확인</p>
          <p className="mt-3 text-base font-black leading-7">문의 내용과 관련 ID를 함께 보내 주세요.</p>
        </div>
      </header>

      <div className="space-y-5 px-5 py-10 sm:px-8 sm:py-12 lg:px-12" aria-labelledby="contact-channel-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[0.14em] text-[var(--theme-accent)]">01 · 접수 채널</p>
            <h2 id="contact-channel-title" className="mt-2 text-3xl font-black tracking-[-0.045em] text-[var(--theme-text)] sm:text-4xl">문의할 곳을 고르세요</h2>
          </div>
          <p className="text-sm font-semibold text-[var(--theme-text-muted)]">내용에 맞는 채널 하나면 충분합니다.</p>
        </div>

        <div className="contact-directory grid overflow-hidden border-2 border-[var(--theme-border-strong)] bg-[var(--theme-border-strong)] shadow-[6px_6px_0_rgba(25,36,58,0.16)] md:grid-cols-3">
          {channels.map((channel, index) => (
            <article key={channel.title} className="flex min-w-0 flex-col border-b-2 border-[var(--theme-border-strong)] bg-[var(--theme-card)] p-5 last:border-b-0 sm:p-6 md:border-b-0 md:border-r-2 md:last:border-r-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black tracking-[0.14em] text-[var(--theme-accent)]">CHANNEL</p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--theme-text)]">{channel.title}</h3>
                </div>
                <span className="flex size-11 shrink-0 items-center justify-center border-2 border-[var(--theme-border-strong)] bg-[#e6f05a] text-sm font-black text-[#19243a]" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <p className="mt-4 min-h-10 text-sm font-semibold leading-6 text-[var(--theme-text-muted)]">{channel.description}</p>
              {channel.external ? (
                <a href={channel.href} className="contact-link mt-6 inline-flex min-h-14 w-full items-center justify-between gap-3 rounded-[4px] border border-[var(--theme-border-strong)] bg-[var(--theme-text)] px-4 text-sm font-black text-[var(--theme-bg)]">
                  <span className="min-w-0 break-all text-left">{channel.value}</span>
                  <span className="shrink-0 text-lg" aria-hidden>↗</span>
                </a>
              ) : (
                <Link href={channel.href} className="contact-link mt-6 inline-flex min-h-14 w-full items-center justify-between gap-3 rounded-[4px] border border-[var(--theme-border-strong)] bg-[var(--theme-text)] px-4 text-sm font-black text-[var(--theme-bg)]">
                  <span className="min-w-0 text-left">{channel.value}</span>
                  <span className="shrink-0 text-lg" aria-hidden>→</span>
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-4 border-t-2 border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] px-5 py-10 sm:px-8 sm:py-12 lg:grid-cols-[1.08fr_0.92fr] lg:px-12">
        <section className="contact-checklist rounded-[3px_10px_3px_10px] border-2 border-[var(--theme-border-strong)] border-l-8 bg-[var(--theme-card)] p-5 shadow-[5px_5px_0_#e6f05a] sm:p-7">
          <div className="flex items-center justify-between gap-4 border-b-2 border-dashed border-[var(--theme-border-strong)] pb-5">
            <div>
              <p className="text-xs font-black tracking-[0.14em] text-[var(--theme-accent)]">02 · 접수 전표</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--theme-text)]">함께 보낼 정보</h2>
            </div>
            <span className="shrink-0 border-2 border-[var(--theme-border-strong)] px-3 py-2 text-xs font-black text-[var(--theme-text)]" aria-hidden>CHECK</span>
          </div>
          <ol className="divide-y divide-dashed divide-[var(--theme-border)]">
            {includeItems.map((item, index) => (
              <li key={item} className="grid grid-cols-[2.25rem_1fr] gap-3 py-4 text-sm font-semibold leading-6 text-[var(--theme-text-muted)]">
                <span className="font-black text-[var(--theme-accent)]" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="contact-response-ticket rounded-[10px_3px_10px_3px] border-2 border-[var(--theme-border-strong)] bg-[#dceee5] p-5 shadow-[5px_5px_0_#77c7a2] sm:p-7">
          <div className="border-b-2 border-dashed border-[var(--theme-border-strong)] pb-5">
            <p className="text-xs font-black tracking-[0.14em] text-[var(--theme-accent)]">03 · 답변 시간</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--theme-text)]">접수 뒤 이렇게 확인합니다</h2>
          </div>
          <dl className="divide-y divide-dashed divide-[var(--theme-border)] text-sm">
            <div className="grid gap-2 py-5 sm:grid-cols-[0.72fr_1.28fr] sm:gap-4">
              <dt className="font-black text-[var(--theme-text)]">일반 문의</dt>
              <dd className="font-semibold leading-6 text-[var(--theme-text-muted)]">평일 기준 1영업일 이내 첫 답변</dd>
            </div>
            <div className="grid gap-2 py-5 sm:grid-cols-[0.72fr_1.28fr] sm:gap-4">
              <dt className="font-black text-[var(--theme-text)]">긴급 수업 장애</dt>
              <dd className="font-semibold leading-6 text-[var(--theme-text-muted)]">운영 시간 기준 2시간 이내 확인</dd>
            </div>
          </dl>
          <p className="border-2 border-[var(--theme-border-strong)] bg-[#e6f05a] px-4 py-3 text-sm font-black leading-6 text-[#19243a]">
            수업 장애는 발생 시간과 영향을 받은 수업을 함께 보내 주세요.
          </p>
        </section>
      </div>
    </section>
  );
}
