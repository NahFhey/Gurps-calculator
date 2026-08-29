# Character Lifecycle (12c) — Design Concept

**Status:** Designed 2026-08-28 (grill-me session, 6 questions + 4 batched
calls). Two specs written same day: `2026-08-28-points-economy-12c-laneA.md`
and `2026-08-28-templates-npcgen-12c-laneB.md`. **Dispatch queued after the
13c chain completes** (study → social) — Lane A collides with Study's
advancement-entry helper.
**Origin:** ROADMAP.md Phase 12c (creation wizard/templates, level-up/
point-spend workflow, comparison view, NPC generator).

## Problem

The app has no advancement economy: no earned-points pool, no cost-enforced
spending, no award moment. Templates are hollow stubs (name + cosmetic "150
pts" on a blank 10/10/10/10 character). No NPC generation, no comparison view.
Cost constants are scattered across three UI components, and five
sense-attribute point costs are silently dropped from every displayed total (a
live bug).

## Decisions (all locked in grilling)

1. **Bundle of lanes, point-spend is the centerpiece.** Comparison view is
   first on the chopping block if appetite runs out.
2. **Real earned-points economy.** `unspentPoints` on the character's
   `gcsData` (rides exports), fed by a GM **Award Points** action (amount +
   note, party-wide or selected characters) from the party column header,
   drained by spending. Awards and spends live in a dated point ledger.
3. **Spending menu, three enforcement tiers:** skills/spells fully computed
   (existing B170 ladder); attributes/secondaries fully computed (shared cost
   module; raising DX/IQ recomputes dependent skill levels); traits
   GM-adjudicated manual cost, including negative-cost disadvantages that
   credit the pool.
4. **Cart-with-confirm.** A dedicated Spend Points modal (context menu + pool
   badge on the sheet): pending changes accumulate against the running budget;
   one atomic Confirm applies sheet changes + history entries + pool deduction.
   Raw edit mode stays the GM's unrestricted escape hatch.
5. **Templates become seeded, editable data entities**
   (`entities.characterTemplates`): six genuinely fleshed-out generic-fantasy
   150-point builds seeded on load (ensure-on-hydrate precedent), Manager view
   for rename/describe/delete, and **"Save as template"** on any character as
   the authoring path. Creation modal previews template contents. Non-setting-
   exclusive by construction (currency-config reasoning).
6. **NPC generator outputs full `Character` entities** (`isPlayer: false`)
   from a template: count, variance level (none / light ±1 / heavy ±2 +
   optional trait swap), syllable-based name generator with reroll, honest
   point totals recomputed. One template system feeds creation and generation.
   Party-column NPC filtering = recorded followup; CharacterLibrary bridge out
   of scope.

### Batched calls

- **Comparison view:** context-menu "Compare with…" modal, two characters
  side-by-side, all rows shown (reusing `characterDiff` field tables),
  differences highlighted.
- **`character` changelog family** covering awards, spends, generated NPCs.
- **Rules consolidation + bundled bug fixes:** shared cost-constants module;
  `calculateTotalPoints` becomes the single total everywhere **and gains the
  five missing sense-attribute costs** (visible totals change, correctly); one
  shared skill-advancement helper used by SkillHistorySection, Study's award,
  and the spend cart; fix dangling `skillHistory.skillId` after
  duplicate/import; fix the context-menu Edit stub (selects but never opens
  edit mode).
- **Two specs, sequential dispatch** after 13c: Lane A (points economy), Lane
  B (templates + NPC generator + comparison).

## Out of scope (recorded followups)

- Trait/advantage catalog with real costs (huge; manual tier covers v1).
- Point-budget enforcement at character *creation* (wizard stays free-build).
- Party-column NPC section/filter for generated-NPC clutter.
- CharacterLibrary ↔ Character bridging; racial templates; template
  import/export as files (campaign export already carries entities).
- Attribute/trait advancement via Study (Study stays skills-only).
- Spending approval flow for multiplayer players (GM-driven app v1).

## Testing decisions

Lane A: cost-module unit tests (incl. corrected totals with sense points);
shared advancement helper (existing + new skill, level recomputation);
cart component tests (cost preview, insufficient-funds block, atomic apply
payload, disadvantage credit); award modal; ledger entries; SkillHistorySection
and Study suites stay green after refactor; `regenerateGCSDataIds` skillId
remap test. Lane B: template seeding idempotence; save-as-template snapshot
(images stripped); creation-from-template completeness; NPC generator with
injected RNG (deterministic jitter, name reroll, honest totals, dependent
skill recomputation); comparison rows include unchanged fields.
