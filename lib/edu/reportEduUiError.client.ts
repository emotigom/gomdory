import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";

export type EduUiErrorInput = {
  message: string;
  slug?: string | null;
  lessonId?: number | null;
};

const clamp = (value: string, maxLength: number) =>
  value.length > maxLength ? value.slice(0, maxLength) : value;

export async function reportEduUiError({ message, slug, lessonId }: EduUiErrorInput) {
  try {
    await apiFetch(apiV1Path("edu/ui-error"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: clamp(message, 500),
        slug: slug ? clamp(slug, 140) : null,
        lessonId: typeof lessonId === "number" ? lessonId : null,
      }),
    });
  } catch {
    return;
  }
}
