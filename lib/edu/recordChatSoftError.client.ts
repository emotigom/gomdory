import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";

export type ChatSoftErrorInput = {
  stage: string;
  error?: unknown;
  messageCount?: number;
  keyName?: string;
  lessonId?: number | null;
  slug?: string | null;
};

const clamp = (value: string, maxLength: number) =>
  value.length > maxLength ? value.slice(0, maxLength) : value;

const getErrorName = (error: unknown) => {
  if (error instanceof Error && error.name) {
    return error.name;
  }
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  return "UnknownError";
};

export async function recordChatSoftError({
  stage,
  error,
  messageCount,
  keyName,
  lessonId,
  slug,
}: ChatSoftErrorInput) {
  const errorName = error ? getErrorName(error) : undefined;
  const meta = {
    stage,
    ...(typeof messageCount === "number" ? { messageCount } : {}),
    ...(keyName ? { keyName } : {}),
    ...(errorName ? { errorName } : {}),
  };
  const payload = {
    message: clamp(`edu_chat_soft_error:${stage} ${JSON.stringify(meta)}`, 500),
    slug: slug ? clamp(slug, 140) : null,
    lessonId: typeof lessonId === "number" ? lessonId : null,
  };

  try {
    await apiFetch(apiV1Path("edu/ui-error"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (sendError) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[edu] chat soft error", {
        ...meta,
        sendErrorName: getErrorName(sendError),
      });
    }
  }
}
