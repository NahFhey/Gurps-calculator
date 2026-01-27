# Activities Panel Refactor Plan

**Created:** 2026-01-27
**Branch:** `claude/activities-panel-refactor-plan-A6MkG`
**Status:** Planning Phase

---

## Overview

This document outlines a comprehensive refactor of the Activities Panel and related systems based on the user's wireframe vision. The goal is to transform the current monolithic PartyToolApp into a streamlined activity launcher while building out missing core features.

### Vision Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Weather Widget]  │  Current Weather / Effects  │ [Adv Day][Adv Slot] Day X│
├──────────┬─────────────────────────────┬────────────────────────┬───────────┤
│  PARTY   │     CHARACTER SHEET         │    ACTIVITIES PANEL    │   RAIL    │
│  COLUMN  │     (GCS-style, full)       │    (Tile Grid)         │           │
│          │                             │                        │ [Invent.] │
│ [Char 1] │  Can expand to fill area    │  [Alchemy]  [Cooking]  │ [Activ. ] │
│ [Char 2] │  or split share area        │  [Crafting] [Gather.]  │ [Manager] │
│ [Char 3] │                             │                        │ [Rules  ] │
│          │  - Portrait + Identity      │  Clicking tile expands │ [Changel] │
│ [+ Add ] │  - Attributes (ST/DX/IQ/HT) │  to fill area or opens │           │
│ [Import] │  - Secondary Stats          │  as modal overlay      │           │
│          │  - Skills Table             │                        │           │
│          │  - Advantages/Disadv.       │                        │           │
│          │  - Equipment Table          │                        │           │
│          │  - Melee/Ranged Weapons     │                        │           │
│          │                             │                        │           │
│          │  [Edit Mode Toggle]         │                        │           │
├──────────┴─────────────────────────────┴────────────────────────┴───────────┤
│                        [COMBAT TILE - Start Combat, Status]                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Current State Analysis

### What Exists (Well-Developed)
| System | Location | Lines | Status |
|--------|----------|-------|--------|
| Alchemy | AlchemyTab.tsx | ~170 | Full GURPS 4e rules |
| Cooking | CookingTab.tsx | ~880 | Recipe system complete |
| Crafting | CraftingTab.tsx | ~980 | Design/craft workflow |
| Gathering | GatheringManager.tsx | ~184 | Day planner integration |
| Combat | CombatTracker.tsx | ~1,506 | Full combat system |

### What's Broken/Missing
| Feature | Issue | Priority |
|---------|-------|----------|
| Character Sheet | Combat-focused only, missing skills/advantages/equipment | **CRITICAL** |
| Activities Panel | Separate implementation, doesn't connect to existing systems | HIGH |
| Combat Button | In rail, should be in combat tile | HIGH |
| Import Button | No onClick handler | HIGH |
| Manager Module | Props mismatch (expects legacy props) | HIGH |
| Changelog | addLogEntry never called | MEDIUM |
| Inventory Module | Missing Party Stash | MEDIUM |
| Add/Edit Characters | Not accessible from Party Column | MEDIUM |
| Weather System | Does not exist | NEW FEATURE |

---

## Phase 1: Character Sheet (CRITICAL PATH)

**Goal:** Create a full GCS-style interactive character sheet

### 1.1 Character Sheet Component Structure
```
src/components/character-sheet/
├── CharacterSheet.tsx           # Main container with Edit Mode toggle
├── types/characterSheet.ts      # TypeScript interfaces
└── views/
    ├── IdentitySection.tsx      # Portrait, Name, Title, Organization
    ├── DescriptionSection.tsx   # Gender, Age, Height, Weight, etc.
    ├── AttributesSection.tsx    # ST, DX, IQ, HT with point costs
    ├── SecondaryStatsSection.tsx # HP, FP, Will, Per, Speed, Move, Dodge
    ├── HitLocationsTable.tsx    # Hit location chart
    ├── EncumbranceTable.tsx     # Encumbrance & Move table
    ├── LiftingTable.tsx         # Lifting & Moving Things
    ├── MeleeWeaponsTable.tsx    # Melee weapons with damage calc
    ├── RangedWeaponsTable.tsx   # Ranged weapons with range/acc
    ├── TraitsSection.tsx        # Advantages & Disadvantages
    ├── SkillsTable.tsx          # Skills with level/points
    └── EquipmentTable.tsx       # Carried equipment with weight/cost
```

