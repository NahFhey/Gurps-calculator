# GURPS VTT - Roadmap to Completion

**Created:** 2026-03-22
**Updated:** 2026-04-05 (adversarial review hardening amendments)
**Approach:** Alternating cleanup and feature phases to keep momentum while improving stability

---

## Phase 10: Stabilization Sprint + Critical Fixes (Cleanup)

**Goal:** Get the codebase healthy before pushing new features. Fix what's broken, remove what's dead, and harden against crashes and data loss.

### 10a: Fix TypeScript Errors (~542 errors) + Type Safety Hardening ✅ COMPLETE
**Status:** tsc passes clean (0 errors), `strict: true` already enabled, ESLint now covers .ts/.tsx.
**Completed (2026-04-05):**
- ✅ ESLint config updated with `typescript-eslint` — `no-explicit-any: warn` on `.ts/.tsx`
- ✅ `as any` removed from 6 critical files (80 casts → 0): `mapReducer.ts`, `FishingTaskForm.tsx`, `dataMigration.ts`, `campaignStorage.ts`, `CharacterLibrary.tsx`, `CombatTracker.tsx`
- ✅ `.d.ts` declarations created for `combatViewFilter.js`, `turnContext.js`, `combatHistory.js`
- ✅ `CombatCharacter` type extended with missing optional fields (category, basicSpeed, basicMove, mp, currentHP, etc.)
- ✅ `SerializedMapState` type added for JSON hydration in campaignStorage
- ✅ `ViewModeType` exported from combatViewFilter for proper typing
- ✅ `strict: true` already set in tsconfig

**Completed (2026-04-09) — Test errors + production `as any` hardening:**
- ✅ Fixed 24 tsc compilation errors in test files (prop mismatches, unused variables, void truthiness)
- ✅ Created `RollableTable` interface in `gathering.d.ts` — bridges untyped JS gathering utils to typed consumers
- ✅ Made `Trait.id` optional in `TBBuilderPanel` (matches actual FormulasView usage)
- ✅ Made `tableType` optional in `GatheringTableExtended`, added optional chaining in EnvironmentsView
- ✅ Replaced `as any` / `as unknown as any` in GatheringTab, FishingActivity, FishingResolutionPanel, ForagingActivity, ForagingResolutionPanel, CookingTab, EncounterSetup, FormulasView
- ✅ Production `as any` count: **3 remaining** (was 203) — all in deferred structural mismatches

**DRIFT NOTE (2026-08-26, resolved 2026-08-27):** a sweep found **87** production `as any` lines, ~60 in the Fishing downtime views — reintroduced during the downtime-system rework. ✅ Fishing lane cleaned 2026-08-27 (codex-shepherd, spec `2026-08-27-fishing-as-any-cleanup.md`): all 61 casts removed, mostly no-ops over the canonical gathering types; `defaultTables?: ModeDefaults` added as a deprecated legacy dual-read on `GatheringEnvironmentExtended`. Production `as any` now ~26 lines across 20 files (next candidates: whatever the sweep shows outside fishing).

**Remaining 3 production `as any` casts (→ Phase 11a, count as of 2026-04-09):**
- `DayPlannerTab.tsx:185` — two casts bridging `TimeSlot` type divergence between campaign.ts and dayplanner.ts
- `AlchemyActivity.tsx:169` — `AlchemyBatchWithPhase` ↔ `ExtendedBatch` interface bridge
- `campaignUtils.ts:294` — `deepMerge` recursive generic call (runtime-safe, generic utility)
- **181 `as any` remain in test files** — not in scope for 10a (address in 10c when fixing test mocks)

### 10b: Dead Code Removal ✅
- ~~Remove 5 unused bridge contexts~~ (already removed in Phase 9)
- ~~Migrate CombatContext usage out of CharacterLibrary and EncounterSetup~~ (already using direct store)
- ~~Remove CombatContext after migration~~ → replaced with `useCombatSession` hook + `combatUIStore` (external store for shared UI state)
- ~~Audit and remove unused dependencies~~ → removed `@rollup/rollup-linux-x64-gnu`
- ~~Convert remaining .js test files → .ts~~ → 6 files renamed, `@ts-nocheck` added (proper typing deferred to 10c)
- Updated lint/format scripts to cover `.ts`/`.tsx` instead of `.jsx`

### 10c: Expand Test Coverage + Critical Path Tests
- Fix existing broken test mocks to match current types
- Add tests for remaining ~21 untested view components
- Add integration tests for critical workflows: combat round, time advancement, crafting project lifecycle
- Target: all tests green, 80%+ view coverage
- **Add server tests** (currently 0 test files in `server/`):
  - Route handler tests (state CRUD, session join)
  - Socket event handler tests
  - Database operation tests
- **Add tests for unprotected JSON.parse crash paths**
- **Add tests for import validation edge cases** (malformed JSON, huge files, missing fields)
- **Add tests for serialization round-trip** (Set -> Array -> Set)

### 10d: Defensive JSON & Error Handling (NEW) ✅ COMPLETE (verified 2026-08-26)
**Status:** All items below were completed incidentally across later phases (JS→TS conversions, Phase 10.5 hardening, import-validation work). Verified 2026-08-26: every remaining `JSON.parse` site in `src/` is inside try-catch (storage.ts, helpers.ts `safeJsonParse`, schemaVersioning.ts, dataMigrations.ts, exportImport.ts); the listed `.js` files no longer exist (converted to `.ts`, several no longer parse JSON at all); Zod import validation + 50MB size limit live in `exportImport.ts` (`CampaignImportSchema`, `exceedsImportSizeLimit`); per-tab `TabErrorBoundary` wraps feature areas in UnifiedShell.

**Wrap all unprotected `JSON.parse` calls in try-catch:**
- `src/state/campaignReducer.ts:937`
- `src/utils/combatHistory.js` (lines 246, 282)
- `src/utils/combatReveal.js` (lines 211, 264, 279, 312)
- `src/utils/storage.ts:123`
- `src/utils/helpers.js:26`
- `src/utils/schemaVersioning.js:198`
- `src/utils/dataMigrations.js` (lines 220, 235, 255)

