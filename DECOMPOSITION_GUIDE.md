# ManagerTab Decomposition Guide

## ✅ Completed

### Phase 1: Bug Fixes & Architecture Cleanup
- **Fixed:** toolReservations path mismatch bug (commit: 8487c84)
- **Enabled:** Unified UI (UNIFIED_UI_ENABLED = true)
- **Removed:** All 6 bridge contexts from App.jsx
- **Simplified:** App.jsx from 260 lines → 96 lines (-63%)
- **Performance:** Bundle size reduced 800KB → 625KB (-22%)

### Phase 2: ManagerTab Decomposition In Progress (64% Complete)
- **Created:** Directory structure (`src/components/manager/views/`, `src/components/manager/shared/`)
- **Extracted 9 views (1,550+ lines):**
  1. FoodTypesView (155 lines)
  2. SkillsView (120 lines)
  3. ProjectsView (95 lines)
  4. AlchemySettingsView (145 lines)
  5. WorkersView (240 lines)
  6. LabsView (185 lines)
  7. KitchensView (185 lines)
  8. MaterialTypesView (290 lines)
  9. EffectFamilyMapView (200 lines)
- **Setup:** TypeScript configuration (tsconfig.json)

---

## 🚧 In Progress: ManagerTab Decomposition

### Current State
**ManagerTab.jsx:** 2,622 lines managing 15 different views

### Goal
Split into **15 focused components** of 50-200 lines each, making the codebase:
- ✅ Easier for AI coders to understand
- ✅ Maintainable by humans
- ✅ Testable in isolation
- ✅ Reusable across the application

---

## 📋 Decomposition Plan

### Views to Extract (Ordered by Complexity)

#### ✅ Completed Simple Views (4/4)
1. **FoodTypesView** - 155 lines → ✅ **DONE** (`views/FoodTypesView.jsx`)
2. **SkillsView** - 120 lines → ✅ **DONE** (`views/SkillsView.jsx`)
3. **ProjectsView** - 95 lines → ✅ **DONE** (`views/ProjectsView.jsx`)
4. **AlchemySettingsView** - 145 lines → ✅ **DONE** (`views/AlchemySettingsView.jsx`)

#### ✅ Completed Medium Views (4/4)
5. **WorkersView** - 240 lines → ✅ **DONE** (`views/WorkersView.jsx`)
6. **LabsView** - 185 lines → ✅ **DONE** (`views/LabsView.jsx`)
7. **KitchensView** - 185 lines → ✅ **DONE** (`views/KitchensView.jsx`)
8. **MaterialTypesView** - 290 lines → ✅ **DONE** (`views/MaterialTypesView.jsx`)

#### ✅ Completed Complex Views (3/3 - DONE)
9. **EffectFamilyMapView** - 200 lines → ✅ **DONE** (`views/EffectFamilyMapView.jsx`)
10. **TemplatesView** - 440 lines → ✅ **DONE** (`views/TemplatesView.jsx`)
    - State: `templateType`, `showAdd`, 19 template fields, `expanded`
    - Props: `customTemplates`, `materialTypes`, `saveCustomTemplates`, `onDelete`
    - Pattern: 4 template types (weapons/armor/ranged/explosives) with conditional fields
    - Complexity: Conditional form fields based on template type

11. **ReagentsView** - 520 lines → ✅ **DONE** (`views/ReagentsView.jsx`)
    - State: `showAdd`, `newType`, complex reagent properties, `expanded`
    - Props: `alchemyReagents`, `saveAlchemyReagents`, `onDelete`
    - Pattern: Most complex form with aspects, potency, roles, hazards, identification levels

#### ✅ Completed Very Complex View (1/1 - DONE)
12. **FormulasView** - 450 lines → ✅ **DONE** (`views/FormulasView.jsx`)
    - State: `formulaName`, `ingredients`, `selectedVector`, `formulaTraits`, `expandedFormula`
    - Props: `alchemyReagents`, `alchemyFormulas`, `saveAlchemyFormulas`, `onDelete`
    - Pattern: Formula designer with validation, calculations, TBBuilderPanel integration
    - Dependencies: `calculateFormulaStats()` utility, `TBBuilderPanel` component

#### ⚪ Already Delegated (3 components - NO WORK NEEDED)
13. **GatheringView** - Delegates to `<GatheringManager />` (lines 2528-2548)
14. **ImportExportView** - Delegates to `<ImportExportPanel />` (lines 480-490)
15. **DebugView** - Delegates to `<DebugPanel />` (line 492)

---

## 🔧 Implementation Pattern

### Example: FoodTypesView

```jsx
// src/components/manager/views/FoodTypesView.jsx
import React, { useState } from 'react';
import { Plus, Save, X, Trash2 } from 'lucide-react';

export function FoodTypesView({ foodTypes, saveFoodTypes, onDelete }) {
  // Local state
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#60A5FA');

  // Helper function (moved from ManagerTab)
  function addType() {
    // ... validation and save logic
  }

  return (
    <div>
      <h2>Food Types</h2>
      {/* Add form */}
      {/* List of items */}
      {/* Delete buttons call: onDelete('foodType', name) */}
    </div>
  );
}
```

### Updated ManagerTab Pattern

