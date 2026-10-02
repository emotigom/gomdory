export type TeacherCollectedLinkStatus = "unchecked" | "valid-looking" | "invalid" | "unavailable";

export interface TeacherCollectedPublishedLink {
  id: string;
  labelKo?: string;
  studentDisplayKo?: string;
  shareId?: string;
  publicUrl: string;
  lessonNumber?: number;
  titleKo?: string;
  noteKo?: string;
  addedAt: string;
  status: TeacherCollectedLinkStatus;
}

export interface TeacherCoursewareDashboardState {
  selectedDayNumber: number;
  collectedLinks: TeacherCollectedPublishedLink[];
  updatedAt: string;
  source: "local-teacher-dashboard";
  version: 1;
}
