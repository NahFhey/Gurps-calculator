# GURPS Calculator - Project Status & Roadmap

**Last Updated:** 2026-01-27
**Branch:** `claude/review-project-status-BbPCp`
**Status:** Phase 8a Complete - GatheringManager Decomposed to TypeScript

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
│   ├── ChangelogTab.tsx, DebugPanel.tsx, ErrorBoundary.tsx
│   ├── GMLockModal.tsx, DiceRoller.tsx, ImportExportPanel.tsx
│   ├── manager/
│   │   └── views/
│   │       └── [12 TypeScript view components]
│   ├── gathering/
│   │   └── views/
│   │       └── [7 TypeScript view components]
│   ├── AlchemyTab.jsx (uses bridge context)
│   ├── CombatTab.jsx (uses bridge context)
│   ├── CookingTab.jsx (uses bridge context)
│   ├── CraftingTab.jsx (uses bridge context)
│   ├── InventoryTab.jsx (uses bridge context)
│   └── ... (other components)
```

### Bridge Contexts (Legacy - Still in Use)
These are INTENTIONALLY kept for backward compatibility:
- `src/contexts/AlchemyContext.jsx` - Used by AlchemyTab
- `src/contexts/CombatContext.jsx` - Used by CombatTab, CharacterLibrary, etc.
- `src/contexts/ConfigContext.jsx` - Used by multiple legacy tabs
- `src/contexts/CraftingContext.jsx` - Used by CraftingTab
- `src/contexts/GatheringContext.jsx` - Not used (candidate for removal)
- `src/contexts/InventoryContext.jsx` - Used by CookingTab, CraftingTab, InventoryTab

**Note:** Do NOT remove these until legacy tabs are migrated to UnifiedShell pattern.

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

**Files Still to Convert (Lower Priority):**
```bash
# Large god components (candidates for decomposition first)
src/components/DayPlannerTab.jsx (1,364 lines)
src/components/RulesTab.jsx (820 lines)

# Legacy tabs (bridge context dependent)
src/components/AlchemyTab.jsx
src/components/CombatTab.jsx
src/components/CookingTab.jsx
src/components/CraftingTab.jsx
src/components/InventoryTab.jsx