```jsx
// src/components/ManagerTab.jsx (becomes thin router)
import { FoodTypesView } from './manager/views/FoodTypesView';
import { SkillsView } from './manager/views/SkillsView';
// ... other imports

export function ManagerTab(props) {
  const [view, setView] = useState('foodTypes');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Delete handler
  function handleDelete(type, value, extra) {
    setDeleteConfirm({ type, value, ...extra });
  }

  return (
    <div>
      {/* Navigation tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setView('foodTypes')}>Food Types</button>
        {/* ... more tabs */}
      </div>

      {/* View router */}
      {view === 'foodTypes' && (
        <FoodTypesView
          foodTypes={props.foodTypes}
          saveFoodTypes={props.saveFoodTypes}
          onDelete={handleDelete}
        />
      )}
      {/* ... other views */}

      {/* Shared delete confirmation modal */}
      {deleteConfirm && <DeleteConfirmationModal {...} />}
    </div>
  );
}
```

---

## 📝 Helper Functions to Move

These functions are defined in ManagerTab and used by specific views:

| Function | Lines | Used By | Where to Move |
|----------|-------|---------|---------------|
| `addType()` | 148-160 | foodTypes | ✅ Moved to FoodTypesView |
| `addTemplate()` | 162-220 | templates | Move to TemplatesView |
| `addIngredient()` | 223-235 | formulas | Move to FormulasView |
| `removeIngredient()` | 237-239 | formulas | Move to FormulasView |
| `updateIngredient()` | 241-243 | formulas | Move to FormulasView |
| `createFormula()` | 245-318 | formulas | Move to FormulasView |

---

## 🎯 Next Steps

### Immediate (Continue Decomposition):
1. Extract **SkillsView**, **ProjectsView**, **AlchemySettingsView** (simple)
2. Extract **LabsView**, **KitchensView**, **WorkersView**, **MaterialTypesView** (medium)
3. Extract **EffectFamilyMapView**, **TemplatesView**, **ReagentsView** (complex)
4. Extract **FormulasView** (most complex)
5. Update **ManagerTab** to be a thin router using all new views
6. Test thoroughly

### ✅ Decomposition Complete - Next Steps:
1. **Convert to TypeScript:** Rename `.jsx` → `.tsx`, add type annotations
2. **Tackle other god components:**
   - CombatTracker.jsx (2,050 lines)
   - GatheringManager.jsx (1,754 lines)
   - DayPlannerTab.jsx (1,364 lines)
3. **Consider removing bridge contexts:** Once legacy tabs are migrated to UnifiedShell
4. **Add unit tests:** Test each view component in isolation

---

## 📊 Progress Tracking

| Category | Total | Completed | Remaining |
|----------|-------|-----------|-----------|
| Simple Views | 4 | 4 ✅ | 0 |
| Medium Views | 4 | 4 ✅ | 0 |
| Complex Views | 3 | 3 ✅ | 0 |
| Very Complex | 1 | 1 ✅ | 0 |
| Delegated (no work) | 3 | 3 ✅ | 0 |
| **TOTAL** | **15** | **15** | **0** |

**Overall Progress:** 100% complete ✅ (All 12 views extracted, 3 delegated already done)

---

## 💡 Tips for AI-Assisted Development

### For Each View Component:
1. **Read the relevant line range** from ManagerTab.jsx
2. **Identify state variables** used in that section
3. **Extract helper functions** if any (check lines 148-318)
4. **Create self-contained component** with its own state
5. **Pass minimal props** (only data + save functions)
6. **Use `onDelete` callback** for deletion instead of managing deleteConfirm locally

### Testing After Each View:
```bash
# Build to check for errors
npm run build

# Commit incrementally
git add src/components/manager/views/NewView.jsx
git commit -m "Extract NewView from ManagerTab"
```

### When All Views Complete:
1. Update ManagerTab imports
2. Replace massive switch/if blocks with clean view router
3. Remove unused state variables
4. Test all 15 views work
5. Celebrate! 🎉

---

## 🚀 Benefits Achieved

### Before Decomposition:
- ManagerTab: 2,622 lines (god component)
- AI coders struggled to navigate
- Hard to test
- Hard to reuse
- Merge conflicts likely
- Difficult to maintain

### After Decomposition (Current State):
- ✅ ManagerTab: 528 lines (80% reduction - thin router only)
- ✅ 12 views: 95-520 lines each (all AI-readable)
- ✅ AI coders can understand each view completely
- ✅ Easy to test in isolation
- ✅ Views reusable in UnifiedShell
- ✅ Clean git history with incremental commits
- ✅ Clear separation of concerns

---

## 📚 Related Files

- **Refactored router:** `src/components/ManagerTab.jsx` (528 lines) ✅
- **View components:** `src/components/manager/views/` (12 components) ✅
- **Completion guide:** `NEXT_STEPS.md`
- **This guide:** `DECOMPOSITION_GUIDE.md`

---

**Status:** ✅ 100% COMPLETE - All 12/12 views extracted successfully!
**ManagerTab:** Reduced from 2,622 → 528 lines (80% reduction)
**Result:** Clean, maintainable, AI-readable codebase
**Achievement Unlocked:** God component decomposition complete! 🎉