### 1.2 GCS Import Functionality
- Parse .gcs files (XML format)
- Map GCS fields to our Character type
- Import equipment, skills, advantages, disadvantages
- Preserve point costs and page references

### 1.3 Edit Mode Toggle
- View mode: Read-only display
- Edit mode: Inline editing with validation
- GM vs Player permissions
- Point budget tracking

### 1.4 Character Type Extensions
```typescript
interface GCSCharacter extends Character {
  // Identity
  portrait?: string;
  title?: string;
  organization?: string;

  // Description
  gender?: string;
  age?: number;
  birthday?: string;
  religion?: string;
  height?: string;
  weight?: string;
  sizeModifier?: number;
  skinColor?: string;
  hairColor?: string;
  eyeColor?: string;
  handedness?: 'Left' | 'Right' | 'Ambidextrous';

  // Primary Attributes (existing)
  ST: number;
  DX: number;
  IQ: number;
  HT: number;

  // Secondary Stats (calculated + modifiers)
  HP: { base: number; current: number; modifier: number };
  FP: { base: number; current: number; modifier: number };
  Will: { base: number; modifier: number };
  Per: { base: number; modifier: number };
  basicSpeed: { base: number; modifier: number };
  basicMove: { base: number; modifier: number };

  // Combat
  dodge: number;
  parry: Record<string, number>;
  block: Record<string, number>;

  // Traits
  advantages: Advantage[];
  disadvantages: Disadvantage[];
  quirks: string[];

  // Skills
  skills: Skill[];
  techniques: Technique[];
  spells?: Spell[];

  // Equipment
  equipment: Equipment[];
  melee: MeleeWeapon[];
  ranged: RangedWeapon[];

  // Point Tracking
  totalPoints: number;
  spentPoints: number;
  unspentPoints: number;
}
```

### 1.5 Tasks
- [ ] Create `src/types/characterSheet.ts` with full GCS interfaces
- [ ] Create CharacterSheet.tsx container component
- [ ] Implement IdentitySection with portrait support
- [ ] Implement AttributesSection with point costs
- [ ] Implement SecondaryStatsSection with calculations
- [ ] Implement TraitsSection (advantages/disadvantages)
- [ ] Implement SkillsTable with GURPS skill system
- [ ] Implement EquipmentTable with weight/cost tracking
- [ ] Implement MeleeWeaponsTable with damage calculation
- [ ] Implement RangedWeaponsTable with range bands
- [ ] Implement Edit Mode toggle
- [ ] Create GCS import parser
- [ ] Add character to CampaignStore entities
- [ ] Connect to Party Column selection

---

## Phase 2: Layout Restructure

**Goal:** Implement flexible panel system matching wireframe

### 2.1 Header Changes
- Add Weather Widget (left side)
- Add Advance Day / Advance Slot buttons (right side)
- Add Day X | Slot X display
- Remove time controls from Activities panel

### 2.2 Flexible Panel System
```typescript
interface PanelState {
  leftPanel: 'normal' | 'collapsed';
  centerPanel: 'normal' | 'expanded' | 'hidden';
  rightPanel: 'normal' | 'expanded' | 'hidden';
}

// Behaviors:
// - Character Sheet can expand to fill center+right
// - Activity tile click expands right panel to fill center+right
// - Modal overlay option for activities
```

### 2.3 Combat Tile
- Remove Combat from rail navigation
- Create CombatTile component at bottom
- Show "Start Combat" button
- Show active combat status if in progress
- Quick navigation to combat module

### 2.4 Tasks
- [ ] Create PanelLayoutContext for panel state management
- [ ] Modify UnifiedShell.tsx header section
- [ ] Create WeatherWidget placeholder component
- [ ] Move time controls from PartyToolApp to header
- [ ] Implement panel expand/collapse logic
- [ ] Create CombatTile component
- [ ] Remove Combat from rail array
- [ ] Add modal overlay support for activity expansion

---

## Phase 3: Activities Panel Simplification

**Goal:** Transform into a tile-based activity launcher

