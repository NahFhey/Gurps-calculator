# Combat Injury Persistence (Phase 15a)

**Designed:** 2026-09-01 (grill-me session, 14 decisions)
**Status:** Designed — dispatched to codex-shepherd same day
**Problem:** Combat tracks conditions, crippled limbs, and death on `Participant`s, but only HP/FP sync back to party `Character`s at combat end. `PostCombatSummary` captures the rest into its display and drops it: crippled limbs vanish, a concealed poisoning evaporates, and a dead party character stays in the party column, assignable to fishing trips at −8 HP. Second-largest gap from the 2026-09-01 15a audit.

## Solution shape

A top-level `Character.status` field holding trimmed, open-ended injury state, written by the existing post-combat sync, seeded back into the next combat, gated into downtime, and cleared GM-first.

## Decisions

1. **`Character.status?: { conditions?, crippled?, dead? }` — top-level, NOT inside `gcsData`.** `gcsData` is draft-edited wholesale by character panels (stale-draft clobber hazard, cf. equipment-lane draft reconciliation) and overwritten by GCS re-import; status must survive both.
2. **Catalog-driven persistence:** `persistsAfterCombat: boolean` on every entry in `src/constants/conditions.ts`. Defaults — persist: poisoned, unconscious, blinded; drop: stunned, prone, grappled, bleeding, burning, slowed, haste, shielded, fatigued (FP already persists fatigue). Sync carries only un-expired conditions whose catalog entry persists.
3. **Trimmed, open-ended shape:** persisted conditions are `{ instanceId, conditionId, label, severity?, source?, notes?, revealed? }` — combat-relative fields (rounds/turns/expiry) dropped; a persisted condition lasts until something clears it. `revealed` is kept: GM concealment (12a.6) survives the combat boundary.
4. **Return leg — seed into new combats:** `partyCharacterToCombat` seeds `status.conditions` as permanent-duration `ConditionInstance`s (revealed carried) and `status.crippled` into `Participant.crippled`. Persistence is mechanical, not bookkeeping.
5. **Replace-on-sync:** at combat end the persist-filtered participant set replaces `status.conditions` — correct because seeding-in is guaranteed (cured-in-combat means gone; acquired-in-combat means kept). Only participants are touched; reinforcements count; absent characters untouched.
6. **Crippled = bare location keys** (`status.crippled?: string[]`, same vocabulary as combat: armR/armL/legR/legL/hand/foot), open-ended. GURPS B422 crippled/lasting/permanent tiers are a named follow-up ("crippling permanence tiers") — combat doesn't record the margin today, and crippled has no mechanical effect even in combat (display only).
7. **Death, full teeth:** sync sets `status.dead` from participant `isDead`. Dead characters get a party-column skull badge, are blocked from downtime task assignment, and are excluded from EncounterSetup's "Add All Party" (individual add stays possible — GM override path). No auto-removal from the party; clearing is manual GM action only (revival stays sovereign).
8. **The gate is `dead || unconscious`:** one predicate, both causes, wired into downtime assignment (`isUnavailable` and task-creation validation paths). Rest's healerId model treats patients as targets, so healing flows are not blocked.
9. **Recovery is manual-first with one auto rule:** a GM status editor (list conditions + crippled with per-item remove, in the party column's Character options menu) is the primary clear mechanism. Exactly one automatic rule: Rest finalize clears `unconscious` when the resolved HP ends above 0 — a deliberate site, not a hidden reducer coupling on HP writes.
10. **Bleeding is not persisted:** the post-combat boundary (first aid, the summary's healing estimates) resolves active bleeding narratively; no inert `{rate, round}` data outside the round structure. GM can add the bleeding condition manually if wanted (its catalog flag still says don't persist).
11. **Three display surfaces:** (1) party column — extend `CharacterStatusBadge`: skull (dead), KO (unconscious), compact condition/crippled indicator with tooltip reusing `ConditionBadge` icon vocabulary; (2) the GM status editor (decision 9); (3) Rest view recovery strip lists status read-only for triage. Character-sheet status section deferred (drags in the player-visibility question for `revealed` on one's own sheet).
12. **Write channel: extend the existing sync** — `PostCombatSummary`'s per-character `updateCharacter` call grows to carry `status` beside `gcsData.pools` (per-character atomic; one-shot `syncComplete` guard already exists). No new bus action — every write is to one character record. Wake-up rule rides Rest finalize's existing `updateCharacter`.
13. **Party-only:** persistence applies to `isFromParty` participants only. Library entries (`entities.combatCharacters`) are reusable templates — Tuesday's dead goblin is pristine Thursday. Named recurring NPCs the GM wants tracked belong in the party column. Stated explicitly so nobody "fixes" this later.
14. **Vehicle: codex-shepherd, single lane.** Schema 1.6.1 → 1.6.2, additive optional fields, no-op migration, grandfathered (existing characters simply lack `status`).

## Testing / verification bar

- Reducer/util tests: persist filter (expired dropped, catalog flag respected), trim shape, replace-on-sync (cure in combat removes; acquisition adds), crippled/dead carry, party-only scope, seed-into-combat round trip (revealed preserved), wake-up rule (HP>0 clears unconscious; HP≤0 doesn't), gate predicate.
- Component tests: party badges render from status; status editor removes items; Add All Party filters dead/unconscious; rest strip lists status.
- Shepherd browser verification: full loop — combat with KO + cripple + concealed poison → end combat → badges appear, assignment blocked → rest heals past 0 → wakes, gate lifts → re-enter combat → conditions seeded, half-revealed poison still anonymous in player view.

## Out of scope

- Crippling permanence tiers (B422 lasting/permanent by margin) — named follow-up; requires combat-side margin capture.
- Mechanical penalties from crippled limbs (still display-only, in and out of combat).
- Bleeding persistence / real-time bleed-out modeling.
- Condition recovery rule engine (HT rolls to shake poison etc.).
- Character-sheet status section + player-facing visibility of own concealed conditions (follow-up with its own design question).
- Library/NPC injury tracking.
- Dying / mortally-wounded state modeling (death-check state stays recomputed from HP in combat).
- Auto-removal or archival of dead characters.
