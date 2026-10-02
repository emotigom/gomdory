"use client";

import { useMemo, useState } from "react";

import { HTML_LESSON_KIT_REGISTRY } from "@/lib/curriculum/lessonKitRegistry";
import { generateLessonKitStudentCardText } from "@/lib/curriculum/lessonKitStudentCard";
import { apiV1Path } from "@/lib/standards/pathTypes";

type CopyState = "idle" | "copied" | "manual";

type Props = {
  boardId: string;
  boardAccessCode?: string | null;
};

type LessonKitDisplayMeta = {
  lessonNumber: string;
  title: string;
  description: string;
  tone: "amber" | "violet" | "emerald" | "sky" | "rose" | "lime" | "cyan";
};

function buildStudentCodingPath(code: string, lessonKitId?: string) {
  const params = new URLSearchParams();
  params.set("view", "student-app");
  if (lessonKitId) params.set("lessonKit", lessonKitId);

  return `/s/${encodeURIComponent(code)}?${params.toString()}`;
}

const toSameOriginUrl = (path: string) => {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
};

const LESSON_KIT_DISPLAY_META: Record<string, LessonKitDisplayMeta> = {
  "lesson-05-html-structure": {
    lessonNumber: "5차시",
    title: "HTML 구조 이해",
    description: "제목, 본문, 버튼처럼 웹페이지 뼈대를 이루는 HTML 구조를 익혀요.",
    tone: "amber",
  },
  "lesson-06-css-styling": {
    lessonNumber: "6차시",
    title: "CSS 화면 꾸미기",
    description: "색, 글자 크기, 여백, 카드 모양을 바꾸며 화면 분위기를 꾸며요.",
    tone: "violet",
  },
  "lesson-07-js-interaction": {
    lessonNumber: "7차시",
    title: "JavaScript 버튼 응원함",
    description: "버튼 클릭, 숫자 세기, 초기화 같은 상호작용을 JavaScript로 만들어요.",
    tone: "emerald",
  },
  "lesson-08-web-core-basics": {
    lessonNumber: "8차시",
    title: "HTML/CSS/JS 핵심 보충",
    description: "HTML 구조, CSS 꾸미기, JavaScript 움직임을 연결해서 다시 점검해요.",
    tone: "sky",
  },
  "lesson-09-vscode-file-structure": {
    lessonNumber: "9차시",
    title: "VS Code와 파일 구조",
    description: "다운로드한 웹앱이 index.html, style.css, script.js 세 파일로 이루어져 있음을 확인해요.",
    tone: "rose",
  },
  "lesson-10-js-reaction-lab": {
    lessonNumber: "보충",
    title: "JavaScript 반응 복습",
    description: "빠른 학생용 추가 미션으로 버튼 반응, 문장, 이모지, 색상을 복습해요.",
    tone: "lime",
  },
  "lesson-10-ai-favorite-page": {
    lessonNumber: "10차시",
    title: "AI와 함께 만드는 주제 소개 페이지",
    description: "AI 초안 예시를 참고하고, 내가 고르고 고친 말로 좋아하는 주제를 소개해요.",
    tone: "rose",
  },
  "lesson-11-ai-3d-mission-room": {
    lessonNumber: "11차시",
    title: "AI 3D 미션룸 만들기",
    description: "three.js 3D 공간의 제목, 방, 색상, 힌트를 바꾸며 나만의 AI 미션룸을 만들어요.",
    tone: "cyan",
  },
  "lesson-13-ai-camera-card": {
    lessonNumber: "13차시",
    title: "카메라 인식과 AI 포토 카드",
    description: "Award VR 체험으로 포토 카드를 만들고 카메라, 동의, 개인정보 안전을 함께 확인해요.",
    tone: "rose",
  },
  "lesson-12-ai-quiz-maker": {
    lessonNumber: "12차시",
    title: "AI 문제 만들기와 미니 퀴즈 게임",
    description: "AI처럼 보이는 문제 예시를 사람이 검토하고, 문제/선택지/정답/피드백을 바꿔 퀴즈 게임을 완성해요.",
    tone: "amber",
  },
  "lesson-14-ai-portfolio-starter": {
    lessonNumber: "14차시",
    title: "AI 작품 만들기와 제출",
    description: "Canva와 AI 도구로 만든 이미지, 영상, 음악, 링크 작품을 보드에 제출해요.",
    tone: "violet",
  },
  "lesson-15-ai-gallery-site-starter": {
    lessonNumber: "15차시",
    title: "AI 작품 모음집 사이트",
    description: "교사 최종 작품 갤러리의 JSON 데이터를 넣어 우리 반 작품 전시 사이트를 완성해요.",
    tone: "cyan",
  },
  "lesson-16-clipchamp-ai-trailer": {
    lessonNumber: "16차시",
    title: "Clipchamp AI 작품 예고편",
    description: "내 AI 작품 이미지와 이야기를 20~40초 예고편 영상으로 만들고 video.mp4로 제출해요.",
    tone: "emerald",
  },
};