**Add input validation for imports:**
- Add Zod schemas for campaign state, character data, combat state
- Validate in `src/utils/exportImport.js` before `mergeGM()`
- Validate in `src/components/combat/CharacterLibrary.tsx` before spreading into state
- Add file size limits (reject imports > 50MB)

**Add error boundaries per feature area:**
- Wrap each major tab (Combat, Gathering, Cooking, Downtime, Inventory, Map) in its own ErrorBoundary
- Add error boundary around CombatTracker action panel
- Catch async errors in SyncProvider with user-facing toast

### 10e: Memory Leak Fixes (NEW) ✅ COMPLETE (verified 2026-08-26)
**Status:** Verified 2026-08-26: `CharacterContextMenu` clears its timer and removes listeners in cleanup; `MapContextMenu` and `ConfirmDialog` have symmetric add/remove listener effects; `ConnectionManager.connectSocket()` calls `socket.off()` before every `socket.on()` and `removeAllListeners()` on disconnect (lines ~188, ~277).

**Fix event listener leaks (setTimeout race condition):**
- `src/components/character-management/CharacterContextMenu.tsx` (lines 47-50)
- `src/components/map/views/MapContextMenu.tsx`
- `src/components/ui/ConfirmDialog.tsx`
- Pattern: use a ref flag to prevent adding listeners after cleanup runs

**Fix socket listener duplication:**
- `src/net/ConnectionManager.ts` (lines 243-302): Add `socket.off()` calls before `socket.on()` in `connectSocket()`, or use `socket.removeAllListeners()` on disconnect

**Estimated effort:** 3-4 focused sessions

---

## Phase 10.5: Server Security & Data Integrity ✅ COMPLETE

**Goal:** Harden the multiplayer backend before shipping.
**Completed:** 2026-04-11

### 10.5a: Server Authentication ✅
- JWT authentication via `jose` library with per-start random 256-bit secret (24h token expiry)
- `server/src/auth.ts`: `signToken()`, `verifyToken()`, `authMiddleware`, `requireRole()`, `requireCampaignAccess()`
- Tokens returned on POST `/campaigns` (GM token) and POST `/sessions/join` (Player token)
- Client `ConnectionManager` stores token, sends in `Authorization: Bearer` header and Socket.IO `auth` handshake

### 10.5b: Server Authorization & Validation ✅
- PUT `/campaigns/:id/state` — requires GM role + campaign membership
- GET `/campaigns/:id` — requires campaign membership
- POST `/sessions` — requires GM role + matching campaign
- Socket `JOIN_ROOM` — verifies token campaign match, uses token role/displayName (ignores client payload)
- State JSON parse validation on PUT endpoint

### 10.5c: Server Hardening ✅
- **CORS lockdown:** Configurable allowlist via `CORS_ORIGINS` env var (default: localhost dev ports)
- **Rate limiting:** `express-rate-limit` — 100 req/min general, 10 req/min session join
- **Join code hardening:** 10-character codes (up from 6)
- **Database safety:** Atomic writes (temp file + rename) in `saveDB()`

### 10.5d: Payload & Data Integrity ✅
- 10MB payload cap on Express JSON parser, Socket.IO `maxHttpBufferSize`, and route-level validation
- Dependencies added: `jose`, `express-rate-limit`

**Deferred to Phase 11+:**
- IP-based join code lockout (rate limiting covers the brute-force vector)
- Periodic DB backup (atomic writes prevent corruption; backup is a nice-to-have)
- CombatContext atomic state updates (combat decomposition in Phase 11a)
- Storage resilience pending queue (Phase 15b performance pass)
- Zod schema for server-side campaign state validation (depends on campaign state type stabilization)

**Server test suite:** 66 tests (auth 4, routes 28, socket 12, db 18, integration 4)

---

## Phase 11: Combat System Enhancement (Feature)

**Goal:** Make combat the standout feature — smooth, tactical, and fast at the table.

### 11a: CombatTracker Decomposition ✅ COMPLETE
**Completed (2026-04-12):**
- ✅ CombatTracker.tsx: 1,545 → 602 lines (61% reduction, well under 800 target)
- ✅ ActionPanel.tsx: 644 → 371 lines (42% reduction)
- ✅ Extracted 5 hooks + 1 component:
  - `useActionResolution` (437 lines) — injury/damage/effect processing, reveal state updates
  - `useCombatExport` (272 lines) — export/import (player view, GM-locked, save/load)
  - `useCombatConditions` (196 lines) — condition CRUD with undo support
  - `useCombatReinforcements` (190 lines) — reinforcement insertion with turn order modes
  - `useCombatHistory` (152 lines) — persistent undo/redo with useState (was broken no-op)
  - `ManeuverWorkflowWidgets` (92 lines) — aim tracking and wait trigger panels
- ✅ All 93 combat tests pass, zero new tsc errors
- ✅ Undo/redo fully functional (was previously broken — history state was discarded every render)

**Remaining overlap:** CombatTracker still has inline turn/maneuver/dice logic that overlaps with `useCombatSession`. Unifying these is a future cleanup opportunity but not blocking.

