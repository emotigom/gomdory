import { routes } from "@/lib/standards/routes";

export type RootCauseHintKind =
  | "auth_missing"
  | "permission_denied"
  | "rls_recursion_or_policy"
  | "supabase_schema_mismatch"
  | "storage_eventual_consistency"
  | "next_asset_missing"
  | "build_id_mismatch"
  | "host_mismatch_redirect"
  | "rate_limited"
  | "unknown";

export type RootCauseHintConfidence = "low" | "medium" | "high";

export type RootCauseHint = {
  kind: RootCauseHintKind;
  confidence: RootCauseHintConfidence;
  evidence: string[];
  nextSteps: string[];
};

type OpsEvent = {
  stage: string | null;
  code: string | null;
  message: string | null;
  path: string | null;
  method: string | null;
  status: number | null;
};

type RootCauseHintInput = {
  opsEvents: OpsEvent[];
  summary: {
    topStages: Array<{ stage: string; count: number }>;
    topCodes: Array<{ code: string; count: number }>;
  };
};

const MAX_HINTS = 3;
const MAX_EVIDENCE = 3;
const MAX_NEXT_STEPS = 3;
const E2E_LOGIN_PATH = routes.api.v1("e2e", "login");

const normalize = (value: string | null | undefined) => (value ?? "").toLowerCase();

const includesAny = (value: string | null | undefined, keywords: string[]) => {
  const normalized = normalize(value);
  if (!normalized) return false;
  return keywords.some((keyword) => normalized.includes(keyword));
};

const uniq = (values: string[]) => Array.from(new Set(values));

const clampList = (values: string[], max: number) => values.slice(0, max);

const collectEvidence = (values: string[]) => clampList(uniq(values).filter(Boolean), MAX_EVIDENCE);

const collectNextSteps = (values: string[]) => clampList(uniq(values).filter(Boolean), MAX_NEXT_STEPS);

const buildHint = (
  kind: RootCauseHintKind,
  confidence: RootCauseHintConfidence,
  evidence: string[],
  nextSteps: string[],
) => ({
  kind,
  confidence,
  evidence: collectEvidence(evidence),
  nextSteps: collectNextSteps(nextSteps),
});

