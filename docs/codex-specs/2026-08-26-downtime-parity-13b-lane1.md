# SPEC: Downtime Parity Lane — Tool-Conflict UX Unification + Requirement Preview Parity (Phase 13b, lane 1)

## Background

React 18 + TypeScript (strict) + Vite GURPS campaign manager. Redux-style state
(`useCampaignStore()` from `src/state/campaignStore.tsx`), downtime task system in
`src/state/downtime/` with per-activity forms under `src/components/downtime/views/`.

Two UX gaps, each of which already has a finished reference implementation
elsewhere in the codebase. Your job is to bring the laggards up to the existing
standard. NO new design — copy the established patterns.

## Deliverable 1 — Proactive tool-reservation UX in Mining and Foraging forms

**Current state:** `validateToolExclusivity`
(`src/state/downtime/downtimeValidation.ts:180-207`) blocks task creation with a
`TOOL_CONFLICT` error when a requested tool is already reserved by another
pending/in-progress task in the same (dayKey, slot). `FishingTaskForm.tsx`
(~110-111, ~640-669) PROACTIVELY greys out reserved tools (lock icon, "In use"
badge, disabled checkbox) using `selectReservedToolIdsForSlot`. But
`MiningTaskForm.tsx` and `ForagingTaskForm.tsx` have NO proactive check — users
only find out via the reactive red `ValidationError` card at submit.

**Also:** a shared component `src/components/downtime/views/shared/ToolSelector.tsx`
already implements the proactive-greying UX but is used ONLY by its own tests —
it was an unfinished consolidation attempt.

**Required:**
- Wire the shared `ToolSelector` into `MiningTaskForm.tsx` and
  `ForagingTaskForm.tsx`, replacing their current tool-picking UI, so reserved
  tools are greyed/disabled with the same visual language Fishing uses. Adapt
  `ToolSelector`'s props if needed (small, additive changes only).
- Reserved-tool data comes from the same selector Fishing uses
  (`selectReservedToolIdsForSlot` — check its exact import path and call shape in
  FishingTaskForm).
- Do NOT touch `FishingTaskForm.tsx` — its inline implementation works; leave
  consolidating it as a future cleanup.
- The reactive `ValidationError` path stays as the backstop (unchanged).

## Deliverable 2 — Requirement previews for Alchemy and Cooking

**Reference implementation:** `CraftingDesigns.tsx` (~75-79, ~158-173): computes
`canStart` from required-vs-available materials, renders a "Required Materials"
list with green/red per-line "(N available)" and disables the start button with
a "Need Materials" label when insufficient.

**Alchemy** (`src/components/alchemy/BatchesView.tsx`): the batch-start flow
(~233-262) only hard-blocks with `alert('Insufficient X: need YU, have ZU')` at
commit time. Add a live preview in the batch-composition UI: as ingredients are
added to the pending batch, render a per-ingredient sufficiency list —
ingredient name, units required vs `AlchemyReagent.quantity` on hand, green/red
— and disable the start/commit button with an explanatory label when any line is
red. Availability reads the REAGENT pool (`reagents` prop already available in
the view) — alchemy consumes reagents, not inventory materials. Keep the alert
as a backstop. Do not change any consumption logic.

**Cooking** (`src/components/cooking/` — CookingTab router + views): the primary
meal-prep path selects ingredients and consumes via
`actions.consumeFoods('party', ...)`, blocking with alerts when short. Add the
same style of sufficiency preview to the primary meal-prep flow: per-ingredient
required-vs-available (party food holdings) with green/red lines and a disabled
confirm button when short. Availability must read the party inventory food
holdings the consumption path uses (find the selector the existing code uses —
post schema 1.5.4, holdings live on the party `Inventory` record; there is a
compat selector for totals). Do not change consumption logic or the meal-buff
behavior. If `RemakeView` already has a `hasEnough` substitution flow, leave it
alone — only the primary prep path gets the preview.

## Constraints

- `strict: true` clean (`npx tsc --noEmit`), NO new `as any`, `import type` for
  type-only imports.
- Files you may edit: `MiningTaskForm.tsx`, `ForagingTaskForm.tsx`,
  `src/components/downtime/views/shared/ToolSelector.tsx`,
  `src/components/alchemy/BatchesView.tsx`, files under
  `src/components/cooking/`, plus test files. Nothing else — in particular do
  NOT touch `src/state/**` (read via existing selectors only),
  `FishingTaskForm.tsx`, or `src/components/manager/**`.
- Match each file's existing style (Tailwind classes, dark slate palette — copy
  the exact visual patterns from the reference implementations).
- No new dependencies. Do not commit to git.

## Definition of done — self-verify before finishing

1. Component tests (extend existing test files or add new ones in the matching
   `__tests__/` dirs, following existing patterns):
   - Mining + Foraging: a tool reserved by another task in the same slot renders
     disabled/greyed; an unreserved tool is selectable; submitting with only
     unreserved tools passes validation.
   - Alchemy: preview shows red for an ingredient exceeding on-hand reagent
     quantity, green otherwise; start button disabled when any red.
   - Cooking: preview shows red/green per ingredient vs party food holdings;
     confirm disabled when short.
2. Run and pass, fixing failures yourself:
   - `npx vitest run src/components/downtime/ src/components/alchemy/ src/components/cooking/`
   - `npx vitest run src/state/downtime/`
   - `npx tsc --noEmit`
3. Final summary: one paragraph — what ToolSelector prop changes were needed,
   where each preview lives in the component tree, and which selectors feed the
   cooking availability numbers.
