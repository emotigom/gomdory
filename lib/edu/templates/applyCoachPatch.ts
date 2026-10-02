import type { WorkspaceFile } from "@/app/edu/_components/Workspace";

export type ReplaceCommand = {
  op: "replace";
  find: string;
  replace: string;
  all?: boolean;
};

export type CoachPatchPayload = {
  htmlPatch?: string | ReplaceCommand | ReplaceCommand[] | null;
  cssPatch?: string | ReplaceCommand | ReplaceCommand[] | null;
};

export type CoachPatchApplyResult = {
  files: Record<string, WorkspaceFile>;
  changed: boolean;
  warnings: string[];
};

const SCRIPT_TAG_REGEX = /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const IMPORT_RULE_REGEX = /@import\s+/gi;

const applyReplaceCommands = (source: string, patch: ReplaceCommand | ReplaceCommand[]) => {
  const commands = Array.isArray(patch) ? patch : [patch];
  return commands.reduce((acc, command) => {
    if (command.op !== "replace" || !command.find) return acc;
    if (command.all) {
      return acc.split(command.find).join(command.replace ?? "");
    }
    return acc.replace(command.find, command.replace ?? "");
  }, source);
};

const applyPatch = (source: string, patch: CoachPatchPayload["htmlPatch"]) => {
  if (typeof patch === "string") return patch;
  if (!patch) return source;
  return applyReplaceCommands(source, patch);
};

export const applyCoachPatchPayload = (
  files: Record<string, WorkspaceFile>,
  payload: CoachPatchPayload,
): CoachPatchApplyResult => {
  const warnings: string[] = [];
  const htmlCurrent = files["index.html"]?.content ?? "";
  const cssCurrent = files["style.css"]?.content ?? "";

  let nextHtml = applyPatch(htmlCurrent, payload.htmlPatch);
  let nextCss = applyPatch(cssCurrent, payload.cssPatch);

  if (SCRIPT_TAG_REGEX.test(nextHtml)) {
    warnings.push("html_script_removed");
    nextHtml = nextHtml.replace(SCRIPT_TAG_REGEX, "");
  }
  if (IMPORT_RULE_REGEX.test(nextCss)) {
    warnings.push("css_import_removed");
    nextCss = nextCss.replace(/@import[^;]+;?/gi, "");
  }

  const changed = nextHtml !== htmlCurrent || nextCss !== cssCurrent;
  if (!changed) {
    return { files, changed: false, warnings };
  }

  return {
    changed: true,
    warnings,
    files: {
      ...files,
      "index.html": {
        contentType: files["index.html"]?.contentType ?? "text/html",
        content: nextHtml,
      },
      "style.css": {
        contentType: files["style.css"]?.contentType ?? "text/css",
        content: nextCss,
      },
    },
  };
};
