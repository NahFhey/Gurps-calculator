# Social Activities (13c) — Design Concept

**Status:** Designed 2026-08-28 (grill-me session, 3 questions + 6 batched
calls). Spec `2026-08-28-social-13c.md` written same day; **third in the
dispatch queue** — after trading merges and study dispatches (shared activity-
registration files).
**Origin:** ROADMAP.md Phase 13c bullet "Social activities (reputation/reaction
modifier management)".

## Problem

The party's social standing exists nowhere: no factions, no reputation, no NPC
entities, no reaction-roll machinery (recon 2026-08-28 confirmed all greenfield
— `gcsData.reactions` is import-only decoration; combat's 'ally' category is
ephemeral; trading's `merchantName` is free text). GMs track who likes the
party in their head.

## Decisions (all locked in grilling)

1. **The persistent thing is a relationship ledger.** GM-curated entries with a
   free `kind` tag (person / faction / settlement), each carrying a **reaction
   modifier** (the number the GM applies when the party deals with that entry),
   notes, and a day-stamped history of shifts with causes. Subsumes faction
   reputation without inventing a faction entity system; parallel to
   `gcsData.reactions` phrasing but campaign-level and maintained.
2. **Party-level modifiers.** One modifier per entry — "the Guild likes
   *them*". Per-character nuance lives in notes and personal GCS Reputation
   traits. (Per-entry per-character overrides = possible later layer, same
   trajectory as party→personal wallets.)
3. **Task mechanics.** Real `'social'` DowntimeTask, one task = one slot of
   deliberate effort targeting one ledger entry, led by the talker:
   - Approach = influence skill from a fixed GURPS list with **per-skill RAW
     unskilled defaults**: Diplomacy IQ−6, Fast-Talk IQ−5, Savoir-Faire IQ−4,
     Streetwise IQ−5, Intimidation Will−5, Carousing HT−4. Level via merged
     skills (`getMerchantSkill` accessor is the template).
   - Roll 3d6 vs effective skill **+ the entry's current modifier**
     (self-balancing: hostile is hard to warm, friendly easy to keep).
   - Crit success **+2** / success **+1** / failure **0** / crit failure
     **−1** to the entry's modifier, hard-capped **±4**. Every shift appends
     history.
   - GM can always hand-edit modifier and notes — rolls are the earned path,
     not the only one.

### Batched calls

- **Storage:** `entities.contacts: Record<Id, ContactEntry>` (normalized
  pattern; not a MealBuff-style single slot).
- **Ledger UI in the Social activity view** — entry cards (modifier badge,
  kind tag, expandable history), explicit add/edit/delete; like StudyProjects
  cards in Study.
- **Find-or-create:** task target picker = existing entries + "New contact…"
  (created at modifier 0).
- **Display-only modifiers in v1** — no roll machinery consumes them (MealBuff
  precedent). One cheap cross-surface: trading's form shows a standing badge
  when the merchant name matches a ledger entry.
- **Plumbing:** `social` changelog family; tile not skill-gated; no batch
  mode; social skills added to `GURPS_TO_ACTIVITY_KEY`.
- **Sequencing:** dispatch third (trading → study → social).

## Out of scope (recorded followups)

- A reaction-roll resolver that mechanically consumes ledger modifiers
  (would be the app's first buff-with-machinery; wait for table demand).
- GM-only visibility flags on entries / player-view masking (EffectDefinition
  `gmNotes` eye-toggle is the pattern when wanted).
- Per-character modifier overrides per entry.
- NPC entity system / linking entries to combat participants or locations
  (14c settlement NPCs may revisit).
- Contact assets in GURPS trait terms (Contacts/Patrons/Allies advantages).
- Modifier decay over time.

## Testing decisions

Pure engine tests (per-skill defaults incl. Will/HT-based, shift outcomes for
all four roll results, ±4 clamps, history append); reducer tests (contacts
CRUD, find-or-create dedup by name); component tests (form target picker +
new-contact path + skill preview with default labeling, resolution flow,
ledger card edit/history); trading-form standing badge; changelog family.
