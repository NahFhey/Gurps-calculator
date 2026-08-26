# SPEC: Result History — Structured Changelog Upgrade (Phase 13b, lane 2)

## Background

React 18 + TypeScript (strict) GURPS campaign manager, Redux-style state with
Immer (`src/state/campaignReducer.ts`). Full design: `docs/ACTIVITY_SYSTEM_13B_PLAN.md`
§"Lane 2" (in this worktree) — READ IT FIRST; this spec implements it exactly.

The activity changelog (`state.logs.entries`, rendered by
`src/components/ChangelogTab.tsx`, entries built by
`src/utils/activityLogger.ts`) is an unbounded array of message strings with no
search or filters. You will make it structured, capped, and searchable.

## Deliverable 1 — LogEntry structure + reducer stamping + cap

`LogEntry` is defined in `src/state/campaignReducer.ts`. Extend it (all new
fields OPTIONAL — legacy entries persist in saves and must load untouched):
- `day?: number`, `slot?: number` — game time
- `meta?: { characterIds?: string[]; characterNames?: string[]; itemNames?: string[]; quantity?: number; taskId?: string }`

Reducer changes:
- Add ONE private helper in campaignReducer (e.g. `appendLogEntry(draft, entry)`)
  that: stamps `entry.day = draft.time.day` and `entry.slot = draft.time.slot`
  (only when not already set), unshifts, then trims the array to a
  `MAX_LOG_ENTRIES = 2000` constant (drop from the END — oldest entries — the
  array is newest-first).
- Replace EVERY `draft.logs.entries.unshift(...)` site with the helper. Grep for
  all of them (`logs.entries.unshift` — sites near lines ~721, ~749, ~807, ~860,
  ~875) and any other direct writes except the wholesale `logs.entries =` SET
  (leave that one as-is but apply the cap after it too).

## Deliverable 2 — activityLogger meta passthrough

`createActivityLogEntry` (`src/utils/activityLogger.ts`) ALREADY accepts
`characterName`, `itemName`, `quantity` in `details` but silently drops them.
- Extend `details` with optional `characterIds?: string[]`,
  `characterNames?: string[]`, `itemNames?: string[]`, `taskId?: string`
  (keep the existing singular `characterName`/`itemName` accepted and fold them
  into the plural arrays).
- Populate `entry.meta` from whatever is provided. Do NOT stamp day/slot here —
  the reducer does that.
- Update the per-system creator families (`alchemyLog`, `cookingLog`,
  `craftingLog`, `gatheringLog`, `inventoryLog`, `combatLog`) to pass through to
  meta the data their existing parameters already carry (worker/character names,
  item names, quantities). Then sweep the CALL SITES across the codebase and
  pass additional meta ONLY where the needed value is already in scope at the
  call site (e.g. a task's `leaderId`, an item name variable). Do NOT thread new
  values through component props or contexts to reach a call site — if a site
  doesn't have the data locally, leave it as-is.
- **Files you must NOT touch even if they contain log calls:**
  `src/components/downtime/DowntimeContext.tsx`, all `*TaskForm.tsx` files, and
  anything under `src/components/downtime/views/` whose name ends in
  `TaskForm.tsx` (a parallel work lane owns them). If a log call site lives in
  one of those, skip it and list it in your final summary.

## Deliverable 3 — ChangelogTab filters

`src/components/ChangelogTab.tsx` (currently ~63 lines: flat reverse-chron list
with GM/player visibility masking). Add four client-side controls, computed in a
`useMemo` chain where visibility masking applies BEFORE any filtering:
1. Text search input — case-insensitive substring over `payload.message` (and
   `payload.maskedMessage` when that's what would render). Works on legacy
   entries.
2. Category filter — dropdown/chips over the activity families. `type` is
   formatted `"<family>.<action>"` (e.g. `alchemy.batch_started`); filter on the
   family prefix. Families: alchemy, cooking, crafting, gathering, inventory,
   combat, plus "all".
3. Day range — two numeric inputs (from/to, inclusive) matched against
   `entry.day`; entries without `day` (legacy) are shown only when the range is
   unset.
4. Character — dropdown of party characters (from
   `state.entities.characters`), matching `meta.characterIds` first, falling
   back to `meta.characterNames` (case-insensitive). Entries without meta never
   match a selected character.
Empty/default state of every control = no filtering (today's behavior). Style
per the app (Tailwind, dark slate); keep the tab lightweight — no pagination,
no saved presets, no export.

## Constraints

- `strict: true` clean (`npx tsc --noEmit`); NO new `as any`; `import type` for
  type-only imports. No new dependencies. Do not commit to git.
- No schema-version bump: new LogEntry fields are optional and additive; old
  saves must load unchanged (verify: a state with legacy message-only entries
  renders and filters correctly).
- Do not change what messages SAY — only add structure around them.

## Definition of done — self-verify before finishing

1. Reducer tests (extend the existing campaignReducer test file or add one
   following its conventions): appended entries get day/slot stamped from
   state.time; pre-stamped entries keep their values; the 2,000 cap trims
   oldest; the wholesale SET path also ends capped.
2. activityLogger tests: meta populated from creator args; singular
   characterName folds into characterNames; absent data → absent meta keys.
3. ChangelogTab component tests: text search hits legacy entries; family filter;
   day-range excludes legacy entries only when a range is set; character filter
   matches by id and by name fallback; a `visibility: 'gm'` entry stays masked
   from player view even when it matches a search.
4. Run and pass, fixing failures yourself:
   `npx vitest run src/state/ src/components/ChangelogTab* src/utils/__tests__/` (adjust
   paths to where the tests actually live) and `npx tsc --noEmit`.
5. Final summary: one paragraph — which unshift sites were converted, which call
   sites got meta, and which sites you skipped because the data wasn't in scope
   or the file was off-limits.
