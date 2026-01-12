# Alchemy System Refactor Plan

## Current State Analysis

### Tier Calculation
- **Current**: Manual selection via dropdown (Tier 1-4)
- **Issue**: No automated calculation from ingredient potency
- **Target**: Auto-calculate tier from "potency load" of active ingredients

### Role Coverage
- **Current**: No validation or penalties for missing roles
- **Issue**: Players can create invalid formulas
- **Target**: Validate required roles per vector/tier, apply penalties if missing

### Reagent Limits
- **Current**: No max reagent or unit constraints
- **Issue**: Unrestricted batches
- **Target**: Hard limits with UI feedback

### Identification System
- **Current**: Partial implementation (identificationLevel 0-4 exists)
- **Issue**: Aspects/potency still shown regardless of identification
- **Target**: Hide data until identified, analysis costs 1U

### DM/Skill Math
- **Current**: `effectiveSkill = skill + batch.DM`
- **Issue**: Potential sign errors or double-counting
- **Target**: Audit and fix sign conventions

### Hazards
- **Current**: Tags only, no rules
- **Issue**: No triggering or consequences
- **Target**: Rules lookup + triggering system

### Effect Family Map
- **Current**: Works but keys may be inconsistent
- **Issue**: Reverse lookups might fail
- **Target**: Canonical key strategy

## Implementation Order

### Phase 1: Core Math & Constraints
1. ✅ Add tier calculation from potency
2. ✅ Add role coverage validation
3. ✅ Add reagent/unit limits
4. ✅ Add hazard rules

### Phase 2: Identification System
5. ✅ Extend identification to hide potency
6. ✅ Implement analysis with 1U cost
7. ✅ Update all UI to respect identification

### Phase 3: DM/Skill Audit
8. ✅ Audit and fix sign conventions
9. ✅ Add unit tests

### Phase 4: Polish
10. ✅ Effect Family Map canonicalization
11. ✅ Backward compatibility migrations
12. ✅ Documentation

## Constants to Add

```javascript
// Tier thresholds based on potency load
export const TIER_THRESHOLDS = {
  1: { min: 0, max: 3 },    // P0-P1 actives
  2: { min: 4, max: 6 },    // P2 actives
  3: { min: 7, max: 9 },    // P3 actives
  4: { min: 10, max: 999 }  // P4 actives
};

// Required roles per vector
export const REQUIRED_ROLES = {
  'Potion': { active: 1, stabilizer: 1, solvent: 1 },
  'Salve/Poultice': { active: 1, binder: 1 },
  'Ink/Coating': { active: 1, binder: 1 },
  'Aerosol/Smoke': { active: 1, catalyst: 1 },
  'Bomb/Grenade': { active: 1, catalyst: 1, stabilizer: 1 }
};

// Penalty Scheme A for missing roles
export const ROLE_PENALTY_SCHEME_A = {
  missingActive: { wr: 999, dm: -999 }, // Invalid
  missingStabilizer: { wr: 2, dm: -1 },
  missingSolvent: { wr: 2, dm: -1 },
  missingBinder: { wr: 2, dm: -1 },
  missingCatalyst: { wr: 1, dm: 0 }
};

// Max constraints
export const MAX_REAGENTS_PER_BATCH = 8;
export const MAX_UNITS_PER_REAGENT_BY_ROLE = {
  'Active': 3,
  'Catalyst': 2,
  'Stabilizer': 2,
  'Solvent': 5,  // Can use more for dilution
  'Binder': 3,
  'Vector': 1,
  'Signature': 1,
  'Tool': 1
};

// Hazard rules
export const HAZARD_RULES = {
  'Flammable': {
    triggerOn: ['mishap', 'quality<=Unstable'],
    effect: 'Fire damage to lab/workers',
    wrMod: 1
  },
  'Volatile': {
    triggerOn: ['failure', 'mishap'],
    effect: 'Explosion, lose batch',
    wrMod: 2
  },
  'Reactive': {
    triggerOn: ['conflict_pairs'],
    effect: 'Increased WR/DM penalty',
    wrMod: 1,
    dmMod: -1
  },
  'Unstable': {
    triggerOn: ['any_failure'],
    effect: 'CP +1 extra',
    wrMod: 1
  },
  'Toxic': {
    triggerOn: ['exposure'],
    effect: 'HT roll or take damage',
    wrMod: 0
  },
  'Intoxicant': {
    triggerOn: ['exposure'],
    effect: 'IQ/DX penalty',
    wrMod: 0
  },
  'Hallucinogenic': {
    triggerOn: ['exposure'],
    effect: 'Mental effects',
    wrMod: 0
  }
};
```

## Backward Compatibility

### Formulas
- If formula has explicit tier, keep it but mark as "legacy"
- Recompute on edit
- Show warning if tier doesn't match calculated value

### Reagents
- If no identificationLevel, default to:
  - 4 (fully known) if created by GM in Manager tab
  - 0 (unknown) if imported/found as loot
  - Decision: Default to 4 for existing reagents (GM-friendly)

### Batches
- Existing batches keep their stored WR/DM
- Don't retroactively change completed batches
- In-progress batches: recalculate on next work block

## Testing Checklist

- [ ] Tier auto-calculates from potency
- [ ] Role validation shows warnings
- [ ] Penalties apply correctly
- [ ] Max reagents enforced
- [ ] Max units per role enforced
- [ ] Analysis costs 1U per use
- [ ] Identification levels hide aspects/potency
- [ ] DM signs are correct
- [ ] Lab Rating applied once
- [ ] Hazards trigger at right times
- [ ] Effect Family Map lookups work both ways
- [ ] Old data loads without errors
- [ ] Can edit old formulas
- [ ] Can complete old batches