export const buildRootCauseHints = ({ opsEvents, summary }: RootCauseHintInput): RootCauseHint[] => {
  const hints: Array<{ score: number; hint: RootCauseHint }> = [];

  const statuses = opsEvents.map((event) => event.status).filter((status): status is number => status !== null);
  const codes = opsEvents.map((event) => event.code).filter(Boolean);
  const messages = opsEvents.map((event) => event.message).filter(Boolean);
  const paths = opsEvents.map((event) => event.path).filter(Boolean);
  const stages = opsEvents.map((event) => event.stage).filter(Boolean);

  const hasStatus = (status: number) => statuses.includes(status);
  const anyCode = (keywords: string[]) => codes.some((code) => includesAny(code, keywords));
  const anyMessage = (keywords: string[]) => messages.some((message) => includesAny(message, keywords));
  const anyPath = (keywords: string[]) => paths.some((path) => includesAny(path, keywords));
  const anyStage = (keywords: string[]) => stages.some((stage) => includesAny(stage, keywords));

  const addHint = (score: number, hint: RootCauseHint) => {
    hints.push({ score, hint });
  };

  if (hasStatus(401) && (anyCode(["unauthorized", "auth"]) || anyMessage(["unauthorized", "로그인", "auth"]))) {
    addHint(
      3,
      buildHint(
        "auth_missing",
        "high",
        ["status 401 observed", "message/code includes auth/unauthorized keywords"],
        [
          "Confirm cookies/session in client",
          `Check ${E2E_LOGIN_PATH} success and cookie set`,
          "Verify auth domain (gomdory) used for authenticated calls",
        ],
      ),
    );
  }

  if (hasStatus(403) && (anyMessage(["권한"]) || anyCode(["forbidden"]))) {
    addHint(
      3,
      buildHint(
        "permission_denied",
        "high",
        ["status 403 observed", "message/code indicates permission/forbidden"],
        [
          "Verify boardId/shareCode context is correct",
          "Check membership/owner policy for endpoint",
          "If unexpected, inspect RLS policies related to the table",
        ],
      ),
    );
  }

  if (anyCode(["42p17"]) || anyMessage(["42p17", "infinite recursion"])) {
    addHint(
      3,
      buildHint(
        "rls_recursion_or_policy",
        "high",
        ["code/message indicates 42P17 or infinite recursion"],
        [
          "Inspect RLS policies for recursion (policy -> function -> same table)",
          "Temporarily run query in SQL editor to reproduce",
          "Use drop-before-create pattern in migration",
        ],
      ),
    );
  } else if (anyMessage(["recursion"]) && anyMessage(["policy"])) {
    addHint(
      2,
      buildHint(
        "rls_recursion_or_policy",
        "medium",
        ["message mentions recursion and policy"],
        [
          "Inspect RLS policies for recursion (policy -> function -> same table)",
          "Temporarily run query in SQL editor to reproduce",
          "Use drop-before-create pattern in migration",
        ],
      ),
    );
  }

  if (anyCode(["42p01"]) || anyMessage(["column does not exist", "relation does not exist"])) {
    addHint(
      2,
      buildHint(
        "supabase_schema_mismatch",
        "medium",
        ["message/code indicates missing column or relation"],
        [
          "Verify latest migrations applied to production",
          "Check table existence and migration order",
          "Run supabase db push / verify migration history",
        ],
      ),
    );
  }

  const storageStages = opsEvents.filter((event) => includesAny(event.stage, ["storage", "verify_deleted"]));
  const storageStatuses = new Set(
    storageStages.map((event) => event.status).filter((status): status is number => status !== null),
  );
  if (storageStatuses.has(200) && storageStatuses.has(404)) {
    addHint(
      2,
      buildHint(
        "storage_eventual_consistency",
        "medium",
        ["storage/verify_deleted stages show mixed 200/404"],
        [
          "Add short retry/backoff on verify_deleted",
          "Check R2 cache headers / eventual consistency assumptions",
          "Ensure delete path invalidates any cache",
        ],
      ),
    );
  }

  if (anyPath(["/_next/static/"]) && statuses.some((status) => status >= 404)) {
    addHint(
      3,
      buildHint(
        "next_asset_missing",
        "high",
        ["/_next/static asset path with 404/5xx status"],
        [
          "Check build output contains referenced chunk/css",
          "Verify routing/proxy for /_next/static in Cloudflare",
          "Purge cache and redeploy if mismatch",
        ],
      ),
    );
  }

  if (anyStage(["build_id_mismatch"]) || anyCode(["build_id_mismatch"]) || anyMessage(["build id mismatch"])) {
    addHint(
      3,
      buildHint(
        "build_id_mismatch",
        "high",
        ["stage/code/message indicates build_id_mismatch"],
        [
          "Check deployments for gomdory and gkrry are on same build",
          "Purge cache",
          "Verify env/branch mapping in Cloudflare Pages",
        ],
      ),
    );
  }

  if (anyMessage(["host mismatch"]) || (anyMessage(["redirect"]) && anyMessage(["host"]))) {
    addHint(
      2,
      buildHint(
        "host_mismatch_redirect",
        "medium",
        ["message indicates host mismatch or redirects"],
        [
          "Verify canonical host logic",
          "Ensure public/auth baseUrl selection is correct",
        ],
      ),
    );
  }

  if (hasStatus(429) || anyCode(["rate_limit", "rate limited"]) || anyMessage(["rate_limit", "rate limited"])) {
    addHint(
      hasStatus(429) ? 3 : 2,
      buildHint(
        "rate_limited",
        hasStatus(429) ? "high" : "medium",
        ["rate limit status/code observed"],
        [
          "Check api_rate_limits configuration",
          "Verify client retry policy",
          "Inspect rate_limits logs for requestId",
        ],
      ),
    );
  }

  if (hints.length === 0) {
    addHint(
      1,
      buildHint(
        "unknown",
        "low",
        [
          "no matching rule for status/code/stage",
          summary.topStages[0] ? `topStage: ${summary.topStages[0].stage}` : "topStage unavailable",
        ],
        ["Review opsEvents/auditEvents details for additional clues"],
      ),
    );
  }

  return hints
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.hint)
    .slice(0, MAX_HINTS);
};
