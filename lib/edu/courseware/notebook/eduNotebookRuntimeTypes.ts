export type EduNotebookExecutionMode = "pyodide" | "fallback";

export type EduNotebookRunStatus = "idle" | "loading" | "running" | "success" | "error" | "timeout";

export type EduNotebookRunResult = {
  stdout: string;
  stderr: string;
  error?: string;
  elapsedMs?: number;
  status: EduNotebookRunStatus;
};
