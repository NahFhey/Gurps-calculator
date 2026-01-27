# CampaignStore Migration Plan

## Overview
Migrate all legacy Context-based state management to centralized CampaignStore reducer pattern.

**Current State:** 42+ individual `useState` hooks in App.jsx, 6 Context providers, fragmented localStorage
**Target State:** Single CampaignStore reducer, unified state tree, single localStorage key

---

## Phase 1: Expand CampaignState Schema ✓

### 1.1 Create Type Definitions
**File:** `src/types/campaign.ts` (new)

Define TypeScript interfaces for all legacy systems:
- Inventory (materials, foods, recipes, foodTypes, materialTypes)
- Crafting (crafts, craftDesigns, customTemplates)
- Alchemy (reagents, formulas, batches, labs, settings)
- Gathering (species, tools, tables, environments, sessions, dailyEvents, bait, categories, items)
- Day Planner (timeSlots, taskAssignments, pendingDayLedger)
- Combat (characters, active, history, tombstones, rulesPreset, reveal, items)
- Config (workers, kitchens, cookingSkills, effectFamilyMap)

### 1.2 Update CampaignState
**File:** `src/state/campaignReducer.ts`

Replace `entities` structure:
```typescript
entities: {
  // Shared across all systems
  characters: Record<Id, Character>;  // Merge workers + party characters

  // Inventory system
  materials: Record<Id, Material>;
  foods: Record<Id, Food>;
  foodTypes: FoodType[];
  materialTypes: MaterialType[];

  // Crafting system
  crafts: Record<Id, Craft>;
  craftDesigns: Record<Id, CraftDesign>;
  customTemplates: CustomTemplates;

  // Alchemy system
  alchemyReagents: Record<Id, Reagent>;
  alchemyFormulas: Record<Id, Formula>;
  alchemyBatches: Record<Id, Batch>;
  alchemyLabs: Record<Id, Lab>;

  // Gathering system
  gatheringSpecies: Record<Id, Species>;
  gatheringTools: Record<Id, GatheringTool>;
  gatheringTables: Record<Id, Table>;
  gatheringEnvironments: Record<Id, Environment>;
  gatheringSessions: Record<Id, Session>;
  gatheringBait: Record<Id, Bait>;
  gatheringCategories: Record<Id, Category>;
  gatheringItems: Record<Id, Item>;

  // Combat system
  combatCharacters: Record<Id, CombatCharacter>;
  combatItems: Record<Id, CombatItem>;

  // Shared facilities
  kitchens: Record<Id, Kitchen>;
  facilities: Record<Id, Facility>;  // Existing from Party Tool

  // Tools (merge customTemplates + Party Tool tools)
  toolTemplates: Record<Id, ToolTemplate>;
  toolInstances: Record<Id, ToolInstance>;
  toolReservations: Record<Id, string[]>;

  // Inventories (unified for all systems)
  inventories: Record<Id, Inventory>;
}
```

---

## Phase 2: Create Reducer Actions

### 2.1 Inventory Actions
```typescript
// Materials
| { type: 'addMaterial'; payload: Material }
| { type: 'updateMaterial'; payload: { id: Id; changes: Partial<Material> } }
| { type: 'removeMaterial'; payload: Id }
| { type: 'consumeMaterials'; payload: { materials: { id: Id; amount: number }[] } }
| { type: 'setMaterials'; payload: Record<Id, Material> }

// Foods
| { type: 'addFood'; payload: Food }
| { type: 'updateFood'; payload: { id: Id; changes: Partial<Food> } }
| { type: 'removeFood'; payload: Id }
| { type: 'consumeFoods'; payload: { foods: { id: Id; amount: number }[] } }
| { type: 'setFoods'; payload: Record<Id, Food> }

// Food Types
| { type: 'setFoodTypes'; payload: FoodType[] }
| { type: 'addFoodType'; payload: FoodType }

// Material Types
| { type: 'setMaterialTypes'; payload: MaterialType[] }
| { type: 'addMaterialType'; payload: MaterialType }
```

