import { getUploadErrorDiagnostics, type UploadErrorDiagnostics } from "@/lib/uploads/uploadErrors";

export type UploadTaskState = "pending" | "uploading" | "committed" | "failed";

export type UploadTask = {
  id: string;
  file: File;
  state: UploadTaskState;
  error?: string;
  errorDiagnostics?: UploadErrorDiagnostics;
  abortController?: AbortController;
};

const defaultIdFactory = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function enqueue(
  tasks: UploadTask[],
  files: File[],
  idFactory: () => string = defaultIdFactory,
): UploadTask[] {
  if (!files.length) return tasks;
  const nextTasks = files.map((file) => ({
    id: idFactory(),
    file,
    state: "pending" as const,
  }));
  return [...tasks, ...nextTasks];
}

export async function startNext(
  tasks: UploadTask[],
  upload: (task: UploadTask, signal: AbortSignal) => Promise<void>,
  onChange?: (tasks: UploadTask[]) => void,
): Promise<UploadTask[]> {
  const pendingTask = tasks.find((task) => task.state === "pending");
  if (!pendingTask) return tasks;

  const controller = new AbortController();
  let nextTasks = tasks.map((task) =>
    task.id === pendingTask.id
      ? {
          ...task,
          state: "uploading" as const,
          error: undefined,
          errorDiagnostics: undefined,
          abortController: controller,
        }
      : task,
  );
  onChange?.(nextTasks);

  try {
    const uploadingTask = nextTasks.find((task) => task.id === pendingTask.id);
    if (!uploadingTask) {
      return nextTasks;
    }
    await upload(uploadingTask, controller.signal);
    nextTasks = nextTasks.map((task) =>
      task.id === pendingTask.id
        ? { ...task, state: "committed" as const, error: undefined, abortController: undefined }
        : task,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error && error.name === "AbortError"
        ? "업로드가 취소되었습니다."
        : error instanceof Error
          ? error.message
          : "첨부 업로드에 실패했습니다.";
    const errorDiagnostics = getUploadErrorDiagnostics(error);
    nextTasks = nextTasks.map((task) =>
      task.id === pendingTask.id
        ? {
            ...task,
            state: "failed" as const,
            error: errorMessage,
            errorDiagnostics,
            abortController: undefined,
          }
        : task,
    );
  }

  onChange?.(nextTasks);
  return nextTasks;
}

export function cancelTask(tasks: UploadTask[], taskId: string): UploadTask[] {
  return tasks.map((task) => {
    if (task.id !== taskId) return task;

    if (task.state === "uploading" && task.abortController) {
      task.abortController.abort();
    }

    if (task.state === "committed") {
      return task;
    }

    return {
      ...task,
      state: "failed",
      error: "업로드가 취소되었습니다.",
      errorDiagnostics: undefined,
      abortController: undefined,
    };
  });
}

export function retryTask(tasks: UploadTask[], taskId: string): UploadTask[] {
  return tasks.map((task) =>
    task.id === taskId && task.state === "failed"
      ? {
          ...task,
          state: "pending",
          error: undefined,
          errorDiagnostics: undefined,
          abortController: undefined,
        }
      : task,
  );
}
