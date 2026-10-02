import type { ServiceStatusItem, StatusLevel } from "./statusTypes";

const STATUS_LABELS: Record<StatusLevel, string> = {
  operational: "정상",
  degraded: "성능 저하",
  partial_outage: "부분 장애",
  major_outage: "장애",
  maintenance: "점검중",
  unknown: "확인중",
};

const STATUS_PRIORITY: Record<StatusLevel, number> = {
  operational: 0,
  unknown: 1,
  maintenance: 2,
  degraded: 3,
  partial_outage: 4,
  major_outage: 5,
};

export function statusLabel(level: StatusLevel): string {
  return STATUS_LABELS[level];
}

export function statusTone(level: StatusLevel): "good" | "warn" | "danger" | "neutral" {
  if (level === "operational") return "good";
  if (level === "degraded" || level === "maintenance") return "warn";
  if (level === "partial_outage" || level === "major_outage") return "danger";
  return "neutral";
}

function worstLevel(services: ServiceStatusItem[]): StatusLevel {
  if (services.length === 0) return "unknown";

  return services.reduce<StatusLevel>((current, service) => {
    return STATUS_PRIORITY[service.level] > STATUS_PRIORITY[current] ? service.level : current;
  }, "operational");
}

export function summarizeOverallLevel(services: ServiceStatusItem[]): StatusLevel {
  const coreServices = services.filter((service) => service.role === "core");
  return worstLevel(coreServices.length > 0 ? coreServices : services);
}

export function hasExternalProviderIssue(services: ServiceStatusItem[]): boolean {
  return services.some((service) => service.role === "external" && STATUS_PRIORITY[service.level] > STATUS_PRIORITY.operational);
}

export function loginHeadline(overallLevel: StatusLevel, services: ServiceStatusItem[]): string {
  if (overallLevel === "operational") {
    return hasExternalProviderIssue(services) ? "로그인 서비스 정상" : "인증 시스템 정상";
  }

  if (overallLevel === "degraded" || overallLevel === "maintenance") return "로그인 서비스 확인 필요";
  if (overallLevel === "partial_outage" || overallLevel === "major_outage") return "로그인 서비스 장애";
  return "로그인 서비스 확인중";
}

export function loginSubheadline(overallLevel: StatusLevel, services: ServiceStatusItem[]): string {
  if (overallLevel === "operational" && hasExternalProviderIssue(services)) {
    return "외부 인프라 상태 모니터링 중";
  }

  if (overallLevel === "operational") return "핵심 인증 경로가 정상 응답 중입니다.";
  return "Gomdory 인증·데이터베이스·API 상태를 우선 확인하고 있습니다.";
}
