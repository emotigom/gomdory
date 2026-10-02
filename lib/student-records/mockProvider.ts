import "server-only";
import type { ProviderGeneratedRecord, ProviderRecordInput, RecordGenerationOptions } from "./contracts";
import type { StudentRecordProvider } from "./provider";

function makeText(row: ProviderRecordInput, options: RecordGenerationOptions): string {
  const activity = row.activity.trim(); const strength = row.strength.trim(); const attitude = row.attitude.trim(); const observation = row.observation.trim();
  const type = options.recordType === "behavior-summary" ? "행동 특성" : options.recordType === "autonomous-activity" ? "자율 활동" : "교과 활동";
  const hash = [...row.rowId].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 7);
  const verbs = options.tone === "growth" ? ["발전 가능성을 보임", "성장을 이어 감"] : options.tone === "objective" ? ["관찰됨", "확인됨"] : ["참여함", "임함"];
  const detail = options.targetLength < 150 ? "short" : options.targetLength < 350 ? "medium" : "long";
  const firstEvidence = [activity && `${type} 관련 활동에서 ${activity}`, detail !== "short" && attitude && `${attitude} 태도로`].filter(Boolean);
  const first = firstEvidence.length ? `${firstEvidence.join(", ")} ${verbs[hash % verbs.length]}.` : `${type} 관련 관찰에 참여함.`;
  const evidence = detail === "short" ? [strength || observation].filter(Boolean) : detail === "medium" ? [strength && `강점으로 ${strength}`, observation].filter(Boolean).slice(0, 2) : [activity && `활동 내용 ${activity}`, strength && `강점 ${strength}`, attitude && `참여 태도 ${attitude}`, observation && `관찰 내용 ${observation}`].filter(Boolean);
  const closing = ["기록함.", "정리함."][Math.floor(hash / 2) % 2];
  return `${first} ${evidence.length ? `${evidence.join(", ")} 내용을 바탕으로 ${closing}` : "입력된 관찰 내용을 바탕으로 기록함."}`;
}
export class MockStudentRecordProvider implements StudentRecordProvider {
  async generateBatch(input: { requestId: string; batchId: string; rows: ReadonlyArray<ProviderRecordInput>; options: RecordGenerationOptions }): Promise<ReadonlyArray<ProviderGeneratedRecord>> {
    return input.rows.map((row) => ({ rowId: row.rowId, generatedText: makeText(row, input.options) }));
  }
}
