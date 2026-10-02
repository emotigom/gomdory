export type EduNotebookCell = {
  id: string;
  type: "markdown" | "code";
  content: string;
  starterCode?: string;
  expectedOutputText?: string;
  teacherNote?: string;
  readOnly?: boolean;
};

export type EduMiniNotebook = {
  title: string;
  studentIntro: string;
  cells: EduNotebookCell[];
  teacherNotes?: string;
};
