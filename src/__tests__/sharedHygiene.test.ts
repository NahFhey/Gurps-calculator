/**
 * shared/ is compiled two ways: the client (Vite, bundler resolution) and the
 * server (tsc/tsx, NodeNext). These rules keep one source of truth that both
 * can load (docs/TYPED_BOUNDARIES_PLAN.md §2.3 "shared/ rules"):
 *   - no committed .js/.d.ts twin beside a .ts (Vite resolves .js before .ts,
 *     so a twin is what the browser actually runs);
 *   - no imports from src/ (the server cannot resolve them);
 *   - no immer and no import.meta (server-side and NodeNext-unsafe);
 *   - every relative import carries .js (NodeNext requires it).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';

const SHARED_DIR = resolve(__dirname, '../../shared');

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listFiles(full);
    return [full];
  });
}

const allFiles = listFiles(SHARED_DIR);
const sourceFiles = allFiles.filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
const rel = (f: string) => relative(SHARED_DIR, f);

interface ImportRef {
  file: string;
  specifier: string;
}

function importsOf(file: string): ImportRef[] {
  const info = ts.preProcessFile(readFileSync(file, 'utf8'), true, true);
  return info.importedFiles.map((i) => ({ file, specifier: i.fileName }));
}

function usesImportMeta(file: string): boolean {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let found = false;
  const visit = (node: ts.Node) => {
    if (
      ts.isMetaProperty(node) &&
      node.keywordToken === ts.SyntaxKind.ImportKeyword &&
      node.name.text === 'meta'
    ) {
      found = true;
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const allImports = sourceFiles.flatMap(importsOf);
const relativeImports = allImports.filter((i) => i.specifier.startsWith('.'));

describe('shared/ hygiene', () => {
  it('finds the shared sources', () => {
    expect(sourceFiles.map(rel)).toEqual(
      expect.arrayContaining(['protocol.ts', 'session.ts', 'playerProjection.ts']),
    );
  });

  it('has no committed .js or .d.ts twin beside a .ts', () => {
    const twins = sourceFiles.flatMap((f) => {
      const base = f.slice(0, -'.ts'.length);
      return [`${base}.js`, `${base}.d.ts`].filter((t) => existsSync(t)).map(rel);
    });
    expect(twins).toEqual([]);
  });

  it('does not import from src/', () => {
    const srcDir = resolve(SHARED_DIR, '../src') + sep;
    const offenders = allImports
      .filter((i) => {
        if (i.specifier.startsWith('.')) {
          return resolve(join(i.file, '..'), i.specifier).startsWith(srcDir);
        }
        return i.specifier.startsWith('@/') || i.specifier.startsWith('src/');
      })
      .map((i) => `${rel(i.file)} -> ${i.specifier}`);
    expect(offenders).toEqual([]);
  });

  it('does not import immer', () => {
    const offenders = allImports
      .filter((i) => i.specifier === 'immer' || i.specifier.startsWith('immer/'))
      .map((i) => `${rel(i.file)} -> ${i.specifier}`);
    expect(offenders).toEqual([]);
  });

  it('does not use import.meta', () => {
    expect(sourceFiles.filter(usesImportMeta).map(rel)).toEqual([]);
  });

  it('gives every relative import a .js extension', () => {
    const offenders = relativeImports
      .filter((i) => !i.specifier.endsWith('.js'))
      .map((i) => `${rel(i.file)} -> ${i.specifier}`);
    expect(offenders).toEqual([]);
  });
});
