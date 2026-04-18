# GURPS Calculator - Project Status & Roadmap

**Last Updated:** 2026-04-17
**Branch:** `home-test`
**Status:** Phase 10 stabilization baseline is green; the next cleanup targets are dependency audit, coverage expansion, and bundle follow-up before Phase 11 combat decomposition.

## Current Snapshot

- `npm run lint`, `npm run typecheck`, `npm run build`, and `npx vitest run` are all green in the current worktree.
- The TypeScript lint warning backlog from the recent lint expansion has been cleared.
- Legacy `CombatContext` has been removed and combat now uses direct store/hook access.
- The repo-local stabilization workflow now includes thematic backlog sweeps, explicit closeout verification, and doc refresh expectations.
- The most useful next Phase 10 work is dependency cleanup, targeted coverage expansion, and bundle-size follow-up.

Historical migration details below are kept for context, but the bullets above are the current baseline.

---

## 📊 Current State

### ✅ Completed Phases

#### Phase 1-4: Migration Foundation (Historical)
- Created Unified UI architecture with CampaignStore
- Implemented Redux-style state management with Immer
- Built UnifiedShell component
- Set up normalized state pattern

#### Phase 5: Bug Fixes & Architecture Cleanup ✅ COMPLETE
**Commits:** 8487c84, 633b357, 77e051b
- ✅ Fixed toolReservations schema path bug
- ✅ Enabled UNIFIED_UI (set to true)
- ✅ Removed all 6 bridge context providers from App.jsx
- ✅ Simplified App.jsx: 260 → 96 lines (-63%)
- ✅ Bundle size reduced: 800KB → 625KB (-22%)

#### Phase 6: ManagerTab Decomposition ✅ COMPLETE
**Commits:** Multiple incremental commits + 284ee80 (final)

**Achievement: 2,622 → 528 lines (80% reduction)**

**All 12 Views Extracted (Now TypeScript .tsx):**
1. FoodTypesView.tsx (155 lines)
2. SkillsView.tsx (120 lines)
3. ProjectsView.tsx (95 lines)
4. AlchemySettingsView.tsx (145 lines)
5. WorkersView.tsx (240 lines)
6. LabsView.tsx (185 lines)
7. KitchensView.tsx (185 lines)
8. MaterialTypesView.tsx (290 lines)
9. EffectFamilyMapView.tsx (200 lines)
10. TemplatesView.tsx (440 lines)
11. ReagentsView.tsx (520 lines)
12. FormulasView.tsx (450 lines)

**Benefits Achieved:**
- ✅ Each view is AI-readable (95-520 lines)
- ✅ Clear separation of concerns
- ✅ Self-contained components
- ✅ Testable in isolation
- ✅ Reusable across application
- ✅ No performance impact

---

## 🏗️ Current Architecture

### State Management
```
CampaignStore (Redux-style with Immer)
├── entities/
│   ├── characters: Record<Id, Character>
│   ├── inventory: Record<Id, InventoryItem>
│   ├── materials: Record<Id, Material>
│   ├── crafts: Record<Id, Craft>
│   ├── workers: Record<Id, Worker>
│   ├── toolReservations: Record<...>
│   └── ... (normalized)
├── collections/
│   ├── foodTypes: FoodType[]
│   ├── materialTypes: MaterialType[]
│   ├── alchemyReagents: Reagent[]
│   └── ... (arrays)
└── checkpoints/
    └── entries: Checkpoint[]
```

### Component Structure
```
src/
├── App.tsx (typed entry point)
├── unified/
│   └── UnifiedShell.tsx (typed UI shell)
├── components/
│   ├── ManagerTab.tsx (typed thin router)
│   ├── GatheringManager.tsx (typed thin router - 184 lines)
│   ├── DayPlannerTab.tsx (typed thin router - 270 lines)
│   ├── ChangelogTab.tsx, DebugPanel.tsx, ErrorBoundary.tsx
│   ├── GMLockModal.tsx, DiceRoller.tsx, ImportExportPanel.tsx
│   ├── manager/
│   │   └── views/
│   │       └── [12 TypeScript view components]
│   ├── gathering/
│   │   └── views/
│   │       └── [7 TypeScript view components]
│   ├── dayplanner/
│   │   └── views/
│   │       └── [5 TypeScript view components]
│   ├── rules/
│   │   ├── data/
│   │   │   └── rulesContent.ts (730 lines of content)
│   │   └── views/
│   │       └── [2 TypeScript view components]
│   ├── combat/
│   │   ├── CombatTracker.tsx (1,506 lines - thin router)
│   │   ├── views/
│   │   │   └── [5 TypeScript view components]
│   │   └── [other combat components]
│   ├── AlchemyTab.tsx (170 lines - direct store)
│   ├── CombatTab.tsx (130 lines - direct store)
│   ├── CookingTab.tsx (880 lines - direct store)
│   ├── CraftingTab.tsx (980 lines - direct store)
│   ├── InventoryTab.tsx (460 lines - direct store)
│   └── ... (other components)
```

