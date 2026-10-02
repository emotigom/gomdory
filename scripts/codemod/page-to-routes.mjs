import path from "path";
import { fileURLToPath } from "url";
import { Node, Project, SyntaxKind } from "ts-morph";
import { stringMappings, templateMappings } from "./map-page-to-routes.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const ROUTES_IMPORT = "@/lib/standards/routes";

const TARGET_CALLEES = new Set(["router.push", "router.replace", "redirect"]);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const check = args.includes("--check");
  const json = args.includes("--json");
  let maxFiles = 20;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--max-files") {
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

  return { apply: apply && !check, check, dryRun: !apply, json, maxFiles };
};

const normalizePath = (value) => value.split(path.sep).join("/");

const getLiteralText = (node) => {
  if (Node.isStringLiteral(node)) return node.getLiteralText();
  if (Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralText();
  return null;
};

const getTemplateParts = (node) => {
  if (!Node.isTemplateExpression(node)) return null;
  const head = node.getHead().getLiteralText();
  const spans = node.getTemplateSpans();
  const tails = spans.map((span) => span.getLiteral().getLiteralText());
  const expressions = spans.map((span) => span.getExpression());
  return { head, tails, expressions };
};

const buildCallText = (callee, args) => `${callee}(${args.join(", ")})`;

const findTemplateMapping = (parts) =>
  templateMappings.find(
    (mapping) =>
      mapping.head === parts.head &&
      mapping.tails.length === parts.tails.length &&
      mapping.tails.every((tail, index) => tail === parts.tails[index]),
  );

const ensureRoutesImport = (sourceFile) => {
  const existing = sourceFile
    .getImportDeclarations()
    .find((decl) => decl.getModuleSpecifierValue() === ROUTES_IMPORT);

  if (!existing) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: ROUTES_IMPORT,
      namedImports: ["routes"],
    });
    return;
  }

  const namedImports = existing.getNamedImports();
  if (!namedImports.some((imp) => imp.getName() === "routes")) {
    existing.addNamedImport("routes");
  }
};

const describeNode = (node) => {
  const sourceFile = node.getSourceFile();
  const pos = sourceFile.getLineAndColumnAtPos(node.getStart());
  const relPath = normalizePath(path.relative(REPO_ROOT, sourceFile.getFilePath()));
  return `${relPath}:${pos.line}:${pos.column}`;
};

const replaceWithMapping = ({ node, literalText, templateParts }) => {
  if (literalText) {
    const mapping = stringMappings.get(literalText);
    if (mapping) {
      return buildCallText(mapping.callee, mapping.args);
    }
  }

  if (templateParts) {
    const mapping = findTemplateMapping(templateParts);
    if (mapping) {
      return buildCallText(
        mapping.callee,
        templateParts.expressions.map((expression) => expression.getText()),
      );
    }
  }

  return null;
};

const processSourceFile = (sourceFile) => {
  let replacements = 0;
  const manualRequired = [];

  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const callExpression of callExpressions) {
    if (!Node.isCallExpression(callExpression)) continue;
    const calleeText = callExpression.getExpression().getText();
    if (!TARGET_CALLEES.has(calleeText)) continue;
    const args = callExpression.getArguments();
    if (args.length === 0) continue;
    const arg = args[0];

    const replacement = replaceWithMapping({
      node: arg,
      literalText: getLiteralText(arg),
      templateParts: getTemplateParts(arg),
    });

    if (replacement) {
      arg.replaceWithText(replacement);
      replacements += 1;
      continue;
    }

    manualRequired.push({
      location: describeNode(callExpression),
      text: callExpression.getText(),
    });
  }

  const jsxAttributes = sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute);
  for (const attribute of jsxAttributes) {
    if (attribute.getName() !== "href") continue;
    const initializer = attribute.getInitializer();
    if (!initializer) continue;

    if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
      const replacement = replaceWithMapping({
        node: initializer,
        literalText: getLiteralText(initializer),
        templateParts: null,
      });

      if (replacement) {
        attribute.setInitializer(`{${replacement}}`);
        replacements += 1;
        continue;
      }

      manualRequired.push({
        location: describeNode(attribute),
        text: attribute.getText(),
      });
      continue;
    }

    if (Node.isJsxExpression(initializer)) {
      const expression = initializer.getExpression();
      if (!expression) continue;

      const replacement = replaceWithMapping({
        node: expression,
        literalText: getLiteralText(expression),
        templateParts: getTemplateParts(expression),
      });

      if (replacement) {
        expression.replaceWithText(replacement);
        replacements += 1;
        continue;
      }

      manualRequired.push({
        location: describeNode(attribute),
        text: attribute.getText(),
      });
    }
  }

  if (replacements > 0) {
    ensureRoutesImport(sourceFile);
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
  const { apply, check, dryRun, json, maxFiles } = parseArgs();
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
      return true;
    })
    .sort((a, b) => {
      const aPath = normalizePath(path.relative(REPO_ROOT, a.getFilePath()));
      const bPath = normalizePath(path.relative(REPO_ROOT, b.getFilePath()));
      const aPriority = aPath.startsWith("app/") || aPath.startsWith("lib/") ? 0 : 1;
      const bPriority = bPath.startsWith("app/") || bPath.startsWith("lib/") ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return aPath.localeCompare(bPath);
    });

  const changedFiles = [];
  const manualRequired = [];

  for (const sourceFile of sourceFiles) {
    const result = processSourceFile(sourceFile);
    if (result.replacements > 0) {
      const relative = normalizePath(path.relative(REPO_ROOT, sourceFile.getFilePath()));
      changedFiles.push(relative);
    }
    if (result.manualRequired.length > 0) {
      manualRequired.push(...result.manualRequired);
    }
    if (result.replacements > 0 && apply) {
      sourceFile.saveSync();
    }
  }

  if (check) {
    logCheckResults({ name: "page-to-routes", files: changedFiles, json, maxFiles });
    if (manualRequired.length > 0) {
      if (json) {
        console.log(
          JSON.stringify({
            name: "page-to-routes",
            mode: "manual",
            count: manualRequired.length,
            items: manualRequired.slice(0, maxFiles),
            truncated: manualRequired.length > maxFiles,
          }),
        );
      } else {
        console.log("manual updates required:");
        for (const entry of manualRequired.slice(0, maxFiles)) {
          console.log(`${entry.location} ${entry.text}`);
        }
        if (manualRequired.length > maxFiles) {
          console.log(`... and ${manualRequired.length - maxFiles} more`);
        }
      }
    }
    process.exit(changedFiles.length > 0 ? 1 : 0);
  }

  if (dryRun) {
    console.log(`[codemod] would update ${changedFiles.length} files`);
    return;
  }

  if (changedFiles.length > 0) {
    console.log(`[codemod] updated ${changedFiles.length} files`);
  } else {
    console.log("[codemod] no changes applied");
  }
};

await run();
