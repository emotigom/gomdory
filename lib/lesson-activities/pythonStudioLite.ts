import type { LessonActivityType } from "@/lib/lesson-activities/registry";
import { getConfiguredPyodideBaseUrl } from "@/lib/lesson-activities/pyodideAssets";

export const PYTHON_STUDIO_LITE_ACTIVITY_TYPE = "python_studio_lite" satisfies LessonActivityType;
export const PYTHON_STUDIO_LITE_VERSION = 1;
export const PYTHON_STUDIO_LITE_CODE_MAX_LENGTH = 20_000;
export const PYTHON_STUDIO_LITE_STDIN_MAX_LENGTH = 5_000;
export const PYTHON_STUDIO_LITE_OUTPUT_MAX_LENGTH = 10_000;

export type PythonStudioLiteConfig = {
  activityType: typeof PYTHON_STUDIO_LITE_ACTIVITY_TYPE;
  version: typeof PYTHON_STUDIO_LITE_VERSION;
  title: string;
  starter: {
    code: string;
    stdin: string;
  };
  instruction: string;
  missionSteps: string[];
  challenge?: {
    title: string;
    description: string;
    examples: string[];
  };
  teacherSummaryTitle?: "파이썬 실습실" | "파이썬 if/else 실습";
  runtime: {
    mode: "browser_optional";
    baseUrl: string;
  };
};

export type PythonStudioLiteState = {
  activityType: typeof PYTHON_STUDIO_LITE_ACTIVITY_TYPE;
  version: typeof PYTHON_STUDIO_LITE_VERSION;
  code: string;
  stdin: string;
  stdout: string;
  stderr: string;
  savedAt: string | null;
  submitted: boolean;
  submittedAt: string | null;
};

export type PythonStudioLiteSaveInput = {
  code: unknown;
  stdin?: unknown;
  stdout?: unknown;
  stderr?: unknown;
};

function normalizeText(value: unknown, label: string, maxLength: number, options: { cap?: boolean } = {}): string {
  if (typeof value !== "string") return "";
  const withoutNulls = value.replace(/\u0000/g, "");
  if (withoutNulls.length > maxLength) {
    if (options.cap) return withoutNulls.slice(0, maxLength);
    throw new Error(`${label}은(는) ${maxLength}자 이내로 작성해 주세요.`);
  }
  return withoutNulls;
}

export function normalizePythonStudioLiteCode(value: unknown): string {
  return normalizeText(value, "파이썬 코드", PYTHON_STUDIO_LITE_CODE_MAX_LENGTH);
}

export function normalizePythonStudioLiteStdin(value: unknown): string {
  return normalizeText(value, "입력값", PYTHON_STUDIO_LITE_STDIN_MAX_LENGTH);
}

export function capPythonStudioLiteOutput(value: unknown): string {
  return normalizeText(value, "실행 결과", PYTHON_STUDIO_LITE_OUTPUT_MAX_LENGTH, { cap: true });
}

export function buildLesson1PythonStudioLiteConfig(): PythonStudioLiteConfig {
  return {
    activityType: PYTHON_STUDIO_LITE_ACTIVITY_TYPE,
    version: PYTHON_STUDIO_LITE_VERSION,
    title: "파이썬 첫걸음: AI 탐험 카드 만들기",
    starter: {
      code: `print("AI 탐험을 시작합니다!")\n\nnickname = input("닉네임을 입력하세요: ")\nfavorite_ai = input("관심 있는 AI 사례를 입력하세요: ")\n\nprint()\nprint("=== AI 탐험 카드 ===")\nprint(f"탐험가: {nickname}")\nprint(f"관심 있는 AI: {favorite_ai}")\nprint("AI는 많은 데이터에서 패턴을 찾아 도움을 줄 수 있어요.")`,
      stdin: "탐험가\n영상 추천",
    },
    instruction: "print(), input(), 변수, f-string을 사용해 나만의 AI 탐험 카드를 만들어 보세요.",
    missionSteps: [
      "print()로 문장을 출력해요.",
      "input()으로 닉네임과 관심 있는 AI 사례를 입력받아요.",
      "입력받은 값을 변수에 저장해요.",
      "f-string으로 결과를 깔끔하게 보여줘요.",
      "개인정보 대신 닉네임과 가상의 탐험 주제를 사용해요.",
    ],
    teacherSummaryTitle: "파이썬 실습실",
    runtime: {
      mode: "browser_optional",
      baseUrl: getConfiguredPyodideBaseUrl(),
    },
  };
}

