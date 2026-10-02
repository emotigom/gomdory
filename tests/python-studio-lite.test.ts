import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

import {
  PYTHON_STUDIO_LITE_ACTIVITY_TYPE,
  PYTHON_STUDIO_LITE_CODE_MAX_LENGTH,
  PYTHON_STUDIO_LITE_OUTPUT_MAX_LENGTH,
  PYTHON_STUDIO_LITE_STDIN_MAX_LENGTH,
  buildInitialPythonStudioLiteState,
  buildLesson1PythonStudioLiteConfig,
  buildLesson2PythonStudioLiteConfig,
  buildSavedPythonStudioLiteState,
  isPythonStudioLiteCompleted,
  markPythonStudioLiteSubmitted,
  summarizePythonStudioLiteForTeacher,
} from "@/lib/lesson-activities/pythonStudioLite";
import {
  DEFAULT_PYODIDE_BASE_URL,
  getPyodideAssetPaths,
  normalizePyodideBaseUrl,
} from "@/lib/lesson-activities/pyodideAssets";
import {
  getLessonTemplate,
  LESSON_ACTIVITY_TYPES,
} from "@/lib/lesson-activities/registry";

const root = process.cwd();
const read = (...segments: string[]) =>
  fs.readFileSync(path.join(root, ...segments), "utf8");

async function runPythonWorkerMock(code: string, stdin = "") {
  const worker = read("public", "workers", "python-studio-lite-worker.js");
  const messages: unknown[] = [];
  let listener: ((event: { data: unknown }) => void) | null = null;
  let stdoutRaw: ((charCode: number) => void) | null = null;
  let stderrRaw: ((charCode: number) => void) | null = null;
  let stdinReader: (() => string) | null = null;
  let receivedCode = "";
  const writeRaw = (raw: ((charCode: number) => void) | null, text: string) => {
    assert.ok(raw, "raw output callback should be registered");
    for (const byte of new TextEncoder().encode(text)) raw(byte);
  };
  const context = vm.createContext({
    TextDecoder,
    Uint8Array,
    console,
    importScripts: () => undefined,
    self: {
      postMessage: (message: unknown) => messages.push(message),
      addEventListener: (
        _type: string,
        callback: (event: { data: unknown }) => void,
      ) => {
        listener = callback;
      },
      loadPyodide: async () => ({
        setStdin: ({ stdin: nextStdin }: { stdin: () => string }) => {
          stdinReader = nextStdin;
        },
        setStdout: ({ raw }: { raw: (charCode: number) => void }) => {
          stdoutRaw = raw;
        },
        setStderr: ({ raw }: { raw: (charCode: number) => void }) => {
          stderrRaw = raw;
        },
        runPythonAsync: async (nextCode: string) => {
          receivedCode = nextCode;
          if (nextCode.includes('input("닉네임을 입력하세요: ")')) {
            writeRaw(stdoutRaw, "닉네임을 입력하세요: ");
            const value = stdinReader?.() ?? "";
            writeRaw(stdoutRaw, `탐험가: ${value}\n`);
            return;
          }
          if (nextCode.includes('raise RuntimeError("실패")')) {
            writeRaw(stderrRaw, "Traceback line 1\n");
            throw new Error("RuntimeError: 실패");
          }
          if (nextCode.includes('print("첫 줄\\n둘째 줄")')) {
            writeRaw(stdoutRaw, "첫 줄\n둘째 줄\n");
            return;
          }
          if (nextCode.includes('print(f"결과: {1 + 1}\\n완료")')) {
            writeRaw(stdoutRaw, "결과: 2\n완료\n");
            return;
          }
          if (nextCode.includes('print("A")') && nextCode.includes("print()")) {
            writeRaw(stdoutRaw, "A\n\nB\n");
          }
        },
      }),
    },
  });
  vm.runInContext(worker, context);
  assert.ok(listener, "worker message listener should be registered");
  listener({ data: { type: "run", id: "test-run", code, stdin } });
  await new Promise((resolve) => setImmediate(resolve));
  return {
    messages: JSON.parse(JSON.stringify(messages)) as unknown[],
    receivedCode,
  };
}

