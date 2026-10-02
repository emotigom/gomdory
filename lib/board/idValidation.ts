const BOARD_UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && BOARD_UUID_REGEX.test(value);
}

export function isValidBoardId(value: unknown): value is string {
  return isValidUuid(value);
}
