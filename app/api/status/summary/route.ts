import { NextResponse } from "next/server";

import { hasExternalProviderIssue, loginHeadline, loginSubheadline, statusLabel, statusTone, summarizeOverallLevel } from "@/lib/status/statusFormatting";
import { probeAppResponsiveness, probeAuthAvailability, probeDatabaseReachability } from "@/lib/status/healthProbes";
import type { ServiceStatusItem, StatusIncidentItem, StatusLevel, StatusSnapshot, TelemetryStat } from "@/lib/status/statusTypes";

const SUPABASE_STATUS_SUMMARY_URL = "https://status.supabase.com/api/v2/summary.json";
const CLOUDFLARE_STATUS_SUMMARY_URL = "https://www.cloudflarestatus.com/api/v2/summary.json";
const STATUS_TIMEOUT_MS = 3_500;

export const dynamic = "force-dynamic";

type StatuspageSummary = {
  status?: { indicator?: string; description?: string };
  incidents?: Array<{ id?: string; name?: string; status?: string; impact?: string; shortlink?: string; updated_at?: string; created_at?: string }>;
};

function mapIndicatorToLevel(indicator: unknown): StatusLevel {
  switch (indicator) {
    case "none":
      return "operational";
    case "minor":
      return "degraded";
    case "major":
      return "partial_outage";
    case "critical":
      return "major_outage";
    case "maintenance":
      return "maintenance";
    default:
      return "unknown";
  }
}

async function fetchSummary(url: string): Promise<StatuspageSummary | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal, next: { revalidate: 60 } });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return null;
    return payload as StatuspageSummary;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function toIncidents(source: string, summary: StatuspageSummary | null): StatusIncidentItem[] {
  if (!summary?.incidents?.length) return [];
  return summary.incidents.slice(0, 3).map((incident, index) => ({
    id: incident.id ?? `${source}-${index}`,
    title: incident.name ?? `${source} 이슈`,
    level: mapIndicatorToLevel(incident.impact),
    startedAt: incident.created_at,
    updatedAt: incident.updated_at,
    href: incident.shortlink,
    source,
  }));
}

function telemetryTone(level: StatusLevel): TelemetryStat["tone"] {
  return statusTone(level);
}

export async function GET() {
  try {
    const [authResult, dbResult, appResult, supabaseResult, cloudflareResult] = await Promise.allSettled([
      probeAuthAvailability(),
      probeDatabaseReachability(),
      probeAppResponsiveness(),
      fetchSummary(SUPABASE_STATUS_SUMMARY_URL),
      fetchSummary(CLOUDFLARE_STATUS_SUMMARY_URL),
    ]);

    const now = new Date().toISOString();
    const authProbe = authResult.status === "fulfilled" ? authResult.value : null;
    const dbProbe = dbResult.status === "fulfilled" ? dbResult.value : null;
    const appProbe = appResult.status === "fulfilled" ? appResult.value : null;
    const supabaseSummary = supabaseResult.status === "fulfilled" ? supabaseResult.value : null;
    const cloudflareSummary = cloudflareResult.status === "fulfilled" ? cloudflareResult.value : null;

    const services: ServiceStatusItem[] = [
      {
        id: "gomdory-auth",
        label: "Gomdory Auth",
        level: authProbe?.level ?? "unknown",
        message: authProbe?.message ?? "인증 상태 확인중",
        updatedAt: authProbe?.checkedAt ?? now,
        source: "gomdory",
        role: "core",
        category: "primary-service",
      },
      {
        id: "gomdory-db",
        label: "Gomdory Database",
        level: dbProbe?.level ?? "unknown",
        message: dbProbe?.message ?? "데이터베이스 상태 확인중",
        updatedAt: dbProbe?.checkedAt ?? now,
        source: "gomdory",
        role: "core",
        category: "primary-service",
      },
      {
        id: "gomdory-api",
        label: "Gomdory API",
        level: appProbe?.level ?? "unknown",
        message: appProbe?.message ?? "내부 API 상태 확인중",
        updatedAt: appProbe?.checkedAt ?? now,
        source: "gomdory",
        role: "core",
        category: "primary-service",
      },
      {
        id: "supabase-provider",
        label: "Supabase Provider",
        level: mapIndicatorToLevel(supabaseSummary?.status?.indicator),
        message: supabaseSummary?.status?.description ?? "외부 인프라 공개 상태 확인중",
        updatedAt: now,
        href: "https://status.supabase.com",
        source: "supabase",
        role: "external",
        category: "external-infrastructure",
      },
      {
        id: "cloudflare-provider",
        label: "Cloudflare Provider",
        level: mapIndicatorToLevel(cloudflareSummary?.status?.indicator),
        message: cloudflareSummary?.status?.description ?? "외부 인프라 공개 상태 확인중",
        updatedAt: now,
        href: "https://www.cloudflarestatus.com",
        source: "cloudflare",
        role: "external",
        category: "external-infrastructure",
      },
    ];

    const incidents = [...toIncidents("supabase", supabaseSummary), ...toIncidents("cloudflare", cloudflareSummary)].slice(0, 4);
    const overallLevel = summarizeOverallLevel(services);
    const externalIssue = hasExternalProviderIssue(services);
    const telemetry: TelemetryStat[] = [
      { id: "auth", label: "인증", value: statusLabel(services[0].level), tone: telemetryTone(services[0].level) },
      { id: "database", label: "데이터베이스", value: statusLabel(services[1].level), tone: telemetryTone(services[1].level) },
      { id: "api", label: "내부 API", value: statusLabel(services[2].level), tone: telemetryTone(services[2].level) },
      { id: "external", label: "외부 인프라", value: externalIssue ? "모니터링 중" : "정상", tone: externalIssue ? "warn" : "good" },
    ];

    const snapshot: StatusSnapshot = {
      overallLevel,
      overallLabel: statusLabel(overallLevel),
      headline: loginHeadline(overallLevel, services),
      subheadline: loginSubheadline(overallLevel, services),
      services,
      incidents,
      telemetry,
      updatedAt: now,
    };

    return NextResponse.json(snapshot, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    const now = new Date().toISOString();
    const fallback: StatusSnapshot = {
      overallLevel: "unknown",
      overallLabel: statusLabel("unknown"),
      headline: "로그인 서비스 확인중",
      subheadline: "상태 정보를 일시적으로 확인할 수 없습니다.",
      services: [
        { id: "gomdory-app", label: "Gomdory App", level: "unknown", message: "상태 정보를 일시적으로 확인할 수 없습니다.", updatedAt: now, role: "core" },
      ],
      incidents: [],
      telemetry: [{ id: "sync", label: "상태 동기화", value: statusLabel("unknown"), tone: "neutral" }],
      updatedAt: now,
    };
    return NextResponse.json(fallback, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } });
  }
}