### Context Status
Main tabs now use direct store/hook access. `CombatContext` has been removed from the current worktree, and `src/contexts` is no longer carrying the old bridge-context set referenced in earlier migration notes.

---

## 🎯 Roadmap

### Phase 7: TypeScript Conversion ✅ COMPLETE
**Priority:** High
**Impact:** Type safety, better DX, fewer runtime errors

**✅ Completed:**
1. Created `src/types/views.ts` with prop interfaces for all 12 views
2. Converted all 12 view components: `.jsx` → `.tsx`
   - SkillsView, FoodTypesView, ProjectsView, AlchemySettingsView
   - WorkersView, LabsView, KitchensView, MaterialTypesView
   - EffectFamilyMapView, TemplatesView, ReagentsView, FormulasView
3. Added explicit type annotations for props, state, and callbacks
4. Build passes with no view component errors
5. **Converted ManagerTab.jsx → ManagerTab.tsx**
   - Created ManagerTabProps interface (70+ typed props)
   - Added GMLockData, ManagerView, DeleteConfirmState types
   - Removed PropTypes dependency
   - Build verified (623KB bundle)
6. **Converted App.jsx → App.tsx**
   - Added typed state for CampaignState and MigrationStatus
   - Imported types from campaignReducer
7. **Converted UnifiedShell.jsx → UnifiedShell.tsx**
   - Added ModuleDefinition and UnifiedShellProps interfaces
   - Typed event handlers (KeyboardEvent, MouseEvent)
8. **Converted 6 utility components:**
   - ChangelogTab.tsx, DebugPanel.tsx, ErrorBoundary.tsx
   - GMLockModal.tsx, DiceRoller.tsx, ImportExportPanel.tsx
9. **Converted ALL combat directory components (17 files):**
   - CombatHistory.tsx, CharacterSheet.tsx, ModifierStack.tsx
   - ConditionsPanel.tsx, RevealPanel.tsx, EffectsPanel.tsx
   - DefenseAssist.tsx, GCSImportModal.tsx, AttackAssist.tsx
   - DamageAssist.tsx, ReinforcementsModal.tsx
   - CharacterLibrary.tsx, CharacterForm.tsx, ActionPanel.tsx
   - EncounterSetup.tsx, InjuryResolutionPanel.tsx
   - **CombatTracker.tsx (2,051 lines - largest component)**

**Total: 38 components converted to TypeScript**

**Benefits Achieved:**
- Catch bugs at compile time
- Better IDE autocomplete
- Self-documenting code
- Easier refactoring
- Combat system fully type-safe

#### Phase 8a: GatheringManager Decomposition ✅ COMPLETE
**Commit:** 207ae08

**Achievement: 1,754 → 184 lines (90% reduction)**

**Created `src/types/gathering.ts` with TypeScript interfaces for:**
- GatheringSpeciesExtended, GatheringToolExtended, GatheringTableExtended
- GatheringEnvironmentExtended, GatheringBaitExtended, GatheringItemExtended
- All view props interfaces and utility types

**All 7 Views Extracted (TypeScript .tsx):**
1. CampaignDayView.tsx (44 lines)
2. SpeciesView.tsx (274 lines)
3. ItemsView.tsx (224 lines)
4. ToolsView.tsx (295 lines)
5. TablesView.tsx (310 lines)
6. EnvironmentsView.tsx (264 lines)
7. BaitView.tsx (195 lines)

**GatheringManager.tsx converted to thin router (184 lines)**

**Benefits Achieved:**
- ✅ Each view is AI-readable (44-310 lines)
- ✅ Full TypeScript type safety
- ✅ Clear separation of concerns
- ✅ Self-contained components
- ✅ Build passes (622KB bundle)

#### Phase 8b: DayPlannerTab Decomposition ✅ COMPLETE
**Commit:** fa8f6c1

**Achievement: 1,365 → 270 lines (80% reduction)**

**Created `src/types/dayplanner.ts` with TypeScript interfaces for:**
- TaskAssignment, TimeSlot, PendingDayLedger, InventoryDelta
- All view props interfaces and utility types

