#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const allowlistPath = path.join(root, 'scripts', 'theme-token-allowlist.json');
const banned = /\b(gray|slate|zinc|neutral|stone|blue|green|red|amber|sky)-(50|100|200|300|400|500|600|700|800|900|950)\b/g;

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolutePath));
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }
  return files;
}

function loadAllowlist() {
  const entries = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('Theme token allowlist must be an array.');

  return entries.map((entry, index) => {
    if (
      typeof entry?.file !== 'string' ||
      typeof entry?.pattern !== 'string' ||
      typeof entry?.reason !== 'string' ||
      entry.reason.trim() === ''
    ) {
      throw new Error(`Invalid theme token allowlist entry at index ${index}.`);
    }

    return { ...entry, matcher: new RegExp(entry.pattern) };
  });
}

const allowlist = loadAllowlist();
const targets = [...collectSourceFiles(srcRoot), path.join(root, 'index.html')].sort();
const violations = [];

for (const file of targets) {
  const relativePath = path.relative(root, file).split(path.sep).join('/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

  lines.forEach((line, lineIndex) => {
    banned.lastIndex = 0;
    for (const match of line.matchAll(banned)) {
      const allowed = allowlist.some((entry) => {
        entry.matcher.lastIndex = 0;
        return entry.file === relativePath && (entry.matcher.test(match[0]) || entry.matcher.test(line));
      });

      if (!allowed) {
        violations.push({
          file: relativePath,
          line: lineIndex + 1,
          column: (match.index ?? 0) + 1,
          token: match[0],
          source: line.trim(),
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`Theme token gate failed with ${violations.length} violation(s):`);
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line}:${violation.column} ${violation.token}`);
    console.error(`  ${violation.source}`);
  }
  process.exitCode = 1;
} else {
  console.log('Theme token gate passed.');
}
