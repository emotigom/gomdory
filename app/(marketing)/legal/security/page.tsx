import type { Metadata } from "next";
import { LegalPageShell } from "../../_components/LegalPageShell";

export const metadata: Metadata = { title: "보안 및 취약점 제보 | 곰도리플랫폼", alternates: { canonical: "/legal/security" } };

const cards = [
  ["제보 방법", "보안 이슈는 ahnsangkyoon@gmail.com 또는 010-4846-3058로 제보해 주세요."],
  ["포함하면 좋은 정보", "재현 단계, 영향 범위, 화면 캡처, 발생 시각, 계정 유형(교사/학생)을 함께 전달해 주세요."],
  ["하지 말아야 할 행위", "무단 대량 스캔, 서비스 중단 유도, 데이터 파괴, 타인 계정 접근 시도는 금지됩니다."],
  ["처리 원칙", "접수 후 우선순위를 판단해 대응하며, 결과와 후속 조치를 가능한 범위에서 안내합니다."],
  ["개인정보 보호 우선", "제보 과정에서도 학생 실명, 연락처, 주소 등 불필요한 개인정보 공유를 피하고 최소 정보만 전달해 주세요."],
] as const;

export default function Page() {
  return (
    <LegalPageShell title="보안 및 취약점 제보" description="책임 있는 제보와 대응 절차를 안내합니다." lastUpdated="2026-05-12">
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(([title, body]) => (
          <article key={title} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-700">{body}</p>
          </article>
        ))}
      </div>
    </LegalPageShell>
  );
}
