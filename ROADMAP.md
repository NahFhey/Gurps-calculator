# GURPS VTT - Roadmap to Completion

**Created:** 2026-03-22
**Approach:** Alternating cleanup and feature phases to keep momentum while improving stability

---

## Phase 10: Stabilization Sprint (Cleanup)

**Goal:** Get the codebase healthy before pushing new features. Fix what's broken, remove what's dead.

### 10a: Fix TypeScript Errors (~542 errors)
- Fix type mismatches in test files (mock objects missing required fields)
- Fix `CraftingData` type — `projectId` and `toolIds` removed but tests/migration still reference them
- Fix `LogVisibility` type mismatch in activityLogger.ts
- Fix `FishingData` missing fields in UnifiedShell test mocks
- Clean up unused imports/declarations (TS6133/TS6196 warnings)
- Fix `storage.ts` type narrowing (`.valid`/`.issues` on `object`)
- Add Vite `ImportMeta` env type declaration for logger.ts

### 10b: Dead Code Removal
- Remove 5 unused bridge contexts: AlchemyContext, ConfigContext, CraftingContext, GatheringContext, InventoryContext
- Migrate CombatContext usage out of CharacterLibrary and EncounterSetup → direct store
- Remove CombatContext after migration
- Audit and remove unused dependencies from package.json
- Convert remaining 8 .jsx test files → .tsx

### 10c: Expand Test Coverage
- Fix existing broken test mocks to match current types
- Add tests for remaining ~21 untested view components
- Add integration tests for critical workflows: combat round, time advancement, crafting project lifecycle
- Target: all tests green, 80%+ view coverage

**Estimated effort:** 2-3 focused sessions

---

## Phase 11: Combat System Enhancement (Feature)

**Goal:** Make combat the standout feature — smooth, tactical, and fast at the table.

### 11a: CombatTracker Decomposition
- Extract remaining business logic from CombatTracker.tsx (1,545 lines)
- Create dedicated hooks: `useCombatTurn`, `useInitiativeTracker`, `useCombatHistory`
- Extract ActionPanel.tsx (644 lines) into sub-views by action type
- Target: CombatTracker < 800 lines, ActionPanel < 300 lines

### 11b: Combat UX Improvements
- Automated attack/defense roll resolution with margin calculation
- Quick-action buttons for common maneuvers (Attack, All-Out Attack, Defend, Wait)
- Visual initiative timeline / turn order bar
- Drag-and-drop participant reordering
- Status effect duration tracking with auto-decrement on new rounds
- Damage application with automatic DR and hit location lookup

### 11c: Combat-Party Integration
- Seamless character flow between party roster and combat encounters
- Pre-built encounter templates (save/load enemy groups)
- Post-combat injury summary and healing time calculation
- Loot/reward distribution after encounter resolution

**Estimated effort:** 3-4 sessions

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
- CookingTab.tsx (1,001 lines) → thin router + views
- CraftingTab.tsx (currently gone but crafting logic) — verify decomposition state
- LocationManager.tsx (1,091 lines) → thin router + views

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
- TravelWizard steps are built (Mode → Route → Confirm) — complete the flow
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

**Goal:** Everything works together smoothly.

### 15a: Cross-System Integration
- Map travel → triggers encounters → opens combat tracker
- Combat resolution → feeds into downtime (injuries, loot)
- Downtime crafting → updates inventory → equips characters
- Location arrival → updates available facilities and NPCs

### 15b: Performance & Bundle
- Code splitting by tab/feature (lazy load combat, map, etc.)
- Profile and optimize re-renders in large state updates
- Target: bundle < 500KB initial, lazy-load the rest

### 15c: UX Polish
- Keyboard shortcuts for common actions
- Undo/redo across all systems (not just combat)
- Notification system for completed activities, status changes
- Responsive layout improvements
- Dark mode / theme support

**Estimated effort:** 2-3 sessions

---

## Phase 16: Desktop App & Networking (Ship It)

**Goal:** Get a distributable Electron app that works at the table.

### 16a: Electron Packaging
- Build pipeline for Windows (primary), Mac, Linux
- Auto-update mechanism
- Local database persistence (SQL.js → campaigns.db)
- File association for campaign save files

### 16b: Multiplayer (Nice to Have)
- Server discovery on local network
- Player view (restricted based on GM mode)
- Real-time state sync for combat (initiative, HP, conditions visible to all)
- Chat / dice roll broadcasting
- Reconnection handling

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
| 10 | Cleanup | TS errors, dead code, tests | 2-3 |
| 11 | Feature | Combat system | 3-4 |
| 12 | Feature | Character depth | 3-4 |
| 13 | Mixed | Downtime polish | 3-4 |
| 14 | Feature | Map & locations | 3-4 |
| 15 | Cleanup | Integration & UX | 2-3 |
| 16 | Ship | Electron & networking | 3-4 |
| **Total** | | | **~20-26 sessions** |

---

## Principles

1. **Cleanup before features** — Phase 10 first, always. Broken types and dead code slow everything down.
2. **Decompose before extending** — Before adding features to a 1,000+ line file, decompose it first.
3. **Test what matters** — Focus tests on state reducers and critical workflows, not every UI detail.
4. **Ship incrementally** — Each phase should leave the app in a usable state. No multi-phase dependencies.
5. **The downtime system is the differentiator** — Invest disproportionately in making it excellent.