### 2.2 Crafting Actions
```typescript
| { type: 'addCraft'; payload: Craft }
| { type: 'updateCraft'; payload: { id: Id; changes: Partial<Craft> } }
| { type: 'removeCraft'; payload: Id }
| { type: 'completeCraft'; payload: Id }
| { type: 'setCrafts'; payload: Record<Id, Craft> }

| { type: 'addCraftDesign'; payload: CraftDesign }
| { type: 'updateCraftDesign'; payload: { id: Id; changes: Partial<CraftDesign> } }
| { type: 'removeCraftDesign'; payload: Id }
| { type: 'setCraftDesigns'; payload: Record<Id, CraftDesign> }

| { type: 'setCustomTemplates'; payload: CustomTemplates }
| { type: 'addCustomTemplate'; payload: { category: string; template: Template } }
```

### 2.3 Alchemy Actions
```typescript
| { type: 'addAlchemyReagent'; payload: Reagent }
| { type: 'updateAlchemyReagent'; payload: { id: Id; changes: Partial<Reagent> } }
| { type: 'removeAlchemyReagent'; payload: Id }
| { type: 'setAlchemyReagents'; payload: Record<Id, Reagent> }

| { type: 'addAlchemyFormula'; payload: Formula }
| { type: 'setAlchemyFormulas'; payload: Record<Id, Formula> }

| { type: 'addAlchemyBatch'; payload: Batch }
| { type: 'updateAlchemyBatch'; payload: { id: Id; changes: Partial<Batch> } }
| { type: 'setAlchemyBatches'; payload: Record<Id, Batch> }

| { type: 'setAlchemyLabs'; payload: Record<Id, Lab> }
| { type: 'updateAlchemySettings'; payload: Partial<AlchemySettings> }
```

### 2.4 Gathering Actions
```typescript
| { type: 'setGatheringSpecies'; payload: Record<Id, Species> }
| { type: 'setGatheringTools'; payload: Record<Id, GatheringTool> }
| { type: 'setGatheringTables'; payload: Record<Id, Table> }
| { type: 'setGatheringEnvironments'; payload: Record<Id, Environment> }
| { type: 'addGatheringSession'; payload: Session }
| { type: 'updateGatheringSession'; payload: { id: Id; changes: Partial<Session> } }
| { type: 'setGatheringSessions'; payload: Record<Id, Session> }
| { type: 'setGatheringDailyEvents'; payload: Record<string, unknown> }
| { type: 'setGatheringBait'; payload: Record<Id, Bait> }
| { type: 'setGatheringCategories'; payload: Record<Id, Category> }
| { type: 'setGatheringItems'; payload: Record<Id, Item> }
```

### 2.5 Day Planner Actions
```typescript
| { type: 'setTimeSlots'; payload: TimeSlot[] }
| { type: 'addTaskAssignment'; payload: TaskAssignment }
| { type: 'updateTaskAssignment'; payload: { id: Id; changes: Partial<TaskAssignment> } }
| { type: 'setTaskAssignments'; payload: TaskAssignment[] }
| { type: 'setPendingDayLedger'; payload: DayLedger | null }
```

### 2.6 Combat Actions
```typescript
| { type: 'addCombatCharacter'; payload: CombatCharacter }
| { type: 'updateCombatCharacter'; payload: { id: Id; changes: Partial<CombatCharacter> } }
| { type: 'removeCombatCharacter'; payload: Id }
| { type: 'setCombatCharacters'; payload: Record<Id, CombatCharacter> }
| { type: 'setCombatActive'; payload: CombatSession | null }
| { type: 'updateCombatActive'; payload: Partial<CombatSession> }
| { type: 'setCombatHistory'; payload: CombatSession[] }
| { type: 'setCombatTombstones'; payload: CombatCharacter[] }
| { type: 'setCombatRulesPreset'; payload: string }
| { type: 'setCombatItems'; payload: Record<Id, CombatItem> }
```

### 2.7 Character/Config Actions
```typescript
| { type: 'addCharacter'; payload: Character }
| { type: 'updateCharacter'; payload: { id: Id; changes: Partial<Character> } }
| { type: 'removeCharacter'; payload: Id }
| { type: 'setCharacters'; payload: Record<Id, Character> }

| { type: 'setKitchens'; payload: Record<Id, Kitchen> }
| { type: 'setCookingSkills'; payload: CookingSkill[] }
| { type: 'setEffectFamilyMap'; payload: Record<string, unknown> }
```

