# Task: Decompose LocationManager.tsx into thin router + view components

## Background

This is a GURPS 4e campaign-management app (React 18 + TypeScript strict + Tailwind + Vite, Vitest/jsdom for tests). Large components get split into a **thin router** (owns state + dispatch) and **pure view components** (props in, JSX out). `src/components/location/LocationManager.tsx` is a 1,084-line monolith — the last one on the roadmap's Phase 13a list. Two sibling decompositions merged this week are your reference implementations for structure, style, and test approach: `src/components/cooking/` (CookingTab router + `views/` + `types.ts` + `__tests__/`) and `src/components/inventory/` (same shape). Follow them closely.

## Current shape (read the file first)

- `LocationManager({ onClose })` — the main component, `useCampaignStore()` at the top, a `ManagerView` union of 10 view states: `'list' | 'create' | 'edit' | 'travel' | 'weatherTables' | 'editWeatherTable' | 'climates' | 'terrain' | 'terrainModifiers' | 'weatherModifiers'`.
- Two editor components already live as separate functions in the same file: `TerrainModifiersEditor` and `WeatherModifiersEditor`.
- Exported as both named export and `export default LocationManager`.
- Consumers: `src/components/location/index.ts` and `src/components/header/WeatherWidget.tsx`. Do NOT edit `WeatherWidget.tsx`; editing `index.ts` is allowed only if re-export adjustments are unavoidable (prefer leaving it untouched).

## Deliverables

1. **`src/components/location/views/`** — extract each view-state's JSX into pure components. Group sensibly rather than mechanically: closely-related small states may share a file (e.g. create/edit can be one `LocationFormView` if they already share markup; `weatherTables`/`editWeatherTable` similarly), but no view file over ~250 lines. Move `TerrainModifiersEditor` and `WeatherModifiersEditor` into their own files under `views/` as-is. Views receive all data and callbacks via props — no `useCampaignStore()` inside views.
2. **`src/components/location/LocationManager.tsx`** — becomes the thin router: all store access, `useState`, handlers, and the `ManagerView` switch. Target well under 400 lines. Keep BOTH the named export and the default export so all existing imports keep working. Shared local types go in `src/components/location/managerTypes.ts` (there may already be a types module — check; do not collide with existing type files).
3. **Characterization tests** — LocationManager currently has NO tests (`LocationComponents.test.tsx` covers other components; leave it alone). Add `src/components/location/__tests__/LocationManager.test.tsx`: router renders the list view by default, view switching works for at least 4 of the 10 states, a representative store dispatch fires (e.g. creating a location adds it to state — use `CampaignStoreProvider` with `createCampaignState()` the way `src/components/cooking/__tests__/CookingTab.test.tsx` does), and `onClose` is called from the UI path that closes the manager. Plus at least one render test per extracted view file with representative props. Minimum 14 tests total.

## Hard constraints

- **Pure refactor.** Zero behavior change, zero markup/styling change beyond what extraction forces. Same rendered DOM for the same state.
- `strict: true` TypeScript — `npx tsc --noEmit` must pass with zero errors.
- **No new `as any` casts. No `@ts-ignore` / `@ts-expect-error`.** Use `import type` for type-only imports.
- Do not modify anything under `src/state/`, `src/types/`, or any component outside `src/components/location/`.
- Do not add dependencies. Do not run npm install (node_modules is a symlink, already populated).
- Preserve any pre-existing bugs you find — report them in your summary instead of fixing them.

## Definition of done — self-verify before finishing

Run these yourself from the repo root and fix failures before finishing:

```
npx tsc --noEmit
npx vitest run src/components/location
```

All must pass (the pre-existing `LocationComponents.test.tsx` included). Then write a final summary: one paragraph on how you grouped the 10 view states into files, plus anything that looked like a pre-existing bug.
