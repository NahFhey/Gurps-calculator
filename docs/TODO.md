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

## Phase 3: Activities Panel Simplification 🔲 PENDING

- [ ] Create new ActivitiesPanel component
  - [ ] 4-tile grid layout (Alchemy, Cooking, Crafting, Gathering)
  - [ ] Each tile opens existing system (expand or modal)
  - [ ] Show current day/slot and weather effects
- [ ] Migrate features from PartyToolApp.jsx:
  - [ ] Inventories tab → InventoryTab (add Party Stash)
  - [ ] Logs tab → ChangelogTab
  - [ ] GM Workshop > Tool Templates → ManagerTab
  - [ ] GM Workshop > Facilities → ManagerTab
  - [ ] GM Workshop > Time Controls → Header
- [ ] Delete PartyToolApp.jsx (1,065 lines → ~100 lines)

---

## Phase 4: Quick Fixes 🔲 PENDING

- [ ] Fix Manager module (migrate to `useCampaignStore()`)
- [ ] Populate Changelog (add logging calls throughout codebase)
- [ ] Add Party Stash tab to Inventory module

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

### Planned New Files
- `src/components/activities/ActivitiesPanel.tsx` - Phase 3
- `src/components/activities/ActivityTile.tsx` - Phase 3
- `src/components/location/LocationManager.tsx` - Phase 5
- `src/components/location/TravelPanel.tsx` - Phase 5
- `src/types/location.ts` - Phase 5

### Files Modified in Phase 2
- `src/unified/UnifiedShell.tsx` - Layout restructure with new header, collapsible party, CombatTile
- `src/components/party-tool/PartyToolApp.jsx` - Removed time controls (now in header)

### Files to Modify (Remaining)
- `src/components/ManagerTab.tsx` - Fix props issue (Phase 4)
- `src/components/ChangelogTab.tsx` - Add logging (Phase 4)
- `src/components/InventoryTab.tsx` - Add Party Stash (Phase 4)

### Files to Delete
- `src/components/party-tool/PartyToolApp.jsx` - After Phase 3

---

## Notes

- The existing systems (AlchemyTab, CookingTab, CraftingTab, GatheringManager) are production-ready and should be connected to, not replaced.
- Use feature flags for gradual rollout if needed.
- The `work.skills` field on Character is auto-populated from `gcsData.skills` for backward compatibility with activities.