**All 5 Views Extracted (TypeScript .tsx):**
1. DayHeaderBar.tsx (58 lines)
2. WorkersPanel.tsx (53 lines)
3. TaskListPanel.tsx (107 lines)
4. DaySummaryPanel.tsx (81 lines)
5. TaskDetailPanel.tsx (815 lines) - contains 7 internal sub-components

**DayPlannerTab.tsx converted to thin router (270 lines)**

**Benefits Achieved:**
- ✅ Each view is AI-readable (53-815 lines)
- ✅ Full TypeScript type safety
- ✅ TaskDetailPanel broken into logical sub-components
- ✅ Build passes (622KB bundle)

#### Phase 8c: RulesTab Decomposition ✅ COMPLETE
**Commit:** 3cabe66

**Achievement: 820 → 50 lines (94% reduction)**

**Created `src/types/rules.ts` with TypeScript interfaces for:**
- RuleSection, RuleSubsection, ExpandedSections
- RuleSectionViewProps, QuickNavigationProps, RulesTabProps

**Decomposition Strategy:**
- Extracted 730 lines of static content to `rules/data/rulesContent.ts`
- Created 2 view components in `rules/views/`

**All Components Created (TypeScript .tsx):**
1. rulesContent.ts (730 lines) - All 6 sections of documentation content
2. RuleSectionView.tsx (48 lines) - Expandable section display
3. QuickNavigationView.tsx (19 lines) - Footer navigation hint

**RulesTab.tsx converted to thin router (50 lines)**

**Benefits Achieved:**
- ✅ Content separated from presentation logic
- ✅ Full TypeScript type safety
- ✅ Clean, readable thin router
- ✅ Build passes (622KB bundle)

**Files Still to Convert (Lower Priority):**
```bash
# Alchemy subcomponents
src/components/alchemy/*.jsx (6 files)

# Contexts (legacy - candidates for removal)
src/contexts/*.jsx (6 files)

# Other
src/components/party-tool/PartyToolApp.jsx
src/index.jsx
```

---

### Phase 8: God Component Decomposition ✅ COMPLETE
**Priority:** High
**Impact:** Maintainability, testability, AI-readability

Applied the decomposition pattern used for ManagerTab to all major god components:

#### 8a. GatheringManager.jsx (1,754 lines) ✅ COMPLETE
**See Phase 8a completion above for details.**
- 7 views extracted to `src/components/gathering/views/`
- Thin router converted to TypeScript
- 90% code reduction achieved

#### 8b. DayPlannerTab.jsx (1,365 lines) ✅ COMPLETE
**See Phase 8b completion above for details.**
- 5 views extracted to `src/components/dayplanner/views/`
- Thin router converted to TypeScript
- 80% code reduction achieved

#### 8c. RulesTab.jsx (820 lines) ✅ COMPLETE
**See Phase 8c completion above for details.**
- Content extracted to `rules/data/rulesContent.ts`
- 2 views extracted to `rules/views/`
- Thin router converted to TypeScript
- 94% code reduction achieved

#### 8d. CombatTracker.tsx (2,051 lines) ✅ COMPLETE
**Commit:** dd07167

**Achievement: 2,051 → 1,506 lines (27% reduction)**

**Created `src/types/combatTracker.ts` with TypeScript interfaces for:**
- Participant, CombatState, HistoryState, RevealState
- LogEntry, RollData, ActionData, Maneuver, TurnContext
- All view props interfaces

**All 5 Views Extracted (TypeScript .tsx):**
1. CombatHeaderView.tsx (120 lines) - Header with undo/redo, export, end combat
2. TurnControlsView.tsx (50 lines) - Current turn display with navigation
3. DicePanelView.tsx (80 lines) - Collapsible dice tools
4. ParticipantListView.tsx (290 lines) - Participant cards with status
5. CombatLogView.tsx (200 lines) - Log display with roll/action formatting

**CombatTracker.tsx converted to thin router (1,506 lines)**

**Note:** CombatTracker has more business logic than other decomposed components.
The 27% reduction focuses on view extraction while preserving complex combat logic.

**Benefits Achieved:**
- ✅ View logic cleanly separated
- ✅ Full TypeScript type safety
- ✅ Reusable view components
- ✅ Build passes (624KB bundle)

#### 8e. Future Candidates (Lower Priority)
**Remaining large files that could benefit from decomposition:**
- ActionPanel.tsx (combat action workflow)
- AlchemyTab.jsx (bridge context dependent)
- CookingTab.jsx (bridge context dependent)

