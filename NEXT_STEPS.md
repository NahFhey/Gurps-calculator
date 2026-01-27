# Next Steps - Complete ManagerTab Decomposition

## ✅ What's Done (64% Complete)

### Extracted Views (9/14):
1. ✅ FoodTypesView (155 lines)
2. ✅ SkillsView (120 lines)
3. ✅ ProjectsView (95 lines)
4. ✅ AlchemySettingsView (145 lines)
5. ✅ WorkersView (240 lines)
6. ✅ LabsView (185 lines)
7. ✅ KitchensView (185 lines)
8. ✅ MaterialTypesView (290 lines)
9. ✅ EffectFamilyMapView (200 lines)

### Architecture Improvements:
- ✅ Fixed toolReservations bug
- ✅ Enabled UNIFIED_UI
- ✅ Removed all bridge contexts
- ✅ App.jsx: 260 → 96 lines (-63%)
- ✅ Bundle: 800KB → 625KB (-22%)

---

## 🎯 Remaining Work (3 Views - Est. 2-3 hours)

### 1. TemplatesView (~205 lines)
**Location:** ManagerTab.jsx lines 1293-1497
**Helper Function:** lines 162-220 (`addTemplate()`)

**Key Features:**
- 4 template types (weapons, armor, ranged, explosives)
- Conditional form fields based on type
- Material management (add/remove materials per template)
- Expandable template details

**State Variables:**
```javascript
const [templateType, setTemplateType] = useState('weapons');
const [showAdd, setShowAdd] = useState(false);
const [expanded, setExpanded] = useState({});
// 19 template field states:
const [newTName, setNewTName] = useState('');
const [newTWeight, setNewTWeight] = useState('');
const [newTHP, setNewTHP] = useState('');
const [newTDamage, setNewTDamage] = useState('');
const [newTReach, setNewTReach] = useState('');
const [newTParry, setNewTParry] = useState('');
const [newTCost, setNewTCost] = useState('');
const [newTST, setNewTST] = useState('');
const [newTNotes, setNewTNotes] = useState('');
const [newTAcc, setNewTAcc] = useState('');
const [newTRange, setNewTRange] = useState('');
const [newTRoF, setNewTRoF] = useState('');
const [newTShots, setNewTShots] = useState('');
const [newTBulk, setNewTBulk] = useState('');
const [newTRCl, setNewTRCl] = useState('');
const [newTLC, setNewTLC] = useState('');
const [newTLocation, setNewTLocation] = useState('');
const [newTDR, setNewTDR] = useState('');
const [newTFuse, setNewTFuse] = useState('');
```

**Props Needed:**
- `customTemplates` (nested object by type)
- `materialTypes` (array for material selector)
- `saveCustomTemplates` (function)
- `onDelete` (callback)

**Pattern:**
- Template type selector dropdown
- Conditional form fields based on selected type
- Material management in expanded view
- Delete confirmation via callback

---

### 2. ReagentsView (~430 lines) - MOST COMPLEX
**Location:** ManagerTab.jsx lines 1697-2122

**Key Features:**
- Aspect selection (primary/secondary/tertiary from ASPECTS constant)
- Potency levels (P0-P4)
- Refinement levels (crude/prepared/refined)
- Ingredient roles (8 types: Active, Catalyst, Stabilizer, etc.)
- Hazard tags (7 types: Flammable, Volatile, etc.)
- Quantity management
- Identification levels (0-4) with range slider
- False profiles (for crit failures)

**State Variables:**
```javascript
const [showAdd, setShowAdd] = useState(false);
const [newType, setNewType] = useState(''); // reagent name
const [expanded, setExpanded] = useState({});
// Reagent properties (stored in expanded object):
// - newPrimary, newSecondary, newTertiary
// - newPotency
// - newRefinement
// - newQuantity
// - newRoles (array)
// - newHazards (array)
```

**Props Needed:**
- `alchemyReagents` (array)
- `saveAlchemyReagents` (function)
- `onDelete` (callback)
- `ASPECTS`, `POTENCY_LEVELS`, `INGREDIENT_ROLES`, `HAZARD_TAGS` (constants)

**Pattern:**
- Complex multi-step form
- Checkboxes for roles/hazards
- Dropdowns for aspects/potency/refinement
- Identification level slider
- False profile management
- Expandable detail panel

---

### 3. FormulasView (~290 lines)
**Location:** ManagerTab.jsx lines 2124-2410
**Helper Functions:**
- lines 223-235 (`addIngredient()`)
- lines 237-239 (`removeIngredient()`)
- lines 241-243 (`updateIngredient()`)
- lines 245-318 (`createFormula()`)

**Key Features:**
- Formula designer with ingredient list
- Ingredient selection (reagent + role + units + refinement)
- Vector selection (Potion, Salve, Ink, Aerosol, Bomb)
- TBBuilderPanel integration for trait budgets
- Formula stats calculation (tier, WR, DM, potency, hazards)
- Validation and warnings
- Expandable formula preview

