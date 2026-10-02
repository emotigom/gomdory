import type { Metadata } from "next";
import { LegalPageShell } from "../../_components/LegalPageShell";

export const metadata: Metadata = { title: "AI 개인정보 보호 안내 | 곰도리플랫폼", alternates: { canonical: "/legal/ai-privacy" } };

const cards = [
  ["개인정보 입력 금지", "AI 프롬프트에 학생 이름, 전화번호, 주소, 보호자 정보, 건강정보 등 불필요한 개인정보를 입력하지 않도록 안내합니다."],
  ["교사 판단 우선", "AI 결과는 수업 보조 자료이며, 최종 판단과 안내는 선생님이 수행합니다."],
  ["학생 계정정보 미사용", "학생의 이메일이나 구글 계정 없이도 수업 참여가 가능하도록 설계합니다."],
  ["민감정보 주의", "건강, 상담, 가정환경 등 민감한 내용은 AI 입력에 포함하지 않도록 안내합니다."],
  ["수업 맥락 중심 사용", "AI는 수업 자료 정리, 예시 생성, 활동 안내 보조 용도로 사용합니다."],
] as const;

export default function Page() {
  return (
    <LegalPageShell title="AI 개인정보 보호 안내" description="교사 관리형 수업 흐름에서 AI 기능 이용 시 개인정보 보호 기준을 안내합니다." lastUpdated="2026-05-12">
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(([title, body]) => (
          <article key={title} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-700">{body}</p>
          </article>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-700">구체적인 운영/문의 요청은 본문 중복 기재 대신 아래 문의처에서 통합 접수합니다.</p>
    </LegalPageShell>
  );
}
