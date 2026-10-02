#!/usr/bin/env node
import { constants } from "node:fs";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const REQUIRED_FILES = ["app/s/page.tsx", "app/s/[code]/page.tsx", "middleware.ts"];

const APP_ROOT = path.resolve("app");
const ROUTE_FILE_PATTERN = /^route\.[cm]?[jt]sx?$/i;
const ALLOWED_ROUTE_VALUE_EXPORTS = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "config",
  "generateStaticParams",
  "revalidate",
  "dynamic",
  "dynamicParams",
  "fetchCache",
  "preferredRegion",
  "runtime",
  "maxDuration",
]);

const hasModifier = (node, kind) =>
  Boolean(node.modifiers?.some((modifier) => modifier.kind === kind));

const collectBindingNames = (name, names) => {
  if (ts.isIdentifier(name)) {
    names.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    collectBindingNames(element.name, names);
  }
};

const scriptKindFor = (filePath) => {
  if (/\.tsx$/i.test(filePath)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(filePath)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/i.test(filePath)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};

const collectRouteValueExports = (filePath, source) => {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filePath),
  );
  const names = new Set();

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      names.add("default");
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      if (!statement.exportClause) {
        names.add("*");
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          if (!element.isTypeOnly) names.add(element.name.text);
        }
      } else {
        names.add(statement.exportClause.name.text);
      }
      continue;
    }

    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
      names.add("default");
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        collectBindingNames(declaration.name, names);
      }
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)
    ) {
      if (statement.name) names.add(statement.name.getText(sourceFile));
    }
  }

  return [...names];
};

const collectRouteFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectRouteFiles(entryPath)));
    } else if (ROUTE_FILE_PATTERN.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
};

const checkRouteModuleExports = async () => {
  const routeFiles = (await collectRouteFiles(APP_ROOT)).sort();
  if (routeFiles.length === 0) throw new Error("No Next.js route modules found under app/.");
  const violations = [];

  for (const filePath of routeFiles) {
    const source = await readFile(filePath, "utf8");
    const invalid = collectRouteValueExports(filePath, source).filter(
      (name) => !ALLOWED_ROUTE_VALUE_EXPORTS.has(name),
    );
    if (invalid.length > 0) {
      const relativePath = path.relative(process.cwd(), filePath).split(path.sep).join("/");
      violations.push(`${relativePath}: ${invalid.join(", ")}`);
    }
  }

  if (violations.length > 0) {
    throw new Error(`Invalid Next.js route exports:\n${violations.map((item) => `- ${item}`).join("\n")}`);
  }
};

const assertExists = async (path) => {
  try {
    await access(path, constants.F_OK);
  } catch {
    throw new Error(`Missing required route file: ${path}`);
  }
};

const assertContains = (source, token, label) => {
  if (!source.includes(token)) {
    throw new Error(`Invariant failed: ${label}`);
  }
};

const checkStaticRoutes = async () => {
  await checkRouteModuleExports();

  for (const file of REQUIRED_FILES) {
    await assertExists(file);
  }

  const shareEntry = await readFile("app/s/page.tsx", "utf8");
  assertContains(shareEntry, 'data-page-marker="share-entry"', "/s must keep share-entry marker");

  const shareCodePage = await readFile("app/s/[code]/page.tsx", "utf8");
  assertContains(shareCodePage, 'data-page-marker="student-board"', "/s/[code] must keep student board marker");

  const middlewareSource = await readFile("middleware.ts", "utf8");
  assertContains(middlewareSource, 'rewriteUrl.pathname = "/s"', "gkrry root must route to /s");
  assertContains(middlewareSource, 'pathname === "/"', "middleware must explicitly handle root path");
};

const checkRemoteSmoke = async () => {
  const remoteSmokeEnabled = process.env.ROUTE_INVARIANTS_REMOTE === "1";
  if (!remoteSmokeEnabled) {
    console.warn("[route-invariants] ROUTE_INVARIANTS_REMOTE is not set; skipping remote smoke checks.");
    return;
  }

  const smokeShareCode = process.env.SMOKE_SHARE_CODE;
  if (!smokeShareCode) {
    console.warn("[route-invariants] SMOKE_SHARE_CODE is not set; skipping remote smoke checks.");
    return;
  }

  const checks = [
    {
      url: `https://www.gomdory.com/s/${encodeURIComponent(smokeShareCode)}`,
      marker: "data-page-marker=\"student-board",
      label: "gomdory /s/<code>",
    },
    {
      url: "https://gkrry.com/",
      marker: "data-page-marker=\"share-entry\"",
      label: "gkrry root share entry",
    },
  ];

  for (const check of checks) {
    const response = await fetch(check.url, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(`${check.label} expected 200 but got ${response.status}`);
    }
    const body = await response.text();
    if (!body.includes(check.marker)) {
      throw new Error(`${check.label} missing marker ${check.marker}`);
    }
  }
};

await checkStaticRoutes();
await checkRemoteSmoke();
console.log("[route-invariants] OK");
