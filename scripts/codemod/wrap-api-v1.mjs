import path from "path";
import { fileURLToPath } from "url";
import { Node, Project, SyntaxKind } from "ts-morph";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const PATH_TYPES_IMPORT = "@/lib/standards/pathTypes";
const API_V1_TOKEN = "/api/v1/";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const check = args.includes("--check");
  const json = args.includes("--json");
  let maxFiles = 20;
  const include = [];
  const exclude = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--include") {
      include.push(args[i + 1]);
      i += 1;
    } else if (arg === "--exclude") {
      exclude.push(args[i + 1]);
      i += 1;
    } else if (arg === "--max-files") {
      const parsed = Number.parseInt(args[i + 1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        maxFiles = parsed;
      }
      i += 1;
    } else if (arg.startsWith("--max-files=")) {
      const parsed = Number.parseInt(arg.split("=")[1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        maxFiles = parsed;
      }
    }
  }

  return {
    apply: apply && !check,
    check,
    dryRun: !apply,
    json,
    maxFiles,
    include: include.filter(Boolean),
    exclude: exclude.filter(Boolean),
  };
};

const normalizePath = (value) => value.split(path.sep).join("/");

const hasGlobChars = (pattern) => /[*?[\]]/.test(pattern);

const globToRegex = (pattern) => {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
  const withGlob = escaped
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*")
    .replace(/\\\?/g, ".");
  return new RegExp(`^${withGlob}$`);
};

const matchesPattern = (relPath, pattern) => {
  if (!pattern) return true;
  const normalizedPattern = normalizePath(pattern);
  if (!hasGlobChars(normalizedPattern)) {
    return relPath.startsWith(normalizedPattern);
  }
  return globToRegex(normalizedPattern).test(relPath);
};

const shouldIncludeFile = (relPath, include, exclude) => {
  const includeMatch = include.length === 0 || include.some((pattern) => matchesPattern(relPath, pattern));
  const excludeMatch = exclude.some((pattern) => matchesPattern(relPath, pattern));
  return includeMatch && !excludeMatch;
};

const containsApiV1 = (text) => text.includes(API_V1_TOKEN);

const isUnsafeApiPathCall = (node) =>
  Node.isCallExpression(node) && node.getExpression().getText() === "unsafeApiPath";

const isRoutesApiCall = (node) =>
  Node.isCallExpression(node) && node.getExpression().getText().startsWith("routes.api");

const wrapWithUnsafeApiPath = (node) => {
  node.replaceWithText(`unsafeApiPath(${node.getText()})`);
};

const ensureUnsafeImport = (sourceFile) => {
  const importDecls = sourceFile
    .getImportDeclarations()
    .filter((decl) => decl.getModuleSpecifierValue() === PATH_TYPES_IMPORT);

  if (importDecls.length === 0) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: PATH_TYPES_IMPORT,
      namedImports: ["unsafeApiPath"],
    });
    return;
  }

  const [decl] = importDecls;
  const namedImports = decl.getNamedImports();
  if (!namedImports.some((imp) => imp.getName() === "unsafeApiPath")) {
    decl.addNamedImport("unsafeApiPath");
  }
};

const removeUnusedUnsafeImport = (sourceFile) => {
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
  const hasUsage = identifiers.some(
    (identifier) =>
      identifier.getText() === "unsafeApiPath" && !Node.isImportSpecifier(identifier.getParent()),
  );
  if (hasUsage) return;

  const importDecls = sourceFile
    .getImportDeclarations()
    .filter((decl) => decl.getModuleSpecifierValue() === PATH_TYPES_IMPORT);

  for (const decl of importDecls) {
    const namedImports = decl.getNamedImports();
    const target = namedImports.find((imp) => imp.getName() === "unsafeApiPath");
    if (target) {
      target.remove();
      if (decl.getNamedImports().length === 0 && !decl.getDefaultImport()) {
        decl.remove();
      }
    }
  }
};

const describeNode = (node) => {
  const sourceFile = node.getSourceFile();
  const pos = sourceFile.getLineAndColumnAtPos(node.getStart());
  const relPath = normalizePath(path.relative(REPO_ROOT, sourceFile.getFilePath()));
  return `${relPath}:${pos.line}:${pos.column}`;
};

const collectManualEntry = (manualRequired, node, reason) => {
  manualRequired.push({
    location: describeNode(node),
    reason,
    text: node.getText(),
  });
};

const isWrappedByUnsafeApiPath = (node) =>
  node.getAncestors().some((ancestor) => isUnsafeApiPathCall(ancestor));