test("Python Studio Lite registry and lesson 1 starter are privacy-safe", () => {
  assert.equal(LESSON_ACTIVITY_TYPES.includes("python_studio_lite"), true);
  assert.deepEqual(
    getLessonTemplate("lesson_01_ai_intro_python_first_steps")?.activities.map(
      (activity) => activity.key,
    ),
    ["ai_bingo", "python_studio_lite"],
  );

  const config = buildLesson1PythonStudioLiteConfig();
  assert.equal(config.activityType, PYTHON_STUDIO_LITE_ACTIVITY_TYPE);
  assert.equal(config.version, 1);
  assert.equal(config.title, "파이썬 첫걸음: AI 탐험 카드 만들기");
  assert.match(config.starter.code, /print\("AI 탐험을 시작합니다!"\)/);
  assert.match(config.starter.code, /닉네임을 입력하세요/);
  assert.match(config.starter.code, /관심 있는 AI 사례를 입력하세요/);
  assert.match(config.starter.code, /nickname = input/);
  assert.match(config.starter.code, /favorite_ai = input/);
  assert.match(config.starter.code, /print\(f"탐험가: \{nickname\}"\)/);
  assert.match(
    config.starter.code,
    /print\(f"관심 있는 AI: \{favorite_ai\}"\)/,
  );
  assert.match(
    config.starter.code,
    /AI는 많은 데이터에서 패턴을 찾아 도움을 줄 수 있어요/,
  );
  assert.equal(config.starter.stdin, "탐험가\n영상 추천");
  assert.doesNotMatch(
    config.starter.code,
    /이름을 입력|학교|전화번호|주소|이메일|생일|학번|010|@example\.com/,
  );

  const state = buildInitialPythonStudioLiteState(config);
  assert.equal(state.activityType, "python_studio_lite");
  assert.equal(state.code, config.starter.code);
  assert.equal(state.stdin, config.starter.stdin);
  assert.equal(state.stdout, "");
  assert.equal(state.stderr, "");
  assert.equal(state.submitted, false);
});

test("Python Studio Lite lesson 2 starter covers if/elif/else, and, input, and f-strings safely", () => {
  assert.deepEqual(
    getLessonTemplate("lesson_02_ai_judgment_if_else")?.activities.map(
      (activity) => activity.key,
    ),
    ["ai_judgment_sort", "python_studio_lite", "web_coding_lite"],
  );
  const config = buildLesson2PythonStudioLiteConfig();
  assert.equal(config.title, "파이썬 if/else: AI 판단 도우미 만들기");
  assert.equal(
    config.instruction,
    "if/else, elif, and/or를 사용해 AI가 잘하는 일과 사람의 판단이 필요한 일을 분류해 보세요.",
  );
  assert.match(config.starter.code, /input\("판단할 일을 입력하세요: "\)/);
  assert.match(
    config.starter.code,
    /if data_many == "예" and needs_empathy == "아니오":/,
  );
  assert.match(config.starter.code, /elif needs_empathy == "예":/);
  assert.match(config.starter.code, /else:/);
  assert.match(
    config.starter.code,
    /print\(f"\{task\}은\/는 AI가 잘 도와줄 수 있어요\."\)/,
  );
  assert.equal(config.starter.stdin, "스팸 메일 차단\n예\n아니오");
  assert.ok(config.missionSteps.some((step) => step.includes("if/elif/else")));
  assert.ok(config.missionSteps.some((step) => step.includes("and")));
  assert.equal(
    config.challenge?.title,
    "도전 미션: 나만의 AI 판단 도우미 만들기",
  );
  assert.doesNotMatch(
    JSON.stringify(config),
    /이름을 입력|학교|전화번호|주소|이메일|생일|학번|010|@example\.com/,
  );
});