**State Variables:**
```javascript
const [showAdd, setShowAdd] = useState(false);
const [formulaName, setFormulaName] = useState('');
const [ingredients, setIngredients] = useState([]); // array of {id, reagentId, role, unitsUsed, refinement}
const [selectedVector, setSelectedVector] = useState('Potion');
const [formulaTraits, setFormulaTraits] = useState([]);
const [expandedFormula, setExpandedFormula] = useState(null);
```

**Props Needed:**
- `alchemyReagents` (array - for ingredient selection)
- `alchemyFormulas` (array)
- `saveAlchemyFormulas` (function)
- `onDelete` (callback)
- `INGREDIENT_ROLES`, `VECTORS` (constants)
- `calculateFormulaStats` (utility function from `../utils/alchemy`)

**Dependencies:**
- `TBBuilderPanel` component (from `./alchemy/TBBuilderPanel`)

**Pattern:**
- Ingredient builder (add/remove/update)
- Real-time formula stats calculation
- Validation warnings/errors
- Expandable formula details
- Integration with TBBuilderPanel for trait budgets

---

## 📋 Implementation Steps

### Step 1: Extract TemplatesView
```bash
# Read lines 1293-1497 and 162-220
# Create src/components/manager/views/TemplatesView.jsx
# Move addTemplate() helper into component
# Test that template creation/editing works
```

### Step 2: Extract ReagentsView
```bash
# Read lines 1697-2122
# Create src/components/manager/views/ReagentsView.jsx
# Handle complex form state for aspects/potency/roles/hazards
# Test reagent creation with all properties
```

### Step 3: Extract FormulasView
```bash
# Read lines 2124-2410 and 223-318
# Create src/components/manager/views/FormulasView.jsx
# Move helper functions (addIngredient, removeIngredient, updateIngredient, createFormula)
# Import TBBuilderPanel and calculateFormulaStats
# Test formula designer with validation
```

### Step 4: Update ManagerTab Router
```bash
# Import all 12 view components
# Replace view === 'X' sections with view components
# Keep: navigation tabs, view state, shared delete modal
# Expected size: ~200 lines total
```

### Step 5: Test & Commit
```bash
npm run build
# Test all 15 views work
# Test delete confirmations
# Test all forms save correctly
git add -A
git commit -m "Complete: ManagerTab decomposition - 12 views extracted"
git push
```

---

## 🎯 Final ManagerTab Structure

After completion, ManagerTab.jsx should look like:

```javascript
import React, { useState } from 'react';
import { FoodTypesView } from './manager/views/FoodTypesView';
import { SkillsView } from './manager/views/SkillsView';
import { ProjectsView } from './manager/views/ProjectsView';
import { AlchemySettingsView } from './manager/views/AlchemySettingsView';
import { WorkersView } from './manager/views/WorkersView';
import { LabsView } from './manager/views/LabsView';
import { KitchensView } from './manager/views/KitchensView';
import { MaterialTypesView } from './manager/views/MaterialTypesView';
import { EffectFamilyMapView } from './manager/views/EffectFamilyMapView';
import { TemplatesView } from './manager/views/TemplatesView';
import { ReagentsView } from './manager/views/ReagentsView';
import { FormulasView } from './manager/views/FormulasView';
import { GatheringManager } from './GatheringManager';
import { ImportExportPanel } from './ImportExportPanel';
import { DebugPanel } from './DebugPanel';
import { GMLockModal } from './GMLockModal';

export function ManagerTab(props) {
  const [view, setView] = useState('foodTypes');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showGMLockModal, setShowGMLockModal] = useState(false);

  function handleDelete(type, value, extra = {}) {
    setDeleteConfirm({ type, value, ...extra });
  }

  // Navigation tabs (lines ~50)
  // View router (lines ~100)
  // Shared delete confirmation modal (lines ~40)
  // GM lock modal (lines ~10)
}

// Total: ~200 lines
```

---

## 🚀 Benefits After Completion

### Code Quality:
- ManagerTab: 2,622 → ~200 lines ✅
- 12 focused views: 100-430 lines each ✅
- Each view self-contained and testable ✅
- Clear separation of concerns ✅

### Developer Experience:
- AI coders can understand each view ✅
- Easy to find and fix bugs ✅
- Simple to add new views ✅
- Reusable components ✅

### Performance:
- No change (views are lazy-loaded via conditional rendering)
- Potential for code-splitting if needed later

---

## 📚 Resources

- **DECOMPOSITION_GUIDE.md** - Complete breakdown with line numbers
- **Task agent analysis** (agent ID: a9f9141) - Detailed view structure
- **Existing extracted views** - In `src/components/manager/views/`
- **Pattern examples** - See FoodTypesView, WorkersView, EffectFamilyMapView

---

## ⏱️ Time Estimate

- TemplatesView: 45-60 minutes
- ReagentsView: 60-90 minutes (most complex)
- FormulasView: 45-60 minutes
- ManagerTab router update: 30 minutes
- Testing: 30 minutes
- **Total: 3.5-4.5 hours**

---

**Status:** Ready to extract final 3 views
**Current Progress:** 64% (9/14 views extracted)
**Next:** Extract TemplatesView from lines 1293-1497 + helper at 162-220
