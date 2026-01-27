# Combat & Party Integration - TODO

**Reference Document:** [COMBAT_PARTY_INTEGRATION_PLAN.md](./COMBAT_PARTY_INTEGRATION_PLAN.md)

---

## Bug Fixes (Completed)

- [x] Fix GM Mode toggle - `setGmMode` action was missing
- [x] Fix Combat crash - `CombatProvider` not in component tree
- [x] Fix Gathering crash - `materialTypes` prop missing
- [x] Fix checkpoint null reference - defensive checks added
- [x] Fix maneuver selection crash - combat state validation added

**Commits:**
- `ed97665` Fix: GM mode, Combat, and Gathering system bugs
- `ed155b1` Fix: Add defensive null checks for checkpoints in ManagerTab
- `05599ef` Fix: Add defensive null checks for combat state properties

---

## Phase 1: Hit Location Profile

- [ ] Add hit location profile types
  - [ ] Create `HitLocationProfile` type in `src/types/characterSheet.ts`
  - [ ] Add `hitLocationProfileId?: string` to `Character` type in `src/types/campaign.ts`
  - [ ] Default value: `'humanoid'`

- [ ] Add profile selector to Character Sheet
  - [ ] Modify `src/components/character-sheet/PointPoolsSection.tsx`
  - [ ] Add dropdown below HP/FP pools, above Traits section
  - [ ] Load available profiles from `src/constants/hitLocations.js`
  - [ ] Save selection to character entity

- [ ] Wire up to campaign store
  - [ ] Add action to update character's hit location profile
  - [ ] Ensure profile persists on save/load

---

## Phase 2: Party Characters in Combat

- [ ] Add party character access to CombatContext
  - [ ] Modify `src/contexts/CombatContext.jsx`
  - [ ] Expose `partyCharacters` from `state.entities.characters`
  - [ ] Filter to only characters with `isPlayer: true`

- [ ] Update Encounter Setup UI
  - [ ] Modify `src/components/combat/EncounterSetup.tsx`
  - [ ] Add "Party Characters" section above "Add from Library"
  - [ ] Show party characters with + button to add to encounter
  - [ ] Party characters auto-assigned "Player" category

- [ ] Handle party character data in combat
  - [ ] Map party character stats to combat participant format
  - [ ] Use `gcsData.attributes` for HP, ST, DX, etc.
  - [ ] Use character's `hitLocationProfileId` for hit locations

---

## Phase 3: Player Category Lock

- [ ] Lock category for party characters
  - [ ] Modify `src/components/combat/EncounterSetup.tsx`
  - [ ] Disable category dropdown for party-sourced participants
  - [ ] Show lock icon or "Party Member" indicator

- [ ] GM Mode override
  - [ ] Check `state.ui.gmModeEnabled` for override
  - [ ] If GM Mode: allow category change with warning
  - [ ] If Player Mode: category locked, no dropdown

- [ ] Update Character Library
  - [ ] Modify `src/components/combat/CharacterLibrary.tsx`
  - [ ] Hide party characters from library (they're in Party section)
  - [ ] Or show them with "In Party" badge, non-editable

---

## Phase 4: Combat HP Sync (Deferred)

- [ ] Decide sync strategy (Combat-Only vs Live Sync)
- [ ] Implement chosen strategy
- [ ] Add UI for syncing HP back to party on combat end

---

## File Locations

### Phase 1 Files
- `src/types/campaign.ts` - Character type modification
- `src/types/characterSheet.ts` - Hit location profile types
- `src/components/character-sheet/PointPoolsSection.tsx` - Profile selector UI
- `src/constants/hitLocations.js` - Existing profile data (reference)

### Phase 2 Files
- `src/contexts/CombatContext.jsx` - Party character access
- `src/components/combat/EncounterSetup.tsx` - Party section UI

### Phase 3 Files
- `src/components/combat/EncounterSetup.tsx` - Category lock
- `src/components/combat/CharacterLibrary.tsx` - Party indicator

---

## Testing Checklist

### Phase 1
- [ ] Character sheet shows hit location profile dropdown
- [ ] Default profile is "humanoid"
- [ ] Profile selection saves and persists
- [ ] Profile loads correctly on page refresh

### Phase 2
- [ ] Party characters appear in Encounter Setup
- [ ] Can add party character to combat
- [ ] Party character stats (HP, attributes) correct in combat
- [ ] Non-party characters still work from library

### Phase 3
- [ ] Party character category locked to "Player"
- [ ] Category dropdown disabled for party characters
- [ ] GM Mode allows category change
- [ ] Non-party characters can be any category

---

## Notes

- Existing combat saves should continue to work (backward compatible)
- Party characters in combat use their `gcsData` for stats
- Combat tracks its own `currentHP` separate from party HP
- Hit location profiles already defined in `src/constants/hitLocations.js`