### 3.1 New Activities Panel Structure
```
src/components/activities/
├── ActivitiesPanel.tsx          # Tile grid container
├── ActivityTile.tsx             # Individual activity tile
└── types/activities.ts          # TypeScript interfaces
```

### 3.2 Activity Tiles
| Tile | Color | Links To |
|------|-------|----------|
| Alchemy | Yellow | AlchemyTab (expand/modal) |
| Cooking | Yellow | CookingTab (expand/modal) |
| Crafting | Yellow | CraftingTab (expand/modal) |
| Gathering | Yellow | GatheringManager (expand/modal) |

### 3.3 Remove From Activities Panel
- ~~Inventories tab~~ → Move to Inventory module
- ~~Logs tab~~ → Move to Changelog module
- ~~GM Workshop tab~~ → Move to Manager module
- ~~Complex Activity Configurator~~ → Simplify or integrate into each activity system

### 3.4 Keep/Integrate
- Worker assignment (integrate into each activity system)
- Equipment reservation (ReservationEngine stays, used by activities)
- Time slot awareness (from header controls)

### 3.5 Tasks
- [ ] Create ActivitiesPanel.tsx with tile grid layout
- [ ] Create ActivityTile.tsx component
- [ ] Implement expand behavior (fill center+right panels)
- [ ] Implement modal overlay behavior
- [ ] Connect tiles to existing activity systems
- [ ] Remove Inventories tab from PartyToolApp
- [ ] Remove Logs tab from PartyToolApp
- [ ] Migrate GM Workshop content to Manager module
- [ ] Deprecate/remove PartyToolApp.jsx (1,065 lines)

---

## Phase 4: Quick Fixes

**Goal:** Fix broken features with minimal effort

### 4.1 Import Button (1 line fix)
```tsx
// UnifiedShell.tsx line 246-251
<button
  type="button"
  className="..."
  onClick={() => setActiveModule('manager')} // Add this + navigate to Import/Export view
>
  Import
</button>
```

### 4.2 Manager Module Props Fix
- Migrate ManagerTab to use useCampaignStore() directly
- Remove dependency on legacyAppState
- Pattern: Same as AlchemyTab, CookingTab, etc.

### 4.3 Changelog Log Population
Add `addLogEntry` calls to:
- Activity resolutions (activityResolver.ts)
- Inventory transfers (inventoryManager.ts)
- Time advancement (timeSystem.ts)
- Combat events (CombatTracker.tsx)
- Project completions

### 4.4 Inventory Module Party Stash
- Add Party Stash tab to InventoryTab
- Use existing `state.entities.inventories` data
- Show items, tools, currency
- Add transfer functionality

### 4.5 Tasks
- [ ] Fix Import button onClick handler
- [ ] Migrate ManagerTab.tsx to useCampaignStore
- [ ] Add addLogEntry calls throughout codebase
- [ ] Add Party Stash tab to InventoryTab
- [ ] Add character inventory to Character Pane

---

## Phase 5: Weather System (New Feature)

**Goal:** Add weather mechanics that affect activities

### 5.1 Weather Types
```typescript
interface Weather {
  type: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'wind';
  intensity: 'light' | 'moderate' | 'heavy';
  temperature: 'freezing' | 'cold' | 'mild' | 'warm' | 'hot';
}

interface WeatherEffect {
  activityModifiers: {
    gathering: number;
    cooking: number;
    crafting: number;
    alchemy: number;
    travel: number;
  };
  visionPenalty: number;
  hearingPenalty: number;
  description: string;
}
```

### 5.2 Weather Widget
- Display current weather icon + text
- Show active weather effects
- Random weather generation per day
- Manual GM override

### 5.3 Tasks
- [ ] Create `src/types/weather.ts` with interfaces
- [ ] Create `src/utils/weatherSystem.ts` for generation/effects
- [ ] Create WeatherWidget.tsx component
- [ ] Add weather state to CampaignStore
- [ ] Connect weather effects to activity modifiers
- [ ] Add weather to day advancement logic

---

## Phase 6: Character Management

**Goal:** Add character creation/editing from Party Column

### 6.1 Party Column Enhancements
- Add "+" button to add new character
- Add "Import" button for GCS import
- Context menu on character: Edit, Delete, Duplicate

