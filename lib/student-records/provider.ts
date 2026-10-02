import "server-only";
import type { ProviderGeneratedRecord, ProviderRecordInput, RecordGenerationOptions } from "./contracts";

export interface StudentRecordProvider {
  generateBatch(input: { requestId: string; batchId: string; rows: ReadonlyArray<ProviderRecordInput>; options: RecordGenerationOptions }): Promise<ReadonlyArray<ProviderGeneratedRecord>>;
}
