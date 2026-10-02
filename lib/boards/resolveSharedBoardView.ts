import { normalizeStudentView, parseStudentView, type StudentView } from "@/lib/student/view";

export type SharedBoardView = StudentView;

export const normalizeSharedBoardView = (value?: string | null): SharedBoardView | null => {
  if (!value) return null;
  return parseStudentView(value);
};

export const resolveSharedBoardView = (
  viewParam?: string | null,
  serverDefaultView?: string | null,
): SharedBoardView => {
  if (viewParam) {
    return normalizeStudentView(viewParam);
  }
  if (serverDefaultView) {
    return normalizeStudentView(serverDefaultView);
  }
  return "wall";
};
