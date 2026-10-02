import type { GenerateBatchResponse } from "./contracts";
export function hasExpectedResponseIdentity(response: GenerateBatchResponse, operationId: string, batchId: string): boolean {
  return response.operationId === operationId && response.batchId === batchId;
}