---

## Phase 3: Implement Reducer Logic

### 3.1 Update campaignReducer.ts
**File:** `src/state/campaignReducer.ts`

Implement all action handlers using Immer:
- Array operations → Convert to normalized objects (Record<Id, T>)
- Direct mutations in draft (Immer handles immutability)
- Validate IDs and relationships
- Log major state changes

### 3.2 Create Utility Functions
**File:** `src/state/campaignUtils.ts` (new)

```typescript
// Convert legacy arrays to normalized objects
export function normalizeArray<T extends { id: Id }>(arr: T[]): Record<Id, T>
export function denormalizeObject<T>(obj: Record<Id, T>): T[]

// Merge workers + party characters
export function mergeCharacters(workers: Worker[], partyChars: Character[]): Record<Id, Character>

// Convert customTemplates to toolTemplates
export function migrateLegacyTemplates(customTemplates: CustomTemplates): Record<Id, ToolTemplate>
```

---

## Phase 4: Create Data Migration

### 4.1 Migration Script
**File:** `src/persistence/dataMigration.ts` (new)

```typescript
export async function migrateToV2() {
  // 1. Load all 42 localStorage keys
  // 2. Convert arrays to normalized objects
  // 3. Merge workers into characters
  // 4. Create party inventory + character inventories
  // 5. Convert customTemplates to toolTemplates
  // 6. Build complete CampaignState
  // 7. Save to 'campaignState' key
  // 8. Create backup of old data
  // 9. Clear old keys (optional - keep for rollback)
}
```

### 4.2 Schema Versioning
Update schema version from 1.0.0 → 2.0.0

Add migration detector in App.jsx:
```typescript
useEffect(() => {
  const needsMigration = await checkMigrationNeeded();
  if (needsMigration) {
    await migrateToV2();
  }
}, []);
```

---

## Phase 5: Update Contexts (Bridge Pattern)

Instead of removing Contexts, convert them to **facades** that use CampaignStore:

### 5.1 InventoryContext → CampaignStore Bridge
**File:** `src/contexts/InventoryContext.jsx`

```typescript
export function InventoryProvider({ children }) {
  const { state, actions } = useCampaignStore();

  const value = {
    // Expose legacy API
    materials: Object.values(state.entities.materials),
    foods: Object.values(state.entities.foods),
    foodTypes: state.entities.foodTypes,
    materialTypes: state.entities.materialTypes,

    // Wrap actions to match old API
    saveMaterials: (materials) => {
      actions.setMaterials(normalizeArray(materials));
    },
    saveFoods: (foods) => {
      actions.setFoods(normalizeArray(foods));
    },
    // ... other save functions
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}
```

**Benefit:** Legacy tabs continue to work without changes!

### 5.2 Update All Contexts
Repeat for:
- CraftingContext
- AlchemyContext
- GatheringContext
- ConfigContext
- CombatContext

---

## Phase 6: Refactor App.jsx

### 6.1 Remove useState Declarations
**File:** `src/App.jsx` (lines 32-99)

Delete all 42 useState hooks - state now lives in CampaignStore

### 6.2 Remove Save Function Factories
**File:** `src/App.jsx` (lines 108-154)

Delete createSaveFunction and all 42 save functions

### 6.3 Simplify loadData
**File:** `src/App.jsx` (lines 172-227)

```typescript
async function loadData() {
  // CampaignStore handles loading via campaignStorage.ts
  // Only need to run migration if detected
  const needsMigration = !await window.storage.get('campaignState');
  if (needsMigration) {
    await migrateToV2();
  }
  setLoading(false);
}
```

### 6.4 Update Context Providers
**File:** `src/App.jsx` (lines 580-750)

```typescript
// Before: 42 pieces of state passed as props
<InventoryContext.Provider value={inventoryValue}>

// After: Contexts pull from CampaignStore directly
<CampaignStoreProvider initialCampaignState={initialCampaignState}>
  <InventoryProvider>
    <CraftingProvider>
      <AlchemyProvider>
        {/* No props needed - Contexts use useCampaignStore() */}
      </AlchemyProvider>
    </CraftingProvider>
  </InventoryProvider>
</CampaignStoreProvider>
```

