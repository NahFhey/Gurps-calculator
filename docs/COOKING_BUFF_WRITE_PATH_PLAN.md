# Cooking Buff Write Path — Design Concept

**Status:** Designed AND implemented 2026-08-25 (grill-me session → codex-shepherd, same day). Schema 1.5.2. Browser-verified: cook → banner, day advance → gone.
**Origin:** [`INVENTORY_INTEGRATION_FOLLOWUPS.md`](./INVENTORY_INTEGRATION_FOLLOWUPS.md) item #1.

## Problem

Cooking is supposed to grant the party a temporary daily buff, but no buff exists in
state. Today a cook writes a `RecipeCreationLog` (MoS + result tier), decrements
`Food.quantity`, and logs — nothing else. The table runs the buff on GM voice.

## Solution shape

One nullable party-level record, written by cooking, expired by the calendar, read by
a display banner. No new subsystem.

## Decisions (grilling session, in order)

1. **The buff is a flat +1 per named skill/attribute** listed in the recipe's existing
   `Recipe.skills` field — that field IS the buff spec ("Skill Names (Granted by
   Recipe)"). Any game-legal skill or attribute name is a valid entry; entries stay
   plain strings (no typed union in v1). Table example: +1 Cryptography, Guns, Artist.
2. **No magnitude scaling by result tier.** Critical success is already expressed as an
   extra skill slot at recipe creation (the existing "Critical Success? (+1 roll)"
   checkbox); it does not bump +1 to +2.
3. **Failure and Critical Failure grant nothing.** Ingredients still consumed, creation
   log still written. No debuff (food-poisoning mechanics are out of scope).
4. **Both cook paths grant on success:** `create()` and `executeRemake()` in the
   cooking router are symmetric dispatch sites.
5. **Party-wide; everyone eats in v1.** The People count remains what it already is —
   a linear ingredient-quantity gate (1 ingredient per person, no leftovers) — not a
   buff-eligibility check. No who-ate picker.
6. **One buff slot, latest cook wins.** A new successful cook replaces the active
   buff. No stacking, no same-skill combination rules, no multi-meal days.
7. **Expiry is calendar-day validity, checked lazily at read time.** The record stores
   the day it was cooked; it is valid iff `buff.day === state.time.day`. No expiry
   sweep in the reducer, no coupling to the shared `advanceTime` case (which travel
   also uses). Known accepted quirk: a Night cook lives one slot.
8. **Storage: a single top-level nullable field on `CampaignState`** (e.g.
   `mealBuff: MealBuff | null`). Not an entities pseudo-collection, not a speculative
   `effects` slice. Schema-version bump; load-time migration defaults it to `null`.
   Persists across save/reload; the day check handles staleness for free.
9. **Snapshot, not reference:** the record copies `{ day, recipeId, recipeName,
   skills[] }` at cook time. Editing or deleting the recipe later never retroactively
   changes or dangles today's buff (same freezing philosophy as `creationHistory`).
10. **Read side v1 is display-only:** a header-area banner in the weather-widget
    pattern — "Meal: Root Stew — +1 Cryptography, Guns, Artist (today)" — visible to
    all viewers, absent when no valid buff. No automatic application into any roll
    math anywhere.
11. **Cook = eat.** The buff writes immediately on a successful cook; there is no
    separate "party eats" step (cook-now-eat-later is followup #5, stored meals).

## Out of scope (definition of done depends on these staying out)

- **Mechanical application into rolls** — no name-matching into `gcsData.skills`,
  combat math, or the activity calculator. Followup: fold into downtime activity
  bonuses where skill names match cleanly.
- **Dietary restrictions** (new followup, recorded this session): GURPS diet traits
  flagging characters who can't/won't eat a given meal → per-character exclusion.
  Data hook exists (`Food.types`); trait detection convention needs its own design
  pass (same fragility class as the attunement Magery-sourcing question).
- **Who-ate subset / partial meals** (feeds 4, party of 6) — belongs with followup #5.
- **Stored/prepared meals** — existing followup #5, unchanged.
- **Critical-failure debuffs.**
- **Multi-meal days / per-slot meals** — would layer onto the single-slot design.
- **Pre-existing disconnect, not touched:** the cooking weather banner is
  informational only; weather modifiers are not applied to the cook roll today.
  Leave as-is.

## Testing decisions

- Reducer: buff written on success from both dispatch sites; not written on
  Failure/Critical Failure; replacement semantics (second cook overwrites).
- Validity: selector/read-check tests for day match and day rollover.
- Migration: schema bump defaults `mealBuff` to null on legacy saves; round-trip.
- UI: banner renders active buff (name + skill list), absent when null or stale-day.

## Next step

Small enough for a single codex-shepherd delegation once specced (reducer action +
type + migration + banner + tests), or a direct implementation session.