### 6.2 Character Creation Flow
- New character wizard OR
- Blank character sheet in edit mode
- Import from GCS file

### 6.3 Tasks
- [ ] Add "Add Character" button to Party Column
- [ ] Create character creation modal/wizard
- [ ] Connect Import button to GCS import
- [ ] Add character context menu (edit/delete/duplicate)
- [ ] Implement character deletion with confirmation

---

## Implementation Order

### Sprint 1: Foundation (Phase 1 + 4.1-4.2)
1. Create Character Sheet types and basic structure
2. Implement core sections (Attributes, Skills, Equipment)
3. Fix Import button
4. Fix Manager module

### Sprint 2: Character Sheet Complete (Phase 1 continued)
1. Implement all remaining sections
2. Add Edit Mode toggle
3. Create GCS import parser
4. Connect to Party Column

### Sprint 3: Layout + Activities (Phase 2 + 3)
1. Implement flexible panel system
2. Create Activities tile grid
3. Move Combat to bottom tile
4. Remove deprecated tabs from Activities

### Sprint 4: Polish (Phase 4.3-4.5 + 5 + 6)
1. Fix Changelog logging
2. Add Party Stash to Inventory
3. Implement Weather system
4. Add character management to Party Column

---

## Files to Create

```
src/
├── components/
│   ├── character-sheet/
│   │   ├── CharacterSheet.tsx
│   │   ├── views/
│   │   │   ├── IdentitySection.tsx
│   │   │   ├── DescriptionSection.tsx
│   │   │   ├── AttributesSection.tsx
│   │   │   ├── SecondaryStatsSection.tsx
│   │   │   ├── HitLocationsTable.tsx
│   │   │   ├── EncumbranceTable.tsx
│   │   │   ├── LiftingTable.tsx
│   │   │   ├── MeleeWeaponsTable.tsx
│   │   │   ├── RangedWeaponsTable.tsx
│   │   │   ├── TraitsSection.tsx
│   │   │   ├── SkillsTable.tsx
│   │   │   └── EquipmentTable.tsx
│   │   └── GCSImportParser.ts
│   ├── activities/
│   │   ├── ActivitiesPanel.tsx
│   │   └── ActivityTile.tsx
│   ├── weather/
│   │   └── WeatherWidget.tsx
│   └── combat/
│       └── CombatTile.tsx
├── types/
│   ├── characterSheet.ts
│   ├── activities.ts
│   └── weather.ts
├── utils/
│   └── weatherSystem.ts
└── contexts/
    └── PanelLayoutContext.tsx
```

## Files to Modify

```
src/unified/UnifiedShell.tsx     # Header, layout, combat tile, import button
src/components/ManagerTab.tsx     # Migrate to useCampaignStore
src/components/InventoryTab.tsx   # Add Party Stash tab
src/components/ChangelogTab.tsx   # Verify log display
src/utils/activityResolver.ts     # Add log entries
src/utils/inventoryManager.ts     # Add log entries
src/utils/timeSystem.ts           # Add log entries, weather
src/state/campaignReducer.ts      # Add weather state
src/state/campaignStore.tsx       # Add weather actions
```

## Files to Delete/Deprecate

```
src/components/party-tool/PartyToolApp.jsx  # Replace with ActivitiesPanel
src/components/party-tool/PartyToolContainer.tsx  # No longer needed
```

---

## Success Criteria

- [ ] Full GCS-style character sheet visible and editable
- [ ] .gcs file import working
- [ ] Activities panel shows 4 tiles that expand/modal to full systems
- [ ] Combat button in dedicated tile at bottom
- [ ] Weather widget in header with effects
- [ ] Import button functional
- [ ] Manager module working
- [ ] Changelog receiving log entries
- [ ] Inventory module has Party Stash
- [ ] Characters can be added/edited from Party Column

---

## Risk Mitigation

1. **Large Scope:** Break into small, committable chunks
2. **Character Sheet Complexity:** Start with view-only, add edit later
3. **GCS Format:** Research format thoroughly before implementing
4. **Breaking Changes:** Keep old components until new ones are verified
5. **State Changes:** Add new state fields without modifying existing

---

**Next Step:** Begin Phase 1 - Create character sheet types and basic component structure.
