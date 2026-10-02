export type TemplateId =
  | "elem-check-in"
  | "elem-brainstorm"
  | "elem-exit-ticket"
  | "elem-vocab-wall"
  | "elem-gallery-walk"
  | "mid-debate"
  | "mid-kanban"
  | "mid-science-observation"
  | "mid-math-problem"
  | "common-qna";

export type TemplateCategory =
  | "SEL"
  | "Brainstorm"
  | "Exit"
  | "Vocabulary"
  | "Sharing"
  | "Debate"
  | "Project"
  | "Science"
  | "Math"
  | "QnA";

export type GradeBand = "ELEM" | "MID";

export type TemplateDefinition = {
  id: TemplateId;
  title: string;
  subtitle: string;
  category: TemplateCategory;
  gradeBand: GradeBand;
  durationMin: 5 | 10 | 40;
  tags: string[];
  preview: {
    bullets: string[];
    screenshot?: string;
  };
  payload: {
    board: {
      title: string;
      description?: string;
      themeKey?: string;
      initialColumns?: string[];
    };
    starterCards?: Array<{ column?: string; text: string; kind?: "prompt" | "instruction" }>;
    features?: { reactions?: boolean; quickPoll?: boolean; spotlight?: boolean };
    presets?: { name: string; steps?: string[] }[];
  };
};