test("Python Studio Lite utilities enforce code/input length and cap output before storage", () => {
  const current = buildInitialPythonStudioLiteState(
    buildLesson1PythonStudioLiteConfig(),
  );
  const saved = buildSavedPythonStudioLiteState(
    current,
    { code: "print('AI 탐험')", stdin: "탐험가", stdout: "완료", stderr: "" },
    "2026-05-17T00:00:00.000Z",
  );
  assert.equal(saved.savedAt, "2026-05-17T00:00:00.000Z");
  assert.equal(isPythonStudioLiteCompleted(saved), false);
  const submitted = markPythonStudioLiteSubmitted(
    saved,
    "2026-05-17T00:01:00.000Z",
  );
  assert.equal(isPythonStudioLiteCompleted(submitted), true);
  assert.equal(PYTHON_STUDIO_LITE_CODE_MAX_LENGTH, 20_000);
  assert.equal(PYTHON_STUDIO_LITE_STDIN_MAX_LENGTH, 5_000);
  assert.equal(PYTHON_STUDIO_LITE_OUTPUT_MAX_LENGTH, 10_000);
  assert.throws(
    () =>
      buildSavedPythonStudioLiteState(
        current,
        { code: "x".repeat(PYTHON_STUDIO_LITE_CODE_MAX_LENGTH + 1), stdin: "" },
        "now",
      ),
    /파이썬 코드은\(는\) 20000자 이내/,
  );
  assert.throws(
    () =>
      buildSavedPythonStudioLiteState(
        current,
        {
          code: "print(1)",
          stdin: "x".repeat(PYTHON_STUDIO_LITE_STDIN_MAX_LENGTH + 1),
        },
        "now",
      ),
    /입력값은\(는\) 5000자 이내/,
  );
  const capped = buildSavedPythonStudioLiteState(
    current,
    {
      code: "print(1)",
      stdout: "o".repeat(PYTHON_STUDIO_LITE_OUTPUT_MAX_LENGTH + 5),
      stderr: "e".repeat(PYTHON_STUDIO_LITE_OUTPUT_MAX_LENGTH + 5),
    },
    "now",
  );
  assert.equal(capped.stdout.length, PYTHON_STUDIO_LITE_OUTPUT_MAX_LENGTH);
  assert.equal(capped.stderr.length, PYTHON_STUDIO_LITE_OUTPUT_MAX_LENGTH);
});

test("Python Studio Lite teacher summary counts saved and submitted states without code exposure", () => {
  const config = buildLesson1PythonStudioLiteConfig();
  const base = buildInitialPythonStudioLiteState(config);
  const saved = buildSavedPythonStudioLiteState(
    base,
    { code: "print('saved')", stdin: "탐험가" },
    "2026-05-17T00:00:00.000Z",
  );
  const submitted = markPythonStudioLiteSubmitted(
    buildSavedPythonStudioLiteState(
      base,
      { code: "print('submitted')", stdin: "코딩 고양이" },
      "2026-05-17T00:01:00.000Z",
    ),
    "2026-05-17T00:02:00.000Z",
  );

  const summary = summarizePythonStudioLiteForTeacher({
    activityRunId: "run-python",
    config,
    rows: [
      {
        id: "row-1",
        displayName: "학생 A",
        state: saved,
        status: "in_progress",
        updatedAt: "2026-05-17T00:00:00.000Z",
        submittedAt: null,
      },
      {
        id: "row-2",
        displayName: "코딩 고양이",
        state: submitted,
        status: "completed",
        updatedAt: "2026-05-17T00:02:00.000Z",
        submittedAt: "2026-05-17T00:02:00.000Z",
      },
    ],
  });

  assert.equal(summary.activityTitle, "파이썬 실습실");
  assert.equal(summary.participantCount, 2);
  assert.equal(summary.savedCount, 2);
  assert.equal(summary.submittedCount, 1);
  assert.deepEqual(
    summary.recentSubmissions.map((item) => item.status),
    ["submitted", "saved"],
  );
  assert.equal(JSON.stringify(summary).includes("print('submitted')"), false);
});

