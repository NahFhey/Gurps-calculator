# Activities Panel Refactor - TODO

**Reference Document:** [ACTIVITIES_PANEL_REFACTOR_DETAILED.md](./ACTIVITIES_PANEL_REFACTOR_DETAILED.md)

---

## Phase 1: Character Sheet ✅ COMPLETE

- [x] Create GCSCharacter types (`src/types/characterSheet.ts`)
- [x] Extend Character entity in campaign store
- [x] Build CharacterSheet component with all sections:
  - [x] IdentitySection
  - [x] AttributesSection (Primary)
  - [x] SecondaryAttributesSection
  - [x] PointPoolsSection (HP/FP)
  - [x] TraitsSection (Advantages, Perks, Disadvantages, Quirks)
  - [x] SkillsSection
  - [x] SpellsSection
  - [x] EquipmentSection
  - [x] ModifiersSection (Reactions, Conditional Modifiers)
  - [x] NotesSection
- [x] Build text import parser (`src/utils/characterImport.ts`)
- [x] Wire up CharacterSheet to UnifiedShell center panel
- [x] Add Import Character button functionality

**Commit:** `7f81a70 Feat: Implement Phase 1 - GCS Character Sheet`

---

## Phase 2: Layout Restructure ✅ COMPLETE

- [x] Header Redesign
  - [x] Add WeatherWidget component (placeholder for Phase 5)
  - [x] Move TimeControls to header (Advance Day/Slot)
  - [x] Add TimeDisplay component
- [x] Flexible Panel System
  - [x] Create PanelLayoutContext
  - [x] Implement panel expand/collapse states (party column collapsible)
  - [x] Support modal overlays for activities
- [x] Combat Tile
  - [x] Create CombatTile component at bottom of layout
  - [x] Show combat status (inactive/active, round, participants)
  - [x] Click to expand to full Combat module

**Commit:** `12f1648 Feat: Implement Phase 2 - Layout Restructure`

---

## Phase 3: Activities Panel Simplification ✅ COMPLETE

- [x] Create new ActivitiesPanel component
  - [x] 4-tile grid layout (Alchemy, Cooking, Crafting, Gathering)
  - [x] Each tile opens existing system (modal overlay)
  - [x] Show current day/slot and weather effects placeholder
- [x] Migrate features from PartyToolApp.jsx:
  - [x] Inventories tab → InventoryTab (Party Stash view added)
  - [x] Logs tab → ChangelogTab (deferred to Phase 4)
  - [x] GM Workshop > Tool Templates → ManagerTab (new ToolTemplatesView)
  - [x] GM Workshop > Facilities → ManagerTab (new FacilitiesView)
  - [x] GM Workshop > Time Controls → Header (already done in Phase 2)
- [x] Delete PartyToolApp.jsx and PartyToolContainer.tsx
- [x] Fix ManagerTab to use useCampaignStore() directly

**Commit:** `2865827 Feat: Implement Phase 3 - Activities Panel Simplification`

---

## Phase 4: Quick Fixes ✅ COMPLETE

- [x] Fix Manager module (migrate to `useCampaignStore()`) - Done in Phase 3
- [x] Populate Changelog (add logging calls throughout codebase)
  - [x] Created `src/utils/activityLogger.ts` - Logging utility with helpers for all activity types
  - [x] Added logging to AlchemyTab (batch started/completed/failed)
  - [x] Added logging to CookingTab (meal prepared)
  - [x] Added logging to CraftingTab (project started/completed)
  - [x] Added logging to InventoryTab (item/tool/currency transfers)
  - [x] Added logging to campaignReducer (combat started/combatant defeated)
- [x] Add Party Stash tab to Inventory module - Done in Phase 3

**Commit:** `2e68582 Feat: Implement Phase 4 - Populate Changelog with Logging`

---

## Phase 5: Location & Weather System ✅ COMPLETE

- [x] Create Location types and interfaces (`src/types/location.ts`)
- [x] Create Weather types and effects (weather types, effects, tables)
- [x] Build LocationManager (GM tool) - create/edit/delete locations
- [x] Build WeatherWidget component - displays current location and weather
- [x] Implement weather generation per location (climate-based weather tables)
- [x] Basic travel system between locations (TravelPanel component)
- [x] Weather effects on activities:
  - [x] Activity calculator updated with `weatherModifiers` parameter
  - [x] `useWeatherModifiers` hook for activity tabs
  - [x] Weather banners in AlchemyTab, CookingTab, CraftingTab
  - [x] GatheringContext updated with weather modifiers
  - [x] ActivitiesPanel shows current weather effects
- [x] Weather auto-advances when time advances (in campaignReducer)
- [x] Default "Camp" location created on initialization

**Commit:** `307c7b8 Feat: Implement Phase 5 - Location & Weather System`

---

## Phase 6: Character Management ✅ COMPLETE

