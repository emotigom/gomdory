import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "../../_components/LegalPageShell";
import { PdfDownloadButton } from "../../_components/PdfDownloadButton";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 곰도리플랫폼",
  description: "곰도리플랫폼 개인정보처리방침",
  alternates: { canonical: "/legal/privacy" },
};

const articles = [
  ["section-1", "제1조 개인정보처리방침 개요"],
  ["section-2", "제2조 개인정보의 처리 목적"],
  ["section-3", "제3조 처리하는 개인정보 항목"],
  ["section-4", "제4조 개인정보의 처리 및 보유기간"],
  ["section-5", "제5조 개인정보의 제3자 제공"],
  ["section-6", "제6조 개인정보 처리 위탁"],
  ["section-7", "제7조 개인정보의 파기 절차 및 방법"],
  ["section-8", "제8조 정보주체와 법정대리인의 권리"],
  ["section-9", "제9조 만 14세 미만 아동의 개인정보 보호"],
  ["section-10", "제10조 개인정보의 안전성 확보 조치"],
  ["section-11", "제11조 쿠키 및 자동 수집 장치"],
  ["section-12", "제12조 AI 기능 이용 시 개인정보 보호"],
  ["section-13", "제13조 개인정보 보호책임자"],
  ["section-14", "제14조 고지의 의무"],
] as const;

