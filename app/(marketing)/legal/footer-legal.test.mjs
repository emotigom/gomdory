import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const footer=fs.readFileSync('app/(marketing)/_components/MarketingFooter.tsx','utf8');
const privacy=fs.readFileSync('app/(marketing)/legal/privacy/page.tsx','utf8');
const cert=fs.readFileSync('app/(marketing)/legal/certification-readiness/page.tsx','utf8');
const child=fs.readFileSync('app/(marketing)/legal/child-safety/page.tsx','utf8');
const ai=fs.readFileSync('app/(marketing)/legal/ai-privacy/page.tsx','utf8');

test('footer keywords',()=>{['곰도리플랫폼','안상균','010-4846-3058','ahnsangkyoon@gmail.com','개인정보처리방침','이용약관','학습지원 SW 기준 안내'].forEach(k=>assert.ok(footer.includes(k),k));});
test('privacy required terms',()=>{['제1조 개인정보처리방침 개요','제2조 개인정보의 처리 목적','제3조 처리하는 개인정보 항목','제4조 개인정보의 처리 및 보유기간','제5조 개인정보의 제3자 제공','제6조 개인정보 처리 위탁','제8조 정보주체와 법정대리인의 권리','제9조 만 14세 미만 아동의 개인정보 보호','제10조 개인정보의 안전성 확보 조치','제13조 개인정보 보호책임자','학생은 별도 회원가입이나 로그인 없이','학생의 이메일','구글 계정','전화번호','주소','교사만 이메일 또는 구글 로그인 계정','안상균','ahnsangkyoon@gmail.com','010-4846-3058'].forEach(k=>assert.ok(privacy.includes(k),k));});
test('public pages avoid forbidden claims and unfinished wording',()=>{const targets=[privacy,child,ai,fs.readFileSync('app/(marketing)/edu/compliance/learning-support-software/page.tsx','utf8'),fs.readFileSync('app/(marketing)/edu/compliance/privacy-data/page.tsx','utf8')];['적용 중','공개 중','자료 제공 중','충족 예정','준비 중','개인정보 준비 중','TODO','운영 환경 확인 후 확정 예정','교육부 인증','에듀집 승인','공식 통과','심의 완료','인증 획득'].forEach(k=>targets.forEach(src=>assert.ok(!src.includes(k),k)));});
test('certification caution and forbidden claims',()=>{assert.ok(cert.includes('공식 인증 획득 또는 심의 통과를 의미하지 않으며'));['교육부 인증','에듀집 승인','공식 통과','심의 완료'].forEach(k=>assert.ok(!cert.includes(k),k));});

test('child/ai pages contain structured policy keywords',()=>{['학생 로그인 없이 참여','학생 계정정보 미수집','교사 관리형 수업','만 14세 미만 보호 원칙'].forEach(k=>assert.ok(child.includes(k),k));['개인정보 입력 금지','교사 판단 우선','민감정보 주의'].forEach(k=>assert.ok(ai.includes(k),k));});

test('public compliance pages include completed status wording',()=>{const learning=fs.readFileSync('app/(marketing)/edu/compliance/learning-support-software/page.tsx','utf8');const privacyData=fs.readFileSync('app/(marketing)/edu/compliance/privacy-data/page.tsx','utf8');const combined=[footer,cert,child,ai,learning,privacyData,privacy].join('\n');['적용됨','공개됨','절차 운영됨'].forEach(k=>assert.ok(combined.includes(k),k));assert.ok(combined.includes('자료 제공됨')||combined.includes('학교 검토 자료 제공됨'),'자료 제공됨');});

test('privacy page exposes pdf download action',()=>{const pdfButton=fs.readFileSync('app/(marketing)/_components/PdfDownloadButton.tsx','utf8');['개인정보처리방침 PDF 다운로드'].forEach(k=>assert.ok(pdfButton.includes(k),k));['/downloads/gomdory-privacy-policy.pdf','핵심 요약','제1조 개인정보처리방침 개요','개인정보 보호책임자'].forEach(k=>assert.ok(privacy.includes(k),k));});