# Alchemy subcomponents
src/components/alchemy/*.jsx (6 files)

# Contexts (legacy)
src/contexts/*.jsx (6 files)

# Other
src/components/party-tool/PartyToolApp.jsx
src/index.jsx
```

---

### Phase 8: God Component Decomposition 🚧 IN PROGRESS
**Priority:** High
**Estimated Time:** 1-2 weeks
**Impact:** Maintainability, testability, AI-readability

Apply the same decomposition pattern used for ManagerTab to remaining god components:

#### 8a. GatheringManager.jsx (1,754 lines) ✅ COMPLETE
**See Phase 8a completion above for details.**
- 7 views extracted to `src/components/gathering/views/`
- Thin router converted to TypeScript
- 90% code reduction achieved

#### 8b. DayPlannerTab.jsx (1,364 lines) 🎯 RECOMMENDED NEXT
**Suggested Views:**
- TimelineView
- ActivitySchedulerView
- CharacterAssignmentView
- ProgressTrackingView

#### 8c. RulesTab.jsx (820 lines)
**Suggested Views:**
- RulesCategoryView
- RulesSearchView
- RulesDisplayView

#### 8d. CombatTracker.tsx (2,051 lines) - Already TypeScript
**Note:** Already converted to TypeScript but still a large file.
**Consider decomposing into:**
- ParticipantListView
- CombatLogView
- ActionPanelView (already extracted)
- TurnControlsView

**Pattern to Follow:**
1. Read the monolith component
2. Identify logical view boundaries
3. Extract state for each view
4. Create view components with `onDelete` pattern
5. Convert parent to thin router
6. Test incrementally
7. Commit after each view

---

### Phase 9: Legacy Tab Migration (Major Refactor)
**Priority:** Low (current tabs work fine)
**Estimated Time:** 2-3 weeks
**Impact:** Removes bridge contexts, simplifies architecture

**Goal:** Migrate remaining tabs to UnifiedShell pattern

**Tabs to Migrate:**
1. AlchemyTab.jsx → Use useCampaignStore() directly
2. CombatTab.jsx → Use useCampaignStore() directly
3. CookingTab.jsx → Use useCampaignStore() directly
4. CraftingTab.jsx → Use useCampaignStore() directly
5. InventoryTab.jsx → Use useCampaignStore() directly

**After Migration:**
- Remove bridge context files (`src/contexts/*.jsx`)
- Remove bridge context providers from App.jsx (already removed)
- Simplify state access patterns
- Reduce bundle size further

**Note:** This is low priority because current dual architecture works fine.

---

### Phase 10: Testing & Documentation (Polish)
**Priority:** Medium
**Estimated Time:** 1 week
**Impact:** Code quality, maintainability

#### Unit Tests
Create tests for each view component:
```javascript
// Example: FoodTypesView.test.jsx
describe('FoodTypesView', () => {
  it('renders food types list', () => { ... });
  it('adds new food type when form submitted', () => { ... });
  it('calls onDelete when delete clicked', () => { ... });
  it('validates duplicate names', () => { ... });
});
```

**Test Coverage Goals:**
- View components: 80%+
- State reducers: 90%+
- Utility functions: 100%

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
- **src/state/campaignStore.js** - Main state store
- **src/state/campaignReducer.ts** - State reducer logic
- **src/components/UnifiedShell.jsx** - Main UI shell
- **src/components/App.jsx** - Application entry point

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
2. 🎯 **Continue Phase 8** - Decompose DayPlannerTab.jsx next
3. 📋 **Create todo list** - Break chosen component into tasks
4. 🚀 **Start incremental work** - Small commits, test often

### Recommended: Start with DayPlannerTab.jsx (Phase 8b)
```bash
# Step 1: Read and analyze DayPlannerTab.jsx (1,364 lines)
# Identify logical view boundaries (Timeline, Scheduler, etc.)
# Document state and props needed for each view

# Step 2: Create first view (simplest one)
# Extract to src/components/dayplanner/views/
# Test thoroughly with npm run build

# Step 3: Repeat for all identified views
# Step 4: Convert parent to thin router
# Step 5: Convert to TypeScript (.tsx)
```

### Alternative: RulesTab.jsx (Phase 8c)
```bash
# Same pattern as above
# Smaller component (820 lines) - good if DayPlanner feels complex
```

---

## 📊 Metrics & Progress

### Code Quality Metrics
- **ManagerTab Size:** 2,622 → 528 lines (80% reduction) ✅
- **GatheringManager Size:** 1,754 → 184 lines (90% reduction) ✅
- **App.jsx Size:** 260 → 96 lines (63% reduction) ✅
- **Bundle Size:** 800KB → 622KB (22% reduction) ✅
- **View Component Size:** 44-520 lines (AI-readable) ✅
- **Test Coverage:** 0% (needs Phase 10) ⚠️

### Architecture Health
- ✅ Single source of truth (CampaignStore)
- ✅ Normalized state pattern
- ✅ Component decomposition well underway (2 god components done)
- ✅ TypeScript for manager views + ManagerTab + gathering views + all combat components
- ✅ 45 components converted to TypeScript (38 + 7 gathering views)
- ⚠️ Bridge contexts still present (intentional)
- ⚠️ Some legacy tabs still JSX (lower priority)

### Developer Experience
- ✅ AI-readable component sizes
- ✅ Clear separation of concerns
- ✅ Incremental git history
- ✅ Good documentation
- ✅ Type safety for manager and gathering components

---

## 🏆 Achievements Unlocked

- **God Component Slayer** - Decomposed 2,622-line ManagerTab ✅
- **Gathering Master** - Decomposed 1,754-line GatheringManager (90% reduction) ✅
- **Architecture Simplifier** - Removed bridge pattern from App.jsx ✅
- **Bundle Optimizer** - Reduced bundle by 22% ✅
- **Documentation Master** - Created comprehensive guides ✅
- **Type Safety Pioneer** - Converted 45 components to TypeScript ✅
- **Combat System Master** - Full TypeScript coverage for combat (17 files) ✅

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

**Current Branch:** `claude/review-project-status-BbPCp`
**Build Status:** ✅ Passing (622KB bundle)
**Ready for:** Phase 8b - DayPlannerTab Decomposition

🎊 Phase 8a Complete! GatheringManager decomposed - 45 components now TypeScript! 🎊
