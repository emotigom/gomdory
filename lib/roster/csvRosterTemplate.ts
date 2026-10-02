export type CsvRosterTemplateLanguage = "ko" | "en";

const KO_TEMPLATE = `학급명,역할,표시명,외부ID
1반,학생,탐험가A,S-001
1반,학생,탐험가B,S-002
1반,교사,담당교사,T-001`;

const EN_TEMPLATE = `class_name,role,display_label,external_id
Class 1,student,ExplorerA,S-001
Class 1,student,ExplorerB,S-002
Class 1,teacher,HomeroomTeacher,T-001`;

export function buildPrivacySafeRosterCsvTemplate(language: CsvRosterTemplateLanguage = "ko"): string {
  return language === "en" ? EN_TEMPLATE : KO_TEMPLATE;
}

