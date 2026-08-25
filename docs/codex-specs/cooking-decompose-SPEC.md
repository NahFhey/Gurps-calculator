# Task: Decompose CookingTab.tsx into thin router + view components

## Background

This is a GURPS 4e campaign-management app (React 18 + TypeScript strict + Tailwind + Vite, Vitest/jsdom for tests). Large components get split into a **thin router** (owns state + dispatch) and **pure view components** (props in, JSX out). `src/components/CookingTab.tsx` is a 978-line monolith that predates this convention. Roadmap Phase 13a calls for decomposing it. Reference implementations of the pattern: `src/components/downtime/` (DowntimePanel + `views/` directory) and `src/components/manager/` (ManagerTab + `views/`).

## Deliverables

1. **`src/components/cooking/views/`** — extract the three views from CookingTab's `CookingView = 'create' | 'library' | 'remake'` switch into separate pure components (one file each, e.g. `CreateMealView.tsx`, `RecipeLibraryView.tsx`, `RemakeView.tsx`). Views receive all data and callbacks via props. No `useCampaignStore()` calls inside views.
2. **`src/components/cooking/CookingTab.tsx`** — the thin router: holds all `useState`, all `useMemo` selectors over the store, all handlers, and renders the active view. Target well under 400 lines. Shared types used by multiple views go in `src/components/cooking/types.ts` (or a small `shared.ts`).
3. **`src/components/CookingTab.tsx`** — becomes a re-export shim (`export { CookingTab } from './cooking/CookingTab'`) so the existing imports in `src/unified/UnifiedShell.tsx` and `src/components/downtime/DowntimePanel.tsx` keep working unchanged. Do NOT edit those two consumer files.
4. **Characterization tests** — CookingTab currently has NO tests. Add `src/components/cooking/__tests__/CookingTab.test.tsx` (router renders, view switching works, store wiring dispatches on a representative action — e.g. preparing a meal calls the expected store action) and at least one render test per extracted view with representative props. Follow the testing style of existing component tests, e.g. `src/components/__tests__/InventoryTab.test.tsx`. Minimum 12 tests total.

## Hard constraints

- **Pure refactor.** Zero behavior change, zero markup/styling change beyond what extraction forces. Same rendered DOM for the same state.
- `strict: true` TypeScript — `npx tsc --noEmit` must pass with zero errors.
- **No new `as any` casts. No `@ts-ignore` / `@ts-expect-error`.**
- Use `import type` for type-only imports.
- Do not modify anything under `src/state/`, `src/types/`, or any component outside `src/components/CookingTab.tsx` and the new `src/components/cooking/` directory.
- Do not add dependencies. Do not run npm install (node_modules is a symlink, already populated).

## Definition of done — self-verify before finishing

Run these yourself from the repo root and fix failures before finishing:

```
npx tsc --noEmit
npx vitest run src/components/cooking
npx vitest run src/__tests__/combatIntegration.test.ts
```

All must pass. Then write a final summary: one paragraph on how you sliced the component, plus anything you noticed that looked like a pre-existing bug (do NOT fix pre-existing bugs — report them).
