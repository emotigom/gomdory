import "server-only";

export const studentRecordResponseFormat = { type: "json_schema", name: "student_record_batch", strict: true, schema: { type: "object", additionalProperties: false, required: ["results"], properties: { results: { type: "array", minItems: 1, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["rowId", "generatedText"], properties: { rowId: { type: "string", minLength: 8, maxLength: 128 }, generatedText: { type: "string", minLength: 1, maxLength: 2000 } } } } } } } as const;

export function extractCompletedStructuredText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const response = body as Record<string, unknown>;
  if (response.status !== "completed" || response.error != null || response.incomplete_details != null || !Array.isArray(response.output) || response.output.length !== 1) return null;
  const item = response.output[0]; if (!item || typeof item !== "object") return null;
  const content = (item as Record<string, unknown>).content;
  if (!Array.isArray(content) || content.length !== 1) return null;
  const part = content[0]; if (!part || typeof part !== "object") return null;
  const data = part as Record<string, unknown>;
  return data.type === "output_text" && typeof data.text === "string" && !data.text.includes("```") ? data.text : null;
}