### 11b: Combat UX Improvements ✅ COMPLETE
**Completed (2026-04-12):**
- ✅ Quick-action maneuver buttons (`QuickManeuverBar.tsx`) — 8 tactile buttons for common maneuvers (Attack, AoA Determined/Strong, AoD, Move, Aim, Wait, Do Nothing), color-coded by category, integrated into ManeuverSelector above the dropdown
- ✅ Visual initiative timeline (`InitiativeTimeline.tsx`) — horizontal scrollable turn order bar with participant tokens, HP-status ring colors, category icons, click-to-jump navigation, auto-scroll to current actor. Replaces text-only TurnControlsView in CombatTracker
- ✅ Condition duration UI polish (enhanced `ConditionBadge.tsx`) — urgency color-coding (red for expiring, orange for 1-2 remaining), countdown text ("2 turns left"), built-in quick-remove X button, pulse animation for expiring conditions
- ✅ Automated attack/defense roll resolution with margin calculation — already implemented in AttackAssist/DefenseAssist (margin = roll - target)
- ✅ Damage application with automatic DR and hit location lookup — already implemented in InjuryResolutionPanel (full DR/wounding/injury pipeline)
- ✅ Drag-and-drop participant reordering (`@dnd-kit/core` + `@dnd-kit/sortable`) — horizontal drag in InitiativeTimeline, auto-tracks currentTurnIndex, full undo/redo via existing combatActions infrastructure
- ✅ Unit tests for new 11b components — InitiativeTimeline (9 tests), QuickManeuverBar (11 tests), ConditionBadge (22 tests)

