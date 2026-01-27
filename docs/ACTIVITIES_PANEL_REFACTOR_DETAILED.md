# Activities Panel Refactor - Detailed Explanation

**Document Version:** 1.0
**Created:** 2026-01-27
**Author:** Claude Code Assistant
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Vision & Goals](#vision--goals)
4. [Detailed Phase Breakdown](#detailed-phase-breakdown)
5. [Technical Architecture](#technical-architecture)
6. [Data Models](#data-models)
7. [User Experience Design](#user-experience-design)
8. [Migration Strategy](#migration-strategy)
9. [Risk Analysis](#risk-analysis)
10. [Appendices](#appendices)

---

## Executive Summary

### The Problem

The GURPS Calculator application has grown organically, resulting in several architectural issues:

1. **Monolithic Activities Panel** - A single 1,065-line component (`PartyToolApp.jsx`) handles activity configuration, inventory management, logging, and GM tools—all unrelated concerns mixed together.

2. **Disconnected Systems** - Well-developed systems for Alchemy, Cooking, Crafting, and Gathering exist but are not connected to the Activities panel, which has its own parallel implementation.

3. **Missing Core Feature** - There is no comprehensive character sheet. The existing character display is combat-focused and lacks the full GURPS character data (skills, advantages, disadvantages, equipment with costs/weights).

4. **Broken Features** - Several UI elements are non-functional (Import button, Manager module, Changelog).

5. **Poor Information Architecture** - Inventory is split across multiple locations, logs are siloed, and combat controls are misplaced.

### The Solution

A comprehensive refactor that:

- Creates a **full GCS-style character sheet** as the central focus
- Transforms the Activities panel into a **simple tile-based launcher** connecting to existing systems
- Implements a **flexible panel layout** allowing users to focus on different tasks
- Adds a **weather system** for environmental effects on activities
- Fixes all broken features and consolidates related functionality

### Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| PartyToolApp.jsx | 1,065 lines | 0 (deleted) |
| Activities Panel | Complex configurator | Simple 4-tile grid |
| Character Sheet | Combat-only (partial) | Full GCS-style |
| Broken Features | 4+ | 0 |
| System Integration | Disconnected | Unified |

---

## Current System Analysis

### Existing Well-Developed Systems

The application already has mature, well-tested systems that should be leveraged:

#### 1. Alchemy System (`AlchemyTab.tsx`)
- **Lines:** ~170 (thin router) + alchemy subcomponents
- **Features:**
  - Full GURPS 4e alchemy rules
  - Reagent management with effect families
  - Formula creation with Working Required (WR) and Difficulty Modifier (DM) calculations
  - Lab equipment bonuses
  - Batch processing
- **State:** Uses `useCampaignStore()` directly
- **Status:** ✅ Production-ready

#### 2. Cooking System (`CookingTab.tsx`)
- **Lines:** ~880
- **Features:**
  - Recipe creation with ingredients
  - Substitution system for missing ingredients
  - Kitchen facility bonuses
  - Skill checks with modifiers
  - Food supply tracking
- **State:** Uses `useCampaignStore()` directly
- **Status:** ✅ Production-ready

#### 3. Crafting System (`CraftingTab.tsx`)
- **Lines:** ~980
- **Features:**
  - Project design workflow
  - Material requirements calculation
  - Quality levels (from Shoddy to Very Fine)
  - Time estimation
  - Worker assignment
- **State:** Uses `useCampaignStore()` directly
- **Status:** ✅ Production-ready

#### 4. Gathering System (`GatheringManager.tsx`)
- **Lines:** ~184 (thin router) + 7 view components (~1,600 total)
- **Features:**
  - Species database (fish, game, plants)
  - Tool effectiveness
  - Environment modifiers
  - Foraging tables
  - Day planner integration
- **State:** Uses `useCampaignStore()` directly
- **Status:** ✅ Production-ready

#### 5. Combat System (`CombatTracker.tsx`)
- **Lines:** ~1,506 (thin router) + 5 view components
- **Features:**
  - Full GURPS combat with initiative
  - Attack/defense resolution
  - Damage calculation with hit locations
  - Conditions and effects tracking
  - Combat history and undo
- **State:** Uses `useCampaignStore()` directly
- **Status:** ✅ Production-ready

### The Problematic Activities Panel

The current `PartyToolApp.jsx` (1,065 lines) attempts to be a "party management tool" but has grown unwieldy:

```
PartyToolApp.jsx Structure:
├── Tab 1: "Active Activity" (~245 lines)
│   ├── Activity Skill Selector
│   ├── Primary Worker Selector
│   ├── Helpers Selection Panel
│   ├── Equipment Slots
│   ├── Facility Selector
│   ├── Real-time Modifiers Display
│   └── Pre-Resolution Checklist
├── Tab 2: "Inventories" (~188 lines)
│   ├── Inventory Display Grid
│   └── Transfer Console
├── Tab 3: "Logs" (~65 lines)
│   └── Unified Logs Display
├── Tab 4: "GM Workshop" (~88 lines)
│   ├── Tool Templates Panel
│   ├── Facilities Panel
│   └── Time Control Panel
├── State/Calculations (~260 lines)
│   └── 7 useMemo blocks
└── Event Handlers (~100 lines)
```

**Problems with this approach:**

1. **Duplication** - The activity configuration duplicates logic that exists in the individual activity systems (Alchemy, Cooking, etc.)

2. **Wrong Location** - Inventories should be in the Inventory module; Logs should be in Changelog

3. **Complexity** - Users must understand the generic "activity" abstraction rather than directly using Cooking, Alchemy, etc.

4. **Maintenance Burden** - Changes to activity logic must be made in multiple places

### Broken Features Analysis

#### Import Button
- **Location:** `UnifiedShell.tsx` line 246-251
- **Issue:** Button renders but has no `onClick` handler
- **Impact:** Users cannot import saved campaigns
- **Fix Complexity:** Low (add handler, navigate to import view)

#### Manager Module
- **Location:** `ManagerTab.tsx`
- **Issue:** Expects 70+ props from `legacyAppState` which is an empty object `{}`
- **Impact:** Module renders but all data is undefined/empty
- **Fix Complexity:** Medium (migrate to `useCampaignStore()` pattern)

#### Changelog Module
- **Location:** `ChangelogTab.tsx`
- **Issue:** Reads from `state.logs.entries` but `addLogEntry` is never called anywhere
- **Impact:** Always shows "No log entries yet"
- **Fix Complexity:** Medium (add logging calls throughout codebase)

#### Combat Button Placement
- **Location:** Rail navigation in `UnifiedShell.tsx`
- **Issue:** Combat is accessed via rail like other modules, but user wants dedicated tile
- **Impact:** UX inconsistency, combat deserves prominent placement
- **Fix Complexity:** Low-Medium (create CombatTile component, modify layout)

---

## Vision & Goals

### User Experience Vision

Based on the user-provided wireframe, the application should present:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                          │
│ ┌──────────────┐                                    ┌─────────┬─────────┐       │
│ │   Weather    │  "Sunny, Mild"                     │Adv. Day │Adv. Slot│ Day 3 │
│ │    Widget    │  "+1 Gathering, -0 Crafting"       └─────────┴─────────┘Slot 2 │
│ └──────────────┘                                                                │
├────────────┬────────────────────────────────────────┬───────────────────┬───────┤
│   PARTY    │         CHARACTER SHEET                │    ACTIVITIES     │ RAIL  │
│   COLUMN   │         (Center Panel)                 │    (Right Panel)  │       │
│            │                                        │                   │       │
│ ┌────────┐ │  ┌─────────────────────────────────┐  │ ┌───────┬───────┐ │ ┌───┐ │
│ │ Char 1 │ │  │ Portrait │ Name: Rina           │  │ │       │       │ │ │Inv│ │
│ │  ★     │ │  │  [ ]     │ Title: Swashbuckler  │  │ │Alchemy│Cooking│ │ ├───┤ │
│ └────────┘ │  │          │ Org: Adventurer Guild│  │ │       │       │ │ │Act│ │
│ ┌────────┐ │  ├──────────┴──────────────────────┤  │ ├───────┼───────┤ │ ├───┤ │
│ │ Char 2 │ │  │ ST: 10 [0]  │ HP: 10/10         │  │ │       │       │ │ │Mgr│ │
│ │        │ │  │ DX: 14 [80] │ FP: 10/10         │  │ │Craft  │Gather │ │ ├───┤ │
│ └────────┘ │  │ IQ: 12 [40] │ Will: 12          │  │ │ ing   │ ing   │ │ │Rul│ │
│ ┌────────┐ │  │ HT: 11 [10] │ Per: 12           │  │ │       │       │ │ ├───┤ │
│ │ Char 3 │ │  ├─────────────┴───────────────────┤  │ └───────┴───────┘ │ │Log│ │
│ │        │ │  │ Basic Speed: 6.25               │  │                   │ └───┘ │
│ └────────┘ │  │ Basic Move: 6  │ Dodge: 9       │  │ Clicking a tile   │       │
│            │  ├─────────────────────────────────┤  │ expands it to     │       │
│ ┌────────┐ │  │ SKILLS                          │  │ fill the center   │       │
│ │  + Add │ │  │ Acrobatics      DX+1  15  [4]   │  │ area, or opens    │       │
│ └────────┘ │  │ Broadsword      DX+2  16  [8]   │  │ as a modal.       │       │
│ ┌────────┐ │  │ Fast-Draw       DX+1  15  [2]   │  │                   │       │
│ │ Import │ │  │ Stealth         DX    14  [2]   │  │                   │       │
│ └────────┘ │  ├─────────────────────────────────┤  │                   │       │
│            │  │ ADVANTAGES           Points     │  │                   │       │
│            │  │ Combat Reflexes      [15]       │  │                   │       │
│            │  │ Enhanced Dodge 1     [15]       │  │                   │       │
│            │  ├─────────────────────────────────┤  │                   │       │
│            │  │ EQUIPMENT            Wt    $    │  │                   │       │
│            │  │ Saber                2 lb  $700 │  │                   │       │
│            │  │ Leather Armor       10 lb  $100 │  │                   │       │
│            │  └─────────────────────────────────┘  │                   │       │
│            │           [Edit Mode Toggle]          │                   │       │
├────────────┴───────────────────────────────────────┴───────────────────┴───────┤
│ COMBAT TILE                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │  [Start Combat]     No active combat.      Participants: 0     Round: --    │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Character-Centric** - The character sheet is the heart of GURPS; it should be prominent and comprehensive.

2. **Direct Access** - Users should go directly to Cooking, Alchemy, etc., not through an abstract "activity" layer.

3. **Contextual Placement** - Features belong where users expect them:
   - Inventory → Inventory module
   - Logs → Changelog module
   - Combat → Prominent tile, not buried in rail

4. **Flexible Workspace** - Panels can expand/collapse based on current task focus.

5. **Environmental Awareness** - Weather affects outdoor activities; this should be visible and integrated.

### Success Metrics

| Goal | Measurement |
|------|-------------|
| Simplify Activities | Panel reduced from 1,065 lines to ~100 lines |
| Complete Character Sheet | All GCS fields present and editable |
| System Integration | Activity tiles open existing systems |
| Fix Broken Features | All 4 broken features working |
| Improve UX | Weather visible, combat accessible, panels flexible |

---

## Detailed Phase Breakdown

### Phase 1: Character Sheet (CRITICAL PATH)

**Why This Is First:**
- Every other system needs character data (skills, attributes, equipment)
- Current character display is inadequate for non-combat use
- GCS import enables bringing existing characters into the system
- This is the most requested feature

#### 1.1 Understanding GCS Format

GURPS Character Sheet (GCS) is the standard software for creating GURPS characters. It saves files in `.gcs` format (XML-based). Understanding this format is crucial for import functionality.

**GCS File Structure (simplified):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<character>
  <profile>
    <name>Rina</name>
    <title>Swashbuckler</title>
    <age>24</age>
    <birthday>July 9</birthday>
    <height>5'7"</height>
    <weight>130 lb</weight>
    <SM>0</SM>
    <gender>Female</gender>
    <portrait>base64encodedimage</portrait>
  </profile>

  <attributes>
    <attribute id="st"><adj>0</adj></attribute>
    <attribute id="dx"><adj>4</adj></attribute>
    <attribute id="iq"><adj>2</adj></attribute>
    <attribute id="ht"><adj>1</adj></attribute>
    <!-- Secondary attributes calculated from primaries -->
  </attributes>

  <advantages>
    <advantage>
      <name>Combat Reflexes</name>
      <base_points>15</base_points>
      <reference>B43</reference>
    </advantage>
  </advantages>

  <disadvantages>
    <disadvantage>
      <name>Code of Honor (Pirate's)</name>
      <base_points>-5</base_points>
      <reference>B127</reference>
    </disadvantage>
  </disadvantages>

  <skills>
    <skill>
      <name>Broadsword</name>
      <specialization></specialization>
      <difficulty>DX/A</difficulty>
      <points>8</points>
      <reference>B208</reference>
    </skill>
  </skills>

  <equipment>
    <item>
      <description>Saber</description>
      <quantity>1</quantity>
      <weight>2 lb</weight>
      <value>700</value>
      <equipped>true</equipped>
    </item>
  </equipment>
</character>
```

#### 1.2 Character Sheet Sections

**Section A: Identity Panel**
```
┌──────────────────────────────────────────────────────┐
│  ┌──────────┐  Name: [Rina                        ] │
│  │          │  Title: [Swashbuckler               ] │
│  │ Portrait │  Organization: [Adventurer's Guild  ] │
│  │          │                                       │
│  │  (drag   │  Player: [Drew Arkena               ] │
│  │  to add) │  Campaign: [Jade Kingdoms           ] │
│  └──────────┘  Created: Apr 26, 2014                │
└──────────────────────────────────────────────────────┘
```

**Section B: Description Panel**
```
┌──────────────────────────────────────────────────────┐
│ Gender: [Female ▼]  Height: [5'7" ]   Hair: [Blond] │
│ Age: [24       ]    Weight: [130lb]   Eyes: [Green] │
│ Birthday: [Jul 9]   Size: [+0    ]    Skin: [Fair ] │
│ Religion: [      ]                    Hand: [Right▼]│
└──────────────────────────────────────────────────────┘
```

**Section C: Primary Attributes**
```
┌─────────────────────────────────────────┐
│ Attribute    Level   Points             │
├─────────────────────────────────────────┤
│ ST           [10]    [0    ]  ±10/level │
│ DX           [14]    [80   ]  ±20/level │
│ IQ           [12]    [40   ]  ±20/level │
│ HT           [11]    [10   ]  ±10/level │
└─────────────────────────────────────────┘
Point costs: ST/HT = 10pts/level, DX/IQ = 20pts/level
```

**Section D: Secondary Characteristics**
```
┌─────────────────────────────────────────────────────┐
│ Characteristic   Base    Modifier   Current  Points │
├─────────────────────────────────────────────────────┤
│ HP               10      [+0]       10       [0   ] │
│ Will             12      [+0]       12       [0   ] │
│ Perception       12      [+0]       12       [0   ] │
│ FP               11      [+0]       11       [0   ] │
├─────────────────────────────────────────────────────┤
│ Basic Speed      6.25    [+0.00]    6.25     [0   ] │
│ Basic Move       6       [+0]       6        [0   ] │
├─────────────────────────────────────────────────────┤
│ Dodge            9       (auto-calculated)          │
│ Parry            —       (weapon-dependent)         │
│ Block            —       (shield-dependent)         │
└─────────────────────────────────────────────────────┘

Calculations:
- HP defaults to ST
- Will defaults to IQ
- Perception defaults to IQ
- FP defaults to HT
- Basic Speed = (HT + DX) / 4
- Basic Move = Basic Speed (drop fractions)
- Dodge = Basic Speed + 3 (drop fractions)
```

**Section E: Skills Table**
```
┌────────────────────────────────────────────────────────────────┐
│ Skill                  Difficulty  RSL    Level  Points  Ref   │
├────────────────────────────────────────────────────────────────┤
│ Acrobatics             DX/H        DX+1   15     [8]     B174  │
│ Broadsword             DX/A        DX+2   16     [8]     B208  │
│ Climbing               DX/A        DX     14     [2]     B183  │
│ Fast-Draw (Sword)      DX/E        DX+1   15     [2]     B194  │
│ Jumping                DX/E        DX     14     [1]     B203  │
│ Stealth                DX/A        DX     14     [2]     B222  │
│ Swimming               HT/E        HT     11     [1]     B224  │
│ Throwing               DX/A        DX-1   13     [1]     B226  │
└────────────────────────────────────────────────────────────────┘

RSL = Relative Skill Level (e.g., DX+2 means 2 above attribute)
Difficulty affects point costs:
- Easy (E): 1/2/4/8 points for +0/+1/+2/+3
- Average (A): 1/2/4/8 points for -1/+0/+1/+2
- Hard (H): 1/2/4/8 points for -2/-1/+0/+1
- Very Hard (VH): 1/2/4/8 points for -3/-2/-1/+0
```

**Section F: Advantages & Disadvantages**
```
┌────────────────────────────────────────────────────────────────┐
│ ADVANTAGES                                                      │
├────────────────────────────────────────────────────────────────┤
│ ✓ Combat Reflexes                              [15]       B43  │
│   +1 to active defenses, +6 vs surprise, never freeze          │
│ ✓ Enhanced Dodge 1                             [15]       B51  │
│   +1 to Dodge                                                  │
│ ✓ Luck                                         [15]       B66  │
│   Reroll bad roll once per hour                                │
├────────────────────────────────────────────────────────────────┤
│ DISADVANTAGES                                                   │
├────────────────────────────────────────────────────────────────┤
│ ✓ Code of Honor (Pirate's)                     [-5]       B127 │
│ ✓ Compulsive Carousing (12)                    [-5]       B128 │
│   Roll 12 or less to resist urge to party                      │
│ ✓ Sense of Duty (Crew)                         [-5]       B153 │
├────────────────────────────────────────────────────────────────┤
│ QUIRKS                                                          │
├────────────────────────────────────────────────────────────────┤
│ • Always keeps word once given                 [-1]            │
│ • Drinks rum exclusively                       [-1]            │
│ • Hums sea shanties when nervous              [-1]            │
└────────────────────────────────────────────────────────────────┘
```

**Section G: Equipment Table**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ✓ │ Qty │ Item                    │ Weight │ Value  │ Location │ Ref    │
├──────────────────────────────────────────────────────────────────────────┤
│ ✓ │  1  │ Saber                   │  2 lb  │  $700  │ Belt     │ B271   │
│ ✓ │  1  │ Main-Gauche             │  1 lb  │  $50   │ Belt     │ B272   │
│ ✓ │  1  │ Flintlock Pistol, 51    │  3 lb  │ $200   │ Holster  │ LT91   │
│ ✓ │  1  │ Leather Armor           │ 10 lb  │ $100   │ Torso    │ B283   │
│ ✓ │  1  │ Leather Boots           │  3 lb  │  $80   │ Feet     │ B284   │
│   │ 20  │ Paper Cartridges        │  1 lb  │  $40   │ Pouch    │ LT91   │
│   │  1  │ Backpack, Small         │  3 lb  │  $60   │ Back     │ B288   │
├──────────────────────────────────────────────────────────────────────────┤
│ Encumbrance: Light (23 lb)  Move: 6  Dodge: 9                            │
│ Total Weight: 23 lb / 50 lb (BL×5)   Total Value: $1,230                 │
└──────────────────────────────────────────────────────────────────────────┘

Encumbrance Levels (based on Basic Lift = ST×ST/5):
- None (0): 0-BL         Move×1, Dodge-0
- Light (1): BL-2×BL     Move×0.8, Dodge-1
- Medium (2): 2×BL-3×BL  Move×0.6, Dodge-2
- Heavy (3): 3×BL-6×BL   Move×0.4, Dodge-3
- X-Heavy (4): 6×BL-10×BL Move×0.2, Dodge-4
```

**Section H: Melee Weapons**
```
┌────────────────────────────────────────────────────────────────────────┐
│ Weapon        │ Usage  │ Level │ Parry │ Block │ Damage        │ Reach │
├────────────────────────────────────────────────────────────────────────┤
│ Saber         │ Swing  │  16   │  12   │  —    │ 2d cut        │  1    │
│               │ Thrust │  16   │  12   │  —    │ 1d+1 imp      │  1    │
│ Main-Gauche   │ Thrust │  14   │  10   │  —    │ 1d-1 imp      │  C    │
│ Punch         │ Thrust │  14   │  —    │  —    │ 1d-2 cr       │  C    │
│ Kick          │ Thrust │  12   │  —    │  —    │ 1d-1 cr       │ C,1   │
└────────────────────────────────────────────────────────────────────────┘

Damage calculation:
- Swing = ST-based (check table) + weapon modifier
- Thrust = ST-based (check table) + weapon modifier
- Parry = (Skill / 2) + 3, modified by weapon
```

**Section I: Ranged Weapons**
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Weapon              │ Level │ Damage    │ Acc │ Range      │ RoF │ Shots │ ST │
├───────────────────────────────────────────────────────────────────────────────┤
│ Flintlock Pistol    │  15   │ 2d pi+    │  1  │ 75/450     │  1  │ 1(20) │  9 │
│ Thrown Knife        │  13   │ 1d-2 imp  │  0  │ ST×0.8/1.5 │  1  │  T    │  6 │
└───────────────────────────────────────────────────────────────────────────────┘

Notes:
- Acc = Accuracy bonus when Aiming
- Range = Half damage / Max range in yards
- RoF = Shots per turn
- Shots = Magazine capacity (reload time)
```

**Section J: Spells Table**
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Spell                │ Class    │ Cast │ Maint │ Duration  │ College       │ SL │ RSL  │ Pts │ Ref  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Light                │ Regular  │  1   │  1    │ 1 min     │ Light         │ 16 │ IQ+1 │  1  │ M110 │
│   Ritual: speak a word or two OR make a small gesture; Cost: -1                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Recover Energy       │ Special  │  0   │  0    │ Special   │ Healing       │ 16 │ IQ+1 │  1  │ M89  │
│   Ritual: speak a word or two OR make a small gesture; Cost: -1                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Explosive Fireball   │ Missile  │ 2-2× │ 1-3   │ Instant   │ Fire          │ 16 │ IQ+1 │  1  │ M75  │
│   Ritual: speak a word or two OR make a small gesture; Cost: -1                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Extinguish Fire      │ Regular  │  3   │  —    │ Permanent │ Fire          │ 16 │ IQ+1 │  1  │ M72  │
│   Ritual: speak a word or two OR make a small gesture; Cost: -1                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Sense Emotion        │ Regular  │  2   │  —    │ Instant   │ Communication │ 16 │ IQ+1 │  1  │ M45  │
│   Ritual: speak a word or two OR make a small gesture; Cost: -1                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Detect Magic         │ Regular  │  2   │  —    │ Instant   │ Knowledge     │ 16 │ IQ+1 │  1  │ M101 │
│   Ritual: speak a word or two OR make a small gesture; Cost: -1                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Deflect Energy       │ Blocking │  1   │  —    │ Instant   │ Fire          │ 16 │ IQ+1 │  1  │ M73  │
│   Ritual: speak a word or two OR make a small gesture                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Armor                │ Regular  │ 2/DR │ Half  │ 1 min     │ Protection    │ 16 │ IQ+1 │  1  │ M167 │
│   Ritual: speak a word or two OR make a small gesture; Cost: -1                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Create Fire          │ Area     │  2   │ Half  │ 1 min     │ Fire          │ 16 │ IQ+1 │  1  │ M72  │
│   Ritual: speak a word or two OR make a small gesture; Cost: -1                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Continual Light      │ Regular  │ 2m,4t│  —    │ 2d days   │ Light         │ 16 │ IQ+1 │  1  │ M110 │
│   Ritual: speak a word or two OR make a small gesture; Cost: -1                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

Spell Classes:
- Regular: Standard spell, roll vs skill to cast
- Missile: Ranged attack spell, uses Innate Attack to hit
- Blocking: Defensive spell, cast as a reaction
- Area: Affects an area, base 2 yards radius
- Special: Unique mechanics (see spell description)

Columns Explained:
- SL: Skill Level (absolute level, e.g., 16)
- RSL: Relative Skill Level (e.g., IQ+1 means 1 above IQ)
- Pts: Character points spent on this spell
- Cast: Energy cost to cast (some scale with effect)
- Maint: Energy cost to maintain per duration period
- Ref: Page reference (M = GURPS Magic)

Spell Difficulty:
- All spells default to IQ/Hard unless noted
- Prerequisite count affects effective difficulty
- Magery adds to all spell skills
```

#### 1.3 Edit Mode Behavior

**View Mode (Default):**
- All fields display as text
- Clean, readable layout
- Click "Edit" button to enter edit mode
- Useful for players during play

**Edit Mode:**
- Fields become editable inputs
- Point costs auto-calculate
- Validation prevents invalid entries
- "Save" commits changes, "Cancel" reverts
- Useful for character creation/advancement

**GM vs Player Permissions:**
- GM can edit any character
- Players can only edit their own characters (when implemented)
- Some fields may be GM-only (hidden disadvantages, secret notes)

#### 1.4 GCS Import Process

```
User clicks "Import"
    → File picker opens
    → User selects .gcs file
    → Parser reads XML
    → Validation checks data integrity
    → Preview shows what will be imported
    → User confirms
    → Character added to campaign
    → Character appears in Party Column
```

**Parsing Challenges:**
- GCS format has evolved over versions
- Some fields are optional
- Custom traits/skills may not match our database
- Equipment may have custom statistics

**Solutions:**
- Support GCS 4.0+ format (most common)
- Gracefully handle missing fields with defaults
- Import custom traits as text notes
- Allow manual correction after import

---

### Phase 2: Layout Restructure

**Why This Phase:**
- Current layout doesn't match the user's vision
- Combat is buried in the rail
- No weather visibility
- Panels can't expand/collapse

#### 2.1 Header Redesign

**Current Header:**
```
┌─────────────────────────────────────────────────────────────┐
│ GURPS Campaign Manager                    [Debug] [GM Lock] │
└─────────────────────────────────────────────────────────────┘
```

**New Header:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌────────────┐                                                           │
│ │  ☀️ Sunny   │  Clear skies, mild temperature         [Adv Day][Adv Slot]│
│ │  72°F      │  Gathering +1, No penalties             Day 3  |  Slot 2  │
│ └────────────┘                                         (Afternoon)       │
│                                               [Debug] [GM Lock] [Import] │
└──────────────────────────────────────────────────────────────────────────┘
```

**Components:**
- `WeatherWidget` - Displays current weather with icon and effects
- `TimeControls` - Advance Day/Slot buttons (moved from PartyToolApp)
- `TimeDisplay` - Day number and slot name

#### 2.2 Flexible Panel System

**Panel States:**
```typescript
type PanelMode = 'normal' | 'expanded' | 'collapsed';

interface LayoutState {
  partyColumn: 'normal' | 'collapsed';
  centerPanel: PanelMode;
  rightPanel: PanelMode;
  modalContent: React.ReactNode | null;
}
```

**Expansion Behaviors:**

1. **Character Sheet Expanded:**
```
┌────────┬─────────────────────────────────────────────────────┬───────┐
│ PARTY  │              CHARACTER SHEET (FULL WIDTH)           │ RAIL  │
│        │                                                     │       │
└────────┴─────────────────────────────────────────────────────┴───────┘
```

2. **Activity Expanded:**
```
┌────────┬─────────────────────────────────────────────────────┬───────┐
│ PARTY  │              COOKING SYSTEM (FULL WIDTH)            │ RAIL  │
│        │              (existing CookingTab)                  │       │
└────────┴─────────────────────────────────────────────────────┴───────┘
```

3. **Modal Overlay:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ [Normal layout dimmed in background]                                  │
│    ┌────────────────────────────────────────────────────────────┐    │
│    │                     ALCHEMY SYSTEM                          │    │
│    │                     (modal overlay)                         │    │
│    │                                                             │    │
│    │                                              [X Close]      │    │
│    └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

#### 2.3 Combat Tile

**Location:** Bottom of the layout, spanning full width below the main panels

**States:**

1. **No Active Combat:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  [🗡️ Start Combat]     No active combat.                            │
└─────────────────────────────────────────────────────────────────────┘
```

2. **Combat Active:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  [⚔️ Return to Combat]  Round 3 | Turn: Rina | 4 participants       │
│                         HP: Rina 8/10, Soren 10/10, Goblin 2/5...   │
└─────────────────────────────────────────────────────────────────────┘
```

**Clicking** opens the full Combat module (replaces right panel or opens modal).

---

### Phase 3: Activities Panel Simplification

**Why This Phase:**
- Current panel is overcomplicated
- Duplicates existing systems
- Contains misplaced features

#### 3.1 New Activities Panel Design

**From:**
```
┌─────────────────────────────────────────────────┐
│ [Active Activity] [Inventories] [Logs] [GM]     │
├─────────────────────────────────────────────────┤
│ Activity Configurator                           │
│ ┌─────────────┐ ┌─────────────┐                │
│ │Activity Skill│ │Primary Worker│               │
│ │[alchemy    ▼]│ │[Rina (10)  ▼]│               │
│ └─────────────┘ └─────────────┘                │
│                                                 │
│ Helpers: [✓] Mira (12)                         │
│                                                 │
│ Equipment Slots:                                │
│ [Rina's Tool: Alembic Kit    ▼]                │
│                                                 │
│ Facility: [Alchemy Corner    ▼]                │
│                                                 │
│ Real-time Modifiers:                           │
│ Skill: +2, Time: -10%, Quality: +1             │
│                                                 │
│ Pre-Resolution Checklist:                       │
│ [!] No tools selected                          │
│                                                 │
│ [GM Override] [Resolve Activity]               │
└─────────────────────────────────────────────────┘
```

**To:**
```
┌─────────────────────────────────────────────────┐
│           ACTIVITIES                            │
├─────────────────────────────────────────────────┤
│                                                 │
│   ┌───────────────┐   ┌───────────────┐        │
│   │               │   │               │        │
│   │   ⚗️ ALCHEMY   │   │   🍳 COOKING  │        │
│   │               │   │               │        │
│   │ Potions &     │   │ Meals &       │        │
│   │ Elixirs       │   │ Rations       │        │
│   └───────────────┘   └───────────────┘        │
│                                                 │
│   ┌───────────────┐   ┌───────────────┐        │
│   │               │   │               │        │
│   │   🔨 CRAFTING │   │   🌿 GATHERING│        │
│   │               │   │               │        │
│   │ Equipment &   │   │ Foraging &    │        │
│   │ Items         │   │ Hunting       │        │
│   └───────────────┘   └───────────────┘        │
│                                                 │
│   Current: Day 3, Afternoon                     │
│   Weather: Sunny (+1 Gathering)                 │
└─────────────────────────────────────────────────┘
```

#### 3.2 Tile Behavior

**On Click:**
1. Check user preference (expand vs modal)
2. If expand: Set rightPanel to 'expanded', load activity component
3. If modal: Set modalContent to activity component

**Each Tile Shows:**
- Icon representing the activity
- Activity name
- Brief description
- Optional: Active project count, in-progress status

#### 3.3 Feature Migration

| Feature | From | To |
|---------|------|-----|
| Inventories tab | PartyToolApp | InventoryTab (add Party Stash) |
| Logs tab | PartyToolApp | ChangelogTab |
| GM Workshop > Tool Templates | PartyToolApp | ManagerTab |
| GM Workshop > Facilities | PartyToolApp | ManagerTab |
| GM Workshop > Time Controls | PartyToolApp | Header |
| Activity Configurator | PartyToolApp | Each activity system handles its own |
| Equipment Reservation | PartyToolApp | Keep ReservationEngine, integrate |

---

### Phase 4: Quick Fixes

These are high-impact, low-effort fixes that improve the application immediately.

#### 4.1 Import Button Fix

**Current Code (`UnifiedShell.tsx:246-251`):**
```tsx
<button type="button" className="...">
  Import
</button>
```

**Fixed Code:**
```tsx
<button
  type="button"
  className="..."
  onClick={() => {
    setActiveModule('manager');
    // Could also set a subview state to go directly to Import/Export
  }}
>
  Import
</button>
```

**Alternative: Direct Import Modal**
```tsx
const [showImportModal, setShowImportModal] = useState(false);

<button
  type="button"
  className="..."
  onClick={() => setShowImportModal(true)}
>
  Import
</button>

{showImportModal && (
  <ImportExportPanel
    onClose={() => setShowImportModal(false)}
    onImport={handleImport}
  />
)}
```

#### 4.2 Manager Module Fix

**Problem:** ManagerTab expects props from legacyAppState which is empty.

**Current (`UnifiedShell.tsx:40`):**
```tsx
const [legacyAppState] = useState<Record<string, unknown>>({});
```

**Solution:** Migrate ManagerTab to use `useCampaignStore()` directly, following the pattern of other tabs.

**Pattern to Follow (from AlchemyTab):**
```tsx
export function ManagerTab() {
  const { state, actions } = useCampaignStore();

  // Extract needed state
  const materials = denormalizeObject(state.entities.materials);
  const workers = Object.values(state.entities.characters).filter(c => c.canWork);
  // ... etc

  // Use state directly in component
  return (
    // ...
  );
}
```

#### 4.3 Changelog Population

**Add logging calls to key operations:**

**activityResolver.ts - After resolving activity:**
```typescript
export function resolveActivity(params) {
  // ... existing resolution logic ...

  // Add log entry
  actions.addLogEntry({
    type: 'activity',
    timestamp: Date.now(),
    visibility: 'public',
    content: `${primaryWorker.name} completed ${skill} activity`,
    details: { outcome, modifiers, helpers }
  });

  return outcome;
}
```

**inventoryManager.ts - After transfer:**
```typescript
export function transferItem(source, target, item, quantity) {
  // ... existing transfer logic ...

  actions.addLogEntry({
    type: 'transfer',
    timestamp: Date.now(),
    visibility: 'public',
    content: `Transferred ${quantity}x ${item.name} from ${source.name} to ${target.name}`
  });
}
```

**timeSystem.ts - After time advance:**
```typescript
export function advanceTimeSlot() {
  // ... existing logic ...

  actions.addLogEntry({
    type: 'time',
    timestamp: Date.now(),
    visibility: 'public',
    content: `Time advanced to ${getSlotName(newSlot)} of Day ${day}`
  });
}
```

#### 4.4 Party Stash in Inventory Module

**Add new tab to InventoryTab:**
```tsx
const [activeTab, setActiveTab] = useState<'materials' | 'foods' | 'stash'>('materials');

// In render:
<div className="tabs">
  <button onClick={() => setActiveTab('materials')}>Raw Materials</button>
  <button onClick={() => setActiveTab('foods')}>Food Supplies</button>
  <button onClick={() => setActiveTab('stash')}>Party Stash</button>
</div>

{activeTab === 'stash' && (
  <PartyStashView
    inventory={state.entities.inventories['party']}
    onTransfer={handleTransfer}
  />
)}
```

---

### Phase 5: Weather System

**Why Weather:**
- Adds environmental context to activities
- Gathering/hunting affected by weather (GURPS rules)
- Travel impacted by conditions
- Adds immersion and tactical decisions

#### 5.1 Weather Types

```typescript
type WeatherType =
  | 'clear'      // Sunny, no clouds
  | 'cloudy'     // Overcast but dry
  | 'rain'       // Wet conditions
  | 'storm'      // Heavy rain, wind, lightning
  | 'snow'       // Cold, snowy
  | 'fog'        // Low visibility
  | 'wind';      // Strong winds

type Intensity = 'light' | 'moderate' | 'heavy';

type Temperature = 'freezing' | 'cold' | 'cool' | 'mild' | 'warm' | 'hot';

interface Weather {
  type: WeatherType;
  intensity: Intensity;
  temperature: Temperature;
  description: string;  // "Light rain, cool"
}
```

#### 5.2 Weather Effects

```typescript
interface WeatherEffects {
  // Skill modifiers
  gatheringMod: number;     // Foraging, fishing, hunting
  travelMod: number;        // Hiking, navigation
  outdoorCraftingMod: number;

  // Vision/hearing
  visionPenalty: number;    // For Perception rolls
  hearingPenalty: number;   // For hearing-based rolls

  // Special conditions
  slipperyGround: boolean;  // DX penalty for movement
  reducedVisibility: boolean; // Range penalties
  coldExposure: boolean;    // FP loss risk
  heatExposure: boolean;    // FP loss risk
}

const WEATHER_EFFECTS: Record<WeatherType, Record<Intensity, WeatherEffects>> = {
  clear: {
    light: { gatheringMod: +1, travelMod: 0, ... },
    moderate: { gatheringMod: +1, travelMod: 0, ... },
    heavy: { gatheringMod: 0, travelMod: 0, ... }  // Harsh sun
  },
  rain: {
    light: { gatheringMod: 0, travelMod: -1, visionPenalty: -1, ... },
    moderate: { gatheringMod: -1, travelMod: -2, visionPenalty: -2, ... },
    heavy: { gatheringMod: -2, travelMod: -4, visionPenalty: -4, slipperyGround: true, ... }
  },
  // ... etc
};
```

#### 5.3 Weather Generation

**Daily Weather Roll:**
```typescript
function generateDailyWeather(previousWeather: Weather, season: Season): Weather {
  // Weather tends to persist with gradual changes
  // Based on GURPS Weather rules or simplified version

  const persistence = 0.6; // 60% chance weather stays similar

  if (Math.random() < persistence) {
    return varyWeather(previousWeather); // Small changes
  } else {
    return generateNewWeather(season); // New weather pattern
  }
}
```

**GM Override:**
```typescript
function setWeather(weather: Weather): void {
  actions.setWeather(weather);
  actions.addLogEntry({
    type: 'weather',
    visibility: 'gm_only',
    content: `GM set weather to: ${weather.description}`
  });
}
```

#### 5.4 Weather Widget UI

```
┌────────────────────────────────────┐
│  ☀️  Clear, Mild                    │
│     Temperature: 72°F              │
│     ───────────────────            │
│     Gathering: +1                  │
│     Travel: Normal                 │
│     No penalties                   │
│                      [🎲 Reroll]   │
│                      [✏️ Set]      │
└────────────────────────────────────┘
```

---

### Phase 6: Character Management

#### 6.1 Add Character Button

**In Party Column:**
```
┌────────────┐
│  [Rina]    │
│  [Soren]   │
│  [Mira]    │
│            │
│  [+ Add]   │  ← Opens character creation
│  [Import]  │  ← Opens GCS import
└────────────┘
```

#### 6.2 Character Creation Options

1. **Blank Character** - Opens character sheet in edit mode with default values
2. **From Template** - Choose from preset character templates (Fighter, Wizard, etc.)
3. **Import GCS** - Load from .gcs file

#### 6.3 Character Context Menu

**Right-click on character in Party Column:**
```
┌──────────────┐
│ View Sheet   │
│ Edit         │
│ ────────────│
│ Duplicate    │
│ Export (.gcs)│
│ ────────────│
│ Delete       │
└──────────────┘
```

---

## Technical Architecture

### Component Hierarchy

```
App.tsx
└── CampaignStoreProvider
    └── UnifiedShell.tsx
        ├── Header
        │   ├── WeatherWidget
        │   ├── TimeControls
        │   └── TimeDisplay
        ├── MainLayout
        │   ├── PartyColumn
        │   │   ├── CharacterCard (×N)
        │   │   ├── AddCharacterButton
        │   │   └── ImportButton
        │   ├── CenterPanel
        │   │   └── CharacterSheet (when character selected)
        │   │       ├── IdentitySection
        │   │       ├── DescriptionSection
        │   │       ├── AttributesSection
        │   │       ├── SecondaryStatsSection
        │   │       ├── SkillsTable
        │   │       ├── SpellsTable
        │   │       ├── TraitsSection
        │   │       ├── EquipmentTable
        │   │       ├── MeleeWeaponsTable
        │   │       └── RangedWeaponsTable
        │   ├── RightPanel
        │   │   └── (varies by active module)
        │   │       ├── ActivitiesPanel (default)
        │   │       ├── InventoryTab
        │   │       ├── ManagerTab
        │   │       └── ...
        │   └── Rail
        │       └── ModuleButton (×6)
        ├── CombatTile
        └── ModalOverlay (when active)
```

### State Shape Additions

```typescript
interface CampaignState {
  // ... existing state ...

  // New weather state
  weather: {
    current: Weather;
    forecast: Weather[];  // Optional: next few days
    history: WeatherLogEntry[];
  };

  // Enhanced character state
  entities: {
    characters: Record<Id, GCSCharacter>;  // Extended type
    // ... existing entities ...
  };

  // UI state additions
  ui: {
    layout: LayoutState;
    characterSheet: {
      editMode: boolean;
      selectedCharacterId: string | null;
    };
  };
}
```

### New Actions

```typescript
// Weather actions
setWeather(weather: Weather): void;
advanceWeather(): void;  // Generate next weather

// Character actions
importCharacter(gcsData: GCSFileData): void;
createCharacter(template?: CharacterTemplate): void;
updateCharacter(id: Id, updates: Partial<GCSCharacter>): void;
deleteCharacter(id: Id): void;
duplicateCharacter(id: Id): void;

// UI actions
setLayoutState(layout: Partial<LayoutState>): void;
setEditMode(enabled: boolean): void;
openModal(content: React.ReactNode): void;
closeModal(): void;
```

---

## Data Models

### GCSCharacter (Full Type)

```typescript
interface GCSCharacter {
  // Identity
  id: Id;
  name: string;
  player?: string;
  portrait?: string;  // Base64 or URL
  title?: string;
  organization?: string;

  // Description
  gender?: string;
  age?: number;
  birthday?: string;
  religion?: string;
  height?: string;
  weight?: string;
  sizeModifier: number;
  skinColor?: string;
  hairColor?: string;
  eyeColor?: string;
  handedness: 'Left' | 'Right' | 'Ambidextrous';

  // Primary Attributes
  ST: number;
  DX: number;
  IQ: number;
  HT: number;

  // Secondary Characteristics
  HP: { max: number; current: number; modifier: number };
  FP: { max: number; current: number; modifier: number };
  Will: { base: number; modifier: number };
  Per: { base: number; modifier: number };
  BasicSpeed: { base: number; modifier: number };
  BasicMove: { base: number; modifier: number };

  // Derived (calculated)
  Dodge: number;

  // Traits
  advantages: Advantage[];
  disadvantages: Disadvantage[];
  perks: Perk[];
  quirks: Quirk[];
  features: Feature[];

  // Skills
  skills: Skill[];
  techniques: Technique[];
  spells: Spell[];

  // Equipment
  equipment: Equipment[];

  // Weapons (derived from equipment, but cached for performance)
  meleeWeapons: MeleeWeapon[];
  rangedWeapons: RangedWeapon[];

  // Point Tracking
  totalPoints: number;
  attributes_points: number;
  advantages_points: number;
  disadvantages_points: number;
  quirks_points: number;
  skills_points: number;
  spells_points: number;
  unspentPoints: number;

  // Notes
  notes: Note[];

  // Campaign-specific
  createdAt: number;
  modifiedAt: number;
}

interface Advantage {
  id: Id;
  name: string;
  specialization?: string;
  basePoints: number;
  pointsPerLevel?: number;
  levels?: number;
  modifiers: TraitModifier[];
  reference: string;  // e.g., "B43"
  notes?: string;
  categories: string[];
}

interface Skill {
  id: Id;
  name: string;
  specialization?: string;
  difficulty: SkillDifficulty;  // "E" | "A" | "H" | "VH"
  attribute: "ST" | "DX" | "IQ" | "HT" | "Will" | "Per";
  points: number;
  level: number;  // Calculated
  relativeLevel: string;  // e.g., "DX+2"
  reference: string;
  defaults: SkillDefault[];
  notes?: string;
}

interface Spell {
  id: Id;
  name: string;
  college: string;           // e.g., "Fire", "Light", "Healing"
  class: SpellClass;         // "Regular" | "Missile" | "Blocking" | "Area" | "Special"
  castingCost: string;       // e.g., "2", "1-3", "2/DR"
  maintenanceCost: string;   // e.g., "1", "Half", "—"
  castingTime: string;       // e.g., "1 sec", "1-3 sec"
  duration: string;          // e.g., "1 min", "Instant", "Permanent"

  // Ritual requirements
  ritual: {
    verbal: boolean;         // Speak words
    somatic: boolean;        // Hand gestures
    description?: string;    // Custom ritual description
  };

  // Skill information
  difficulty: "H" | "VH";    // Spells are always IQ/Hard or IQ/Very Hard
  points: number;
  level: number;             // Calculated skill level
  relativeLevel: string;     // e.g., "IQ+1"

  // Prerequisites
  prerequisites: SpellPrerequisite[];
  prerequisiteCount: number;

  // Reference
  reference: string;         // e.g., "M110" (GURPS Magic page 110)
  notes?: string;

  // Magery requirement
  mageryRequired?: number;   // Minimum Magery level needed
}

type SpellClass = "Regular" | "Missile" | "Blocking" | "Area" | "Special" | "Melee" | "Information" | "Enchantment";

interface SpellPrerequisite {
  type: "spell" | "advantage" | "attribute" | "skill";
  name: string;
  level?: number;            // Required level (for attributes/skills)
}

interface Equipment {
  id: Id;
  description: string;
  quantity: number;
  weight: number;  // per item
  value: number;   // per item
  equipped: boolean;
  location?: string;
  reference?: string;
  notes?: string;

  // Armor properties (if applicable)
  dr?: number;
  locations?: string[];

  // Weapon properties (if applicable)
  weapons?: WeaponProfile[];
}
```

### Weather Types

```typescript
interface Weather {
  type: WeatherType;
  intensity: Intensity;
  temperature: Temperature;
  windSpeed?: number;  // mph
  precipitation?: number;  // inches
  description: string;
}

interface WeatherEffects {
  gatheringMod: number;
  huntingMod: number;
  fishingMod: number;
  travelMod: number;
  outdoorCraftingMod: number;
  visionPenalty: number;
  hearingPenalty: number;
  slipperyGround: boolean;
  reducedVisibility: boolean;
  coldExposure: boolean;
  heatExposure: boolean;
}

interface WeatherLogEntry {
  day: number;
  slot: TimeSlot;
  weather: Weather;
  effects: WeatherEffects;
}
```

---

## User Experience Design

### Interaction Flows

#### Flow 1: Creating a New Character

```
1. User clicks [+ Add] in Party Column
2. Modal appears with options:
   - "Blank Character"
   - "From Template" (shows template picker)
   - "Import from GCS"
3a. If "Blank Character":
    - New character created with defaults
    - Character sheet opens in edit mode
    - User fills in details
    - User clicks "Save"
3b. If "From Template":
    - Template picker shows Fighter, Wizard, Rogue, etc.
    - User selects template
    - Character created with template values
    - Character sheet opens in edit mode for customization
3c. If "Import from GCS":
    - File picker opens
    - User selects .gcs file
    - Preview shows parsed character
    - User confirms import
    - Character added to party
4. New character appears in Party Column
```

#### Flow 2: Starting an Activity (e.g., Cooking)

```
1. User clicks "Cooking" tile in Activities Panel
2. User preference checked:
   - If "Expand": Right panel expands to show full CookingTab
   - If "Modal": Modal overlay appears with CookingTab
3. User interacts with cooking system:
   - Selects recipe
   - Assigns cook (from characters)
   - Selects ingredients from inventory
   - Starts cooking
4. Cooking resolution happens:
   - Skill roll made
   - Result calculated
   - Food added to inventory
   - Log entry created
5. User closes cooking view:
   - If expanded: Panel returns to normal
   - If modal: Modal closes
```

#### Flow 3: Combat Encounter

```
1. User clicks [Start Combat] in Combat Tile
2. Combat setup view appears (or uses existing EncounterSetup)
3. User adds participants:
   - Select from party characters
   - Add enemies from bestiary
4. Combat begins:
   - Initiative rolled
   - Turn order displayed
   - Combat Tile shows active combat status
5. Combat proceeds:
   - Actions resolved
   - Damage applied
   - Conditions tracked
   - History recorded
6. Combat ends:
   - Final status shown
   - Log entries created
   - Loot distributed
7. Return to normal view
```

### Accessibility Considerations

- **Keyboard Navigation:** All interactive elements reachable via Tab
- **Screen Reader Support:** ARIA labels on custom components
- **Color Contrast:** Sufficient contrast for all text
- **Focus Indicators:** Clear visual focus states
- **Responsive Design:** Usable on various screen sizes

---

## Migration Strategy

### Approach: Parallel Development

Rather than modifying existing components, we'll build new components alongside and switch over when ready. This minimizes risk and allows rollback.

### Step-by-Step Migration

#### Step 1: Build Character Sheet (non-breaking)
- Create new `src/components/character-sheet/` directory
- Build all character sheet components
- Test in isolation
- No changes to existing code

#### Step 2: Build New Activities Panel (non-breaking)
- Create new `src/components/activities/` directory
- Build tile-based ActivitiesPanel
- Test in isolation
- No changes to existing code

#### Step 3: Layout Modifications (careful)
- Modify UnifiedShell.tsx to support new layout
- Add feature flag: `USE_NEW_LAYOUT`
- Default to old layout
- Test new layout when flag enabled

#### Step 4: Integration
- Enable new layout by default
- Wire up new components
- Verify all functionality works

#### Step 5: Cleanup
- Remove deprecated PartyToolApp.jsx
- Remove unused code
- Update documentation

### Feature Flags

```typescript
const FEATURE_FLAGS = {
  USE_NEW_CHARACTER_SHEET: true,   // Phase 1
  USE_NEW_LAYOUT: true,            // Phase 2
  USE_NEW_ACTIVITIES_PANEL: true,  // Phase 3
  ENABLE_WEATHER_SYSTEM: true,     // Phase 5
};
```

### Rollback Plan

If issues arise:
1. Disable feature flag for problematic feature
2. Application reverts to old behavior
3. Fix issues in new implementation
4. Re-enable when ready

---

## Risk Analysis

### High Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| GCS import parsing failures | Users can't import characters | Medium | Extensive testing, graceful error handling |
| Layout changes break existing features | Major UX regression | Low | Feature flags, parallel development |
| State shape changes cause data loss | Loss of campaign data | Low | Migration scripts, backup before update |

### Medium Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Weather effects unbalanced | Gameplay affected | Medium | Start with conservative modifiers, iterate |
| Performance degradation | Slow UI | Low | Profile before/after, optimize as needed |
| Scope creep | Delayed completion | High | Strict phase boundaries, defer nice-to-haves |

### Low Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| TypeScript type errors | Build failures | Low | Incremental conversion, CI checks |
| CSS layout issues | Visual bugs | Medium | Browser testing, responsive design |

---

## Appendices

### Appendix A: GCS File Format Reference

GCS uses an XML-based format. Key elements:

```xml
<!-- Root element -->
<character version="4">

  <!-- Character profile -->
  <profile>
    <name>Character Name</name>
    <title>Title</title>
    <!-- ... -->
  </profile>

  <!-- Attributes -->
  <attributes>
    <attribute id="st">
      <adj>0</adj>  <!-- Points spent on adjustment -->
    </attribute>
    <!-- ... -->
  </attributes>

  <!-- Advantages container -->
  <advantages>
    <advantage>
      <name>Advantage Name</name>
      <base_points>15</base_points>
      <reference>B43</reference>
      <!-- Optional modifiers -->
      <modifier>
        <name>Modifier Name</name>
        <cost type="percentage">-10</cost>
      </modifier>
    </advantage>
  </advantages>

  <!-- Skills container -->
  <skills>
    <skill>
      <name>Skill Name</name>
      <specialization>Optional</specialization>
      <difficulty>DX/A</difficulty>
      <points>4</points>
      <reference>B208</reference>
    </skill>
  </skills>

  <!-- Equipment container -->
  <equipment>
    <item>
      <description>Item Name</description>
      <quantity>1</quantity>
      <weight>2 lb</weight>
      <value>100</value>
      <equipped>true</equipped>
    </item>
  </equipment>

</character>
```

### Appendix B: GURPS Skill Difficulty Chart

| Difficulty | Points: 1 | 2 | 4 | 8 | 12 | 16 | 20 | 24 | 28 |
|------------|-----------|---|---|---|----|----|----|----|-----|
| Easy (E)   | Attr+0    | +1| +2| +3| +4 | +5 | +6 | +7 | +8  |
| Average (A)| Attr-1    | +0| +1| +2| +3 | +4 | +5 | +6 | +7  |
| Hard (H)   | Attr-2    | -1| +0| +1| +2 | +3 | +4 | +5 | +6  |
| V.Hard (VH)| Attr-3    | -2| -1| +0| +1 | +2 | +3 | +4 | +5  |

### Appendix C: Weather Effect Guidelines

Based on GURPS environmental rules:

| Condition | Vision | Hearing | Movement | Activities |
|-----------|--------|---------|----------|------------|
| Clear | - | - | - | Gathering +1 |
| Light Rain | -1 | -1 | - | - |
| Heavy Rain | -3 | -2 | Slippery | Gathering -2, Fire-making -4 |
| Fog | -4 to -8 | - | - | Navigation -2 |
| Snow | -1 to -3 | Muffled | Reduced Move | Cold exposure |
| Storm | -4 | -4 | Dangerous | Most outdoor activities -4 |

### Appendix D: File Structure After Refactor

```
src/
├── components/
│   ├── character-sheet/           # NEW - Phase 1
│   │   ├── CharacterSheet.tsx
│   │   ├── GCSImportParser.ts
│   │   └── views/
│   │       ├── IdentitySection.tsx
│   │       ├── DescriptionSection.tsx
│   │       ├── AttributesSection.tsx
│   │       ├── SecondaryStatsSection.tsx
│   │       ├── HitLocationsTable.tsx
│   │       ├── EncumbranceTable.tsx
│   │       ├── LiftingTable.tsx
│   │       ├── MeleeWeaponsTable.tsx
│   │       ├── RangedWeaponsTable.tsx
│   │       ├── TraitsSection.tsx
│   │       ├── SkillsTable.tsx
│   │       ├── SpellsTable.tsx
│   │       └── EquipmentTable.tsx
│   │
│   ├── activities/                # NEW - Phase 3
│   │   ├── ActivitiesPanel.tsx
│   │   └── ActivityTile.tsx
│   │
│   ├── weather/                   # NEW - Phase 5
│   │   ├── WeatherWidget.tsx
│   │   └── WeatherEffectsDisplay.tsx
│   │
│   ├── combat/
│   │   ├── CombatTile.tsx         # NEW - Phase 2
│   │   └── ... (existing)
│   │
│   ├── party-tool/                # DEPRECATED after Phase 3
│   │   └── PartyToolApp.jsx       # To be deleted
│   │
│   └── ... (existing components)
│
├── types/
│   ├── characterSheet.ts          # NEW - Phase 1
│   ├── activities.ts              # NEW - Phase 3
│   ├── weather.ts                 # NEW - Phase 5
│   └── ... (existing)
│
├── utils/
│   ├── gcsParser.ts               # NEW - Phase 1
│   ├── weatherSystem.ts           # NEW - Phase 5
│   └── ... (existing)
│
└── contexts/
    └── PanelLayoutContext.tsx     # NEW - Phase 2
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-27 | Claude Code | Initial document |

---

**End of Document**
