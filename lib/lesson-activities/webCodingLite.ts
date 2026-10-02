import type { LessonActivityType } from "@/lib/lesson-activities/registry";

export const WEB_CODING_LITE_ACTIVITY_TYPE = "web_coding_lite" satisfies LessonActivityType;
export const WEB_CODING_LITE_VERSION = 1;
export const WEB_CODING_LITE_CODE_MAX_LENGTH = 20_000;

export type WebCodingLiteConfig = {
  activityType: typeof WEB_CODING_LITE_ACTIVITY_TYPE;
  version: typeof WEB_CODING_LITE_VERSION;
  title: string;
  starter: {
    html: string;
    css: string;
    js: string;
  };
  hintsEnabled: boolean;
};

export type WebCodingLiteState = {
  activityType: typeof WEB_CODING_LITE_ACTIVITY_TYPE;
  version: typeof WEB_CODING_LITE_VERSION;
  html: string;
  css: string;
  js: string;
  savedAt: string | null;
  submitted: boolean;
  submittedAt: string | null;
};

export type WebCodingLiteSaveInput = {
  html: unknown;
  css: unknown;
  js: unknown;
};

function normalizeCodePart(value: unknown, label: string): string {
  if (typeof value !== "string") return "";
  if (value.length > WEB_CODING_LITE_CODE_MAX_LENGTH) {
    throw new Error(`${label} 코드는 ${WEB_CODING_LITE_CODE_MAX_LENGTH}자 이내로 작성해 주세요.`);
  }
  return value.replace(/\u0000/g, "");
}

export function buildLesson2WebCodingLiteConfig(): WebCodingLiteConfig {
  return {
    activityType: WEB_CODING_LITE_ACTIVITY_TYPE,
    version: WEB_CODING_LITE_VERSION,
    title: "선택: 웹 코딩 체험",
    hintsEnabled: true,
    starter: {
      html: `<main class="app-card">
  <p class="eyebrow">AI 판단 도우미</p>
  <h1>AI와 사람이 함께 판단하기</h1>
  <p class="lead">HTML/CSS/JS로 비슷한 판단 도우미를 만들어 볼 수 있어요.</p>

  <section class="question-card">
    <h2>이 일은 어떤 특징이 있나요?</h2>
    <button onclick="decide('data')">데이터가 많고 반복되는 일인가요?</button>
    <button onclick="decide('ethics')">감정/책임/윤리 판단이 중요한가요?</button>
    <button onclick="decide('both')">데이터도 많고 사람의 확인도 필요한가요?</button>
  </section>

  <p id="result" class="result">버튼을 눌러 판단 결과를 확인해 보세요.</p>
</main>`,
      css: `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top left, #164e63, #020617 58%);
  color: #e0f2fe;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.app-card {
  width: min(92vw, 640px);
  border: 1px solid rgba(125, 211, 252, 0.35);
  border-radius: 28px;
  background: rgba(15, 23, 42, 0.88);
  box-shadow: 0 24px 80px rgba(8, 47, 73, 0.45);
  padding: 28px;
}

.eyebrow {
  color: #67e8f9;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 { margin: 8px 0; font-size: clamp(28px, 6vw, 44px); }
.lead { color: #cbd5e1; line-height: 1.7; }
.question-card { margin-top: 22px; display: grid; gap: 10px; }
button {
  border: 1px solid rgba(125, 211, 252, 0.42);
  border-radius: 16px;
  background: rgba(8, 145, 178, 0.18);
  color: white;
  cursor: pointer;
  font-size: 16px;
  font-weight: 800;
  padding: 14px 16px;
  text-align: left;
}
button:hover { background: rgba(34, 211, 238, 0.28); }
.result {
  margin-top: 18px;
  border-radius: 18px;
  background: rgba(34, 211, 238, 0.14);
  color: #ecfeff;
  font-size: 20px;
  font-weight: 900;
  padding: 18px;
}`,
      js: `function decide(type) {
  const result = document.querySelector("#result");

  if (type === "data") {
    result.textContent = "AI가 잘할 수 있어요.";
  } else if (type === "ethics") {
    result.textContent = "사람의 판단이 필요해요.";
  } else {
    result.textContent = "AI와 사람이 함께하면 좋아요.";
  }
}`,
    },
  };
}

