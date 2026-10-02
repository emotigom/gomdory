export type CoursewareVisualAssetScene = "hero" | "stage" | "cardAccent" | "notebook" | "completion";

export type CoursewareR2VisualAsset = {
  scene: CoursewareVisualAssetScene;
  imageUrl?: string;
  fallbackGradient: string;
};

const VISUAL_BASE = process.env.NEXT_PUBLIC_EDU_VISUAL_ASSET_BASE_URL ?? "";

const makeUrl = (path: string) => (VISUAL_BASE ? `${VISUAL_BASE.replace(/\/$/, "")}/${path}` : undefined);

export const COURSEWARE_R2_VISUAL_ASSETS: Record<CoursewareVisualAssetScene, CoursewareR2VisualAsset> = {
  hero: { scene: "hero", imageUrl: makeUrl("courseware/hero-day.jpg"), fallbackGradient: "linear-gradient(135deg,#312e81 0%,#0f766e 100%)" },
  stage: { scene: "stage", imageUrl: makeUrl("courseware/stage-panel.jpg"), fallbackGradient: "linear-gradient(180deg,#eef2ff 0%,#ecfeff 100%)" },
  cardAccent: { scene: "cardAccent", imageUrl: makeUrl("courseware/card-accent.png"), fallbackGradient: "linear-gradient(90deg,#c7d2fe 0%,#99f6e4 100%)" },
  notebook: { scene: "notebook", imageUrl: makeUrl("courseware/notebook-lab.jpg"), fallbackGradient: "linear-gradient(180deg,#f0fdf4 0%,#ecfeff 100%)" },
  completion: { scene: "completion", imageUrl: makeUrl("courseware/completion.jpg"), fallbackGradient: "linear-gradient(180deg,#ede9fe 0%,#dbeafe 100%)" },
};
