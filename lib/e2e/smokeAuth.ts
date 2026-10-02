import "server-only";

import { readEnvString } from "@/lib/server/runtimeEnv";

export type E2ESmokeSecretStatus = {
  expectedSecret: string | undefined;
  providedSecret: string | null;
  hasExpected: boolean;
  hasHeader: boolean;
  secretMatches: boolean;
};

export function readE2ESmokeSecretStatus(request: Request): E2ESmokeSecretStatus {
  const expectedSecret = readEnvString("E2E_SMOKE_SECRET");
  const providedSecret = request.headers.get("x-e2e-secret");
  const hasExpected = Boolean(expectedSecret);
  const hasHeader = Boolean(providedSecret);
  const secretMatches = Boolean(expectedSecret && providedSecret && providedSecret === expectedSecret);

  return {
    expectedSecret,
    providedSecret,
    hasExpected,
    hasHeader,
    secretMatches,
  };
}

export function logE2ESmokeSecretStatus(status: Pick<E2ESmokeSecretStatus, "hasExpected" | "hasHeader" | "secretMatches">) {
  console.log(
    JSON.stringify(
      {
        level: "info",
        stage: "e2e_login_secret_check",
        hasExpected: status.hasExpected,
        hasHeader: status.hasHeader,
        secretMatches: status.secretMatches,
      },
      (_key, value) => (value === undefined ? undefined : value),
    ),
  );
}