const LESSON_KIT_TONE_CLASSES: Record<
  LessonKitDisplayMeta["tone"],
  { card: string; badge: string; primary: string; secondary: string; sample: string }
> = {
  amber: {
    card: "border-amber-300/55 bg-amber-50/95 text-amber-950 shadow-[0_10px_28px_rgba(146,64,14,0.18)]",
    badge: "border-amber-500/35 bg-amber-100 text-amber-900",
    primary: "border-amber-700 bg-amber-700 text-white hover:bg-amber-800",
    secondary: "border-amber-400 bg-white text-amber-900 hover:bg-amber-100",
    sample: "border-orange-400 bg-orange-100 text-orange-950 hover:bg-orange-200",
  },
  violet: {
    card: "border-violet-300/60 bg-violet-50/95 text-violet-950 shadow-[0_10px_28px_rgba(109,40,217,0.16)]",
    badge: "border-violet-500/35 bg-violet-100 text-violet-900",
    primary: "border-violet-700 bg-violet-700 text-white hover:bg-violet-800",
    secondary: "border-fuchsia-300 bg-white text-violet-950 hover:bg-fuchsia-100",
    sample: "border-pink-400 bg-pink-100 text-pink-950 hover:bg-pink-200",
  },
  emerald: {
    card: "border-emerald-300/60 bg-emerald-50/95 text-emerald-950 shadow-[0_10px_28px_rgba(4,120,87,0.16)]",
    badge: "border-emerald-500/35 bg-emerald-100 text-emerald-900",
    primary: "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800",
    secondary: "border-teal-300 bg-white text-emerald-950 hover:bg-teal-100",
    sample: "border-teal-500 bg-teal-100 text-teal-950 hover:bg-teal-200",
  },
  sky: {
    card: "border-sky-300/60 bg-sky-50/95 text-sky-950 shadow-[0_10px_28px_rgba(3,105,161,0.16)]",
    badge: "border-sky-500/35 bg-sky-100 text-sky-900",
    primary: "border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-800",
    secondary: "border-sky-300 bg-white text-sky-950 hover:bg-sky-100",
    sample: "border-indigo-400 bg-indigo-100 text-indigo-950 hover:bg-indigo-200",
  },
  rose: {
    card: "border-rose-300/60 bg-rose-50/95 text-rose-950 shadow-[0_10px_28px_rgba(190,18,60,0.14)]",
    badge: "border-rose-500/35 bg-rose-100 text-rose-900",
    primary: "border-rose-700 bg-rose-700 text-white hover:bg-rose-800",
    secondary: "border-rose-300 bg-white text-rose-950 hover:bg-rose-100",
    sample: "border-cyan-500 bg-cyan-100 text-cyan-950 hover:bg-cyan-200",
  },
  lime: {
    card: "border-lime-300/60 bg-lime-50/95 text-lime-950 shadow-[0_10px_28px_rgba(77,124,15,0.15)]",
    badge: "border-lime-500/35 bg-lime-100 text-lime-900",
    primary: "border-lime-700 bg-lime-700 text-white hover:bg-lime-800",
    secondary: "border-lime-300 bg-white text-lime-950 hover:bg-lime-100",
    sample: "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200",
  },
  cyan: {
    card: "border-cyan-300/60 bg-cyan-50/95 text-cyan-950 shadow-[0_10px_28px_rgba(8,145,178,0.16)]",
    badge: "border-cyan-500/35 bg-cyan-100 text-cyan-900",
    primary: "border-cyan-700 bg-cyan-700 text-white hover:bg-cyan-800",
    secondary: "border-sky-300 bg-white text-cyan-950 hover:bg-sky-100",
    sample: "border-indigo-400 bg-indigo-100 text-indigo-950 hover:bg-indigo-200",
  },
};