### 11c: Combat-Party Integration ✅ COMPLETE
**Completed (2026-04-12):**
- ✅ Seamless party→combat flow: "Add All Party" button in EncounterSetup adds all party characters in one click
- ✅ Encounter templates: save/load enemy groups from campaign store with full CRUD (save, load, delete)
- ✅ Post-combat summary: auto HP/FP sync-back to party characters' gcsData.pools, participant status review, expandable detail cards with HP/FP bars, status badges, condition lists
- ✅ Healing time estimates: GURPS B424-based natural recovery (1 HP/day), First Aid estimate (1d-2), FP recovery (10 min/FP)
- ✅ Loot distribution: add items (currency/material/food/equipment/other), assign to party pool or individual characters, value tracking, distribution confirmation
- ✅ Post-combat flow: End Combat → Summary → Loot → Done (or skip loot); combat stays active in store until flow completes
- ✅ Unit tests: 9 tests for buildCombatSummary (healing estimates, status flags, multi-party, edge cases)
- **New types:** EncounterTemplate, EncounterTemplateParticipant, ParticipantSummary, HealingEstimate, CombatSummaryData, LootItem, LootDistributionEntry
- **New components:** PostCombatSummary.tsx, LootDistribution.tsx
- **Modified:** CombatTracker.tsx (post-combat flow), EncounterSetup.tsx (Add All Party + templates), useCombatStore.ts (templates + party sync), combatTracker.ts (types), combatActions.ts + combatReducer.ts (template CRUD)
- ~~**Deferred:** Full inventory integration for loot (Phase 15 — currently logs distribution, doesn't modify inventory entities)~~ superseded by 12a.5: `LootDistribution.tsx` dispatches `inventory/itemAcquired` per item (verified 2026-09-01)

---

## Phase 12: Character System Depth (Feature)

**Goal:** Richer character sheets that cover more of GURPS character building.

### 12a: Character Sheet Enhancement ✅ COMPLETE
**Completed (2026-04-14):**
- ✅ **Encumbrance system** (GURPS B17): Basic Lift calculation, 5 encumbrance levels with weight thresholds, Move/Dodge penalties, progress bar visualization. `EncumbranceSection` component with per-level threshold display.
- ✅ **Equipment overhaul**: Equipped/unequipped toggle on every item, equipment categories (weapon/armor/shield/ammo/general), expandable detail rows with weapon stats (damage/reach), armor stats (DR + hit location coverage), shield stats (DB), notes and reference fields. Equipped weight vs total weight tracking.
- ✅ **Per-location DR**: Armor items specify which hit locations they cover (multi-select). `calculateLocationDR()` stacks DR from multiple armor pieces. Displayed in EncumbranceSection under "Armor by Location".
- ✅ **Combat integration**: Party characters added to combat now carry encumbrance-adjusted Move/Dodge, per-location DR array, and token images. `partyCharacterToCombat()` calls encumbrance and DR calculations.
- ✅ **Skill calculation fix**: `calculateSkillLevel` now matches GURPS B170 progression (E/A/H/VH difficulty offsets + correct point-to-level curve). Added `calculateRelativeLevel()` and `calculateSkillPointCost()` utilities. Difficulty column added to Skills table with color-coded display and edit support.
- ✅ **Skill advancement history**: `SkillHistorySection` component with session-labeled entries, point/level change tracking, "Record Advancement" form with live preview, newest-first chronological display.
- ✅ **Character portraits/tokens**: `CharacterImages` type with portrait (256px) and token (64px) images stored as base64 data URLs. Upload UI with auto-resize. Portrait displayed in character sheet header, token displayed in InitiativeTimeline (replaces initials when available).
- ✅ **40 new unit tests**: 28 encumbrance tests (Basic Lift, thresholds, levels, carried weight, full calculation, per-location DR, character-level convenience) + 12 skill calculation tests (all difficulty progressions, inverse cost calculation, derived attributes)

**Deferred:**
- SpellsSection decomposition (332 lines — functional, not yet blocking)
- Advantage/disadvantage point cost enforcement (already has CRUD + point display; enforcement deferred)

**New files:**
- `src/utils/encumbrance.ts` — encumbrance + per-location DR calculation
- `src/components/character-sheet/EncumbranceSection.tsx` — encumbrance display
- `src/components/character-sheet/PortraitSection.tsx` — image upload/display
- `src/components/character-sheet/SkillHistorySection.tsx` — advancement log
- `src/utils/__tests__/encumbrance.test.ts` — 28 tests
- `src/types/__tests__/characterSheet.test.ts` — 12 tests

**Modified:**
- `src/types/characterSheet.ts` — added encumbrance types, equipment categories, LocationDR, SkillAdvancementEntry, CharacterImages, fixed calculateSkillLevel
- `src/types/campaign.ts` — added `images?: CharacterImages` to Character
- `src/types/combatTracker.ts` — added tokenImage, armorByLocation, encumbranceDodge/Move to Participant
- `src/components/character-sheet/CharacterSheet.tsx` — portrait header, EncumbranceSection, SkillHistorySection, image draft state
- `src/components/character-sheet/EquipmentSection.tsx` — equipped toggle, categories, expandable detail rows
- `src/components/character-sheet/SkillsSection.tsx` — difficulty column, B170-accurate calculations
- `src/components/combat/EncounterSetup.tsx` — encumbrance/DR/token in partyCharacterToCombat
- `src/components/combat/views/InitiativeTimeline.tsx` — token image in avatar circle

### 12a.5: Inventory Integration Bus ✅ CODE COMPLETE
**Status:** Implemented 2026-06-09; **table-verified 2026-08-19** — crafting/gathering/loot all write to inventory end-to-end. The party→character hand-retag gap closed in two steps: Transfer Console destination fix (6cea50a, 2026-08-19) and an inline "Give to…" quick-assign on party-stash item rows (2026-08-25, codex-shepherd; browser-verified). See [`docs/INVENTORY_INTEGRATION_PLAN.md`](./docs/INVENTORY_INTEGRATION_PLAN.md) (including the As-Built section) and [`docs/INVENTORY_INTEGRATION_FOLLOWUPS.md`](./docs/INVENTORY_INTEGRATION_FOLLOWUPS.md) for discovered side-issues (now 9 items).
**Shipped:** `inventory/itemAcquired` + `inventory/itemRetagged` always-succeed bus actions; ownership via existing `Inventory` records (party + per-character, auto-created); crafting completion, 10 gathering write sites, and loot distribution all dispatch through the bus; schema 1.4.0 with `ensureInventoryRecords` load-time backfill; 36+ new tests across reducer/actions/migration/dispatch sites.

**Why this is wedged here:** Crafting / gathering / loot all record intent without writing to inventory state. The gap is biting at every session that exercises these subsystems (current arc does). Originally bundled in Phase 15 cross-system integration; pulled forward as a narrow carve-out.

**Scope:**
- Two reducer actions: `inventory/itemAcquired { item, owner, source }` and `inventory/itemRetagged { itemId, newOwner }`. Both always-succeed.
- Single inventory store with an `owner: "party" | CharacterId` tag on each item. Shared vs individual is a tag filter, not separate stores.
- Three dispatch sites: crafting completion, gathering success, loot distribution (rewires existing `LootDistribution.tsx` to dispatch retag instead of just logging).
- Schema migration: existing items default to `owner: <equippedCharacterId>` if equipped, `owner: "party"` otherwise.

**Out of scope:** cooking buff write path (separate followup), attunement state machine (separate followup), combat consumables (separate followup), "take from shared" UI for crafted/gathered items (separate followup), structured per-item provenance, combat-undo coupling for inventory writes (uses post-combat boundary instead).

**Estimated effort:** 2 days plus a session of table verification.

### 12a.6: Combat Condition Visibility
**Status:** MERGED 2026-07-12 (with followup #10's category fix, schema 1.5.1); **table-verified 2026-08-19** on tracker + timeline surfaces (map surface unreachable — see Remaining). See [`docs/COMBAT_CONDITION_VISIBILITY_PLAN.md`](./docs/COMBAT_CONDITION_VISIBILITY_PLAN.md) (Implementation Status sections) for as-built detail and [`docs/COMBAT_CONDITION_VISIBILITY_FOLLOWUPS.md`](./docs/COMBAT_CONDITION_VISIBILITY_FOLLOWUPS.md) for discovered side-issues (now 10 items).
**Shipped (session 1, 2026-07-04):** `revealed` eye state on `ConditionInstance` (consolidated type) seeded from catalog `isObvious`; `cycleRevealed`/`cycleConditionRevealed` helpers; eye-state player-view filtering in `combatViewFilter.js` (closed/half/open, anonymous "Afflicted" placeholder); `isStunned`/`isUnconscious` bool fold into `conditions[]` across writers/readers/init sites; schema 1.5.0 with hydrate-time + flat-legacy + combat-import migrations; 45+ new/updated tests.
**Shipped (session 2, 2026-07-12):** `Tooltip` primitive in `src/components/ui`; `ConditionBadge` rewrite with `mode: 'full' | 'icon' | 'placeholder'` (icon default, placeholder auto-forced from filtered view data) and rich React tooltip; three-state `EyeToggle` per condition row in ConditionsPanel (NPC-only, GM view only); `handleCycleConditionRevealed` in `useCombatConditions` (undoable, no combat-log leak) wired CombatTracker → ActionPanel → ConditionsPanel; 54 new/updated tests; browser-verified closed/half/open player-view behavior end-to-end.
**Shipped (session 3, 2026-07-12):** participant-targeted condition handlers in `useCombatConditions` (works with null combat for CombatContext); `ConditionAddPopover` reusing ConditionsPanel whole, hosted by CombatTracker + CombatMainArea; three entry surfaces — tracker card "+" button, timeline/tracker "+N" overflow pills (caps 3/4, urgency-sorted via exported `sortConditionsByUrgency`), map token-legend button (MapGrid has no token click API; legend row chosen over tile-click to preserve movement semantics); `ConditionOverflowPill` (button on GM surfaces, static count in player view); ~30 new tests; browser-verified both pill surfaces + popover flows in GM and player view.
**Remaining:** none — **12a.6 COMPLETE (2026-08-21)**. Tracker + timeline surfaces table-verified 2026-08-19; the map surface followed after the Battle Map selector (6cea50a), a SyncProvider crash fix, and wiring the map layout's GM mode to `ui.gmModeEnabled`. Map surface verified headlessly (SwiftShader/CDP): GM mode on → condition entry + popover add work on placed tokens; GM mode off → anonymized, no GM entry points. See COMBAT_CONDITION_VISIBILITY_PLAN.md for detail and one UX followup (Manager unreachable during map-combat layout).

**Why this is wedged here:** Conditions on NPCs are universally visible to all viewers. The combat tracker has no information-disclosure layer for conditions, so the GM cannot conceal a Poisoned or Charmed effect without verbal narration. Combat is exercised every session; the gap is currently worked around by GM voice. Bundles a long-overdue Phase 6 cleanup: `Participant.isStunned` and `isUnconscious` (boolean fields outside the conditions array) fold into `conditions[]` so the new visibility filter can't be bypassed.

**Scope:**
- Catalog flag `obvious: boolean` on every condition in `src/constants/conditions.ts`.
- Per-instance `revealed?: 'closed' | 'half' | 'open'` on `ConditionInstance`, seeded from catalog default at creation.
- Three-state eye control in `ConditionsPanel` and the new condition-add popover. NPC-only.
- `combatViewFilter.js` extended with eye-state filtering; closed → omitted, half → anonymous "afflicted" placeholder, open → full badge.
- `ConditionBadge` rewritten with `mode: 'full' | 'icon' | 'placeholder'` and a proper React tooltip.
- Two-surface assignment: condition-add popover extracted from `ConditionsPanel` and reused from both tracker click and map token click.
- Density cap: 4 icons in tracker rows, 3 in initiative timeline, "+N" overflow pill that opens the conditions popover.
- Bool migration: `isStunned` and `isUnconscious` fold into `conditions[]`. Schema version bump on combat-state shape, idempotency + round-trip tests.

**Out of scope:** PC-side eye control (separate followup), `bleeding` and `crippled` folding (own followups; payload doesn't fit generic shape), `isDead` migration (heavy hot-path use, categorically uncoverable, stays as-is), per-table override of catalog `obvious` defaults (separate followup), `useActionResolution` reveal-state coupling (survey-at-implementation-start; default standalone), animation polish.

**Estimated effort:** 2-3 sessions.

### 12b: GCS Import Improvements ✅ COMPLETE (2026-08-26, codex-shepherd)
- ✅ Broader GCS format support — equipment entry variants: decimal + comma-thousands costs, optional quantity/weight, lb/lb./lbs suffixes (2026-08-26)
- ✅ Import validation with diff preview ("here's what will change") — `validateCharacterText` (line-level errors/warnings, wipe-guard for sections that parse empty), `diffCharacters` + grouped preview, update-vs-create choice on name match with narrow non-destructive merge (`buildCharacterImportUpdate`). Browser-verified end-to-end.
- ✅ Batch import for entire party files — `parsePartyText` (Name:-block split) + JSON arrays, selectable batch preview with new/update badges.
- ✅ Export back to GCS-compatible format — `exportCharacterText()` in `src/utils/characterExport.ts`; round-trip parse(export(parse(text))) verified across all sections (2026-08-26)
- ✅ Equipment parser gap FIXED (2026-08-26): `splitBySemicolon` now bracket-aware — entries no longer split at the cost/weight semicolon inside `[$X; Y lb]`; real sheets previously parsed zero equipment. UI wiring for text export (e.g. a context-menu entry beside Export JSON) is a small open nicety.

### 12c: Character Lifecycle
**Designed 2026-08-28** (grill-me session; see [`docs/CHARACTER_LIFECYCLE_12C_PLAN.md`](./docs/CHARACTER_LIFECYCLE_12C_PLAN.md)).
- ✅ **Lane A shipped 2026-08-29** (codex-shepherd, spec `2026-08-28-points-economy-12c-laneA.md`, merge `codex/points-economy`): `unspentPoints` + `pointLedger` on gcsData, GM Award Points modal, cart-with-confirm Spend Points workflow (computed skill/attribute costs, GM-priced traits, atomic apply); cost constants consolidated (`characterPoints.ts`), totals bug fixed (sense/frightCheck points now counted), shared `applySkillAdvancement` (with newSkill dedup) backing sheet/Study/cart, Edit-stub + skillHistory-remap fixes. Browser-verified end-to-end.
- ✅ **Lane B shipped 2026-08-29** (codex-shepherd, spec `2026-08-28-templates-npcgen-12c-laneB.md`, merge `codex/templates-npcgen`): templates as seeded data entities (six playable ~150-pt builds, ensure-on-hydrate + deleted-builtin tracking, Manager view, Save-as-template), creation-modal previews + Generate NPC path (none/light/heavy variance, honest recomputation, syllable names), side-by-side CharacterCompareModal on shared characterDiff tables. Browser-verified end-to-end. **12c COMPLETE — Phase 12 done.**
- Character creation wizard with template support (warrior, mage, thief archetypes)
- Level-up / point-spend workflow between sessions
- Character comparison view (side-by-side stats)
- NPC generator with randomized stats based on templates

**Estimated effort:** 3-4 sessions

---

## Phase 13: Downtime & Activities Polish (Feature + Cleanup)

**Goal:** The downtime system is the killer differentiator — make it flawless.

### 13a: Decompose Remaining Monoliths
- ✅ CookingTab.tsx (978 lines) -> thin router + views (2026-08-25, codex-shepherd: `src/components/cooking/`, 337-line router + 3 views + 14 characterization tests; re-export shim keeps consumers untouched)
- ✅ InventoryTab.tsx (968 lines) -> thin router + views (2026-08-25, codex-shepherd: `src/components/inventory/`, router + OverviewView/PartyStashView/TransferConsole; done alongside the Give-to quick-assign)
- ✅ CraftingTab.tsx — verified decomposed (2026-08-26): `src/components/crafting/` holds CraftingWorkbench (638 lines), CraftingDesigns, CraftingProjectList, SaveDesignModal; no monolith remains. **13a fully complete.**
- ✅ LocationManager.tsx (1,084 lines) -> thin router + views (2026-08-25, codex-shepherd: 321-line router + 8 views + 17 tests; 13a monolith list complete)

### 13b: Activity System Improvements ✅ COMPLETE (2026-08-27)
Shipped as a four-lane bundle (design: [`docs/ACTIVITY_SYSTEM_13B_PLAN.md`](./docs/ACTIVITY_SYSTEM_13B_PLAN.md), all lanes codex-shepherd):
- ✅ Better UX for tool reservation conflicts + material requirement previews (lane 1 "parity", 2026-08-26)
- ✅ Activity result history with searchable log (lane 2 "result history" — structured changelog, 2026-08-26)
- ✅ Batch operations (lane 3 "batch ops" — N parallel single-leader tasks, all-or-nothing validation, 2026-08-26)
- ✅ Activity chaining (lane 4, 2026-08-27) — follow-on affordances on resolved gathering task cards ("Cook with these" / "Craft with these" / "Send to lab") via one-shot `ui.pendingIntent`; `InventoryDelta.kind` stamped at all fishing/foraging/mining resolution sites; bonus fix: foraging deltas now record the acquired inventory id (was catalog id)

### 13c: New Activity Types
- ✅ Trading/Commerce (2026-08-28, codex-shepherd, spec `2026-08-28-trading-13c.md`, merge `codex/trading`; design [`docs/TRADING_COMMERCE_13C_PLAN.md`](./docs/TRADING_COMMERCE_13C_PLAN.md)): `'trading'` tasks = market trips with a transaction console (sell party goods + owner-labeled items, freeform buys, adjustments), opt-in Quick Contest haggle (±5%/pt capped ±30%), money on existing `Inventory.currency` (new `currencySpent` bus action, configurable currency config default cp), learning price book + Manager Trading view. Browser-verified end-to-end.
- ✅ Research/Study (2026-08-28, codex-shepherd, spec `2026-08-28-study-13c.md`, merge `codex/study`; design [`docs/STUDY_13C_PLAN.md`](./docs/STUDY_13C_PLAN.md)): `'study'` tasks credit hours (4 taught/materials, 2 self-study) into persistent StudyProjects; configurable `hoursPerPoint` (default 200, B292); one-click GM Award reuses Record Advancement mechanics with rollover; teacher = slot-locked helper with level gate; no dice. Browser-verified end-to-end (state-level).
- ✅ Healing/Recovery (2026-08-28, codex-shepherd, spec `2026-08-28-rest-recovery-13c.md`, merge `codex/rest-recovery`): rest tasks now resolve — FP restores to max on any rest; sleep makes the B424 natural-recovery HT roll (physician healer adds +1 and doubles, `RestData.healerId`), gated on full-day rest with GM override; RestActivity view with party recovery-status strip (shared `estimateHealing` util, also used by PostCombatSummary); `rest` changelog family. Browser-verified end-to-end.
- ✅ Social activities (2026-08-29, codex-shepherd, spec `2026-08-28-social-13c.md`, merge `codex/social`; design [`docs/SOCIAL_13C_PLAN.md`](./docs/SOCIAL_13C_PLAN.md)): relationship ledger (`entities.contacts` — person/faction/settlement, party-level modifiers ±4, day-stamped shift history) + `'social'` influence tasks (six RAW-default skills, 3d6 vs skill + standing, crit +2/+1/0/−1); trading standing badge. Browser-verified end-to-end. **13c COMPLETE — all four activity types shipped; Phase 13 done.**

**Estimated effort:** 3-4 sessions

---

## Phase 14: Map, Travel & Location System (Feature)

**Goal:** One movement model on the map — travel groups, vehicles with docking, multi-day journeys on the time tick — with locations, facilities, and contacts pinned to the map.

**Designed 2026-08-31** (grill-me session, 25 decisions; see [`docs/MAP_TRAVEL_14_PLAN.md`](./docs/MAP_TRAVEL_14_PLAN.md)). The original 14a text was stale — MapGrid was already replaced by the three.js scene (`SPEC-map-three.md`) with zoom/pan/selection done; the location-graph travel system (`TravelPanel`, `TravelAction`, `activeTravels`) was found declared-but-dead and is being deleted in favor of map-tile travel.

### Lane 0: Foundation & Demolition ✅ COMPLETE (2026-08-31, codex-shepherd, spec `2026-08-31-lane0-travel-unify-14.md`, merge `codex/lane0-travel-unify`)
- ✅ Dead location-graph travel system deleted (TravelPanel/TravelView, TravelAction/LocalTravel/activeTravels, connection travel fields, dead travelWizard map slice, orphaned TravelBlockerList) — net −416 lines
- ✅ Travel unified into `advanceTime`: shared guard/checkpoint/advance+weather helpers; `map/executeTravel` now respects the paused-task guard (before movement), pushes a 'Before travel' undo checkpoint, and regenerates weather (previously silently skipped); reservation-stub `as any` removed
- ✅ Schema 1.5.5 + idempotent hydrate strip of legacy travel fields; 7 new tests; bonus fix: weather-effect −0 normalization (pre-existing exportImport round-trip flake)

### Lane A: Groups & Vehicles ✅ COMPLETE (2026-08-31, codex-shepherd ×2, specs `2026-08-31-lane-a1/a2-*`, merge `codex/lane-a-groups-vehicles`)
- ✅ A1 state model: `TravelGroup`/`Vehicle`/`VehicleTypeDef` (seeded catalog: Lancer/Skyship/Riverboat/Sailing Ship), `party/` domain with co-location-gated split/merge/board, one-level docking with `hangarSlots`, `partyTileId` removed (group-aware `map/executeTravel`, union vision), rewritten travel validation (PARTY_INCAPACITATED implemented, INSUFFICIENT_CREW, vehicle speed budgets), schema 1.5.6 + `ensureTravelGroups`
- ✅ A2 UI: group/vehicle map tokens (portrait sprites, per-tile fan-out, dimmed parked, active ring), active-group selector + generalized placement, wizard Party step (staged dnd-kit Traveling/Staying composition + conveyance, applied atomically at confirm), Manager Vehicles view (catalog + instances + dock/undock)
- Browser-verified headless (SwiftShader): fresh boot seeds The Party, map create + group placement + token render, zero console errors. 70 new tests (suite: 3,904). Known pre-existing shell reload bug filed as a separate task (predates lane A, verified at baseline; fixed same day — see Interstitial below).

### Interstitial: Map-tab data-loss investigation ✅ COMPLETE (2026-08-31, direct fixes)
Three fixes out of the "Map tab wiped / maps missing after reload" investigation, landed on main between lanes A and B:
- ✅ Shell reload bug: rail buttons no longer toggle the active tab off, so the Map tab no longer vanishes after reload (`src/unified/UnifiedShell.tsx`) — the primary reported symptom
- ✅ Checkpoint snapshots no longer corrupt Set fields (`campaignReducer.ts`)
- ✅ Cross-tab overwrite guard for campaign state saves (`src/persistence/campaignStorage.ts`): every save stamps a monotonic revision into `campaignStateRevision`; a session whose baseline is older than storage refuses to save (`CampaignStateConflictError` + one-time `campaign-state-conflict` window event, reload to recover) instead of letting a stale tab's whole-blob save silently erase another session's state — the leading candidate for the intermittent `maps.mapsById` localStorage data loss. 6 new tests.

### Lane B: Climate, Season & Weather ✅ COMPLETE (2026-08-31, codex-shepherd, spec `2026-08-31-lane-b-climate-season-weather-14.md`, verdict accepted — zero shepherd fixes; schema 1.5.7; 54 tests; browser-verified season header/calendar editor/arrival weather gen/tick regen)
- Per-map climate scalar; per-map ambient weather (terrain applies at consumption time)
- Minimal season layer (configurable names/lengths, derived from day counter, temp-shift + precipitation multiplier on weather generation)
- Migration off `Location.currentWeather`

### Lane C: The Journey Loop ✅ COMPLETE (2026-09-01, codex-shepherd ×2, specs `2026-09-01-lane-c1-journey-engine-14.md` + `2026-09-01-lane-c2-events-provisioning-14.md`, merge `codex/lane-c-journey-loop`; schemas 1.5.9 + 1.6.0; suite 4,133; browser-verified headless incl. one shepherd fix)
- ✅ Journey-as-state on `TravelGroup.journey`, armed by the wizard, progressed only by the time tick (`map/executeTravel` + `EXCEEDS_TIME_BUDGET` deleted); auto-camp nights + GM forced-march override (−5 nav, moves on night slots); pause/resume/abort/reroute actions; GM teleports abort
- ✅ Navigation rolls with overt drift: `getNavigationSkill` (Navigation Land/Sea/Air by mode, IQ−6 default, GM-set fallback), weather + navigator-fatigue modifiers, lateral deviation ~1 tile/2 MoF (crit +1), auto-reroute via findRoute, `noRoute` pause
- ✅ Terrain-keyed weighted travel event tables (seeded for all 9 preset terrains, weather/night/forced-march condition gates, Manager "Travel Events" editor, per-map table-set override): flavor logs, hazards auto-apply (lost miles, FP/HP dice), encounter pauses → `pendingIntent` hand-off into EncounterSetup (the 15a hook; journey persists its template id; resume gated on no active combat; shepherd fix ddfe563 pins CombatTab to setup after intent consumption)
- ✅ Provisioning (D9/B426 simplified): CookingTab success stamps the cook's group meal (`entities.groupMeals`); unfed travel days cost 1 FP + starvation debt at the day boundary; rest FP recovery caps at max−debt until fed; confirm-screen provisions preview + shortage warning; Halt & cook affordance
- ✅ `'travel'` downtime tasks materialized already-resolved each moving slot (crew slot-blocked, worked-slot fatigue live; DowntimeProvider two-way sync fix also repairs checkpoint-restore staleness); worst-member encumbrance gates foot speed (`computeSlotBudgetMiles`)
- **Phase 14 COMPLETE** — all lanes shipped.

### Lane D: Locations on the Map ✅ COMPLETE (2026-08-31, codex-shepherd, spec `2026-08-31-lane-d-locations-on-map-14.md`; schema 1.5.8; 56 tests; browser-verified hidden-pin discovery → location switch → detail panel; first dispatch stalled 2h and was killed — clean re-dispatch succeeded)
- Marker↔Location link (`MarkerModel.locationId`); location detail panel on the Map tab
- Facility attachment: `party` | `location` | `vehicle` (main ship as mobile base); position-filtered activity calculator
- Contacts placed at locations (soft presence hints); discovery tracking (`hidden` markers, presence-based `discoveredAt`, `gmNotes` split)
- LocationManager adopted into Manager navigation

**Out of scope (per design):** climate zones, full calendar, hidden drift, water tracking, cargo weight ledger, per-group hidden reveal, settlement generator (deferred), sight-based discovery, overland NPC tokens, fast travel.

**Sequencing:** 0 → A → (B ∥ D) → C. **Estimated effort:** 6-8 sessions (grew with vehicles/groups scope)

---

## Phase 15: Integration & Polish (Cleanup)

**Goal:** Everything works together smoothly. Accessibility and type safety for all remaining code.

### 15a: Cross-System Integration
**Audited 2026-09-01** (full code audit of the four bullets against phases 11c–14 as-builts). Two bullets were already wired end-to-end by earlier phases; two direct fixes landed the same day:
- ✅ Map travel -> triggers encounters -> opens combat tracker (Phase 14 lane C2) — **return leg closed 2026-09-01**: combat started from a travel intent now stamps `travelGroupId` onto `CombatState` (EncounterSetup), and completing the post-combat flow auto-resumes the interrupted journey (CombatTracker dispatches `party/resumeJourney`; reducer gate makes it a no-op if the journey was aborted). JourneyStatusPanel's Resume button now disables during active combat instead of silently no-oping.
- ✅ Combat resolution -> feeds into downtime — verified wired: HP/FP sync-back (11c `PostCombatSummary` → `gcsData.pools`), loot → inventory bus (12a.5 `LootDistribution` → `inventory/itemAcquired`), rest recovery reads the same pools (13c, shared `estimateHealing`).
- ✅ Location arrival -> updates available facilities and NPCs (Phase 14 lane D) — kitchens, alchemy labs, fishing spots, forage zones, and gathering envs all position-filtered. **Workshop gap closed 2026-09-01**: `DowntimeContext.craftingWorkshops` (computed but previously unconsumed — dead code) now feeds a Workshop selector in CraftingWorkbench; bonus (`activityCategories.crafting.skillBonus` ?? `rating`) adds to effective skill and is stamped on the shift, mirroring the kitchen pattern.

**Remaining 15a gaps (each needs a design pass before implementation — grill-me candidates):**
- **Inventory -> character-sheet equipment bridge** (largest gap): `ItemInstance` carries no weight/category/stats, so crafted/looted gear tagged to a character can never reach `gcsData.equipment`, encumbrance, DR, or combat stats. Needs type unification or a converter plus an "equip from inventory" / "add to sheet" affordance in both directions.
- **Combat injuries beyond HP/FP**: `PostCombatSummary` captures crippled limbs, conditions, and death but syncs only pools; `Character` has no fields for them, so they vanish at combat end (rest can heal an amputee to full, silently).
- **Multi-group `currentLocationId` scoping** (self-flagged at `campaignReducer.ts:889`): a non-active group's arrival triggers discovery but never switches the location-scoped downtime resources.
- Cosmetic/UX: no auto-navigation to the Combat tab when a travel event fires (map panel button only); single `pendingIntent` slot can be overwritten by a second group's encounter; contacts are not announced on arrival (lane D scoped them as soft hints).

### 15b: Performance & Bundle
- ✅ Code splitting by tab/feature (2026-08-26, codex-shepherd): React.lazy + Suspense for all heavy tabs in UnifiedShell; entry chunk 2,061KB → 450KB (+142KB react-vendor); Map3DView (543KB) and @dnd-kit (48KB) load on demand. Browser-verified chunk-on-demand behavior, zero console errors.
- Profile and optimize re-renders in large state updates
- ~~Target: bundle < 500KB initial, lazy-load the rest~~ ✅ met (450KB entry)
- ~~**Known regression:** `@dnd-kit` (Phase 11b) pushed bundle from ~624KB to ~1,378KB~~ ✅ resolved via deferred `combat-dnd` chunk

### 15c: UX Polish
- Keyboard shortcuts for common actions
- Undo/redo across all systems (not just combat)
- Notification system for completed activities, status changes
- Responsive layout improvements
- Dark mode / theme support

### 15d: Accessibility (NEW)
- Add aria-labels to all interactive elements
- Add keyboard navigation to combat tracker, inventory, modals
- Add `role="dialog"` and `aria-modal` to all modals
- Add semantic table headers to inventory and combat lists
- Add live regions for toast notifications
- Target: Lighthouse accessibility score > 80

### 15e: JS -> TS Migration (NEW)
- ✅ COMPLETE (2026-08-26): all listed files were already converted in earlier phases or removed as dead code; the two remaining live JS utils (gathering.js 823, alchemy.js 1,366) converted via codex-shepherd with .d.ts folded in — src/utils now has zero .js files outside tests. Original list:
  - `src/utils/combatHistory.js` (600 lines)
  - `src/utils/combatReveal.js` (300 lines)
  - `src/utils/exportImport.js` (500 lines)
  - `src/utils/cryptoLock.js`
  - `src/utils/helpers.js`
  - `src/utils/schemaVersioning.js`
  - `src/utils/dataMigrations.js`

**Estimated effort:** 3-4 sessions

---

## Phase 16: Desktop App & Networking (Ship It)

**Goal:** Get a distributable Electron app that works at the table.

### 16a: Electron Packaging
- Build pipeline for Windows (primary), Mac, Linux
- Auto-update mechanism
- Local database persistence (SQL.js -> campaigns.db)
- File association for campaign save files

### 16b: Multiplayer Improvements (REVISED — auth handled in Phase 10.5)
- Implement delta sync (send only changed fields, not full state)
- Add optimistic locking (version check before accepting state push)
- Add conflict detection UI (show merge dialog when versions diverge)
- Offline queue (buffer pushes during disconnect, replay on reconnect)
- Add reconnection state reconciliation
- Chat / dice roll broadcasting

### 16c: Data & Backup
- Campaign file format (.gurps-campaign)
- Auto-save with configurable interval
- Campaign backup/restore from file
- Campaign sharing between GMs

**Estimated effort:** 3-4 sessions

---

## Summary Timeline

| Phase | Type | Focus | Sessions |
|-------|------|-------|----------|
| 10 (amended) | Cleanup | TS errors, dead code, tests, JSON safety, memory leaks | 3-4 |
| **10.5 (NEW)** | **Security** | **Auth, authorization, rate limiting, data integrity** | **3-4** |
| 11 | Feature | Combat system | 3-4 |
| 12 | Feature | Character depth | 3-4 |
| 13 | Mixed | Downtime polish | 3-4 |
| 14 | Feature | Map & locations | 3-4 |
| 15 (amended) | Cleanup | Integration, accessibility, JS->TS | 3-4 |
| 16 (amended) | Ship | Electron, delta sync, conflict resolution | 3-4 |
| **Total** | | | **~25-32 sessions** |

---

## Principles

1. **Cleanup before features** — Phase 10 first, always. Broken types and dead code slow everything down.
2. **Secure before shipping** — Phase 10.5 before any multiplayer goes live. No auth = no multiplayer.
3. **Decompose before extending** — Before adding features to a 1,000+ line file, decompose it first.
4. **Test what matters** — Focus tests on state reducers, critical workflows, and security boundaries.
5. **Ship incrementally** — Each phase should leave the app in a usable state. No multi-phase dependencies.
6. **The downtime system is the differentiator** — Invest disproportionately in making it excellent.