---

## Phase 7: Integrate Party Tool

### 7.1 Remove PartyToolContainer Props
**File:** `src/components/party-tool/PartyToolContainer.jsx`

Delete 30+ prop mappings - use useCampaignStore() directly

### 7.2 Share Inventories
**File:** `src/components/party-tool/PartyToolApp.jsx`

```typescript
// Access shared inventory
const { state } = useCampaignStore();
const partyInventory = state.entities.inventories['party'];
const materials = Object.values(state.entities.materials);

// Consume materials in activity
function resolveActivity(activity) {
  // ... validation
  actions.consumeMaterials({ materials: [...] });
  actions.addLogEntry({ type: 'activity_resolved', ... });
}
```

### 7.3 Use Crafted Items as Tools
```typescript
// Party Tool can now see completed crafts
const craftedTools = Object.values(state.entities.crafts)
  .filter(craft => craft.phase === 'complete')
  .map(craft => ({
    toolId: craft.id,
    templateId: craft.template,
    conditionId: 'Good'
  }));
```

---

## Phase 8: Enable Unified UI

### 8.1 Update Constants
**File:** `src/constants.js`

```typescript
export const UNIFIED_UI_ENABLED = true;  // Change from false
```

### 8.2 Test UnifiedShell
**File:** `src/unified/UnifiedShell.jsx`

The UnifiedShell component already exists! Just needs testing with new CampaignStore.

---

## Phase 9: Testing & Cleanup

### 9.1 End-to-End Tests
1. Create character → verify appears in all systems
2. Craft weapon → verify appears as Party Tool equipment
3. Gather materials → verify can be used in crafting/cooking
4. Run combat → verify character HP updates persist
5. Advance time → verify all systems respect time slots
6. Export/import campaign → verify full state roundtrip

### 9.2 Cleanup
- Remove legacy localStorage keys
- Delete unused files
- Remove `state.legacy.appState` (no longer needed)
- Clean up comments referencing old patterns
- Update documentation

---

## Rollback Plan

If migration fails:
1. Backup created at `campaignState_backup_v1`
2. Restore all 42 individual localStorage keys
3. Set `UNIFIED_UI_ENABLED = false`
4. Revert commit with git

---

## Timeline Estimate

| Phase | Effort | Risk |
|-------|--------|------|
| 1. Schema expansion | 4 hours | Low |
| 2. Reducer actions | 6 hours | Medium |
| 3. Reducer implementation | 8 hours | Medium |
| 4. Migration script | 6 hours | High |
| 5. Context bridges | 8 hours | Low |
| 6. App.jsx refactor | 4 hours | Low |
| 7. Party Tool integration | 4 hours | Medium |
| 8. Unified UI | 2 hours | Low |
| 9. Testing & cleanup | 8 hours | Medium |
| **Total** | **50 hours (~1.5 weeks)** | |

---

## Success Criteria

✅ Single localStorage key (`campaignState`)
✅ Zero useState in App.jsx
✅ All tabs work with CampaignStore
✅ Party Tool shares characters/inventory
✅ Crafted items usable in activities
✅ Time system unified
✅ Export/import works
✅ UNIFIED_UI_ENABLED = true
✅ All tests pass
✅ No regressions in existing features

---

## Files to Create
- `src/types/campaign.ts` - Full type definitions
- `src/state/campaignUtils.ts` - Normalization utilities
- `src/persistence/dataMigration.ts` - Migration script

## Files to Modify
- `src/state/campaignReducer.ts` - Expand actions & state
- `src/state/campaignStore.tsx` - Add action creators
- `src/contexts/*.jsx` - Convert to bridges (6 files)
- `src/App.jsx` - Remove state, simplify
- `src/components/party-tool/PartyToolContainer.jsx` - Use CampaignStore
- `src/constants.js` - Enable unified UI

## Files to Eventually Delete (post-migration)
- None! Keep Contexts as compatibility layer for now.