const getLessonKitDisplayMeta = (lessonId: string, fallbackTitle: string): LessonKitDisplayMeta =>
  LESSON_KIT_DISPLAY_META[lessonId] ?? {
    lessonNumber: "수업",
    title: fallbackTitle,
    description: "학생 코딩 화면과 예제 페이지로 바로 이동할 수 있어요.",
    tone: "sky",
  };

export default function LessonKitLauncherPanel({ boardId, boardAccessCode = null }: Props) {
  const lessonKits = useMemo(() => [...HTML_LESSON_KIT_REGISTRY], []);
  const fallbackLessonKit = lessonKits.at(-1) ?? null;
  const [studentCodingCopyStateByLessonId, setStudentCodingCopyStateByLessonId] = useState<Record<string, CopyState>>({});
  const [studentCardCopyStateByLessonId, setStudentCardCopyStateByLessonId] = useState<Record<string, CopyState>>({});
  const [studentCodingCopyState, setStudentCodingCopyState] = useState<CopyState>("idle");
  const [submissionWindowNotice, setSubmissionWindowNotice] = useState<string | null>(null);
  const normalizedBoardAccessCode = boardAccessCode?.trim() ?? "";
  const studentCodingPath =
    normalizedBoardAccessCode.length > 0 && fallbackLessonKit
      ? buildStudentCodingPath(normalizedBoardAccessCode, fallbackLessonKit.lessonId)
      : null;

  if (lessonKits.length === 0) return null;

  const setStudentCodingCopyStateForLesson = (lessonId: string, state: CopyState) => {
    setStudentCodingCopyStateByLessonId((current) => ({ ...current, [lessonId]: state }));
  };

  const setStudentCardCopyStateForLesson = (lessonId: string, state: CopyState) => {
    setStudentCardCopyStateByLessonId((current) => ({ ...current, [lessonId]: state }));
  };

  const copyText = async (value: string) => {
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clipboard) return false;

    try {
      await clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  };

  const ensureSubmissionWindowOpen = async () => {
    if (!boardId) return false;
    try {
      const response = await fetch(apiV1Path("dashboard/student-apps/session"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId, action: "autoStart" }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (response.ok && payload?.ok) {
        setSubmissionWindowNotice("학생 앱 제출을 6시간 동안 열어 두었어요.");
        return true;
      }
    } catch {}
    setSubmissionWindowNotice("학생 앱 제출 열림 상태를 확인하지 못했어요.");
    return false;
  };

  const openStudentCodingPath = async (path: string) => {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    await ensureSubmissionWindowOpen();
    if (popup) {
      popup.location.href = path;
      return;
    }
    window.location.href = path;
  };

  const copyStudentCodingUrl = async () => {
    if (!studentCodingPath) return;
    await ensureSubmissionWindowOpen();
    const ok = await copyText(toSameOriginUrl(studentCodingPath));
    if (!ok) {
      setStudentCodingCopyState("manual");
      return;
    }

    setStudentCodingCopyState("copied");
    window.setTimeout(() => setStudentCodingCopyState("idle"), 1800);
  };

  const copyStudentCodingUrlForLesson = async (lessonId: string, path: string) => {
    await ensureSubmissionWindowOpen();
    const ok = await copyText(toSameOriginUrl(path));
    if (!ok) {
      setStudentCodingCopyStateForLesson(lessonId, "manual");
      return;
    }

    setStudentCodingCopyStateForLesson(lessonId, "copied");
    window.setTimeout(() => setStudentCodingCopyStateForLesson(lessonId, "idle"), 1800);
  };

  const copyStudentCardForLesson = async (lessonId: string, cardText: string) => {
    const ok = await copyText(cardText);
    if (!ok) {
      setStudentCardCopyStateForLesson(lessonId, "manual");
      return;
    }

    setStudentCardCopyStateForLesson(lessonId, "copied");
    window.setTimeout(() => setStudentCardCopyStateForLesson(lessonId, "idle"), 1800);
  };

  return (
    <section className="hud-card-shell hud-right-rail-inner rounded-xl p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-[var(--theme-text)]">수업 키트</p>
        <span className="rounded-full border border-[var(--theme-border)] px-2 py-0.5 text-[11px] text-[var(--theme-text-muted)]">
          HTML/CSS/JS 정적 수업
        </span>
        <span className="rounded-full border border-[var(--theme-border)] px-2 py-0.5 text-[11px] text-[var(--theme-text-muted)]">
          프로토타입
        </span>
      </div>
      <p className="mt-2 text-[var(--theme-text-muted)]">
        차시별 학생 코딩 화면, 학생 링크, 예제 페이지를 바로 열 수 있어요.
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--theme-text-muted)]">
        일반 학생 보드 링크는 그대로 유지되고, 아래 링크는 수업 키트가 열린 코딩 화면으로 이동합니다.
      </p>

      <div className="mt-3 rounded-lg border border-[var(--theme-border)] p-2">
        <p className="font-semibold text-[var(--theme-text)]">최신 차시 코딩 화면</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--theme-text-muted)]">
          기본값은 레지스트리의 마지막 수업 키트로 열립니다. 차시별 링크는 아래 카드에서 따로 열고 복사할 수 있어요.
        </p>
        {studentCodingPath ? (
          <div className="mt-2 space-y-2">
            <a
              href={studentCodingPath}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                event.preventDefault();
                void openStudentCodingPath(studentCodingPath);
              }}
              className="block min-h-11 rounded-lg bg-[var(--theme-accent)] px-3 py-2.5 text-center font-medium text-[var(--theme-action-text)]"
            >
              학생 코딩 열기
            </a>
            <button
              type="button"
              onClick={() => void copyStudentCodingUrl()}
              className="min-h-11 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2.5 font-medium text-[var(--theme-text)]"
            >
              링크 복사
            </button>
          </div>
        ) : (
          <p className="mt-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--theme-text-muted)]">
            입장코드를 먼저 생성하면 학생 코딩 화면 링크를 사용할 수 있어요.
          </p>
        )}
        {studentCodingCopyState === "copied" ? (
          <p className="mt-2 text-[var(--theme-text-muted)]">학생 코딩 화면 링크를 복사했어요.</p>
        ) : null}
        {studentCodingCopyState === "manual" ? (
          <p className="mt-2 text-[var(--theme-text-muted)]">
            복사가 안 되면 학생 코딩 화면을 열어 주소를 직접 복사해 주세요.
          </p>
        ) : null}
        {submissionWindowNotice ? (
          <p className="mt-2 text-[var(--theme-text-muted)]">{submissionWindowNotice}</p>
        ) : null}
      </div>

      <div className="mt-3 space-y-3">
        {lessonKits.map((lessonKit) => {
          const displayMeta = getLessonKitDisplayMeta(lessonKit.lessonId, lessonKit.title);
          const toneClasses = LESSON_KIT_TONE_CLASSES[displayMeta.tone];
          const lessonStudentCodingPath =
            normalizedBoardAccessCode.length > 0
              ? buildStudentCodingPath(normalizedBoardAccessCode, lessonKit.lessonId)
              : null;
          const lessonStudentCodingCopyState =
            studentCodingCopyStateByLessonId[lessonKit.lessonId] ?? "idle";
          const studentCardText = generateLessonKitStudentCardText(lessonKit.lessonId);
          const studentCardCopyState = studentCardCopyStateByLessonId[lessonKit.lessonId] ?? "idle";

          return (
            <div
              key={lessonKit.lessonId}
              className={`rounded-lg border p-3 ${toneClasses.card}`}
              data-lesson-kit-card-tone={displayMeta.tone}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${toneClasses.badge}`}>
                    {displayMeta.lessonNumber}
                  </span>
                  <p className="mt-2 text-sm font-bold">{displayMeta.title}</p>
                </div>
                <a
                  href={lessonKit.public.teacherHtmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-current/25 px-2 py-1 text-[11px] font-semibold opacity-85 hover:opacity-100"
                >
                  수업 안내
                </a>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed opacity-85">{displayMeta.description}</p>
              <div className="mt-3 space-y-2">
                {lessonStudentCodingPath ? (
                  <>
                    <a
                      href={lessonStudentCodingPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => {
                        event.preventDefault();
                        void openStudentCodingPath(lessonStudentCodingPath);
                      }}
                      className={`block min-h-11 rounded-lg border px-3 py-2.5 text-center font-semibold ${toneClasses.primary}`}
                    >
                      학생 코딩 열기
                    </a>
                    <button
                      type="button"
                      onClick={() => void copyStudentCodingUrlForLesson(lessonKit.lessonId, lessonStudentCodingPath)}
                      className={`min-h-11 w-full rounded-lg border px-3 py-2.5 font-semibold ${toneClasses.secondary}`}
                    >
                      링크 복사
                    </button>
                  </>
                ) : (
                  <p className="rounded-lg border border-current/20 bg-white/55 px-3 py-2.5 text-[11px] leading-relaxed">
                    입장코드가 만들어지면 학생 코딩 화면 링크를 열고 복사할 수 있어요.
                  </p>
                )}
                <a
                  href={lessonKit.public.sampleIndexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block min-h-11 rounded-lg border px-3 py-2.5 text-center font-semibold ${toneClasses.sample}`}
                >
                  예제 페이지
                </a>
                {studentCardText ? (
                  <button
                    type="button"
                    onClick={() => void copyStudentCardForLesson(lessonKit.lessonId, studentCardText)}
                    className={`min-h-11 w-full rounded-lg border px-3 py-2.5 font-semibold ${toneClasses.secondary}`}
                  >
                    학생 안내 카드 복사
                  </button>
                ) : null}
              </div>
              {lessonStudentCodingCopyState === "copied" ? (
                <p className="mt-2 text-[11px] font-medium opacity-80">학생 링크를 복사했어요.</p>
              ) : null}
              {lessonStudentCodingCopyState === "manual" ? (
                <p className="mt-2 text-[11px] opacity-80">복사가 안 되면 학생 코딩 화면을 열어 주소를 직접 복사해 주세요.</p>
              ) : null}
              {studentCardCopyState === "copied" ? (
                <p className="mt-2 text-[11px] font-medium opacity-80" role="status">
                  학생 안내 카드 문구를 복사했어요.
                </p>
              ) : null}
              {studentCardCopyState === "manual" && studentCardText ? (
                <div className="mt-2 space-y-1">
                  <label htmlFor={`student-card-fallback-${lessonKit.lessonId}`} className="text-[11px] font-medium opacity-80">
                    자동 복사가 안 됐어요. 아래 문구를 직접 선택해 복사해 주세요.
                  </label>
                  <textarea
                    id={`student-card-fallback-${lessonKit.lessonId}`}
                    readOnly
                    value={studentCardText}
                    onFocus={(event) => event.currentTarget.select()}
                    rows={10}
                    className="w-full resize-y rounded-lg border border-current/20 bg-white/80 px-3 py-2 text-[11px] leading-relaxed text-slate-950"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 space-y-1 border-t border-[var(--theme-border)] pt-3 text-[var(--theme-text-muted)]">
        <p>학생별 진도 저장은 아직 지원하지 않습니다.</p>
        <p>제출/공개 관리는 기존 학생 앱 제출 기능에서 진행해요.</p>
      </div>
    </section>
  );
}
