# ManagerTab Decomposition Guide

## ✅ Completed

### Phase 1: Bug Fixes & Architecture Cleanup
- **Fixed:** toolReservations path mismatch bug (commit: 8487c84)
- **Enabled:** Unified UI (UNIFIED_UI_ENABLED = true)
- **Removed:** All 6 bridge contexts from App.jsx
- **Simplified:** App.jsx from 260 lines → 96 lines (-63%)
- **Performance:** Bundle size reduced 800KB → 625KB (-22%)

### Phase 2: ManagerTab Decomposition Started
- **Created:** Directory structure (`src/components/manager/views/`, `src/components/manager/shared/`)
- **Extracted:** FoodTypesView component (155 lines, self-contained)
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

#### ✅ Completed (1/15)
1. **FoodTypesView** - 70 lines → ✅ **DONE** (`views/FoodTypesView.jsx`)

#### 🔵 Simple Views (Next Priority - 3 components)
2. **SkillsView** - 70 lines
   - Lines: 1176-1243
   - State: `showAdd`, `newSkillName`, `deleteConfirm`
   - Props: `cookingSkills`, `saveCookingSkills`, `gmMode`
   - Pattern: Same as FoodTypesView with GM-only editing

3. **ProjectsView** - 50 lines
   - Lines: 1245-1291
   - State: `deleteConfirm`
   - Props: `crafts`, `saveCrafts`, `materials`, `saveMaterials`
   - Pattern: Read-only list with delete, refund materials on delete

4. **AlchemySettingsView** - 115 lines
   - Lines: 2412-2526
   - State: None (direct props editing)
   - Props: `alchemySettings`, `saveAlchemySettings`
   - Pattern: Simple form with toggles and number inputs

#### 🟡 Medium Views (4 components)
5. **WorkersView** - 170 lines
   - Lines: 744-912
   - State: `showAdd`, `newType`, `expanded`, `deleteConfirm`
   - Props: `workers`, `saveWorkers`
   - Pattern: Expandable items with skill editing

6. **LabsView** - 130 lines
   - Lines: 914-1043
   - State: `showAdd`, `newLabName/Rating/Description`, `expanded`, `deleteConfirm`
   - Props: `alchemyLabs`, `saveAlchemyLabs`
   - Pattern: Expandable items with rating (0-4)

7. **KitchensView** - 130 lines
   - Lines: 1045-1174
   - State: `showAdd`, `newKitchenName/Rating/Description`, `expanded`, `deleteConfirm`
   - Props: `kitchens`, `saveKitchens`
   - Pattern: Nearly identical to LabsView

8. **MaterialTypesView** - 180 lines
   - Lines: 564-742
   - State: `showAdd`, material props (7 fields), `expanded`, `draftMatTypeName`, `deleteConfirm`
   - Props: `materialTypes`, `saveMaterialTypes`, `renameMaterialType`
   - Pattern: Expandable with complex property editing

#### 🟠 Complex Views (3 components)
9. **EffectFamilyMapView** - 200 lines
   - Lines: 1499-1695
   - State: `expanded`
   - Props: `effectFamilyMap`, `saveEffectFamilyMap`
   - Pattern: Nested aspect pairs with effect management

10. **TemplatesView** - 205 lines
    - Lines: 1293-1497
    - State: `templateType`, `showAdd`, 19 template fields, `expanded`, `deleteConfirm`
    - Props: `customTemplates`, `materialTypes`, `saveCustomTemplates`
    - Pattern: 4 template types (weapons/armor/ranged/explosives) with conditional fields

11. **ReagentsView** - 430 lines
    - Lines: 1697-2122
    - State: `showAdd`, `newType`, complex reagent properties, `expanded`, `deleteConfirm`
    - Props: `alchemyReagents`, `saveAlchemyReagents`
    - Pattern: Most complex form with aspects, potency, roles, hazards

#### 🔴 Very Complex View (1 component)
12. **FormulasView** - 290 lines
    - Lines: 2124-2410
    - State: `formulaName`, `ingredients`, `selectedVector`, `formulaTraits`, `expandedFormula`, `deleteConfirm`
    - Props: `alchemyReagents`, `alchemyFormulas`, `saveAlchemyFormulas`
    - Pattern: Formula designer with validation, calculations, TBBuilderPanel integration
    - Dependencies: `calculateFormulaStats()` utility

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

### After Decomposition:
1. **Convert to TypeScript:** Rename `.jsx` → `.tsx`, add type annotations
2. **Tackle other god components:**
   - CombatTracker.jsx (2,050 lines)
   - GatheringManager.jsx (1,754 lines)
   - DayPlannerTab.jsx (1,364 lines)
3. **Remove unused code:** Delete bridge context files if truly unused
4. **Documentation cleanup:** Consolidate 16,000+ lines of docs

---

## 📊 Progress Tracking

| Category | Total | Completed | Remaining |
|----------|-------|-----------|-----------|
| Simple Views | 3 | 1 | 2 |
| Medium Views | 4 | 0 | 4 |
| Complex Views | 3 | 0 | 3 |
| Very Complex | 1 | 0 | 1 |
| Delegated (no work) | 3 | 3 | 0 |
| **TOTAL** | **14** | **4** | **10** |

**Overall Progress:** 29% complete (4/14 views done)

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

## 🚀 Expected Benefits

### Before:
- ManagerTab: 2,622 lines
- AI coders struggle to navigate
- Hard to test
- Hard to reuse
- Merge conflicts likely

### After:
- ManagerTab: ~200 lines (router only)
- 15 views: 50-200 lines each
- AI coders can understand each view
- Easy to test in isolation
- Views reusable in UnifiedShell
- Clean git history

---

## 📚 Related Files

- **Current monolith:** `src/components/ManagerTab.jsx` (2,622 lines)
- **New view directory:** `src/components/manager/views/`
- **Shared components:** `src/components/manager/shared/`
- **Analysis document:** Created by Task agent (agent ID: a9f9141)
- **This guide:** `DECOMPOSITION_GUIDE.md`

---

**Status:** Decomposition in progress. FoodTypesView extracted as proof-of-concept.
**Next:** Extract 2 more simple views to establish pattern, then tackle medium/complex views.
**Timeline:** 2-3 days for full decomposition if working incrementally.
