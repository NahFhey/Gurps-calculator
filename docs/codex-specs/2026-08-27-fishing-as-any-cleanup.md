# SPEC: Fishing views `as any` cleanup

**Date:** 2026-08-27
**Origin:** ROADMAP.md 10a drift note — ~60 `as any` casts reintroduced into the
Fishing downtime views during the downtime-system rework.

## Background (why)

This codebase is strict TypeScript with a hard house rule: no `as any`, fix types
at the source. The fishing downtime views violate it ~61 times:
`FishingResolutionPanel.tsx` (32), `FishingActivity.tsx` (18),
`FishingTaskForm.tsx` (10), `FishingTaskCard.tsx` (1). Survey findings you should
verify and exploit:

- The canonical gathering types in `src/types/gathering.ts`
  (`GatheringSpeciesExtended`, `GatheringBaitExtended`, `GatheringToolExtended`,
  `GatheringEnvironmentExtended`, `GatheringTableExtended` — aliased as
  `GatheringSpecies` etc. in `src/types/campaign.ts` lines ~614–637) **already
  declare almost every field the casts reach for**: `species.st`, `.tags`,
  `.foodType`, `.yieldMeatFormula`, `.secondaryMaterialType`,
  `.yieldSecondaryFormula`; `bait.quantity`, `.rollBonus`, `.attractsSpeciesIds`;
  `spot.skillMod`; `tool.toolType`, `.bonuses`, `.skillBonus` (deprecated
  optional); `table.entries`.
- The values are already canonically typed end-to-end: `useDowntimeContext()`
  (`src/components/downtime/DowntimeContext.tsx` lines ~58–70) exposes
  `fishingSpots: GatheringEnvironment[]`, `fishSpecies: GatheringSpecies[]`,
  `fishingBait: GatheringBait[]`, `gatheringTables: GatheringTable[]`, and
  `FishingResolutionPanelProps` declares the same. So the majority of casts are
  **no-ops** — delete the cast, keep the expression.

**This is a pure typing refactor. Zero behavior change.** Emitted JS must be
identical in effect; only type annotations, type declarations, and cast removals
change. Do not "fix" logic you believe is wrong — if you find a genuine logic
bug, leave the behavior as-is and note it in your final summary.

## Deliverable

Remove **every** `as any` (and `as any[]`) from these four files:

- `src/components/downtime/views/FishingResolutionPanel.tsx`
- `src/components/downtime/views/FishingActivity.tsx`
- `src/components/downtime/views/FishingTaskForm.tsx`
- `src/components/downtime/views/FishingTaskCard.tsx`

Also fix the explicit `any` parameter `leader: any | undefined` in
`calculateFishingResultsAuto` (`FishingActivity.tsx` ~line 79) — type it
`Character | undefined` and resolve whatever member accesses (e.g. `leader.st`)
made someone reach for `any`, using the correct source type or the existing
character helpers (look at how other resolution code reads character attributes,
e.g. `getCharacterSkills` from `src/types/characterSheet.ts` and how
`FishingResolutionPanel` computes `leaderST`).

### How, by case

1. **No-op casts** (the majority): delete the cast. `(caughtSpecies as any)?.st`
   → `caughtSpecies?.st`, `fishSpecies as any[]` → `fishSpecies`, etc. If
   deleting a cast produces a real tsc error, the case belongs to 2–4 below.
2. **Legacy dual-read fields** not on the canonical type — e.g.
   `(spot as any)?.defaultTables` (pre-Extended persisted saves used
   `defaultTables`; modern data uses `defaultsByMode`). Follow the existing
   precedent in `src/types/gathering.ts` (see `category?` on
   `GatheringSpeciesExtended` and `skillBonus?`/`yieldBonus?` on
   `GatheringToolExtended`): add the field as optional with a `@deprecated`
   JSDoc explaining it's a legacy-save dual-read. Type it as precisely as the
   legacy shape allows (look at how the fallback value is consumed to infer its
   shape — for `defaultTables` it's used like `ModeDefaults`).
3. **Util bridge casts** — `rollNetCatch(catchTable as any, species as any)` and
   `rollOnCatchTable(catchTable as any, …)` (`src/utils/gathering.ts` declares
   `RollableTable` / `NetSpecies`). The canonical `GatheringTableExtended` is
   likely already structurally assignable to `RollableTable` — if so the casts
   just vanish. Where inference genuinely fails, adjust the **util's** parameter
   types (e.g. accept the canonical types or a shared structural subset) rather
   than casting at call sites. Do not weaken the util's internal typing; keep
   its other callers (foraging/mining views, tests) compiling unchanged.
4. **Genuinely absent fields**: if the runtime data really carries a field no
   type declares and no legacy precedent covers, add it to the canonical
   interface in `src/types/gathering.ts` (optional, documented) — never cast.

### Forbidden

- `as any`, `as unknown as X`, `@ts-ignore`, `@ts-expect-error`, new `any` in
  signatures or generics.
- Loosening existing types (e.g. changing a union to `string`) to make casts
  unnecessary.
- Behavior changes, dead-code deletion beyond the casts themselves, formatting
  churn in untouched lines.

## Definition of done — self-verify all of these before finishing

```bash
# 1. Zero as-any in the fishing views (must print nothing):
rg -n "as any" src/components/downtime/views/Fishing*.tsx

# 2. Zero explicit any left in FishingActivity's local function signatures:
rg -n ": any" src/components/downtime/views/Fishing*.tsx

# 3. Clean compile:
npx tsc --noEmit

# 4. Tests green (fishing + neighbors that share the touched types/utils):
npx vitest run src/components/downtime src/utils/__tests__ src/state 2>&1 | tail -6
```

Also confirm the project-wide `as any` count strictly decreased by your removals
and nothing new appeared elsewhere: run
`rg -c "as any" src --glob '!**/__tests__/**' | sort` before and after and
compare (only the four fishing files may change).

Fix all failures yourself before finishing.

## Final summary requested

One paragraph: which casts were pure no-ops vs. which needed type-source fixes
(list the fields you added to `src/types/gathering.ts` and any util signature
changes), plus anything that smelled like a real logic bug you deliberately left
untouched.