export default function Page() {
  return (
    <LegalPageShell title="개인정보처리방침" description="학교 검토와 수업 운영에 필요한 개인정보 처리 원칙을 쉽게 확인할 수 있도록 정리했습니다." lastUpdated="2026-05-12">
      <section className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PdfDownloadButton href="/downloads/gomdory-privacy-policy.pdf" fileName="gomdory-privacy-policy.pdf" label="개인정보처리방침 PDF 다운로드" />
          <p className="text-xs text-slate-600">학교 제출·검토용으로 저장하거나 출력할 수 있습니다.</p>
        </div>
      </section>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">핵심 요약</h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-slate-700">
            <li>학생은 별도 회원가입이나 로그인 없이 참여할 수 있습니다.</li>
            <li>학생의 이메일, 구글 계정, 전화번호, 주소는 기본적으로 수집하지 않습니다.</li>
            <li>교사만 이메일 또는 구글 로그인 계정으로 수업을 개설하고 관리합니다.</li>
            <li>학생 활동 정보는 닉네임, 제출물, 작품, 댓글 등 수업 운영에 필요한 범위에서만 처리됩니다.</li>
            <li>열람, 정정, 삭제, 처리정지 요청은 이메일 또는 전화로 접수합니다.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/edu/compliance/privacy-data" className="legal-control legal-control-light rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-900">개인정보 처리 항목 보기</Link>
            <Link href="/edu/compliance/learning-support-software" className="legal-control legal-control-light rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-900">학습지원 SW 기준 안내</Link>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-950">목차</h2>
          <ol className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            {articles.map(([id, title]) => (
              <li key={id}>
                <a className="legal-text-link" href={`#${id}`}>
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className="space-y-4 text-sm leading-7 text-slate-700">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 id="section-1" className="scroll-mt-24 text-lg font-semibold text-slate-900">제1조 개인정보처리방침 개요</h2>
          <p className="mt-2">곰도리플랫폼은 교사가 수업을 개설·운영하는 교사 관리형 수업 운영 도구입니다. 학생은 별도 회원가입이나 로그인 없이 참여할 수 있으며, 본 방침은 공개 페이지에서 상시 확인할 수 있습니다.</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-2" className="scroll-mt-24 text-lg font-semibold text-slate-900">제2조 개인정보의 처리 목적</h2><ul className="mt-2 list-disc pl-6"><li>교사 계정 생성 및 로그인</li><li>수업 및 활동 운영</li><li>문의 응대</li><li>서비스 안정성 및 보안</li><li>AI 기능 사용 시 수업 보조</li></ul></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-3" className="scroll-mt-24 text-lg font-semibold text-slate-900">제3조 처리하는 개인정보 항목</h2><h3 className="mt-2 font-semibold text-slate-900">교사</h3><ul className="mt-1 list-disc pl-6"><li>이메일 주소 또는 구글 로그인 식별 정보</li><li>이름 또는 표시명</li><li>문의 시 학교/기관명, 연락처, 문의 내용</li><li>로그인 기록, 접속 로그, 보안 로그</li></ul><h3 className="mt-3 font-semibold text-slate-900">학생</h3><ul className="mt-1 list-disc pl-6"><li>학생 계정 이메일: 수집하지 않음</li><li>학생 구글 계정: 수집하지 않음</li><li>학생 전화번호/주소: 수집하지 않음</li><li>학생 닉네임 또는 표시명: 수업 참여 표시 목적</li><li>제출물, 작품, 댓글, 응답, 첨부파일: 수업 운영 및 결과물 관리 목적</li><li>접속/보안 로그: 서비스 안정성과 보안 목적의 최소 범위</li></ul><p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-medium text-slate-800">학생은 별도 회원가입이나 로그인 없이 참여할 수 있으며, 학생의 이메일·구글 계정·전화번호·주소 등 로그인 개인정보를 기본적으로 수집하지 않습니다.</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-4" className="scroll-mt-24 text-lg font-semibold text-slate-900">제4조 개인정보의 처리 및 보유기간</h2><ul className="mt-2 list-disc pl-6"><li>교사 계정 정보: 회원 탈퇴 또는 계정 삭제 요청 시까지</li><li>수업/게시판/활동 데이터: 교사가 삭제하거나 수업 운영 목적이 종료될 때까지</li><li>학생 계정 정보: 별도 학생 계정을 운영하지 않으므로 보유하지 않음</li><li>문의 기록: 문의 처리 완료 후 3년 이내</li><li>보안/접속 로그: 원칙적으로 1년 이내 또는 보안 목적상 필요한 기간</li></ul></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-5" className="scroll-mt-24 text-lg font-semibold text-slate-900">제5조 개인정보의 제3자 제공</h2><p className="mt-2">곰도리플랫폼은 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다만 법령상 요청이 있거나 이용자가 사전에 동의한 경우 필요한 범위에서 제공될 수 있습니다.</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-6" className="scroll-mt-24 text-lg font-semibold text-slate-900">제6조 개인정보 처리 위탁</h2><p className="mt-2">실제 운영 환경 기준으로 사용하는 서비스만 기재합니다.</p><ul className="mt-2 list-disc pl-6"><li>Cloudflare: 서비스 제공, 보안, 정적 자산 및 인프라 운영</li><li>Supabase: 데이터베이스, 인증, 서비스 데이터 보관</li><li>Google: 교사 Google 로그인 사용 시 인증 지원</li><li>이메일/문의 도구: 문의 접수 및 답변</li></ul></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-7" className="scroll-mt-24 text-lg font-semibold text-slate-900">제7조 개인정보의 파기 절차 및 방법</h2><ul className="mt-2 list-disc pl-6"><li>계정 삭제 요청 시 교사 계정 정보 삭제</li><li>교사가 수업/게시판/활동 데이터 삭제 가능</li><li>전자 파일은 복구가 어렵도록 삭제 또는 접근 불가 처리</li><li>법령상 보관이 필요한 정보는 분리 보관 후 파기</li></ul></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-8" className="scroll-mt-24 text-lg font-semibold text-slate-900">제8조 정보주체와 법정대리인의 권리</h2><p className="mt-2">정보주체는 열람, 정정, 삭제, 처리정지, 동의 철회를 요청할 수 있으며 법정대리인은 동일한 권리를 행사할 수 있습니다. 요청 접수: ahnsangkyoon@gmail.com / 010-4846-3058</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-9" className="scroll-mt-24 text-lg font-semibold text-slate-900">제9조 만 14세 미만 아동의 개인정보 보호</h2><ul className="mt-2 list-disc pl-6"><li>만 14세 미만 학생의 직접 회원가입을 기본 운영 방식으로 두지 않음</li><li>학생은 링크나 코드로 참여</li><li>학생 이메일/구글 계정/전화번호/주소를 기본적으로 수집하지 않음</li><li>교사는 학생 실명, 연락처, 주소, 보호자 정보, 민감정보를 활동 내용에 입력하지 않도록 안내</li><li>별도 동의 기반 기능이 필요한 경우 법정대리인 동의 등 필요한 절차를 마련한 뒤 운영</li></ul></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-10" className="scroll-mt-24 text-lg font-semibold text-slate-900">제10조 개인정보의 안전성 확보 조치</h2><ul className="mt-2 list-disc pl-6"><li>접근 권한 관리</li><li>최소 권한 원칙</li><li>접속 기록 관리</li><li>비밀번호 또는 인증정보 보호</li><li>개인정보 최소 수집</li><li>파일 접근 권한 관리</li><li>보안 취약점 접수 및 대응</li></ul></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-11" className="scroll-mt-24 text-lg font-semibold text-slate-900">제11조 쿠키 및 자동 수집 장치</h2><p className="mt-2">서비스는 로그인 유지, 보안, 서비스 개선을 위해 쿠키 및 자동 수집 장치를 사용할 수 있습니다. 브라우저 설정으로 쿠키 거부가 가능하며, 쿠키 거부 시 일부 기능이 제한될 수 있습니다.</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-12" className="scroll-mt-24 text-lg font-semibold text-slate-900">제12조 AI 기능 이용 시 개인정보 보호</h2><p className="mt-2">AI 기능에 학생 이름, 전화번호, 주소, 학교명, 보호자 연락처, 건강정보 등 불필요한 개인정보나 민감정보를 입력하지 않도록 안내합니다. AI 결과는 수업 보조 자료이며 교사의 판단을 대체하지 않습니다.</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-13" className="scroll-mt-24 text-lg font-semibold text-slate-900">제13조 개인정보 보호책임자</h2><ul className="mt-2 list-disc pl-6"><li>개인정보 보호책임자: 안상균</li><li>상호: 곰도리플랫폼</li><li>이메일: ahnsangkyoon@gmail.com</li><li>전화: 010-4846-3058</li></ul></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 id="section-14" className="scroll-mt-24 text-lg font-semibold text-slate-900">제14조 고지의 의무</h2><p className="mt-2">개인정보처리방침 변경 시 홈페이지 또는 개인정보처리방침 페이지를 통해 고지합니다.</p></article>
      </section>
    </LegalPageShell>
  );
}
