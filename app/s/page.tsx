import JoinByCode from "@/app/_components/JoinByCode";
import { normalizeShareCode } from "@/lib/student/shareCode";
import {
  isQ2B4StudentEntryFixtureEnabled,
  Q2_B4_FIXTURE_AUTHORIZATION_HEADER,
} from "@/lib/q2/browser/studentEntryFixture";
import { headers } from "next/headers";

type StudentEntryPageProps = {
  searchParams?: Promise<{
    code?: string | string[];
    error?: string | string[];
    hint?: string | string[];
    requestId?: string | string[];
    retryable?: string | string[];
  }>;
};

type JoinErrorKind = "code-field" | "form" | undefined;

function resolveJoinErrorMessage(error?: string) {
  if (error === "missing_code") {
    return "공유 코드를 입력해 주세요.";
  }
  if (error === "invalid_code") {
    return "유효하지 않은 공유 코드입니다.";
  }
  if (error === "turnstile_failed") {
    return "보안 확인 시간이 지났습니다. 다시 확인해 주세요.";
  }
  if (error === "class_locked") {
    return "수업이 끝나 입장할 수 없습니다. 선생님께 확인해 주세요.";
  }
  return undefined;
}

function resolveJoinErrorKind(error?: string): JoinErrorKind {
  if (error === "missing_code" || error === "invalid_code") return "code-field";
  if (error === "turnstile_failed" || error === "class_locked") return "form";
  return undefined;
}

export default async function StudentEntryPage({ searchParams }: StudentEntryPageProps) {
  const requestHeaders = await headers();
  const fixtureAuthorized = isQ2B4StudentEntryFixtureEnabled(
    requestHeaders.get(Q2_B4_FIXTURE_AUTHORIZATION_HEADER),
  );
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawCode = Array.isArray(resolvedSearchParams.code) ? resolvedSearchParams.code[0] : resolvedSearchParams.code;
  const error =
    Array.isArray(resolvedSearchParams.error) ? resolvedSearchParams.error[0] : resolvedSearchParams.error;
  const normalizedCode = normalizeShareCode(rawCode ?? "");
  const hint = Array.isArray(resolvedSearchParams.hint)
    ? resolvedSearchParams.hint[0]
    : resolvedSearchParams.hint;
  const requestId = Array.isArray(resolvedSearchParams.requestId)
    ? resolvedSearchParams.requestId[0]
    : resolvedSearchParams.requestId;
  const retryableValue = Array.isArray(resolvedSearchParams.retryable)
    ? resolvedSearchParams.retryable[0]
    : resolvedSearchParams.retryable;
  const retryable = retryableValue === "1";

  return (
    <main
      data-page-marker="share-entry"
      data-testid={fixtureAuthorized ? "student-entry-fixture-authorized" : undefined}
    >
      <JoinByCode
        initialCode={normalizedCode}
        errorMessage={resolveJoinErrorMessage(error)}
        errorKind={resolveJoinErrorKind(error)}
        errorHint={hint}
        requestId={requestId}
        retryable={retryable}
        fixtureTurnstileBypass={fixtureAuthorized}
      />
    </main>
  );
}