**Pattern to Follow:**
1. Read the monolith component
2. Identify logical view boundaries
3. Extract state for each view
4. Create view components with `onDelete` pattern
5. Convert parent to thin router
6. Test incrementally
7. Commit after each view

---

### Phase 9: Legacy Tab Migration ✅ COMPLETE
**Commits:** 31b1564, cb0630b

**Achievement: All 5 legacy tabs migrated to TypeScript with direct store access**

**All Tabs Migrated:**
1. AlchemyTab.jsx → AlchemyTab.tsx (93 → 170 lines, direct useCampaignStore)
2. CombatTab.jsx → CombatTab.tsx (127 → 130 lines, direct useCampaignStore)
3. CookingTab.jsx → CookingTab.tsx (910 → 880 lines, direct useCampaignStore)
4. CraftingTab.jsx → CraftingTab.tsx (1003 → 980 lines, direct useCampaignStore)
5. InventoryTab.jsx → InventoryTab.tsx (508 → 460 lines, direct useCampaignStore)

**Migration Pattern Applied:**
- Replace bridge context imports with useCampaignStore
- Use denormalizeObject/normalizeArray for state conversion
- Derive workers from characters entity
- Add TypeScript interfaces for all data types
- Use useCallback for save functions

**Benefits Achieved:**
- ✅ Direct store access (no bridge overhead)
- ✅ Full TypeScript type safety
- ✅ Consistent state patterns
- ✅ Bridge contexts now candidates for removal
- ✅ Build passes (624KB bundle)

**Remaining Bridge Context Usage:**
- Resolved in the current worktree: `CombatContext` has been removed.

---

### Phase 10: Testing & Documentation 🚧 IN PROGRESS
**Priority:** Medium
**Impact:** Code quality, maintainability

#### Unit Tests - Good Progress
**Commits:** 2684c70, 5402389

**View Component Tests Added:**

**Manager Views:**
1. FoodTypesView.test.tsx - 13 tests (render, add, edit, delete, validation)
2. SkillsView.test.tsx - 16 tests (GM mode, add, delete, validation)
3. ProjectsView.test.tsx - 13 tests (in-progress, completed, delete)
4. LabsView.test.tsx - 12 tests (alchemy lab management)
5. KitchensView.test.tsx - 13 tests (kitchen facility management)
6. WorkersView.test.tsx - 13 tests (worker NPC skills)

**Gathering Views:**
7. CampaignDayView.test.tsx - 10 tests (increment, decrement, input)
8. SpeciesView.test.tsx - 19 tests (fish species, tags, ST, secondary materials)
9. ItemsView.test.tsx - 22 tests (forageable items, rarity, inventory types)

**Test Summary:**
- Total tests: 300 (up from 169)
- New tests added: 131
- All tests passing

**Test Coverage Goals:**
- View components: Good progress (9/~30 views tested)
- State reducers: Good (14 tests)
- Utility functions: Good (100+ tests)

#### Integration Tests
- End-to-end workflows
- Cross-component interactions
- State persistence

#### Documentation
- API documentation for store actions
- Component prop documentation
- Architecture decision records (ADRs)
- Contributing guide for AI coders

---

## 📁 Key Files & Documentation

### Documentation Files
- **PROJECT_STATUS.md** - This file (current state & roadmap)
- **DECOMPOSITION_GUIDE.md** - ManagerTab decomposition methodology
- **NEXT_STEPS.md** - Completion summary for ManagerTab
- **README.md** - Project overview

### Architecture Files
- **src/state/campaignStore.tsx** - Main state store provider/hooks
- **src/state/campaignReducer.ts** - State reducer logic
- **src/unified/UnifiedShell.tsx** - Main UI shell
- **src/App.tsx** - Application entry point

