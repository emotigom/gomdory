import type { Metadata } from "next";
import { LegalPageShell } from "../../_components/LegalPageShell";

export const metadata: Metadata = { title: "아동·청소년 개인정보 보호 안내 | 곰도리플랫폼", alternates: { canonical: "/legal/child-safety" } };

const cards = [
  ["학생 로그인 없이 참여", "학생은 별도 계정 생성 없이 선생님이 제공한 링크나 코드로 수업에 참여합니다."],
  ["학생 계정정보 미수집", "학생 이메일, 구글 계정, 전화번호, 주소를 기본적으로 수집하지 않습니다."],
  ["교사 관리형 수업", "선생님이 수업을 개설하고, 참여 방식과 활동 내용을 관리합니다."],
  ["만 14세 미만 보호 원칙", "만 14세 미만 학생의 직접 계정 가입을 기본 운영 방식으로 두지 않습니다."],
  ["교사 안내", "학생 실명, 연락처, 주소, 보호자 정보, 민감정보를 활동 내용에 입력하지 않도록 안내합니다."],
] as const;

export default function Page() {
  return (
    <LegalPageShell title="아동·청소년 개인정보 보호 안내" description="교사 관리형 수업 운영 기준의 아동·청소년 개인정보 보호 원칙을 안내합니다." lastUpdated="2026-05-12">
      <section className="space-y-4">
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">상태: 절차 운영됨 · 적용됨 · 공개됨. 상세 문의는 아래 문의처를 이용해 주세요.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map(([title, body]) => (
            <article key={title} className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-700">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </LegalPageShell>
  );
}