export function isWebCodingLiteConfig(value: unknown): value is WebCodingLiteConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<WebCodingLiteConfig>;
  return (
    candidate.activityType === WEB_CODING_LITE_ACTIVITY_TYPE &&
    candidate.version === WEB_CODING_LITE_VERSION &&
    typeof candidate.title === "string" &&
    typeof candidate.starter?.html === "string" &&
    typeof candidate.starter.css === "string" &&
    typeof candidate.starter.js === "string" &&
    (candidate.hintsEnabled === undefined || typeof candidate.hintsEnabled === "boolean")
  );
}

export function resolveWebCodingLiteHintsEnabled(config: Pick<WebCodingLiteConfig, "hintsEnabled"> | { hintsEnabled?: unknown }): boolean {
  return config.hintsEnabled !== false;
}

export function withWebCodingLiteHintSettings(config: WebCodingLiteConfig, hintsEnabled: boolean): WebCodingLiteConfig {
  return {
    ...config,
    hintsEnabled,
  };
}

export function buildInitialWebCodingLiteState(config: WebCodingLiteConfig): WebCodingLiteState {
  return {
    activityType: WEB_CODING_LITE_ACTIVITY_TYPE,
    version: WEB_CODING_LITE_VERSION,
    html: config.starter.html,
    css: config.starter.css,
    js: config.starter.js,
    savedAt: null,
    submitted: false,
    submittedAt: null,
  };
}

export function normalizeWebCodingLiteState(value: unknown, fallback: WebCodingLiteState): WebCodingLiteState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const candidate = value as Partial<WebCodingLiteState>;
  try {
    return {
      activityType: WEB_CODING_LITE_ACTIVITY_TYPE,
      version: WEB_CODING_LITE_VERSION,
      html: normalizeCodePart(candidate.html, "HTML"),
      css: normalizeCodePart(candidate.css, "CSS"),
      js: normalizeCodePart(candidate.js, "JavaScript"),
      savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : fallback.savedAt,
      submitted: candidate.submitted === true,
      submittedAt: typeof candidate.submittedAt === "string" ? candidate.submittedAt : null,
    };
  } catch {
    return fallback;
  }
}

export function buildSavedWebCodingLiteState(
  current: WebCodingLiteState,
  input: WebCodingLiteSaveInput,
  savedAt: string,
): WebCodingLiteState {
  return {
    ...current,
    html: normalizeCodePart(input.html, "HTML"),
    css: normalizeCodePart(input.css, "CSS"),
    js: normalizeCodePart(input.js, "JavaScript"),
    savedAt,
  };
}

export function markWebCodingLiteSubmitted(current: WebCodingLiteState, submittedAt: string): WebCodingLiteState {
  return {
    ...current,
    savedAt: current.savedAt ?? submittedAt,
    submitted: true,
    submittedAt,
  };
}

export function isWebCodingLiteCompleted(state: WebCodingLiteState): boolean {
  return state.submitted === true && typeof state.submittedAt === "string" && state.submittedAt.length > 0;
}


export type WebCodingLiteTeacherSummaryRow = {
  id: string;
  displayName: string | null;
  state: unknown;
  status: "in_progress" | "completed";
  updatedAt: string;
  submittedAt: string | null;
};

export function summarizeWebCodingLiteForTeacher(params: {
  activityRunId: string;
  config: WebCodingLiteConfig;
  rows: WebCodingLiteTeacherSummaryRow[];
}) {
  const fallback = buildInitialWebCodingLiteState(params.config);
  const rows = params.rows.map((row) => ({
    ...row,
    state: normalizeWebCodingLiteState(row.state, fallback),
  }));

  return {
    activityRunId: params.activityRunId,
    activityTitle: "웹 코딩 실습실" as const,
    hintsEnabled: resolveWebCodingLiteHintsEnabled(params.config),
    participantCount: rows.length,
    savedCount: rows.filter((row) => Boolean(row.state.savedAt)).length,
    submittedCount: rows.filter((row) => row.state.submitted).length,
    recentSubmissions: rows
      .filter((row) => row.state.submittedAt || row.state.savedAt)
      .sort((a, b) => (b.state.submittedAt ?? b.state.savedAt ?? b.updatedAt).localeCompare(a.state.submittedAt ?? a.state.savedAt ?? a.updatedAt))
      .slice(0, 6)
      .map((row) => ({
        id: row.id,
        displayName: row.displayName || "익명 학생",
        savedAt: row.state.savedAt ?? row.updatedAt,
        submittedAt: row.state.submittedAt ?? row.submittedAt,
        status: row.state.submitted ? "submitted" as const : "saved" as const,
      })),
  };
}
