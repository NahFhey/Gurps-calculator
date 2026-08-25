# Task: Implement the Cooking Buff Write Path (meal buff)

## Background — read the design doc first

This is a GURPS 4e campaign-management app (React 18 + TypeScript strict + Tailwind + Vite, Vitest/jsdom; Redux-style store with Immer in `src/state/campaignReducer.ts`, accessed via `useCampaignStore()` from `src/state/campaignStore.tsx`).

**The design is fully decided — do not redesign.** Read `docs/COOKING_BUFF_WRITE_PATH_PLAN.md` in this repo and implement exactly its decisions. Summary: cooking a recipe successfully grants the party a display-only daily buff (+1 to each skill named in the recipe's existing `skills` field). One nullable party-level record; latest cook wins; valid only on the calendar day it was cooked (lazy read-time check, NO expiry sweep in any reducer); snapshot semantics; failure grants nothing; both cook paths dispatch; cook = eat.

## Deliverables

### 1. Type — `src/types/campaign.ts` (additive only)

```ts
export interface MealBuff {
  day: number;          // state.time.day at cook time — buff valid iff equal to current day
  recipeId: string;
  recipeName: string;
  skills: string[];     // snapshot of Recipe.skills at cook time
}
```

Add `mealBuff: MealBuff | null` to `CampaignState` (top level, NOT inside entities). Update `createCampaignState` in `src/state/campaignReducer.ts` to initialize it to `null`.

### 2. Action — `src/state/campaignReducer.ts` + `src/state/campaignStore.tsx` (additive only)

- New action `{ type: 'setMealBuff', payload: MealBuff | null }` in the reducer's action union and switch (a simple assignment case). Always-succeed.
- New wrapper in campaignStore's actions: `setMealBuff(buff: MealBuff | null)`.
- These two files are high-blast-radius god nodes: make strictly additive edits, touch nothing else in them.

### 3. Dispatch sites — `src/components/cooking/CookingTab.tsx` (the router)

In `create()` and `executeRemake()`: after the existing success classification, if `result` is `'Success'` or `'Critical Success'`, dispatch `setMealBuff` with `{ day: <current day from state.time>, recipeId, recipeName, skills }` — snapshot the skill list (spread into a new array). On Failure/Critical Failure dispatch nothing (do NOT clear an existing buff — a failed dinner doesn't un-eat lunch). Find how the router reads current time from state (`state.time.day` or equivalent — check the actual shape; the reducer's `advanceTime` case shows it).

### 4. Validity helper — `src/utils/mealBuff.ts` (new)

`isMealBuffActive(buff: MealBuff | null, currentDay: number): boolean` — true iff buff non-null and `buff.day === currentDay`. Trivial, but it's the single source of truth for validity — the widget must use it, and tests target it.

### 5. Display — `src/components/header/MealBuffWidget.tsx` (new)

Follow `src/components/header/WeatherWidget.tsx`'s pattern (it reads the store directly and has a `compact` prop; mounted in the header). The widget: reads `state.mealBuff` and current day via `useCampaignStore()`, renders nothing when `isMealBuffActive` is false, otherwise a compact banner: a food emoji/icon, the recipe name, and the skill list rendered as `+1 <Skill>` chips or a joined string (e.g. "Root Stew — +1 Cryptography, +1 Guns, +1 Artist"). Match WeatherWidget's Tailwind styling idiom. Export from `src/components/header/index.ts`.

**Mount:** in `src/unified/UnifiedShell.tsx`, render `<MealBuffWidget compact />` immediately next to the existing `<WeatherWidget compact />` (line ~296). This is the ONLY change allowed in UnifiedShell — one import + one JSX line.

### 6. Migration — schema 1.5.1 → 1.5.2

Follow the existing pattern in `src/utils/dataMigrations.ts` (see `'1.5.0:1.5.1'` and its neighbors) and whatever `src/persistence/dataMigration.ts` documents for the chain: bump `CURRENT_SCHEMA_VERSION` to `1.5.2`, add `migrateTo1_5_2` that sets `mealBuff: null` when the field is absent (idempotent). Ensure load/hydrate paths tolerate old saves (absent field → null), and that save/load round-trips a non-null buff.

### 7. Tests (minimum 18 new)

- Reducer: `setMealBuff` writes the record; overwrites an existing one (latest wins); accepts null; state otherwise untouched.
- Dispatch-site tests (component-level, real store, like `src/components/cooking/__tests__/CookingTab.test.tsx` does for meal prep): successful cook writes `mealBuff` with correct day/skills snapshot; failed cook (roll high) leaves `mealBuff` unchanged — including the case where a previous buff exists; remake path writes it too.
- `isMealBuffActive`: null, same-day, stale-day.
- Migration: 1.5.1 payload without the field gains `mealBuff: null`; idempotent re-run; round-trip of a non-null buff through save/load.
- Widget: renders name + skills when active; renders nothing when null; renders nothing when the day has advanced past `buff.day`.

## Hard constraints

- `strict: true` — `npx tsc --noEmit` zero errors. **No new `as any`, no `@ts-ignore`/`@ts-expect-error`.** `import type` for types.
- Additive-only edits to `campaignReducer.ts`, `campaignStore.tsx`, `campaign.ts`; one-import-one-line edit to `UnifiedShell.tsx`; dispatch additions only in the cooking router (`create`/`executeRemake`); everything else is new files.
- Do NOT add expiry logic to `advanceTime` or any reducer case. Validity is read-time only.
- Do NOT touch the recipe creation UI, `Recipe` type, weather system, or activity calculator.
- No new dependencies; do not run npm install (node_modules is a symlink, already populated).

## Definition of done — self-verify before finishing

```
npx tsc --noEmit
npx vitest run src/components/cooking src/utils/__tests__ src/state/__tests__ src/components/header 2>&1 | tail -5
npx vitest run
```

All green (full suite currently 3,541 tests / 209 files at this commit — expect that plus yours). Then a final summary: one paragraph on implementation choices, and anything that looked like a pre-existing bug (do NOT fix pre-existing bugs — report them).
