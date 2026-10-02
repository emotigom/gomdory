export const CLASS_CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CLASS_CODE_MIN_LENGTH = 4;
export const CLASS_CODE_MAX_LENGTH = 6;
export const DEFAULT_CLASS_CODE_LENGTH = 4;

export type ClassSummary = {
  id: string;
  title: string;
  short_code: string;
  active_board_id: string | null;
  created_at: string;
};

export type ClassBoardSummary = {
  id: string;
  title: string;
  share_code: string | null;
  share_enabled: boolean;
  created_at: string;
  board_view_type?: string | null;
};

function safeRandomInt(maxExclusive: number): number {
  if (typeof globalThis.crypto !== "undefined" && "getRandomValues" in globalThis.crypto) {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return array[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

export function normalizeClassCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidClassCode(value: string): boolean {
  const normalized = normalizeClassCode(value);
  if (normalized.length < CLASS_CODE_MIN_LENGTH || normalized.length > CLASS_CODE_MAX_LENGTH) {
    return false;
  }
  return [...normalized].every((char) => CLASS_CODE_CHARSET.includes(char));
}

export function generateClassCode(length: number = DEFAULT_CLASS_CODE_LENGTH): string {
  const targetLength = Math.min(CLASS_CODE_MAX_LENGTH, Math.max(CLASS_CODE_MIN_LENGTH, length));
  let result = "";

  while (result.length < targetLength) {
    const index = safeRandomInt(CLASS_CODE_CHARSET.length);
    result += CLASS_CODE_CHARSET[index] ?? "";
  }

  return result;
}

export async function withClassCodeRetries<T>({
  create,
  generate = () => generateClassCode(DEFAULT_CLASS_CODE_LENGTH),
  shouldRetry = (error) =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505",
  maxAttempts = 6,
}: {
  create: (code: string) => Promise<T>;
  generate?: () => string;
  shouldRetry?: (error: unknown) => boolean;
  maxAttempts?: number;
}): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generate();

    try {
      return await create(code);
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("클래스 코드를 생성하지 못했습니다.");
}
