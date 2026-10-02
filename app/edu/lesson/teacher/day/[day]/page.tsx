import Link from "next/link";
import { notFound } from "next/navigation";
import { getCoursewareLessonPack } from "@/lib/edu/courseware/aiCoursewareLessonPacks";
import { coursewareLessonHref } from "@/lib/edu/courseware/aiCoursewareRoutes";
import { getCoursewareLessonBlocks } from "@/lib/edu/courseware/aiCoursewareLessonBlocks";

const FLOW = ["이제 AI가 잘하는 일과 사람이 판단해야 하는 일을 구분해 봅시다.", "이번에는 같은 질문을 더 좋은 프롬프트로 바꿔봅시다.", "입력, 처리, 출력으로 생각하면 코딩과 AI 사용이 연결됩니다."];
const MODALITY_LABEL: Record<string, string> = { unplugged: "언플러그드", "browser-ai-lab": "브라우저 AI 실험", "teachable-machine": "티처블 머신형 활동", notebook: "노트북", "gomdory-web-artifact": "웹 결과물", discussion: "토론", "project-studio": "프로젝트" };
const PREP_LABEL: Record<string, string> = { none: "준비 없음", light: "가벼운 준비", medium: "보통 준비", advanced: "고급 준비" };

export default async function TeacherDayPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  const lesson = getCoursewareLessonPack(Number(day));
  if (!lesson) notFound();
  const blocks = getCoursewareLessonBlocks(lesson.day);

  return <main data-courseware-teacher-runtime="teacher-day-v2" className="mx-auto max-w-5xl space-y-4 bg-gradient-to-b from-white to-cyan-50/50 p-4 md:p-6">
    <header className="rounded-3xl border border-cyan-100 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-cyan-700">교사용 {lesson.title}</p><h1 className="text-2xl font-black">진행안 · {lesson.artifact}</h1><p className="mt-1 text-slate-700">핵심 질문: {lesson.essentialQuestion}</p></header>
    <section className="rounded-2xl border bg-white p-4"><h2 className="font-bold">수업 도구 요약</h2><p className="mt-1 text-sm">모달리티: {lesson.modalities.map((m) => MODALITY_LABEL[m] ?? m).join(" · ")}</p><p className="text-sm">준비 수준: {PREP_LABEL[lesson.teacherPreparationLevel]}</p><p className="text-sm">필수 준비물: {lesson.requiredMaterials.join(", ")}</p><p className="text-sm">선택 준비물: {lesson.optionalMaterials.join(", ")}</p><p className="text-sm">도구 플랜: {lesson.toolPlan.map((plan) => plan.title).join(" / ")}</p></section>
    <section className="rounded-2xl border bg-white p-4"><h2 className="font-bold">준비 체크리스트</h2><ul className="mt-2 list-disc pl-5 text-sm">{lesson.requiredMaterials.map((item) => <li key={item}>{item}</li>)}{lesson.toolPlan.flatMap((plan) => plan.teacherSetup).map((setup) => <li key={setup}>{setup}</li>)}</ul></section>
    <section className="rounded-2xl border bg-white p-4"><h2 className="font-bold">개인정보 / 안전 안내</h2><ul className="mt-2 list-disc pl-5 text-sm"><li>학생 얼굴·목소리·이름을 기본 수집하지 않습니다.</li><li>물건, 그림, 손그림 카드, 종이 데이터셋을 우선 사용합니다.</li><li>외부 도구 사용 시 학교 정책을 확인합니다.</li><li>곰도리 서버에 학생 미디어를 업로드하지 않습니다.</li>{lesson.safetyNotes.map((note) => <li key={note}>{note}</li>)}</ul></section>
    <section className="rounded-2xl border bg-white p-4"><h2 className="font-bold">대체 운영안</h2><ul className="mt-2 list-disc pl-5 text-sm">{lesson.toolPlan.map((plan) => <li key={plan.id}>{plan.fallbackPlan ?? "webcam unavailable → 종이 카드 분류 활동"}</li>)}</ul></section>
    <section className="rounded-2xl border bg-white p-4"><h2 className="font-bold">차시별 도구 운영 멘트</h2><ul className="mt-2 space-y-1 text-sm">{lesson.toolPlan.map((plan) => <li key={`${plan.id}-script`}>• {plan.teacherSetup[0] ?? "진행 안내"} → {plan.studentAction[0] ?? "학생 실습"}</li>)}{FLOW.map((line) => <li key={line}>• {line}</li>)}</ul></section>
    <section className="rounded-2xl border bg-white p-4"><h2 className="font-bold">첫 수업에서 추천하는 진행 순서</h2><ol className="mt-2 list-decimal pl-5 text-sm text-slate-700">{blocks.map((block) => <li key={block.id}>{block.title}</li>)}</ol></section>
    <section className="rounded-2xl border bg-white p-4"><h2 className="font-bold">교사 스크립트(블록 전환)</h2><ul className="mt-2 space-y-1 text-sm">{FLOW.map((line) => <li key={line}>• {line}</li>)}</ul></section>
    <section className="rounded-2xl border bg-white p-4"><h2 className="font-bold">권장 운영 시간</h2><ul className="mt-2 space-y-1 text-sm"><li>45분 운영: 핵심 질문 + 분류 + 프롬프트 개선 + 카드 초안 1개</li><li>90분 운영: 전체 블록 순차 진행 + 미니퀴즈 + 회고 공유</li><li>120–180분 확장: 팀별 재작성/발표 + 확장 미션</li></ul></section>
    <div className="flex flex-wrap gap-2"><Link href="/edu/lesson" className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">허브로 돌아가기</Link><Link href={coursewareLessonHref(lesson.day)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">학생 화면으로 이동</Link></div>
  </main>;
}