export function buildLesson2PythonStudioLiteConfig(): PythonStudioLiteConfig {
  return {
    activityType: PYTHON_STUDIO_LITE_ACTIVITY_TYPE,
    version: PYTHON_STUDIO_LITE_VERSION,
    title: "파이썬 if/else: AI 판단 도우미 만들기",
    starter: {
      code: `print("AI 판단 도우미를 시작합니다!")

task = input("판단할 일을 입력하세요: ")
data_many = input("데이터가 많고 반복되는 일인가요? (예/아니오): ")
needs_empathy = input("감정, 책임, 윤리 판단이 중요한가요? (예/아니오): ")

print()
print("=== AI 판단 결과 ===")

if data_many == "예" and needs_empathy == "아니오":
    print(f"{task}은/는 AI가 잘 도와줄 수 있어요.")
elif needs_empathy == "예":
    print(f"{task}은/는 사람의 판단이 꼭 필요해요.")
else:
    print(f"{task}은/는 AI와 사람이 함께하면 좋아요.")`,
      stdin: "스팸 메일 차단\n예\n아니오",
    },
    instruction: "if/else, elif, and/or를 사용해 AI가 잘하는 일과 사람의 판단이 필요한 일을 분류해 보세요.",
    missionSteps: [
      "input()으로 판단할 일을 입력받아요.",
      "조건을 예/아니오로 입력받아요.",
      "if/elif/else로 결과를 나누어요.",
      "and를 사용해 조건을 함께 검사해요.",
      "AI가 도와줄 일인지, 사람이 판단해야 할 일인지 설명해요.",
    ],
    challenge: {
      title: "도전 미션: 나만의 AI 판단 도우미 만들기",
      description: "조건을 하나 더 추가해서 더 세밀하게 판단해 보세요.",
      examples: ["책임이 큰 일인가요?", "처음 보는 상황인가요?"],
    },
    teacherSummaryTitle: "파이썬 if/else 실습",
    runtime: {
      mode: "browser_optional",
      baseUrl: getConfiguredPyodideBaseUrl(),
    },
  };
}

export function isPythonStudioLiteConfig(value: unknown): value is PythonStudioLiteConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<PythonStudioLiteConfig>;
  return (
    candidate.activityType === PYTHON_STUDIO_LITE_ACTIVITY_TYPE &&
    candidate.version === PYTHON_STUDIO_LITE_VERSION &&
    typeof candidate.title === "string" &&
    typeof candidate.starter?.code === "string" &&
    typeof candidate.starter.stdin === "string" &&
    (candidate.instruction === undefined || typeof candidate.instruction === "string") &&
    (candidate.missionSteps === undefined || (
      Array.isArray(candidate.missionSteps) &&
      candidate.missionSteps.every((step) => typeof step === "string")
    )) &&
    (candidate.challenge === undefined || (
      typeof candidate.challenge.title === "string" &&
      typeof candidate.challenge.description === "string" &&
      Array.isArray(candidate.challenge.examples) &&
      candidate.challenge.examples.every((example) => typeof example === "string")
    )) &&
    (candidate.teacherSummaryTitle === undefined || candidate.teacherSummaryTitle === "파이썬 실습실" || candidate.teacherSummaryTitle === "파이썬 if/else 실습") &&
    candidate.runtime?.mode === "browser_optional" &&
    typeof candidate.runtime.baseUrl === "string"
  );
}

export function buildInitialPythonStudioLiteState(config: PythonStudioLiteConfig): PythonStudioLiteState {
  return {
    activityType: PYTHON_STUDIO_LITE_ACTIVITY_TYPE,
    version: PYTHON_STUDIO_LITE_VERSION,
    code: config.starter.code,
    stdin: config.starter.stdin,
    stdout: "",
    stderr: "",
    savedAt: null,
    submitted: false,
    submittedAt: null,
  };
}

export function normalizePythonStudioLiteState(value: unknown, fallback: PythonStudioLiteState): PythonStudioLiteState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const candidate = value as Partial<PythonStudioLiteState>;
  try {
    return {
      activityType: PYTHON_STUDIO_LITE_ACTIVITY_TYPE,
      version: PYTHON_STUDIO_LITE_VERSION,
      code: normalizePythonStudioLiteCode(candidate.code),
      stdin: normalizePythonStudioLiteStdin(candidate.stdin),
      stdout: capPythonStudioLiteOutput(candidate.stdout),
      stderr: capPythonStudioLiteOutput(candidate.stderr),
      savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : fallback.savedAt,
      submitted: candidate.submitted === true,
      submittedAt: typeof candidate.submittedAt === "string" ? candidate.submittedAt : null,
    };
  } catch {
    return fallback;
  }
}

export function buildSavedPythonStudioLiteState(
  current: PythonStudioLiteState,
  input: PythonStudioLiteSaveInput,
  savedAt: string,
): PythonStudioLiteState {
  return {
    ...current,
    code: normalizePythonStudioLiteCode(input.code),
    stdin: input.stdin === undefined ? current.stdin : normalizePythonStudioLiteStdin(input.stdin),
    stdout: input.stdout === undefined ? current.stdout : capPythonStudioLiteOutput(input.stdout),
    stderr: input.stderr === undefined ? current.stderr : capPythonStudioLiteOutput(input.stderr),
    savedAt,
  };
}

export function markPythonStudioLiteSubmitted(current: PythonStudioLiteState, submittedAt: string): PythonStudioLiteState {
  return {
    ...current,
    savedAt: current.savedAt ?? submittedAt,
    submitted: true,
    submittedAt,
  };
}

export function isPythonStudioLiteCompleted(state: PythonStudioLiteState): boolean {
  return state.submitted === true && typeof state.submittedAt === "string" && state.submittedAt.length > 0;
}

export type PythonStudioLiteTeacherSummaryRow = {
  id: string;
  displayName: string | null;
  state: unknown;
  status: "in_progress" | "completed";
  updatedAt: string;
  submittedAt: string | null;
};

export function summarizePythonStudioLiteForTeacher(params: {
  activityRunId: string;
  config: PythonStudioLiteConfig;
  rows: PythonStudioLiteTeacherSummaryRow[];
}) {
  const fallback = buildInitialPythonStudioLiteState(params.config);
  const rows = params.rows.map((row) => ({
    ...row,
    state: normalizePythonStudioLiteState(row.state, fallback),
  }));

  return {
    activityRunId: params.activityRunId,
    activityTitle: params.config.teacherSummaryTitle ?? "파이썬 실습실",
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
