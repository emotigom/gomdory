import type { TeacherUiPrefsPatch } from "@/lib/teacherPrefs/schema";

export type DashboardLayoutTemplate = {
  id: string;
  name: string;
  icon: "balanced" | "dense" | "spacious" | "icon" | "minimal" | "classroom" | "creator";
  recommendation: string;
  badges: string[];
  tokenPreset: TeacherUiPrefsPatch;
};

export const DASHBOARD_LAYOUT_TEMPLATES: DashboardLayoutTemplate[] = [
  {
    id: "balanced",
    name: "Balanced",
    icon: "balanced",
    recommendation: "처음 시작하는 수업 운영",
    badges: ["📘 수업용", "🟦 균형형"],
    tokenPreset: { density: "comfortable", baseFontSize: 16, fontFamily: "suit", dashboardCardRadius: 14, dashboardCardShadow: "soft" },
  },
  {
    id: "dense",
    name: "Dense",
    icon: "dense",
    recommendation: "정보를 한 화면에 많이 배치",
    badges: ["📊 밀도높음", "⚡ 빠른 스캔"],
    tokenPreset: { density: "compact", baseFontSize: 14, fontFamily: "pretendard", dashboardCardRadius: 10, dashboardCardShadow: "none" },
  },
  {
    id: "spacious",
    name: "Spacious",
    icon: "spacious",
    recommendation: "발표/시연 중심의 여유 레이아웃",
    badges: ["🖼️ 작품전시", "👀 가독성최대"],
    tokenPreset: { density: "spacious", baseFontSize: 18, fontFamily: "notoSansKr", dashboardCardRadius: 20, dashboardCardShadow: "soft" },
  },
  {
    id: "icon-led",
    name: "Icon-led",
    icon: "icon",
    recommendation: "아이콘 중심으로 빠른 상태 파악",
    badges: ["🔎 빠른인지", "🧭 상태중심"],
    tokenPreset: { density: "comfortable", baseFontSize: 15, fontFamily: "system", dashboardCardRadius: 12, accentColor: "#0ea5e9" },
  },
  {
    id: "minimal",
    name: "Minimal",
    icon: "minimal",
    recommendation: "잡음을 줄이고 핵심만 표시",
    badges: ["🧼 미니멀", "📖 집중읽기"],
    tokenPreset: { density: "compact", baseFontSize: 15, fontFamily: "suit", dashboardCardRadius: 8, dashboardCardShadow: "none" },
  },
  {
    id: "classroom",
    name: "Classroom",
    icon: "classroom",
    recommendation: "교실 운영 카드 분할에 최적화",
    badges: ["🏫 수업용", "✅ 운영안정"],
    tokenPreset: { density: "comfortable", baseFontSize: 16, fontFamily: "notoSansKr", dashboardCardRadius: 12, accentColor: "#2563eb" },
  },
  {
    id: "creator",
    name: "Creator",
    icon: "creator",
    recommendation: "포트폴리오/작품 소개 강조",
    badges: ["🎨 작품전시", "✨ 하이라이트"],
    tokenPreset: { density: "spacious", baseFontSize: 17, fontFamily: "pretendard", dashboardCardRadius: 18, accentColor: "#8b5cf6" },
  },
];

export function getDashboardLayoutTemplate(templateId: string) {
  return DASHBOARD_LAYOUT_TEMPLATES.find((template) => template.id === templateId) ?? null;
}
