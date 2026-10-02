import type { EduNotebookExecutionMode, EduNotebookRunResult } from "@/lib/edu/courseware/notebook/eduNotebookRuntimeTypes";

const EXECUTION_FLAG = "NEXT_PUBLIC_EDU_NOTEBOOK_EXECUTION_V1";

const FALLBACK_MESSAGE = "이 브라우저에서는 실행 준비가 되지 않았어요. 예시 결과로 확인해 주세요.";

export class EduNotebookRunner {
  readonly mode: EduNotebookExecutionMode;

  constructor() {
    this.mode = process.env[EXECUTION_FLAG] === "true" ? "pyodide" : "fallback";
  }

  isExecutionAvailable(): boolean {
    return this.mode === "pyodide";
  }

  async runCode(code: string): Promise<EduNotebookRunResult> {
    void code;
    if (!this.isExecutionAvailable()) {
      return { status: "error", stdout: "", stderr: "", error: FALLBACK_MESSAGE };
    }

    return {
      status: "error",
      stdout: "",
      stderr: "",
      error: "실행 엔진은 현재 빌드에서 비활성화되어 있어요. 기능 플래그와 런타임 자산을 확인해 주세요.",
    };
  }

  stop(): EduNotebookRunResult {
    return {
      status: "timeout",
      stdout: "",
      stderr: "",
      error: "코드가 너무 오래 실행되어 멈췄어요. 반복문을 확인해 주세요.",
    };
  }

  dispose() {
    // no-op: fallback runner keeps no resources.
  }
}

export const eduNotebookFallbackMessage = FALLBACK_MESSAGE;
