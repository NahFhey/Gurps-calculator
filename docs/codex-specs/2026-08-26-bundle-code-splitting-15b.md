# SPEC: Bundle Code-Splitting — Lazy-Load Heavy Tabs (Phase 15b)

## Background

React 18 + TypeScript (strict) + Vite 5 app (GURPS campaign manager, also packaged
with Electron). `npm run build` currently produces a SINGLE ~2.0MB JS chunk
(`dist/assets/index-*.js`). Nothing in the app uses `React.lazy` or dynamic
`import()` today. The roadmap targets an initial chunk under ~500KB with features
lazy-loaded. The main shell is `src/unified/UnifiedShell.tsx`, which statically
imports every feature tab. A known heavy dependency is `@dnd-kit/*` (used only by
`src/components/combat/views/InitiativeTimeline.tsx`). Work ONLY in this worktree;
do not touch git (no commits) — the shepherd commits after review.

## Deliverable

Introduce route/tab-level code splitting so the initial bundle is dramatically
smaller and feature areas load on demand.

1. In `src/unified/UnifiedShell.tsx`, convert the heavy feature imports to
   `React.lazy` + `<Suspense>`:
   - `InventoryTab`, `ManagerTab`, `RulesTab`, `ChangelogTab`, `DowntimePanel`,
     `CharacterSheet`, `CombatTab`, `MapPanel`, and the combat layout components
     (`CombatParticipantsSidebar`, `CombatManeuverRail`, `CombatMainArea`) if they
     are only rendered inside the combat view.
   - These modules use NAMED exports. Use the
     `lazy(() => import('...').then(m => ({ default: m.TheExport })))` pattern.
   - Keep small always-visible components static (header widgets, `CombatTile`,
     party column, `TabErrorBoundary`, context menus).
   - Wrap lazy content in `<Suspense fallback={...}>` INSIDE the existing
     `TabErrorBoundary` wrappers so load errors surface through the boundary.
     Fallback: a simple centered "Loading…" div styled with Tailwind classes
     consistent with the app (dark slate background, muted text).
2. Do NOT lazy-load anything imported for its side effects or required at first
   paint. Do not change `src/state/**` — the store must remain in the root chunk.
3. If `parseCharacterText` (`src/utils/characterImport.ts`) is only used by the
   import-file flow in UnifiedShell, you may load it via dynamic `import()` inside
   the handler — but do NOT edit `src/utils/characterImport.ts` itself (another
   task owns that file). Same rule for any util: dynamic-import at call sites is
   fine, editing the util files is not.
4. In `vite.config.js`, add `build.rollupOptions.output.manualChunks` to keep
   vendor code sensible — at minimum split `@dnd-kit` with the combat feature and
   keep `react`/`react-dom` in a stable vendor chunk. Prefer simple, maintainable
   chunking over micro-optimization.
5. Electron caveat: the app is also loaded by Electron from `dist/`. Code splitting
   via relative dynamic imports is fine; do not introduce absolute URL asset paths
   and do not change `electron/` files.

## Constraints

- TypeScript strict must stay clean (`npx tsc --noEmit`). NO new `as any`.
- Do not change any component's public API or observable behavior — this is purely
  a loading-strategy change.
- Files you may edit: `src/unified/UnifiedShell.tsx`, `vite.config.js`, and (only
  if genuinely needed for a lazy boundary) a new small wrapper component under
  `src/unified/`. Test files under `src/unified/__tests__/` may be updated ONLY to
  accommodate async rendering (see below), never to weaken assertions.
- No new dependencies.

## Definition of done — self-verify before finishing

1. `npm run build` succeeds. Report the before/after chunk listing
   (`ls -la dist/assets`). Target: the entry chunk (the one referenced by
   `dist/index.html`) under 700KB minified, ideally under 500KB; total of all
   chunks may exceed that freely. If you cannot reach 700KB, report exactly what
   remains in the entry chunk and why (e.g., `du`-style breakdown via
   `npx vite-bundle-visualizer` is NOT available — reason from import graphs).
2. The existing UnifiedShell test suites must pass:
   `npx vitest run src/unified/__tests__/`
   Lazy components render asynchronously — where a test breaks purely because
   rendering is now async, use `await screen.findBy...` style waits. If a suite
   cannot pass without weakening what it asserts, STOP and report that instead of
   changing the assertion.
3. Also run `npx vitest run src/__tests__/combatIntegration.test.ts` (must pass)
   and `npx tsc --noEmit` (clean).
4. Final summary: one paragraph — what got split into which chunks, entry-chunk
   size before/after, and any test accommodations made.
