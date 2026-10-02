export type ToolId =
  | "student_write"
  | "questions"
  | "polls"
  | "reactions"
  | "pulse"
  | "presence"
  | "follow";

export const TOOL_DEFS: Array<{
  id: ToolId;
  label: string;
  audience: ("teacher" | "student")[];
  status: "active" | "coming_soon";
}> = [
  {
    id: "student_write",
    label: "학생 작성",
    audience: ["teacher"],
    status: "active",
  },
  {
    id: "questions",
    label: "질문",
    audience: ["teacher", "student"],
    status: "active",
  },
  {
    id: "polls",
    label: "투표",
    audience: ["teacher", "student"],
    status: "active",
  },
  {
    id: "reactions",
    label: "리액션",
    audience: ["teacher", "student"],
    status: "active",
  },
  {
    id: "pulse",
    label: "펄스",
    audience: ["teacher", "student"],
    status: "active",
  },
  {
    id: "presence",
    label: "출석",
    audience: ["teacher"],
    status: "active",
  },
  {
    id: "follow",
    label: "발표/팔로우",
    audience: ["teacher"],
    status: "coming_soon",
  },
];

export const TOOL_IDS = TOOL_DEFS.map((tool) => tool.id);
