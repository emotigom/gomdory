import "server-only";
import { OpenAiStudentRecordProvider } from "./openAiProvider";
import { StudentRecordsProviderError } from "./providerErrors";
import type { StudentRecordProvider } from "./provider";
import type { ProviderRecordInput, ProviderGeneratedRecord, RecordGenerationOptions } from "./contracts";
import type { StudentRecordsGuestConfig } from "./guestAccess";

class ErrorProvider implements StudentRecordProvider {
  constructor(private readonly error: StudentRecordsProviderError) {}
  async generateBatch(input: { requestId: string; batchId: string; rows: ReadonlyArray<ProviderRecordInput>; options: RecordGenerationOptions }): Promise<ReadonlyArray<ProviderGeneratedRecord>> { void input; throw this.error; }
}

export function createStudentRecordsGuestProvider(config: StudentRecordsGuestConfig, guestVerified: boolean): StudentRecordProvider {
  if (!guestVerified || !config.enabled) return new ErrorProvider(new StudentRecordsProviderError("PROVIDER_DISABLED"));
  if (config.configurationError || !config.apiKey || !config.model) return new ErrorProvider(new StudentRecordsProviderError("PROVIDER_CONFIGURATION"));
  return new OpenAiStudentRecordProvider({ apiKey: config.apiKey, model: config.model, timeoutMs: config.timeoutMs, maxOutputTokens: config.maxOutputTokens });
}
