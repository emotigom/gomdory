import { getLessonById } from "./lessons";
import {
  CODING_STUDIO_PROJECT_SCHEMA_VERSION,
  LESSON_IDS,
  type CodingStudioProject,
  type LessonId,
  type StudioBlockNode,
} from "./types";

function createBaseBlocks(lessonId: LessonId): StudioBlockNode[] {
  if (lessonId === "goal-move") {
    return [
      { id: "start-1", type: "start" },
      { id: "move-1", type: "move", params: { distance: 1 } },
      { id: "move-2", type: "move", params: { distance: 1 } },
      { id: "move-3", type: "move", params: { distance: 1 } },
      { id: "move-4", type: "move", params: { distance: 1 } },
    ];
  }

  if (lessonId === "turn-pivot") {
    return [
      { id: "start-1", type: "start" },
      { id: "move-1", type: "move", params: { distance: 2 } },
      { id: "turn-1", type: "turn", params: { degrees: 45 } },
      { id: "move-2", type: "move", params: { distance: 2 } },
    ];
  }

  if (lessonId === "repeat-route") {
    return [
      { id: "start-1", type: "start" },
      {
        id: "repeat-1",
        type: "repeat",
        params: { count: 2 },
        children: [
          { id: "move-1", type: "move", params: { distance: 1.4 } },
          { id: "turn-1", type: "turn", params: { degrees: 45 } },
        ],
      },
      { id: "move-2", type: "move", params: { distance: 1.2 } },
    ];
  }

  if (lessonId === "sensor-branch") {
    return [
      { id: "start-1", type: "start" },
      {
        id: "if-sensor-1",
        type: "if_sensor",
        children: [{ id: "turn-1", type: "turn", params: { degrees: 45 } }],
      },
      { id: "move-1", type: "move", params: { distance: 1.3 } },
      { id: "move-2", type: "move", params: { distance: 1.3 } },
    ];
  }

  if (lessonId === "strategy-tune") {
    return [
      { id: "start-1", type: "start" },
      {
        id: "repeat-1",
        type: "repeat",
        params: { count: 2 },
        children: [
          { id: "move-1", type: "move", params: { distance: 1.1 } },
          {
            id: "if-sensor-1",
            type: "if_sensor",
            children: [{ id: "turn-1", type: "turn", params: { degrees: 45 } }],
          },
        ],
      },
      { id: "move-2", type: "move", params: { distance: 1.4 } },
    ];
  }

  return [
    { id: "start-1", type: "start" },
    { id: "move-1", type: "move", params: { distance: 1 } },
  ];
}

export function createLessonTemplateProject(lessonId: LessonId): CodingStudioProject {
  return {
    schemaVersion: CODING_STUDIO_PROJECT_SCHEMA_VERSION,
    projectId: `lesson-${lessonId}`,
    title: `${getLessonById(lessonId).title} 템플릿`,
    lessonId,
    blocks: createBaseBlocks(lessonId),
    metadata: {
      updatedAt: new Date(0).toISOString(),
      source: "template",
    },
  };
}

export function parseCodingStudioProject(input: unknown): CodingStudioProject | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<CodingStudioProject>;
  if (candidate.schemaVersion !== CODING_STUDIO_PROJECT_SCHEMA_VERSION) return null;
  if (!candidate.lessonId || !LESSON_IDS.includes(candidate.lessonId)) return null;
  if (!Array.isArray(candidate.blocks)) return null;

  return {
    schemaVersion: CODING_STUDIO_PROJECT_SCHEMA_VERSION,
    projectId: typeof candidate.projectId === "string" ? candidate.projectId : `lesson-${candidate.lessonId}`,
    title: typeof candidate.title === "string" ? candidate.title : createLessonTemplateProject(candidate.lessonId).title,
    lessonId: candidate.lessonId,
    blocks: candidate.blocks,
    metadata: {
      updatedAt:
        candidate.metadata && typeof candidate.metadata.updatedAt === "string"
          ? candidate.metadata.updatedAt
          : new Date(0).toISOString(),
      source: candidate.metadata?.source === "student" ? "student" : "template",
    },
  };
}
