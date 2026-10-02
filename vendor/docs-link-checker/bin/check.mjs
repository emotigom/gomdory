#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootArg = process.argv[2] ?? 'docs';
const repoRoot = process.cwd();
const docsRoot = path.resolve(repoRoot, rootArg);

function walkMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function slugifyHeading(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function extractHeadings(markdown) {
  const sanitizedMarkdown = stripFencedCodeBlocks(markdown);
  const slugCounts = new Map();
  const slugs = new Set();
  for (const line of sanitizedMarkdown.split('\n')) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const base = slugifyHeading(match[1]);
    if (!base) continue;
    const nextCount = (slugCounts.get(base) ?? 0) + 1;
    slugCounts.set(base, nextCount);
    const slug = nextCount === 1 ? base : `${base}-${nextCount - 1}`;
    slugs.add(slug);
  }
  return slugs;
}

function normalizeLinkTarget(rawTarget) {
  const target = rawTarget.trim().replace(/^<|>$/g, '');
  if (!target) return null;
  if (/^(https?:|mailto:|tel:)/i.test(target)) return null;
  const noTitle = target.split(/\s+/)[0];
  return noTitle;
}

function extractLinks(markdown) {
  const sanitizedMarkdown = stripFencedCodeBlocks(markdown);
  const links = [];
  const regex = /\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(sanitizedMarkdown)) !== null) {
    const target = normalizeLinkTarget(match[1]);
    if (!target) continue;
    links.push(target);
  }
  return links;
}

function stripFencedCodeBlocks(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
}

if (!fs.existsSync(docsRoot)) {
  console.error(`[docs-linkcheck] target directory not found: ${rootArg}`);
  process.exit(1);
}

const markdownFiles = walkMarkdownFiles(docsRoot);
const headingMap = new Map();
const fileSet = new Set(markdownFiles.map((file) => path.resolve(file)));

for (const filePath of markdownFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  headingMap.set(filePath, extractHeadings(content));
}

const errors = [];

for (const filePath of markdownFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const links = extractLinks(content);
  for (const link of links) {
    const [rawPath, rawHash] = link.split('#');
    const hasHash = link.includes('#');
    const targetPath = rawPath && rawPath.length > 0
      ? path.resolve(path.dirname(filePath), rawPath)
      : filePath;

    if (rawPath && rawPath.length > 0 && !fs.existsSync(targetPath)) {
      errors.push(`${path.relative(repoRoot, filePath)} -> ${link} (missing path)`);
      continue;
    }

    if (!hasHash) continue;
    const hash = decodeURIComponent(rawHash ?? '').toLowerCase();
    if (!hash) {
      errors.push(`${path.relative(repoRoot, filePath)} -> ${link} (empty anchor)`);
      continue;
    }

    if (!fileSet.has(targetPath)) {
      continue;
    }

    const slugs = headingMap.get(targetPath) ?? new Set();
    if (!slugs.has(hash)) {
      errors.push(`${path.relative(repoRoot, filePath)} -> ${link} (missing anchor #${hash})`);
    }
  }
}

if (errors.length > 0) {
  console.error(`[docs-linkcheck] Found ${errors.length} broken docs link(s):`);
  for (const issue of errors) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`[docs-linkcheck] OK (${markdownFiles.length} markdown files scanned)`);
