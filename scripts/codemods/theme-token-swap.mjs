#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');

const surfaceByShade = {
  500: 'surface-4',
  600: 'surface-3',
  650: 'surface-3',
  700: 'surface-2',
  750: 'surface-2',
  800: 'surface-1',
  850: 'surface-1',
  900: 'surface-0',
  950: 'surface-sunken',
};

const foregroundByShade = {
  100: 'fg-bright',
  200: 'fg-primary',
  300: 'fg-secondary',
  400: 'fg-muted',
  500: 'fg-faint',
  600: 'fg-disabled',
};

const edgeByShade = {
  500: 'edge-bright',
  600: 'edge-strong',
  700: 'edge',
  800: 'edge-subtle',
};

const statusFamilies = {
  blue: 'accent',
  green: 'success',
  red: 'danger',
  amber: 'warning',
  sky: 'info',
};

function swapThemeClasses(source) {
  return source
    .replace(
      /\b(bg|from|to|via)-(?:gray|slate|stone)-(500|600|650|700|750|800|850|900|950)\b/g,
      (_match, utility, shade) => `${utility}-${surfaceByShade[shade]}`,
    )
    .replace(
      /\b(text|placeholder)-(?:gray|slate)-(100|200|300|400|500|600)\b/g,
      (_match, utility, shade) => `${utility}-${foregroundByShade[shade]}`,
    )
    .replace(
      /\b(border|ring|divide|outline)-(?:gray|slate|stone)-(500|600|700|800)\b/g,
      (_match, utility, shade) => `${utility}-${edgeByShade[shade]}`,
    )
    .replace(
      /\b(blue|green|red|amber|sky)-(\d+)\b/g,
      (_match, family, shade) => `${statusFamilies[family]}-${shade}`,
    );
}

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      if (relativePath === 'src/components/map/three') continue;
      files.push(...collectSourceFiles(absolutePath));
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }
  return files;
}

const targets = [...collectSourceFiles(srcRoot), path.join(root, 'index.html')].sort();
const changed = [];

for (const file of targets) {
  const before = fs.readFileSync(file, 'utf8');
  const after = swapThemeClasses(before);
  if (after === before) continue;

  fs.writeFileSync(file, after);
  changed.push(path.relative(root, file).split(path.sep).join('/'));
}

if (changed.length === 0) {
  console.log('Theme token swap: no changes.');
} else {
  console.log(`Theme token swap: updated ${changed.length} file(s).`);
  for (const file of changed) console.log(`  ${file}`);
}