const processSourceFile = (sourceFile) => {
  let replacements = 0;
  const manualRequired = [];

  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const callExpression of callExpressions) {
    if (isUnsafeApiPathCall(callExpression) || isRoutesApiCall(callExpression)) continue;
    const args = callExpression.getArguments();
    if (args.length === 0) continue;
    const firstArg = args[0];
    if (
      Node.isStringLiteral(firstArg) ||
      Node.isNoSubstitutionTemplateLiteral(firstArg) ||
      Node.isTemplateExpression(firstArg)
    ) {
      if (containsApiV1(firstArg.getText())) {
        wrapWithUnsafeApiPath(firstArg);
        replacements += 1;
      }
    }
  }

  const jsxAttributes = sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute);
  for (const attribute of jsxAttributes) {
    const name = attribute.getNameNode().getText();
    if (name !== "href" && name !== "src") continue;
    const initializer = attribute.getInitializer();
    if (initializer && Node.isStringLiteral(initializer) && containsApiV1(initializer.getText())) {
      attribute.setInitializer(`{unsafeApiPath(${initializer.getText()})}`);
      replacements += 1;
    }
  }

  const variableDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  for (const declaration of variableDeclarations) {
    const initializer = declaration.getInitializer();
    if (!initializer) continue;
    if (
      Node.isStringLiteral(initializer) ||
      Node.isNoSubstitutionTemplateLiteral(initializer) ||
      Node.isTemplateExpression(initializer)
    ) {
      if (containsApiV1(initializer.getText())) {
        wrapWithUnsafeApiPath(initializer);
        replacements += 1;
      }
    }
  }

  const stringNodes = sourceFile.getDescendants().filter((node) => {
    if (Node.isJsxText(node)) return true;
    if (
      Node.isStringLiteral(node) ||
      Node.isNoSubstitutionTemplateLiteral(node) ||
      Node.isTemplateExpression(node)
    ) {
      return true;
    }
    return false;
  });

  for (const node of stringNodes) {
    if (!containsApiV1(node.getText())) continue;
    if (isWrappedByUnsafeApiPath(node)) continue;
    if (Node.isJsxText(node)) {
      collectManualEntry(manualRequired, node, "jsx-text");
      continue;
    }
    const parent = node.getParent();
    if (Node.isBinaryExpression(parent)) {
      collectManualEntry(manualRequired, node, "string-concat");
      continue;
    }
    if (Node.isCallExpression(parent) || Node.isVariableDeclaration(parent) || Node.isJsxAttribute(parent)) {
      continue;
    }
    collectManualEntry(manualRequired, node, "manual-review");
  }

  if (replacements > 0) {
    ensureUnsafeImport(sourceFile);
  } else {
    removeUnusedUnsafeImport(sourceFile);
  }

  return { replacements, manualRequired };
};

const logCheckResults = ({ name, files, json, maxFiles }) => {
  const count = files.length;
  const limited = files.slice(0, maxFiles);
  const truncated = count > limited.length;

  if (json) {
    console.log(
      JSON.stringify({
        name,
        mode: "check",
        wouldChangeCount: count,
        files: limited,
        truncated,
      }),
    );
    return;
  }

  if (count === 0) {
    console.log("[codemod] OK (no changes needed)");
    return;
  }

  console.log(`[codemod] would change ${count} files`);
  console.log("files:");
  for (const file of limited) {
    console.log(file);
  }
  if (truncated) {
    console.log(`... and ${count - limited.length} more`);
  }
};

const run = async () => {
  const { apply, check, dryRun, include, exclude, json, maxFiles } = parseArgs();
  const project = new Project({
    tsConfigFilePath: path.join(REPO_ROOT, "tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });

  const sourceFiles = project
    .getSourceFiles()
    .filter((file) => {
      const filePath = file.getFilePath();
      if (filePath.endsWith(".d.ts")) return false;
      if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) return false;
      const relPath = normalizePath(path.relative(REPO_ROOT, filePath));
      return shouldIncludeFile(relPath, include, exclude);
    })
    .sort((a, b) => a.getFilePath().localeCompare(b.getFilePath()));

  let totalReplacements = 0;
  const touchedFiles = new Set();
  const manualRequired = [];

  for (const sourceFile of sourceFiles) {
    const result = processSourceFile(sourceFile);
    if (result.replacements > 0) {
      totalReplacements += result.replacements;
      touchedFiles.add(normalizePath(path.relative(REPO_ROOT, sourceFile.getFilePath())));
    }
    if (result.manualRequired.length > 0) {
      manualRequired.push(...result.manualRequired);
    }
  }

  const sortedTouchedFiles = Array.from(touchedFiles).sort();

  if (check) {
    logCheckResults({
      name: "wrap-api-v1",
      files: sortedTouchedFiles,
      json,
      maxFiles,
    });
    process.exit(sortedTouchedFiles.length > 0 ? 1 : 0);
  }

  if (dryRun) {
    if (sortedTouchedFiles.length === 0) {
      console.log("[codemod] No safe replacements found.");
    } else {
      console.log(`[codemod] Planned replacements: ${totalReplacements}`);
      for (const file of sortedTouchedFiles) {
        console.log(`- ${file}`);
      }
    }
  } else {
    if (sortedTouchedFiles.length > 0) {
      await project.save();
      console.log(`[codemod] Applied replacements: ${totalReplacements}`);
      for (const file of sortedTouchedFiles) {
        console.log(`- ${file}`);
      }
    } else {
      console.log("[codemod] No safe replacements applied.");
    }
  }

  if (manualRequired.length > 0) {
    console.log("\n[codemod] Manual required:");
    for (const item of manualRequired) {
      console.log(`- ${item.location} (${item.reason}) ${item.text}`);
    }
  }
};

run().catch((error) => {
  console.error("[codemod] Failed", error);
  process.exit(1);
});
