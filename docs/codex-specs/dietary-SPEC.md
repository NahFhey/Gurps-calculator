# Task: Implement Dietary Restrictions on Meal Buffs

## Background — read the design doc first

GURPS 4e campaign-management app (React 18 + TypeScript strict + Tailwind + Vite, Vitest/jsdom; Redux-style Immer store). **The design is fully decided — do not redesign.** Read `docs/DIETARY_RESTRICTIONS_PLAN.md` and implement its decisions exactly. It builds on the shipped meal buff (`docs/COOKING_BUFF_WRITE_PATH_PLAN.md`: `MealBuff` on `CampaignState`, dispatched from the cooking router, rendered by `MealBuffWidget`). Sibling lanes from this week (meal buff, attunement, consumables, take-from-shared — all `Codex-Authored` in git log) are your idiom references.

Summary: two explicit per-character food-type lists decide who can eat a meal; trait names only power a nudge; eligibility is computed and snapshotted onto the buff at cook time; the banner shows abstainers. Display-only throughout.

## Deliverables

### 1. Types — `src/types/campaign.ts` (additive only)

- `Character` gains `dietExcludedFoodTypes?: string[]` and `dietRequiredFoodTypes?: string[]` (doc comments per the design: excluded = can't eat if meal contains ANY; required = can't eat unless meal contains AT LEAST ONE; absent/empty = unrestricted on that axis).
- `MealBuff` gains `excludedCharacterIds?: Id[]` (snapshot of party characters who could not eat this meal, computed at cook time). All optional — **no schema bump**.

### 2. Eligibility util — `src/utils/dietaryRestrictions.ts` (new, pure)

- `canEatMeal(character: Pick<Character,'dietExcludedFoodTypes'|'dietRequiredFoodTypes'>, mealFoodTypes: readonly string[]): boolean` — eats iff no meal type ∈ excluded AND (required empty/absent OR ∃ meal type ∈ required). Case-sensitivity: compare food-type strings case-insensitively and trimmed (both sides come from the same GM vocabulary, but hand-entry drift is cheap to absorb here).
- `getMealFoodTypes(ingredients: readonly { foodTypes?: string[] }[]): string[]` — union of ingredient `foodTypes` (recipes snapshot these per ingredient already; empty/absent types contribute nothing).
- `computeExcludedCharacterIds(characters: Character[], mealFoodTypes: readonly string[]): Id[]` — party characters failing `canEatMeal`.
- `hasDietTraitHint(character: Character): boolean` — true when any `gcsData` disadvantage or quirk name, trimmed + lowercased, starts with `'restricted diet'` or `'vegetarian'` (the nudge predicate — mirrors the Magery prefix-match convention in `src/state/selectors/inventorySelectors.ts` `selectMageryLevel`).

### 3. Cook-time snapshot — `src/components/cooking/CookingTab.tsx`

In both `create()` and `executeRemake()`, where `setMealBuff` is dispatched on success: compute `excludedCharacterIds` via the util (party characters from `state.entities.characters`; meal food types from the recipe's ingredient snapshots) and include it in the dispatched `MealBuff`. Note for the remake path: use the recipe's stored `ingredients` (each has `foodTypes`); substitutions changing actual types is out of scope — the recipe snapshot is authoritative (matches the design's whole-meal granularity).

### 4. Banner — `src/components/header/MealBuffWidget.tsx`

When the active buff has a non-empty `excludedCharacterIds`, append an abstainer clause: resolve names from `state.entities.characters` (fall back to skipping unresolvable ids), render as `(Soren abstains)` / `(Soren, Rina abstain)` in a muted style after the skills, in both `compact` and full modes (title/tooltip includes it too). No clause when empty/absent.

### 5. Character-sheet section — `src/components/character-sheet/DietSection.tsx` (new)

- Mounted in `CharacterSheet.tsx` adjacent to `TraitsSection` (~line 239). Follow the sheet's existing section conventions exactly — inspect how a simple section (e.g. `NotesSection`) receives data, handles the sheet's edit/draft state, and persists via the sheet's save path; mirror it. Additive mount only.
- Displays two chip rows: "Won't/can't eat" (excluded) and "Requires" (required). Each has a multi-select/add control drawing options from the live food-type vocabulary: union of `types` across `state.entities.foods`, plus any strings already configured on the character (so stale vocabulary never strands a config). Chips removable.
- **Nudge:** when `hasDietTraitHint(character)` and both lists are empty/absent, render a subtle inline prompt: "Has a diet-related trait — configure dietary restrictions?" (text + styling consistent with the sheet's muted hint idiom). No nudge otherwise.
- When both lists are empty and no nudge applies, the section renders a compact single line ("No dietary restrictions") consistent with other sections' empty states.

### 6. Tests (minimum 20 new)

- `src/utils/__tests__/dietaryRestrictions.test.ts`: excluded any-overlap; required any-of; both axes together; empty/absent lists; case/trim insensitivity; typeless ingredients; union helper; nudge predicate (prefix variants "Restricted Diet (Vegetarian)", "vegetarianism"→false unless it starts with the prefix — assert exact prefix semantics, "Vegetarian" matches, "Lacto-Vegetarian" does not); computeExcludedCharacterIds over a mixed party.
- Cook dispatch (extend the existing meal-buff dispatch test style in `src/components/cooking/__tests__/`): successful cook writes `excludedCharacterIds` for a party where one character excludes an ingredient type and another requires an absent type; unrestricted party → empty array or absent; failed cook still writes nothing.
- Widget: abstainer clause renders with resolved names (singular and plural forms); absent when empty; unresolvable id skipped.
- DietSection: chips render from character data; add/remove persists through the sheet's save path; vocabulary includes foods union + configured strays; nudge visibility rules (hint trait + empty config → shown; configured → hidden; no trait → hidden).
- Persistence: optional fields round-trip; old save without fields loads unrestricted.

## Hard constraints

- `strict: true` — `npx tsc --noEmit` zero errors. **No new `as any`, no `@ts-ignore`/`@ts-expect-error`.** `import type` for types.
- God nodes (`campaign.ts`, `campaignStore.tsx`, `campaignReducer.ts`): strictly additive; the reducer likely needs NO change at all (the buff payload just grows an optional field — verify, don't refactor).
- **No trait-name parsing as mechanics** — the trait check gates only the nudge, never eligibility.
- Do not touch the meal-buff expiry/validity logic, the cooking roll math, `Food`/`Recipe` types, or the Manager.
- No new dependencies; do not run npm install (node_modules is a symlink, already populated).
- Preserve pre-existing bugs; report them.

## Definition of done — self-verify before finishing

```
npx tsc --noEmit
npx vitest run src/utils/__tests__/dietaryRestrictions.test.ts src/components/cooking src/components/header src/components/character-sheet 2>&1 | tail -5
npx vitest run
```

All green (full suite baseline at this commit: 3,640 tests; expect that plus yours; server-integration EPERM in the sandbox is a known environment limit). Final summary: one paragraph on implementation choices — especially how DietSection integrates with the sheet's draft/save flow — plus any pre-existing bugs found.
