export type StatusLevel =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance"
  | "unknown";

export type ServiceStatusRole = "core" | "external" | "informational";

export type ServiceStatusItem = {
  id: string;
  label: string;
  level: StatusLevel;
  message?: string;
  updatedAt?: string;
  href?: string;
  source?: string;
  role?: ServiceStatusRole;
  category?: string;
};

export type StatusIncidentItem = {
  id: string;
  title: string;
  level: StatusLevel;
  startedAt?: string;
  updatedAt?: string;
  href?: string;
  source?: string;
};

export type TelemetryStat = {
  id: string;
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn" | "danger";
};

export type StatusSnapshot = {
  overallLevel: StatusLevel;
  overallLabel: string;
  headline?: string;
  subheadline?: string;
  services: ServiceStatusItem[];
  incidents: StatusIncidentItem[];
  telemetry: TelemetryStat[];
  updatedAt: string;
};
