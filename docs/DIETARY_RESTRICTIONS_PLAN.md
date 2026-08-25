# Dietary Restrictions on Meal Buffs — Design Concept

**Status:** Designed 2026-08-25 (grill-me session, Devin + Fable). Not yet implemented.
**Origin:** [`INVENTORY_INTEGRATION_FOLLOWUPS.md`](./INVENTORY_INTEGRATION_FOLLOWUPS.md) item #10,
recorded during the cooking-buff design earlier the same day.
**Depends on:** the shipped meal buff (`COOKING_BUFF_WRITE_PATH_PLAN.md`, schema 1.5.2).

## Problem

GURPS diet traits (Restricted Diet, vegetarianism, carnivore homebrew) mean some
characters can't or won't eat a given meal — they shouldn't receive its buff. The
shipped buff assumes everyone eats.

## Decisions

1. **Explicit config, trait-based nudge.** The mechanical source of truth is
   explicit per-character configuration — never trait-name parsing. Free-text trait
   vocabulary meeting free-text `Food.types` vocabulary makes any automatic join a
   silent-poisoning bug factory (contrast: the Magery prefix-match convention worked
   because one canonical word carries one number). Traits are a detection *hint*
   only: a disadvantage/quirk prefix-matching "Restricted Diet" or "Vegetarian"
   renders a "configure diet" nudge when the config is empty.
2. **Two lists on `Character`** (both optional, additive, no schema bump):
   - `dietExcludedFoodTypes?: string[]` — can't eat if the meal contains ANY of these.
   - `dietRequiredFoodTypes?: string[]` — can't eat unless the meal contains AT LEAST
     ONE of these (any-of: a carnivore needs *a* meat, not every kind).
   Eligibility: eats iff no ingredient type ∈ excluded AND (required empty OR ∃
   ingredient type ∈ required).
3. **UI in the character sheet**, near Traits: a "Dietary Restrictions" row with
   chips + multi-selects drawn from the live food-type vocabulary (union of
   `entities.foods[].types`, plus any already-configured strings so stale vocabulary
   never strands a config). The nudge renders there. Not the Manager (per-character
   data), not the inventory panel (not about possessions).
4. **Cook-time snapshot.** On a successful cook, intersect each party character's
   lists against the union of the recipe's ingredient `foodTypes` (already
   snapshotted per ingredient); the result lands as `excludedCharacterIds: Id[]` on
   the `MealBuff`. Diet edits never retroactively change who ate an existing meal
   (same freeze-at-cook philosophy as the rest of the buff).
5. **Any-overlap exclusion, whole-meal granularity.** You can't eat around the meat
   in a stew — no per-ingredient partial eating.
6. **Display-only, like the buff itself.** The banner renders abstainers:
   "🍲 Council Stew — +1 Cryptography *(Soren abstains)*". No mechanical effect
   anywhere; the GM sees at a glance who's unbuffed.
7. **Edge:** ingredients whose food has empty/absent `types` contribute nothing to
   the union — a required-list character is excluded from a typeless meal
   (conservative read).

## Out of scope

- Trait-name parsing as mechanics (hint only, permanently).
- Per-ingredient partial eating / picking around ingredients.
- Per-character buffs replacing the single party-level record.
- Player-facing choice UI ("won't eat tonight") — config is GM-set in v1.
- Retroactive application to an active buff on config change.

## Testing decisions

- Eligibility function (pure): excluded-any-overlap; required-any-of; both lists
  together; empty lists; typeless-ingredient union; no-config character always eats.
- Cook dispatch: `excludedCharacterIds` snapshotted correctly from party at cook
  time on both cook paths; failure cooks still write nothing.
- Banner: abstainer names render; no abstainer clause when everyone eats; stale-day
  behavior unchanged.
- Nudge: renders on prefix-matched trait + empty config; absent otherwise.
- Persistence: optional fields round-trip; old saves load with no restrictions.

## Next step

Sized for a single codex-shepherd delegation. Touches `Character` type (additive),
the cooking dispatch sites, `MealBuff` type (additive field), `MealBuffWidget`, and
a character-sheet section. Sequence after the take-from-shared lane merges (both
touch character-adjacent surfaces, and the pipeline is serial through the reducer
anyway).
