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

**Remaining 3 production `as any` casts (→ Phase 11a):**
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

### 10d: Defensive JSON & Error Handling (NEW)

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

### 10e: Memory Leak Fixes (NEW)

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
- **Deferred:** Full inventory integration for loot (Phase 15 — currently logs distribution, doesn't modify inventory entities)

---

## Phase 12: Character System Depth (Feature)

**Goal:** Richer character sheets that cover more of GURPS character building.

### 12a: Character Sheet Enhancement
- Skill advancement tracking (points spent, progression history)
- Advantage/disadvantage management with point costs
- Equipment encumbrance calculation with move/dodge impact
- Spell management improvements (SpellsSection already at 332 lines — may need decomposition)
- Character portrait/token support

### 12b: GCS Import Improvements
- Broader GCS format support (validate against real exports)
- Import validation with diff preview ("here's what will change")
- Batch import for entire party files
- Export back to GCS-compatible format

### 12c: Character Lifecycle
- Character creation wizard with template support (warrior, mage, thief archetypes)
- Level-up / point-spend workflow between sessions
- Character comparison view (side-by-side stats)
- NPC generator with randomized stats based on templates

**Estimated effort:** 3-4 sessions

---

## Phase 13: Downtime & Activities Polish (Feature + Cleanup)

**Goal:** The downtime system is the killer differentiator — make it flawless.

### 13a: Decompose Remaining Monoliths
- CookingTab.tsx (1,001 lines) -> thin router + views
- CraftingTab.tsx (currently gone but crafting logic) — verify decomposition state
- LocationManager.tsx (1,091 lines) -> thin router + views

### 13b: Activity System Improvements
- Activity result history with searchable log
- Material requirement previews before committing to activities
- Batch operations (assign multiple characters to same activity type)
- Activity chaining (craft outputs feed into next activity's inputs)
- Better UX for tool reservation conflicts

### 13c: New Activity Types
- Trading/Commerce (buy/sell with market prices, haggling rolls)
- Research/Study (skill improvement during downtime)
- Healing/Recovery (injury recovery tracking tied to rest activities)
- Social activities (reputation/reaction modifier management)

**Estimated effort:** 3-4 sessions

---

## Phase 14: Map & Location System (Feature)

**Goal:** Bring the existing map infrastructure to full functionality.

### 14a: Map System Polish
- The foundation is already built (MapPanel, MapGrid, TerrainEditor, TravelWizard — 25 files)
- Polish MapGrid interaction (zoom, pan, selection)
- Complete terrain assignment and climate system
- Weather generation tied to location and season
- Random encounter tables per terrain/region

### 14b: Travel System
- TravelWizard steps are built (Mode -> Route -> Confirm) — complete the flow
- Travel time calculation based on terrain, encumbrance, weather
- Travel events and encounters during journeys
- Resource consumption during travel (food, water, supplies from inventory)
- Fatigue tracking for long journeys

### 14c: Location Management
- Location-based facility access (labs, kitchens, shops tied to places)
- NPC placement on map locations
- Location notes and discovery tracking
- Settlement generator with services and population

**Estimated effort:** 3-4 sessions

---

## Phase 15: Integration & Polish (Cleanup)

**Goal:** Everything works together smoothly. Accessibility and type safety for all remaining code.

### 15a: Cross-System Integration
- Map travel -> triggers encounters -> opens combat tracker
- Combat resolution -> feeds into downtime (injuries, loot)
- Downtime crafting -> updates inventory -> equips characters
- Location arrival -> updates available facilities and NPCs

### 15b: Performance & Bundle
- Code splitting by tab/feature (lazy load combat, map, etc.)
- Profile and optimize re-renders in large state updates
- Target: bundle < 500KB initial, lazy-load the rest
- **Known regression:** `@dnd-kit` (Phase 11b) pushed bundle from ~624KB to ~1,378KB — candidate for lazy loading or lighter alternative

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
- Convert critical `.js` utility files to `.ts`:
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
