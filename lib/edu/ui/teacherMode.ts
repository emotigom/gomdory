export type TeacherModeInput = {
  teacherUiEnabled: boolean;
  teacherFromQuery: boolean;
  storedFlag: boolean;
};

export function resolveTeacherMode(input: TeacherModeInput): boolean {
  if (!input.teacherUiEnabled) {
    return false;
  }
  return input.teacherFromQuery || input.storedFlag;
}
