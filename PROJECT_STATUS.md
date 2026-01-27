# GURPS Calculator - Project Status & Roadmap

**Last Updated:** 2026-01-27
**Branch:** `claude/review-project-status-tBbZ7`
**Status:** Phase 7 In Progress - View Components Converted

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
src/components/
├── App.jsx (96 lines - clean entry point)
├── UnifiedShell.jsx (main UI shell)
├── ManagerTab.jsx (528 lines - thin router)
├── manager/
│   └── views/
│       └── [12 view components]
├── AlchemyTab.jsx (uses bridge context)
├── CombatTab.jsx (uses bridge context)
├── CookingTab.jsx (uses bridge context)
├── CraftingTab.jsx (uses bridge context)
├── InventoryTab.jsx (uses bridge context)
└── ... (other components)
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

### Phase 7: TypeScript Conversion 🔄 IN PROGRESS
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

**📝 Remaining Steps:**
1. Convert ManagerTab.jsx → ManagerTab.tsx
2. Convert remaining UI components gradually
3. Add stricter TypeScript rules to tsconfig.json

**Benefits Already Achieved:**
- Catch bugs at compile time
- Better IDE autocomplete
- Self-documenting code
- Easier refactoring

**Files Still to Convert:**
```bash
# ManagerTab router (next priority)
src/components/ManagerTab.jsx → ManagerTab.tsx

# Other components (lower priority)
src/components/App.jsx
src/components/alchemy/TBBuilderPanel.jsx
# ... etc
```

---

### Phase 8: God Component Decomposition (Continue Pattern)
**Priority:** Medium
**Estimated Time:** 1-2 weeks
**Impact:** Maintainability, testability

Apply the same decomposition pattern used for ManagerTab to:

#### 8a. CombatTracker.jsx (2,050 lines)
**Suggested Views:**
- CharacterStatsView
- InitiativeTrackerView
- ActionQueueView
- CombatLogView
- EncounterControlsView

#### 8b. GatheringManager.jsx (1,754 lines)
**Suggested Views:**
- SpeciesManagementView
- ToolManagementView
- EnvironmentSetupView
- GatheringTablesView
- ItemCatalogView

#### 8c. DayPlannerTab.jsx (1,364 lines)
**Suggested Views:**
- TimelineView
- ActivitySchedulerView
- CharacterAssignmentView
- ProgressTrackingView

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
2. 🎯 **Choose Phase 7 or 8** - TypeScript conversion OR next god component
3. 📋 **Create todo list** - Break chosen phase into tasks
4. 🚀 **Start incremental work** - Small commits, test often

### If Choosing TypeScript (Phase 7):
```bash
# Step 1: Create type definitions
touch src/types/campaign.ts
touch src/types/views.ts

# Step 2: Convert one view as proof of concept
mv src/components/manager/views/FoodTypesView.jsx src/components/manager/views/FoodTypesView.tsx

# Step 3: Add interfaces
# Step 4: Test & iterate
```

### If Choosing God Component (Phase 8):
```bash
# Step 1: Analyze CombatTracker
# Read file, identify views
# Document state and props needed

# Step 2: Create first view
# Extract simplest view first
# Test thoroughly

# Step 3: Repeat for all views
# Step 4: Convert parent to router
```

---

## 📊 Metrics & Progress

### Code Quality Metrics
- **ManagerTab Size:** 2,622 → 528 lines (80% reduction) ✅
- **App.jsx Size:** 260 → 96 lines (63% reduction) ✅
- **Bundle Size:** 800KB → 625KB (22% reduction) ✅
- **View Component Size:** 95-520 lines (AI-readable) ✅
- **Test Coverage:** 0% (needs Phase 10) ⚠️

### Architecture Health
- ✅ Single source of truth (CampaignStore)
- ✅ Normalized state pattern
- ✅ Component decomposition started
- ⚠️ Bridge contexts still present (intentional)
- ⚠️ No TypeScript (Phase 7 needed)

### Developer Experience
- ✅ AI-readable component sizes
- ✅ Clear separation of concerns
- ✅ Incremental git history
- ✅ Good documentation
- ⚠️ No type safety yet

---

## 🏆 Achievements Unlocked

- **God Component Slayer** - Decomposed 2,622-line ManagerTab ✅
- **Architecture Simplifier** - Removed bridge pattern from App.jsx ✅
- **Bundle Optimizer** - Reduced bundle by 22% ✅
- **Documentation Master** - Created comprehensive guides ✅

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

**Current Branch:** `claude/review-legacy-migration-jsTP8`
**Build Status:** ✅ Passing (625KB bundle)
**Ready for:** Phase 7 (TypeScript) or Phase 8 (God Components)

🎊 Codebase is in excellent shape - choose your next adventure! 🎊
