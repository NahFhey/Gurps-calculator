# Combat & Party Integration Plan

**Created:** 2026-01-27
**Status:** Planning

---

## Overview

Integrate the Combat system with the Party character system to:
1. Use party characters directly in combat encounters
2. Add Hit Location Profiles to character sheets
3. Lock party characters as "Player" category in combat
4. Prepare for future UI where Combat fills the center panel

---

## Current Architecture

### Party Characters
- Stored in: `state.entities.characters` (Record<Id, Character>)
- Type: `Character` from `src/types/campaign.ts`
- UI: Party column in UnifiedShell, CharacterSheet in center panel

### Combat Characters
- Stored in: `state.entities.combatCharacters` (Record<Id, CombatCharacter>)
- Type: Combat-specific character type
- UI: CharacterLibrary in CombatTab
- Categories: Player, Ally, Enemy, Object

### Problem
Party characters and Combat characters are separate entities. When starting combat:
- Users must manually recreate party characters in Combat's CharacterLibrary
- No sync between party HP/stats and combat HP/stats
- Party characters can be miscategorized as Enemy/Ally

---

## Proposed Solution

### Phase 1: Hit Location Profile

Add `hitLocationProfileId` field to the `Character` type used by party characters.

**Changes:**
- `src/types/campaign.ts` - Add `hitLocationProfileId?: string` to Character type
- `src/types/characterSheet.ts` - Add hit location profile types
- `src/components/character-sheet/PointPoolsSection.tsx` - Add profile selector below HP/FP

**Default Behavior:**
- Default profile: "humanoid" for all party characters
- Profile determines hit location table used in combat
- Existing hit location profiles from Combat system (constants/hitLocations.js)

### Phase 2: Party → Combat Integration

Make Combat's EncounterSetup read directly from party characters.

**Changes:**
- `src/components/combat/EncounterSetup.tsx` - Add "Party Characters" section
- Party characters appear automatically with "Player" category
- Non-party characters remain in CharacterLibrary (for Enemies/Allies/Objects)

**Data Flow:**
```
Party Characters (entities.characters)
         ↓
Combat reads directly (no copy)
         ↓
Combat state tracks combat-specific data:
  - currentHP (can differ from party HP during combat)
  - conditions
  - turn order position
```

### Phase 3: Player Category Lock

Party characters are locked to "Player" category.

**Rules:**
- Party characters (isPlayer: true) → Always "Player" category
- Category dropdown disabled for party characters (unless GM Mode)
- GM Mode allows recategorization (for edge cases)
- Non-party characters can be any category

**UI Changes:**
- `src/components/combat/EncounterSetup.tsx` - Disable category for party chars
- `src/components/combat/CharacterLibrary.tsx` - Show lock indicator for party chars

### Phase 4: Combat HP Sync (Optional)

Decide sync behavior for HP between party and combat:

**Option A: Combat-Only Tracking**
- Combat tracks its own currentHP
- Party HP unchanged until combat ends
- On combat end, optionally sync final HP back to party

**Option B: Live Sync**
- Combat HP changes immediately update party HP
- More realistic but may cause issues with undo/reset

**Recommendation:** Option A (Combat-Only) for simplicity.

---

## Future Vision: Combat Center Panel

Eventually, when combat is active:
- Combat fills the center panel (replaces CharacterSheet)
- Rail (right sidebar) disappears
- Party column shows "Enemy Party" instead of player party
- Participants box becomes turn order tracker

This is out of scope for current work but influences design decisions.

---

## Technical Considerations

### Character Type Unification

Current types:
- `Character` (party) - Basic info, work skills, optional gcsData
- `CombatCharacter` (combat) - Full combat stats, attacks, defenses

**Approach:**
- Party characters with `gcsData` have all combat stats needed
- Combat can read stats from `character.gcsData.attributes`
- Combat-specific state (conditions, turn order) stored separately

### State Structure

```typescript
// Party character (existing)
entities.characters: Record<Id, Character>

// Combat session (existing)
combat.activeSession: {
  participants: Array<{
    instanceId: string;      // Unique for this combat instance
    characterId: string;     // Reference to party character OR combatCharacter
    isPartyCharacter: boolean;
    category: 'player' | 'ally' | 'enemy' | 'object';
    currentHP: number;
    conditions: Condition[];
  }>;
  turnOrder: string[];  // instanceIds
  // ... rest of combat state
}
```

### Migration

Existing combatCharacters remain for:
- Enemy templates
- Ally NPCs
- Objects
- Characters not in party

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing combat saves | Version check, migrate old format |
| HP sync confusion | Clear UI indicators, combat-only HP |
| Performance with large parties | Lazy loading, memoization |
| Category lock frustration | GM Mode override |

---

## Success Criteria

1. Party characters appear in Combat's Encounter Setup automatically
2. Party characters have "Player" category locked (unless GM Mode)
3. Character sheets show Hit Location Profile selector
4. Existing combat functionality unchanged for non-party characters
5. No data loss on upgrade

---

## Dependencies

- Hit Location Profiles already exist in `src/constants/hitLocations.js`
- Character types in `src/types/campaign.ts` and `src/types/characterSheet.ts`
- Combat system in `src/components/combat/`
- CombatContext bridges to CampaignStore

---

## Related Files

### To Modify
- `src/types/campaign.ts` - Character type
- `src/types/characterSheet.ts` - Hit location types
- `src/components/character-sheet/PointPoolsSection.tsx` - Profile UI
- `src/components/combat/EncounterSetup.tsx` - Party integration
- `src/components/combat/CharacterLibrary.tsx` - Category lock
- `src/contexts/CombatContext.jsx` - Party character access

### Reference Only
- `src/constants/hitLocations.js` - Existing profiles
- `src/components/combat/CombatTracker.tsx` - Combat flow
- `src/state/campaignReducer.ts` - State structure
