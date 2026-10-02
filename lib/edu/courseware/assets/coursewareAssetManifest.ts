export const COURSEWARE_PUBLIC_ASSETS_BASE_URL = "https://assets.gomdory.com" as const;
export const DAY01_ASSET_VERSION = "v1" as const;
export const DAY01_COURSEWARE_ASSET_ROOT = `edu/courseware/day01/ai-role-studio/${DAY01_ASSET_VERSION}` as const;

export type Day01AssetFormat = "png" | "webp";

export function day01Asset(path: string, format: Day01AssetFormat = "png"): string {
  const normalized = path.replace(/\.(png|webp)$/i, "");
  return `${COURSEWARE_PUBLIC_ASSETS_BASE_URL}/${DAY01_COURSEWARE_ASSET_ROOT}/${normalized}.${format}`;
}

export const DAY01_AI_ROLE_ASSETS = {
  layoutSoftDashboard: day01Asset("layout/day01-soft-dashboard-list-template"),
  layoutDashboardBear: day01Asset("layout/day01-courseware-dashboard-preview-bear"),
  privacyChecklistTemplate: day01Asset("privacy/day01-safety-checklist-template"),
  quizInterfaceTemplate: day01Asset("quiz/day01-quiz-interface-template"),
  voiceAssistantIcon: day01Asset("bingo/icons/voice-assistant-icon"),
  videoRecommendationIcon: day01Asset("bingo/icons/video-recommendation-icon"),
  routeRecommendationIcon: day01Asset("bingo/icons/route-recommendation-icon"),
  techPanelBg: day01Asset("backgrounds/day01-tech-panel-background-blue"),
  softPanelBg: day01Asset("backgrounds/day01-soft-panel-background-peach"),
  collaborationPanelBg: day01Asset("backgrounds/day01-collaboration-panel-background"),
  resultCardTemplate: day01Asset("templates/day01-result-card-template-empty"),
  learningRecordTemplate: day01Asset("templates/day01-learning-record-template-empty"),
  privacyCheckTemplate: day01Asset("templates/day01-privacy-check-template-empty"),
  quizCardTemplate: day01Asset("templates/day01-quiz-card-template-empty"),
  aiBucketBg: day01Asset("roles/buckets/ai-first-bucket-bg"),
  humanBucketBg: day01Asset("roles/buckets/human-first-bucket-bg"),
  togetherBucketBg: day01Asset("roles/buckets/together-bucket-bg"),
  roleCardIcons: day01Asset("roles/icons/role-card-icons-6set"),
  progressStepIcons: day01Asset("progress/icons/step-icons-6set"),
  successIllustration: day01Asset("states/success-complete-illustration"),
  emptyIllustration: day01Asset("states/empty-state-illustration"),
  infoMessageBox: day01Asset("components/info-message-box"),
  warningMessageBox: day01Asset("components/warning-message-box"),
  dragCardTemplate: day01Asset("components/drag-card-template"),
  badgeSet: day01Asset("badges/day01-achievement-badge-set-3types"),
  loadingIllustration: day01Asset("states/loading-illustration"),
  errorIllustration: day01Asset("states/error-illustration"),
} as const;

export type Day01AssetKey = keyof typeof DAY01_AI_ROLE_ASSETS;
