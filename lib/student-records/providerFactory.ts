import "server-only";
import { MockStudentRecordProvider } from "./mockProvider";
import { OpenAiStudentRecordProvider } from "./openAiProvider";
import { StudentRecordsProviderError } from "./providerErrors";
import type { StudentRecordProvider } from "./provider";
import type { ProviderRecordInput, ProviderGeneratedRecord, RecordGenerationOptions } from "./contracts";
import type { StudentRecordsProviderConfig } from "./providerConfig";

class ErrorProvider implements StudentRecordProvider {
  constructor(private readonly error: StudentRecordsProviderError) {}
  async generateBatch(input: { requestId: string; batchId: string; rows: ReadonlyArray<ProviderRecordInput>; options: RecordGenerationOptions }): Promise<ReadonlyArray<ProviderGeneratedRecord>> { void input; throw this.error; }
}
export function createStudentRecordsProvider(config: StudentRecordsProviderConfig, userId?: string): StudentRecordProvider {
  if (config.mode === "disabled") return new ErrorProvider(new StudentRecordsProviderError("PROVIDER_DISABLED"));
  if (config.mode === "mock") return new MockStudentRecordProvider();
  if (config.configurationError || !config.apiKey || !config.model) return new ErrorProvider(new StudentRecordsProviderError("PROVIDER_CONFIGURATION"));
  if (!userId || !config.allowedUserIds.has(userId.toLowerCase())) return new ErrorProvider(new StudentRecordsProviderError("PROVIDER_DISABLED"));
  return new OpenAiStudentRecordProvider({ apiKey: config.apiKey, model: config.model, timeoutMs: config.timeoutMs, maxOutputTokens: config.maxOutputTokens });
}