### Key Components
- **ManagerTab.jsx** - Thin router (528 lines)
- **manager/views/** - 12 view components (95-520 lines each)
- **Bridge contexts** - Legacy compatibility layer

---

## 🚨 Known Issues & Tech Debt

### High Priority
- None currently! 🎉

### Medium Priority
1. **Bundle Size Warning** - 625KB bundle (consider code splitting)
2. **Bridge Contexts** - Can be removed after legacy tab migration
3. **PropTypes vs TypeScript** - Should migrate to TypeScript interfaces

### Low Priority
1. **Documentation Consolidation** - 16,000+ lines of docs could be streamlined
2. **Unused Dependencies** - May have unused packages in package.json
3. **CSS Organization** - Tailwind classes could be extracted to components

---

## 🎯 Recommended Next Actions

### For Immediate Next Session:
1. ✅ **Review this document** - Understand current state
2. 🎯 **Phase 9 Complete** - All legacy tabs use direct store access
3. 📋 **Choose next phase** - Context cleanup or testing
4. 🚀 **Start incremental work** - Small commits, test often

### Option A: Context Cleanup
```bash
# Remove unused bridge contexts:
# - GatheringContext.jsx (unused)
# - AlchemyContext.jsx (no longer used by tabs)
# - ConfigContext.jsx (no longer used by tabs)
# - CraftingContext.jsx (no longer used by tabs)
# - InventoryContext.jsx (no longer used by tabs)

# CombatContext.jsx has been removed in the current worktree
```

### Option B: Continue Decomposition (Phase 8e)
```bash
# ActionPanel.tsx - combat action workflow
# Complex component with multiple sub-workflows
# Could extract AttackWorkflow, DefenseWorkflow, DamageWorkflow views
```

### Option C: Testing & Documentation (Phase 10)
```bash
# Add unit tests for view components
# Document component APIs
# Create contributing guide
```

---

## 📊 Metrics & Progress

### Code Quality Metrics
- **ManagerTab Size:** 2,622 → 528 lines (80% reduction) ✅
- **GatheringManager Size:** 1,754 → 184 lines (90% reduction) ✅
- **DayPlannerTab Size:** 1,365 → 270 lines (80% reduction) ✅
- **RulesTab Size:** 820 → 50 lines (94% reduction) ✅
- **CombatTracker Size:** 2,051 → 1,506 lines (27% reduction) ✅
- **App.jsx Size:** 260 → 96 lines (63% reduction) ✅
- **Bundle Size:** 800KB → 624KB (22% reduction) ✅
- **View Component Size:** 19-815 lines (AI-readable) ✅
- **Test Coverage:** 888 tests passing (Phase 10 verification green) ✅

### Architecture Health
- ✅ Single source of truth (CampaignStore)
- ✅ Normalized state pattern
- ✅ Component decomposition complete (5 god components done)
- ✅ TypeScript for all major components
- ✅ 63 components converted to TypeScript (58 + 5 legacy tabs)
- ✅ All main tabs use direct store access
- ⚠️ Bridge contexts still present (candidates for removal)
- ⚠️ Combat sub-components still use bridge contexts

### Developer Experience
- ✅ AI-readable component sizes
- ✅ Clear separation of concerns
- ✅ Incremental git history
- ✅ Good documentation
- ✅ Type safety for manager, gathering, dayplanner, rules, and combat components

---

## 🏆 Achievements Unlocked

- **God Component Slayer** - Decomposed 2,622-line ManagerTab ✅
- **Gathering Master** - Decomposed 1,754-line GatheringManager (90% reduction) ✅
- **Day Planner Architect** - Decomposed 1,365-line DayPlannerTab (80% reduction) ✅
- **Rules Reformer** - Decomposed 820-line RulesTab (94% reduction) ✅
- **Combat Strategist** - Decomposed 2,051-line CombatTracker (27% reduction) ✅
- **Architecture Simplifier** - Removed bridge pattern from App.jsx ✅
- **Bundle Optimizer** - Reduced bundle by 22% ✅
- **Documentation Master** - Created comprehensive guides ✅
- **Type Safety Pioneer** - Converted 63 components to TypeScript ✅
- **Combat System Master** - Full TypeScript coverage for combat (22 files) ✅
- **Legacy Liberator** - Migrated all 5 legacy tabs to direct store access ✅

---

## 💡 Tips for Future Sessions

### When Starting a New Session:
1. Read **PROJECT_STATUS.md** (this file) first
2. Check git log for recent changes: `git log --oneline -10`
3. Review current branch: `git status`
4. Choose a phase from roadmap
5. Create todo list with TodoWrite tool
6. Work incrementally with small commits

### When Working on Decomposition:
1. Read the target component thoroughly
2. Use the ManagerTab pattern as reference
3. Extract views one at a time
4. Test after each extraction: `npm run build`
5. Commit incrementally with descriptive messages
6. Update this file when phase complete

### When Converting to TypeScript:
1. Start with simplest components
2. Create shared type definitions first
3. Enable `checkJs: false` initially
4. Convert gradually, enable stricter checks
5. Use existing .ts files as reference

---

**Current Branch:** `home-test`
**Build Status:** ✅ Passing (624KB bundle)
**Ready for:** dependency cleanup, targeted coverage expansion, or Phase 11a combat decomposition

🎊 Phase 9 Complete! All legacy tabs migrated - 63 components now TypeScript! 🎊
