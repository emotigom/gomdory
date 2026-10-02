const ENDING_PATTERNS = /(바꿔줘요|바꿔주세요|바꿔줘|바꿔|해주세요|해줘요|해줘|할래요|이에요|예요)\s*$/;
const LEADING_FILLERS = /^(나의|내|저의|저|나)\s+/;

export const normalizeStudentText = (input: string): string => {
  let text = input ?? "";
  text = text.replace(/\r?\n+/g, " ");
  text = text.replace(/[“”"‘’]/g, "");
  text = text.trim();
  if (!text) return "";

  text = text.replace(/[\/·•]/g, ",");
  text = text.replace(/[，、]/g, ",");
  text = text.replace(/\s*그리고\s*/g, ", ");
  text = text.replace(/\s*,\s*/g, ", ");
  text = text.replace(/[^\p{L}\p{N}\s,]/gu, " ");
  text = text.replace(/\s+/g, " ");
  text = text.replace(LEADING_FILLERS, "");
  text = text.replace(ENDING_PATTERNS, "");
  text = text.replace(/[.!?]+$/g, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
};