test("share activity-state API supports Python own-state save, submit, and reset without server execution", () => {
  const route = read(
    "app",
    "api",
    "v1",
    "share",
    "[code]",
    "activity-state",
    "route.ts",
  );
  const progress = read("lib", "lesson-activities", "progress.ts");
  assert.match(route, /activityType === "python_studio_lite"/);
  assert.match(route, /getOrCreatePythonStudioLiteStateForParticipant/);
  assert.match(route, /updatePythonStudioLiteState/);
  assert.match(route, /parseCodingStudioOperation/);
  assert.match(route, /resolvePublicShareBoard\(code\)/);
  assert.match(progress, /PYTHON_STUDIO_LITE_ACTIVITY_TYPE/);
  assert.match(progress, /buildLesson1PythonStudioLiteConfig/);
  assert.match(progress, /buildLesson2PythonStudioLiteConfig/);
  assert.match(progress, /\.eq\("participant_key_hash", participantKeyHash\)/);
  assert.match(progress, /\.eq\("board_id", params\.boardId\)/);
  assert.match(progress, /reset_to_starter/);
  assert.match(progress, /buildSavedPythonStudioLiteState/);
  assert.match(progress, /markPythonStudioLiteSubmitted/);
  assert.match(progress, /stdout: params\.stdout/);
  assert.match(progress, /stderr: params\.stderr/);
  assert.doesNotMatch(progress, /spawn\(|exec\(|python3|child_process|eval\(/);
  assert.doesNotMatch(route, /runPython|executePython|child_process|python3/);
});

test("Python Studio Lite UI exposes editor, stdin, run/save/submit/reset, and runtime fallback", () => {
  const activity = read(
    "components",
    "lesson-activities",
    "PythonStudioLiteActivity.tsx",
  );
  const shell = read(
    "components",
    "lesson-activities",
    "CodingActivityWorkspace.tsx",
  );
  const panel = read(
    "components",
    "lesson-activities",
    "StudentActivityPanel.tsx",
  );
  const teacher = read(
    "components",
    "lesson-activities",
    "PythonStudioLiteTeacherSummary.tsx",
  );
  assert.match(panel, /python_studio_lite/);
  assert.match(panel, /2단계: 파이썬 첫걸음/);
  assert.match(panel, /2단계: 파이썬 if\/else 실습/);
  assert.match(activity, /activityConfig\?\.title/);
  assert.match(activity, /activityConfig\?\.instruction/);
  assert.match(activity, /미니 미션/);
  assert.match(activity, /CodingActivityWorkspace/);
  assert.match(shell, /max-w-\[1680px\]/);
  assert.match(shell, /data-coding-workspace-shell/);
  assert.match(shell, /넓게 보기/);
  assert.match(shell, /기본 보기/);
  assert.match(shell, /미션 접기/);
  assert.match(activity, /data-testid="coding-workspace-main-grid"/);
  assert.match(activity, /ResizableSplitPane/);
  assert.match(activity, /defaultLeftPercent=\{64\}/);
  assert.match(activity, /storageKey="gomdory:python-studio-lite:split-pane"/);
  assert.match(activity, /lg:min-h-\[420px\]/);
  assert.match(activity, /data-testid="python-studio-action-bar"/);
  assert.match(activity, /missionSteps\.map/);
  assert.match(activity, /challenge\.title/);
  assert.match(activity, /data-testid="python-studio-code-editor"/);
  assert.match(activity, /입력값/);
  assert.match(activity, /실행 결과/);
  assert.match(activity, /준비 중/);
  assert.match(activity, /실행 중/);
  assert.match(activity, /실행 완료/);
  assert.match(activity, /오류 발생/);
  assert.match(
    activity,
    /input\(\)이 나오면 오른쪽 입력값을 줄마다 하나씩 사용해요/,
  );
  assert.match(activity, /실행\s+결과에는 입력한 값도 함께 보여요/);
  assert.match(activity, /data-testid="python-studio-stdout"/);
  assert.match(activity, /data-testid="python-studio-stderr"/);
  assert.match(activity, /<pre/);
  assert.match(activity, /overflow-auto whitespace-pre-wrap break-words/);
  assert.match(activity, /font-mono text-sm leading-relaxed/);
  assert.match(activity, /결과 크게 보기/);
  assert.match(activity, /role="dialog"/);
  assert.match(activity, /aria-modal="true"/);
  assert.doesNotMatch(activity, /dangerouslySetInnerHTML/);
  assert.match(activity, /capPythonStudioLiteOutput/);
  assert.match(activity, /"실행"/);
  assert.match(activity, /저장/);
  assert.match(activity, /제출하기/);
  assert.match(activity, /처음 코드로 되돌리기/);
  assert.match(activity, /파이썬 실행 환경을 준비하는 중…/);
  assert.match(
    activity,
    /파이썬 실행 환경을 불러오지 못했어요\. 코드는 저장할 수 있어요\./,
  );
  assert.match(activity, /다시 시도/);
  assert.match(activity, /RUNTIME_LOAD_TIMEOUT_MS = 20_000/);
  assert.match(activity, /PYTHON_RUN_TIMEOUT_MS = 7_000/);
  assert.match(activity, /new Worker/);
  assert.match(activity, /terminate/);
  assert.match(activity, /window\.confirm/);
  assert.match(teacher, /participantCount/);
  assert.match(teacher, /savedCount/);
  assert.match(teacher, /submittedCount/);
  assert.match(teacher, /학생 화면 열기/);
});

test("Pyodide asset base URL is centralized and can be self-hosted later", () => {
  assert.equal(
    DEFAULT_PYODIDE_BASE_URL,
    "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
  );
  assert.equal(normalizePyodideBaseUrl(undefined), DEFAULT_PYODIDE_BASE_URL);
  assert.equal(
    normalizePyodideBaseUrl("https://assets.gomdory.com/assets/pyodide/vX"),
    "https://assets.gomdory.com/assets/pyodide/vX/",
  );
  assert.equal(
    getPyodideAssetPaths("https://assets.gomdory.com/assets/pyodide/vX")
      .loaderUrl,
    "https://assets.gomdory.com/assets/pyodide/vX/pyodide.js",
  );
});

test("Python worker keeps execution browser-only with input and timeout-friendly messages", () => {
  const worker = read("public", "workers", "python-studio-lite-worker.js");
  assert.match(worker, /importScripts/);
  assert.match(worker, /loadPyodide/);
  assert.match(worker, /setStdin/);
  assert.match(worker, /setStdout/);
  assert.match(worker, /setStderr/);
  assert.match(worker, /createRawTextSink/);
  assert.match(worker, /setStdout\?\.\(\{ raw: stdoutSink\.raw \}\)/);
  assert.match(worker, /setStderr\?\.\(\{ raw: stderrSink\.raw \}\)/);
  assert.match(worker, /runPythonAsync\(code\)/);
  assert.match(worker, /input\(\)에 넣을 입력값이 부족해요/);
  assert.doesNotMatch(
    worker,
    /fetch\(|XMLHttpRequest|child_process|python3|spawn\(/,
  );
});

test("Python worker preserves explicit newline, f-string newline, and blank print output", async () => {
  const plain = await runPythonWorkerMock('print("첫 줄\\n둘째 줄")');
  assert.equal(plain.receivedCode, 'print("첫 줄\\n둘째 줄")');
  assert.deepEqual(plain.messages, [
    {
      type: "run:success",
      id: "test-run",
      stdout: "첫 줄\n둘째 줄\n",
      stderr: "",
    },
  ]);

  const fString = await runPythonWorkerMock('print(f"결과: {1 + 1}\\n완료")');
  assert.equal(fString.receivedCode, 'print(f"결과: {1 + 1}\\n완료")');
  assert.deepEqual(fString.messages, [
    {
      type: "run:success",
      id: "test-run",
      stdout: "결과: 2\n완료\n",
      stderr: "",
    },
  ]);

  const blank = await runPythonWorkerMock('print("A")\nprint()\nprint("B")');
  assert.deepEqual(blank.messages, [
    {
      type: "run:success",
      id: "test-run",
      stdout: "A\n\nB\n",
      stderr: "",
    },
  ]);
});

test("Python worker echoes stdin after prompts and renders runtime errors as plain text", async () => {
  const input = await runPythonWorkerMock(
    'nickname = input("닉네임을 입력하세요: ")\nprint(f"탐험가: {nickname}")',
    "탐험가",
  );
  assert.deepEqual(input.messages, [
    {
      type: "run:success",
      id: "test-run",
      stdout: "닉네임을 입력하세요: 탐험가\n탐험가: 탐험가\n",
      stderr: "",
    },
  ]);

  const error = await runPythonWorkerMock('raise RuntimeError("실패")');
  assert.deepEqual(error.messages, [
    {
      type: "run:error",
      id: "test-run",
      stdout: "",
      stderr: "Traceback line 1\n\nRuntimeError: 실패",
    },
  ]);
});
