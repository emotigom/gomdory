export const STUDENT_RECORDS_GUEST_DEFAULT_MODEL = "gpt-5.4-nano";
export const STUDENT_RECORDS_GUEST_ALLOWED_MODELS = [STUDENT_RECORDS_GUEST_DEFAULT_MODEL];

function normalizeModelCandidate(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function resolveStudentRecordsGuestModel(env = {}) {
  const requestedModel = normalizeModelCandidate(env.STUDENT_RECORDS_GUEST_MODEL);
  const model = requestedModel ?? STUDENT_RECORDS_GUEST_DEFAULT_MODEL;
  const source = requestedModel ? "environment" : "default";
  if (!STUDENT_RECORDS_GUEST_ALLOWED_MODELS.includes(model)) {
    return { ok: false, code: "student_records_guest_model_not_allowed", requestedModel };
  }
  return { ok: true, model, source };
}
