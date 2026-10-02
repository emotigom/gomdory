import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");

const EXCLUDE_PATTERNS = [
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/coverage/**",
  "**/.turbo/**",
  "**/.git/**",
];

const listSourceFiles = () =>
  ts.sys
    .readDirectory(REPO_ROOT, [".ts", ".tsx"], EXCLUDE_PATTERNS, ["**/*"])
    .filter((file) => !file.endsWith(".d.ts"));

const formatDiagnostic = (diagnostic) => {
  const fileName = diagnostic.file?.fileName ?? "unknown";
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  if (!diagnostic.file || diagnostic.start == null) {
    return `${path.relative(REPO_ROOT, fileName)}:0:0 ${message}`;
  }
  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${path.relative(REPO_ROOT, fileName)}:${line + 1}:${character + 1} ${message}`;
};

const main = () => {
  const files = listSourceFiles();
  const diagnostics = [];

  for (const filePath of files) {
    const content = ts.sys.readFile(filePath);
    if (content == null) continue;
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    diagnostics.push(...sourceFile.parseDiagnostics);
  }

  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) {
      console.error(formatDiagnostic(diagnostic));
    }
    process.exit(1);
  }
};

main();