- [x] Add Character button in Party Column
- [x] Character creation options:
  - [x] Blank character (create with default attributes)
  - [x] From template (infrastructure with 6 template types: Fighter, Wizard, Rogue, Cleric, Ranger, Bard)
  - [x] Import from file (GCS text format or JSON)
- [x] Character context menu (View, Edit, Duplicate, Export JSON, Delete)
- [x] Character utility functions (`src/utils/characterManagement.ts`)
- [x] Delete confirmation dialog
- [x] HP/FP display in party character cards

**Commit:** `bc0da2a Feat: Implement Phase 6 - Character Management`

---

## File Locations

### Phase 1 Files (Complete)
- `src/types/characterSheet.ts` - GCS character types
- `src/components/character-sheet/` - All character sheet components
- `src/utils/characterImport.ts` - Text import parser

### Phase 2 Files (Complete)
- `src/contexts/PanelLayoutContext.tsx` - Panel expand/collapse context
- `src/components/header/WeatherWidget.tsx` - Weather display (placeholder)
- `src/components/header/TimeDisplay.tsx` - Day/slot display
- `src/components/header/TimeControls.tsx` - Advance Day/Slot buttons
- `src/components/header/index.ts` - Header component exports
- `src/components/combat/CombatTile.tsx` - Combat status tile

### Phase 3 Files (Complete)
- `src/components/activities/ActivitiesPanel.tsx` - 4-tile activity launcher
- `src/components/activities/ActivityTile.tsx` - Individual activity tile component
- `src/components/activities/index.ts` - Component exports
- `src/components/manager/views/ToolTemplatesView.tsx` - Tool templates view
- `src/components/manager/views/FacilitiesView.tsx` - Facilities view

### Phase 4 Files (Complete)
- `src/utils/activityLogger.ts` - Logging utility with helpers for all activity types

### Phase 5 Files (Complete)
- `src/types/location.ts` - Location, Weather, Travel types and constants
- `src/utils/weatherSystem.ts` - Weather generation and effects utilities
- `src/hooks/useWeatherModifiers.ts` - Hook for getting weather effects in activity tabs
- `src/components/location/LocationManager.tsx` - GM tool for managing locations
- `src/components/location/TravelPanel.tsx` - Travel between locations component
- `src/components/location/index.ts` - Location component exports

### Phase 6 Files (Complete)
- `src/utils/characterManagement.ts` - Character creation, duplication, and export utilities
- `src/components/character-management/CharacterCreationModal.tsx` - Modal for creating new characters
- `src/components/character-management/CharacterContextMenu.tsx` - Right-click context menu for characters
- `src/components/character-management/index.ts` - Component exports

### Files Modified in Phase 6
- `src/unified/UnifiedShell.tsx` - Added character management UI (Add button, context menu, delete confirmation, HP/FP display)

### Files Modified in Phase 2
- `src/unified/UnifiedShell.tsx` - Layout restructure with new header, collapsible party, CombatTile

### Files Modified in Phase 3
- `src/unified/UnifiedShell.tsx` - Replaced PartyToolContainer with ActivitiesPanel
- `src/components/ManagerTab.tsx` - Refactored to use useCampaignStore() directly
- `src/components/InventoryTab.tsx` - Added Party Stash view

### Files Modified in Phase 4
- `src/components/AlchemyTab.tsx` - Added logging for batch events
- `src/components/CookingTab.tsx` - Added logging for meal preparation
- `src/components/CraftingTab.tsx` - Added logging for crafting projects
- `src/components/InventoryTab.tsx` - Added logging for transfers
- `src/contexts/GatheringContext.jsx` - Added logging support
- `src/state/campaignReducer.ts` - Added logging for combat events

### Files Modified in Phase 5
- `src/state/campaignReducer.ts` - Added locations state, location/weather actions, weather auto-advance
- `src/state/campaignStore.tsx` - Added location/weather action exports
- `src/components/header/WeatherWidget.tsx` - Replaced placeholder with real weather state
- `src/components/AlchemyTab.tsx` - Added weather effects banner
- `src/components/CookingTab.tsx` - Added weather effects banner
- `src/components/CraftingTab.tsx` - Added weather effects banner
- `src/contexts/GatheringContext.jsx` - Added weather modifiers
- `src/components/activities/ActivitiesPanel.tsx` - Added real weather effects display
- `src/utils/activityCalculator.ts` - Added weatherModifiers parameter

### Files Deleted in Phase 3
- `src/components/party-tool/PartyToolApp.jsx` - Replaced by ActivitiesPanel
- `src/components/party-tool/PartyToolContainer.tsx` - No longer needed

---

## Notes

- The existing systems (AlchemyTab, CookingTab, CraftingTab, GatheringManager) are production-ready and should be connected to, not replaced.
- Use feature flags for gradual rollout if needed.
- The `work.skills` field on Character is auto-populated from `gcsData.skills` for backward compatibility with activities.
