export const FIELD_NAMES = {
  boardId: "boardId",
  wallId: "wallId",
  shareCode: "shareCode",
  sessionId: "sessionId",
  fileId: "fileId",
  requestId: "requestId",
  cardId: "cardId",
  classId: "classId",
  token: "token",
  userId: "userId",
} as const;

export const FIELD_RULES = {
  apiNaming: "camelCase",
  dbNaming: "snake_case",
  description: "API/DTO는 camelCase, DB 스키마/row는 snake_case를 사용한다.",
} as const;

type KeyTransformOptions = {
  deep?: boolean;
};

const toCamel = (value: string) =>
  value.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());

const toSnake = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-+/g, "_")
    .toLowerCase();

const transformKeys = (
  input: Record<string, unknown>,
  transformer: (key: string) => string,
  options: KeyTransformOptions = {}
): Record<string, unknown> => {
  const entries = Object.entries(input).map(([key, value]) => {
    if (options.deep && value && typeof value === "object" && !Array.isArray(value)) {
      return [transformer(key), transformKeys(value as Record<string, unknown>, transformer, options)];
    }
    if (options.deep && Array.isArray(value)) {
      return [transformer(key), value.map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return transformKeys(item as Record<string, unknown>, transformer, options);
        }
        return item;
      })];
    }
    return [transformer(key), value];
  });

  return Object.fromEntries(entries);
};

export const toCamelKeys = <T extends Record<string, unknown>>(
  input: T,
  options?: KeyTransformOptions
): Record<string, unknown> => transformKeys(input, toCamel, options);

export const toSnakeKeys = <T extends Record<string, unknown>>(
  input: T,
  options?: KeyTransformOptions
): Record<string, unknown> => transformKeys(input, toSnake, options);

export type FieldName = (typeof FIELD_NAMES)[keyof typeof FIELD_NAMES];
