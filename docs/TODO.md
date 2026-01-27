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

**Commit:** `pending`

---

## Phase 5: Location & Weather System 🔲 PENDING

- [ ] Create Location types and interfaces
- [ ] Create Weather types and effects
- [ ] Build LocationManager (GM tool)
- [ ] Build WeatherWidget component
- [ ] Implement weather generation per location
- [ ] Basic travel system between locations
- [ ] Weather effects on activities

---

## Phase 6: Character Management 🔲 PENDING

- [ ] Add Character button in Party Column
- [ ] Character creation options:
  - [ ] Blank character
  - [ ] From template
  - [ ] Import from GCS
- [ ] Character context menu (View, Edit, Duplicate, Export, Delete)

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

### Planned New Files
- `src/components/location/LocationManager.tsx` - Phase 5
- `src/components/location/TravelPanel.tsx` - Phase 5
- `src/types/location.ts` - Phase 5

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

### Files Deleted in Phase 3
- `src/components/party-tool/PartyToolApp.jsx` - Replaced by ActivitiesPanel
- `src/components/party-tool/PartyToolContainer.tsx` - No longer needed

---

## Notes

- The existing systems (AlchemyTab, CookingTab, CraftingTab, GatheringManager) are production-ready and should be connected to, not replaced.
- Use feature flags for gradual rollout if needed.
- The `work.skills` field on Character is auto-populated from `gcsData.skills` for backward compatibility with activities.
