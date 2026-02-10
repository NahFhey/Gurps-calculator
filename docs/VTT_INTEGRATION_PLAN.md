# VTT Integration Plan: Map + Combat System Merge

**Created:** 2026-02-09
**Status:** Future - Post Next Update
**Priority:** Long-term goal

---

## Overview

Combine the existing Map and Combat systems into a unified Virtual Tabletop (VTT) experience. Players and GMs would see combatants positioned on a tactical grid, move tokens during their turns, calculate range automatically, and resolve actions spatially rather than abstractly.

### Goal

Transform the current abstract combat tracker into a spatial combat system where participants exist on a grid, movement is validated against terrain, and range/positioning affect GURPS mechanics.

---

## Current Architecture

### Map System (Overland Focus)

| Capability | Status | Details |
|-----------|--------|---------|
| Grid rendering | Done | DOM-based, virtualized, zoom 0.25x-3.0x |
| Terrain system | Done | 9 preset + custom types, per-mode passability/speed modifiers |
| A* pathfinding | Done | Distance-aware, terrain cost, diagonal support |
| Reachability flood-fill | Done | Dijkstra within movement budget |
| GM/Player visibility | Done | Revealed tile tracking, vision radius |
| Grid expansion | Done | Auto-expand on edge paint/reveal, stable tile UUIDs |
| Markers | Done | POIs with GM/Player visibility control |
| Cross-map links | Done | Portal system between maps |
| Travel wizard | Done | 3-step route planning with validation |
| Party position | Done | Single party token per map |

**Key Files:**
- Types: `src/types/map.ts`
- Reducer: `src/state/map/mapReducer.ts`
- Grid: `src/components/map/views/MapGrid.tsx`
- Pathfinding: `src/utils/mapRouter.ts`
- Utilities: `src/utils/mapUtils.ts`

**Current Scales:** 12 / 50 / 457 miles per tile (overland only)

### Combat System (Abstract/Non-Spatial)

| Capability | Status | Details |
|-----------|--------|---------|
| Turn order | Done | Basic Speed > DX > Name, manual reorder |
| Maneuver system | Done | 13 GURPS maneuvers with constraints/workflows |
| Action pipeline | Done | Attack > Defense > Damage > Injury > Effects |
| Hit location system | Done | Location-specific DR and wounding multipliers |
| Conditions engine | Done | Duration tracking, stacking rules, expiry |
| Reveal system (Phase 5) | Done | Per-field granular reveal (name, HP, defenses, DR, attacks) |
| GM/Player view filter | Done | Safe player view generation from reveal state |
| Undo/redo history | Done | Snapshot-based combat state history |
| Export/import | Done | JSON with optional GM-lock encryption |
| Items system | Done | Phase 6 consumable/equipment tracking |

**Key Files:**
- Types: `src/types/combatTracker.ts`
- Tracker: `src/components/combat/CombatTracker.tsx`
- Setup: `src/components/combat/EncounterSetup.tsx`
- Helpers: `src/utils/combatHelpers.ts`
- Maneuvers: `src/constants/maneuvers.ts`
- Reveal: `src/utils/combatReveal.js`
- View filter: `src/utils/combatViewFilter.js`

**What combat does NOT have:** Position, facing, range, hex grid, line-of-sight, movement paths.

---

## The Gap

The two systems are fully independent. The map has no concept of individual combatants, and combat has no concept of space. The bridge between them is **spatial data on participants** and a **tactical-scale map**.

### Missing Pieces

| Piece | Needed For | Complexity |
|-------|-----------|------------|
| Position on participants | Everything spatial | Low |
| Tactical map scale (1 yard/hex) | GURPS-accurate movement | Medium |
| Movement validation on grid | Turn-based movement | Medium (pathfinding exists) |
| Range calculation | Ranged attacks, spells | Low (once positions exist) |
| Token rendering on grid | Visual VTT experience | Medium |
| Line-of-sight | Cover, stealth, visibility | High |
| Facing | GURPS side/back attacks | Medium |

---

## Proposed Phases

### Phase A: Position Data on Participants

**Goal:** Add spatial coordinates to combat participants. No visual changes yet.

**Changes to `Participant` type** (`src/types/combatTracker.ts`):
```typescript
// Add to Participant interface
position?: {
  q: number;  // Axial coordinate (hex-compatible from the start)
  r: number;  // Axial coordinate
};
facing?: number;      // 0-5 for hex, 0-7 for square
elevation?: number;   // Height in yards (for flying/climbing)
size?: number;        // GURPS Size Modifier (0 = 1 hex, default)
```

**Changes to `EncounterSetup`** (`src/components/combat/EncounterSetup.tsx`):
- Optional "Place on Map" step after generating turn order
- If no map linked, combat works as it does today (abstract mode)
- If map linked, participants get initial positions

**Changes to `CombatState`** (`src/types/combatTracker.ts`):
```typescript
// Add to CombatState
mapId?: string;            // Link to a MapModel
mapScale?: number;         // Yards per tile for this combat
gridType?: 'square' | 'hex'; // Grid geometry (square for now, hex later)
```

**Migration:** Fully backward-compatible. Existing combats without position data continue to work in abstract mode. No changes to current combat flow.

**Reuse:** None of the existing combat logic changes. Position is additive data.

---

### Phase B: Tactical Map Scale

**Goal:** Support a combat-scale map (1 yard per tile) alongside existing overland scales.

**Changes to map constants** (`src/constants/map.ts`):
- Add tactical scale: `1` (yard per tile) to allowed scales
- Add combat-specific terrain presets: Open, Difficult, Wall/Blocked, Elevation
- Tactical maps don't need travel modes (foot/boat/airship)

**New tactical terrain presets:**

| Terrain | Color | Movement Cost | Blocks LoS | Notes |
|---------|-------|--------------|------------|-------|
| Open | Light gray | 1x | No | Default floor |
| Difficult | Brown | 2x | No | Rubble, undergrowth |
| Wall | Dark gray | Impassable | Yes | Solid barrier |
| Water (shallow) | Light blue | 2x | No | Wading |
| Water (deep) | Blue | Impassable* | No | Swimming rules apply |
| Elevation | Tan | 1x up, 1x down | Partial | Height advantage |
| Door | Brown outline | 1x (if open) | Depends | Toggle open/closed |

**Changes to `MapModel`** (`src/types/map.ts`):
- Tactical maps use the same `MapModel` structure
- `scaleMilesPerTile` becomes `scalePerTile` with a unit indicator, OR add `scaleUnit: 'miles' | 'yards'`
- Grid size for tactical maps: typically 20x20 to 40x40

**Changes to `TileModel`:**
```typescript
// Optional additions for tactical tiles
elevation?: number;     // Height in yards (for 3D combat)
isBlocking?: boolean;   // Shortcut for LoS blocking
```

**Reuse:** Existing `MapGrid`, `MapTile`, terrain palette, and grid expansion all work at any scale. The rendering code doesn't care about the scale value.

---

### Phase C: Token Rendering

**Goal:** Display combat participants as tokens on the tactical map grid.

**New component: `CombatToken`**
- Rendered inside `MapTile` when a participant occupies that tile
- Shows: Character initial/icon, team color border (blue=ally, red=enemy), current HP indicator
- Selected token highlighted (current turn actor)
- GM mode: all tokens visible. Player mode: only revealed enemies visible

**Integration point:** `MapGrid` receives participant positions from combat state and overlays tokens.

**Token interaction:**
- Click token to select participant (opens their info in combat panel)
- Current turn actor's token is visually distinct (glow, larger, pulsing border)
- Dead/unconscious tokens shown with reduced opacity or X overlay

**Reuse:**
- Existing `MapTile` already supports overlays (markers, party position indicator)
- Existing reveal state controls what players see per participant
- Team colors map directly to `participant.category`

---

### Phase D: Movement on Grid

**Goal:** Validate and visualize movement during a combatant's turn.

**Movement budget:**
- `participant.basicMove` = yards per Move maneuver
- Half Move for Attack maneuver, Step (1 yard) for others
- Maneuver catalog (`src/constants/maneuvers.ts`) already defines `allowsMove`, `isFullMove` flags

**Movement flow:**
1. Player selects Move or maneuver that allows movement
2. Reachable tiles highlighted (Dijkstra flood-fill within budget -- **already exists** as `getReachableTiles()` in `mapRouter.ts`)
3. Player clicks destination tile
4. Path validated and shown (A* -- **already exists** as `findRoute()`)
5. Movement confirmed, position updated, remaining move tracked

**Changes to maneuver definitions** (`src/constants/maneuvers.ts`):
```typescript
// Add to each maneuver
movementBudget?: 'full' | 'half' | 'step' | 'none';
// full = basicMove yards
// half = floor(basicMove / 2) yards
// step = 1 yard
// none = no movement allowed
```

**Terrain interaction:**
- Terrain speed modifiers affect movement cost (already in terrain model)
- Impassable terrain blocks movement (already in pathfinding)
- Difficult terrain costs 2 yards per tile of movement

**Reuse:** `findRoute()` and `getReachableTiles()` in `mapRouter.ts` handle all the pathfinding. They just need the budget parameter changed from miles to yards.

---

### Phase E: Range and Modifiers

**Goal:** Auto-calculate range between combatants and apply GURPS range modifiers.

**Range calculation:**
- Distance in yards = grid distance between positions (Chebyshev or Euclidean, TBD)
- GURPS Speed/Range table lookup for modifier

**GURPS Speed/Range Table:**

| Range (yards) | Modifier |
|--------------|----------|
| 2 | 0 |
| 3 | -1 |
| 5 | -2 |
| 7 | -3 |
| 10 | -4 |
| 15 | -5 |
| 20 | -6 |
| 30 | -7 |
| 50 | -8 |
| 70 | -9 |
| 100 | -10 |

**Integration with ActionPanel:**
- When attacker and target both have positions, range modifier auto-calculated
- Added to existing modifier stack in attack workflow
- Displayed as "Range: X yards (-Y)" in modifier list

**Melee range check:**
- Adjacent tiles (1 yard) = melee range
- Non-adjacent = requires ranged weapon or movement first
- Reach weapons: 1-2 yard adjacency check

**Reuse:** ActionPanel already has a modifier stack system. Range would be one more auto-calculated modifier.

---

### Phase F: Line of Sight (Advanced)

**Goal:** Determine visibility and cover between positions.

**Basic LoS:**
- Trace line from attacker tile to target tile
- If any `isBlocking` tile intersects: no LoS
- If partially blocked: cover penalty (-2 or -4 per GURPS)

**Algorithm:** Bresenham line drawing or raycasting on the grid.

**Cover levels:**
- No cover: full LoS, no penalty
- Light cover: partial obstruction, -2 to hit
- Heavy cover: mostly obscured, -4 to hit
- Full cover: no LoS, cannot target

**Integration:**
- LoS affects which targets are valid in attack workflow
- Cover modifier added to ActionPanel modifier stack
- GM can override LoS (for special abilities, magic, etc.)

**This phase is optional for MVP.** The VTT works without it -- the GM just adjudicates cover manually as they do in tabletop play.

---

## Grid Type Decision: Square vs Hex

### Option 1: Keep Square Grid (Recommended for Phase A-D)
- **Pro:** Already built and working
- **Pro:** Simpler rendering, pathfinding already handles 8-directional
- **Pro:** Most digital VTTs use square grids (Roll20, Foundry default)
- **Con:** Diagonal movement distance is imprecise (Chebyshev vs Euclidean)
- **Con:** Not the canonical GURPS grid type

### Option 2: Add Hex Grid Mode
- **Pro:** GURPS-authentic, 6 directions, uniform distance
- **Pro:** Facing maps naturally to 6 hex sides
- **Con:** Requires new rendering logic (CSS hex grid or canvas)
- **Con:** Pathfinding needs hex neighbor calculation
- **Con:** Significant frontend work

### Recommendation
Start with square grid for all phases. The underlying data model (row/col position, distance calculation) works for both. Hex rendering can be added later as a visual mode without changing combat logic. Use the "1-2-1" alternating diagonal cost rule common in square-grid GURPS adaptations.

---

## Data Model Summary

### New/Modified Types

```typescript
// src/types/combatTracker.ts -- Additions to Participant
interface Participant {
  // ... existing fields ...
  position?: {
    q: number;  // Axial coordinate (column in square mode, hex q in hex mode)
    r: number;  // Axial coordinate (row in square mode, hex r in hex mode)
  };
  facing?: number;      // 0-5 for hex, 0-7 for square
  elevation?: number;   // Height in yards (flying, climbing, multi-story)
  size?: number;        // GURPS Size Modifier (0 = 1 hex, 1 = 2 hexes, 2 = 3 hexes, etc.)
}

// src/types/combatTracker.ts -- Additions to CombatState
interface CombatState {
  // ... existing fields ...
  mapId?: string;        // Link to a MapModel
  mapScale?: number;     // Yards per tile for this combat
  gridType?: 'square' | 'hex'; // Grid geometry for this combat
}

// src/types/map.ts -- Addition to TileModel
interface TileModel {
  // ... existing fields ...
  elevation?: number;    // Height in yards
  isBlocking?: boolean;  // Blocks line-of-sight
}

// src/types/map.ts -- Scale unit support
interface MapModel {
  // ... existing fields ...
  scaleUnit?: 'miles' | 'yards';
  gridType?: 'square' | 'hex';
}
```

### New Components (Estimated)

| Component | Phase | Purpose |
|-----------|-------|---------|
| `CombatToken` | C | Render participant on map tile |
| `MovementOverlay` | D | Show reachable tiles and path |
| `RangeIndicator` | E | Show range line and modifier |
| `LoSOverlay` | F | Show line-of-sight and cover |
| `TacticalMapSetup` | B | Create/configure tactical-scale maps |
| `TokenPlacer` | A | Place participants on map during setup |

### Modified Components

| Component | Phase | Change |
|-----------|-------|--------|
| `MapGrid` | C | Accept participant positions, render tokens |
| `MapTile` | C | Support token overlay rendering |
| `EncounterSetup` | A | Optional map linking and placement step |
| `CombatTracker` | D | Movement controls during turns |
| `ActionPanel` | E | Auto-calculated range modifier |
| `ManeuverSelector` | D | Show movement budget for selected maneuver |

---

## Reuse Inventory

These existing systems can be reused directly or with minor adaptation:

| Existing System | Reuse In | Adaptation Needed |
|----------------|----------|-------------------|
| `MapGrid` rendering | Token display | Add token overlay layer |
| `MapTile` component | Combat tile rendering | Add token + highlight support |
| A* pathfinding (`mapRouter.ts`) | Movement validation | Change budget unit from miles to yards |
| Dijkstra flood-fill (`mapRouter.ts`) | Reachable tile highlighting | Same budget unit change |
| Terrain speed modifiers | Combat movement costs | Already works, just different scale |
| GM/Player visibility (`revealedTileIds`) | Combat fog of war | Combine with participant reveal state |
| Reveal state system | Token visibility | Enemies hidden until revealed |
| ActionPanel modifier stack | Range/cover modifiers | Add new auto-calculated modifiers |
| Maneuver constraints | Movement budget rules | Add `movementBudget` field |
| Marker system | Environmental markers in combat | Traps, hazards, objectives |
| Grid expansion | Dynamic tactical maps | Works at any scale |

---

## Non-Goals (Explicitly Deferred)

| Item | Reason |
|------|--------|
| Real-time multiplayer / WebSocket sync | Separate project, massive scope |
| Canvas-based rendering | DOM grid works fine, optimize later if needed |
| 3D elevation rendering | Track elevation data but render flat |
| Automated NPC movement / AI | GM controls all non-player movement |
| Animated token movement | Instant position updates first |
| Custom token artwork | Use initials/icons, art system is separate |
| Mobile/touch support for tactical map | Desktop-first for VTT |

---

## Open Questions (Resolved)

1. **Hex vs Square grid** -- Start square, but plan hex-compatible data structures now. Position data should use axial coordinates (q, r) that work for both square and hex grids. This avoids a painful migration later when hex rendering is added.
2. **Combat map creation** -- Separate "New Tactical Map" flow. Tactical maps are saved permanently and can be reused across multiple combats (e.g., a tavern map used for different encounters).
3. **Abstract mode coexistence** -- Abstract (no-map) combat remains as an option. Linking a map is optional during encounter setup. All existing combat flows continue to work without spatial data.
4. **Multi-hex creatures** -- Yes, large creatures occupy multiple tiles based on GURPS Size Modifier. A `size` field on participants will determine how many tiles they occupy (e.g., SM+1 = 2 hexes, SM+2 = 3 hexes). Implementation deferred past Phase A but data structures should accommodate it.
5. **Vertical space** -- Yes, track elevation for flying/climbing. An `elevation` field (in yards) on both participants and tiles. Visual rendering of elevation is deferred, but the data is present from the start.
6. **Map persistence** -- Tactical maps are saved permanently like overland maps. They appear in the map list and can be loaded, edited, and linked to any combat encounter.

---

## Estimated Effort

| Phase | Scope | Estimate | Dependencies |
|-------|-------|----------|-------------|
| A -- Position data | Type changes + optional placement UI | Small | None |
| B -- Tactical scale | New scale option + combat terrain presets | Medium | None |
| C -- Token rendering | New component + MapGrid integration | Medium | A, B |
| D -- Movement on grid | Movement flow + pathfinding integration | Medium-Large | A, B, C |
| E -- Range modifiers | Range calculation + ActionPanel integration | Small-Medium | A |
| F -- Line of sight | LoS algorithm + cover modifiers | Large | A, B, E |

Phases A and B are structural groundwork. C and D are where it starts feeling like a VTT. E is high value for low effort once positions exist. F is the most complex and can ship last or be deferred.

---

## Completion Log

### Phase A: Position Data -- COMPLETE
- `GridPosition` (q, r) on `Participant`, `mapId`/`mapScale`/`gridType` on `CombatState`
- `facing`, `elevation`, `size` fields on `Participant`
- Fully backward-compatible with abstract combat

### Phase B: Tactical Map Scale -- COMPLETE
- Tactical scale (1 yard/tile) in `MapScaleValue`, `ScaleUnit`, `GridType` types
- 7 tactical terrain presets with `TacticalTerrainProps` (movementCost, blocksLoS, blocksMovement)
- `elevation` and `isBlocking` on `TileModel`; `scaleUnit` and `gridType` on `MapModel`

### Phase C: Token Rendering -- COMPLETE
- `CombatToken` component with team colors, initials, current-turn pulse, dead/unconscious indicators
- `CombatMapPanel` bridge component connecting combat state to MapGrid
- Multi-token quadrant stacking on MapTile
- 50/50 split layout in CombatTracker when map is linked
- Token selection syncs with participant list

### Phase D: Movement on Grid -- COMPLETE
**Implemented:** Turn-based movement with GURPS maneuver budgets, tactical pathfinding, and full undo/redo support.

**Files modified (8 files, 0 new):**
- `src/constants/maneuvers.ts` -- Added `movementBudget` field to all 13 maneuvers + `getMovementBudgetYards()` helper
- `src/types/combatTracker.ts` -- Added `movement` to `TurnDecision` interface
- `src/utils/mapRouter.ts` -- Added `findTacticalRoute()` and `getTacticalReachableTiles()` using terrain.tactical costs
- `src/utils/combatActions.js` -- Added `MOVE_PARTICIPANT` action type and creator
- `src/utils/combatReducer.js` -- Added `applyMoveParticipant()` for forward and inverse
- `src/utils/combatHelpers.ts` -- Added `createMovementLogEntry()`
- `src/components/combat/CombatMapPanel.tsx` -- Added movement interaction (reachable tiles, path preview, click-to-move)
- `src/components/combat/CombatTracker.tsx` -- Added `handleMoveTo`, `handleGmPlaceToken`, movement budget display, maneuver-change position revert

**Movement budget per maneuver:**
| Budget | Maneuvers |
|--------|-----------|
| Full (basicMove) | Move |
| Step (1 yard) | Attack, All-Out Attack (both), All-Out Defense (both), Aim, Evaluate, Feint, Ready, Concentrate |
| None (0) | Do Nothing, Change Posture, Wait |

**Key behaviors:**
- Reachable tiles shown as green rings when maneuver allows movement
- Path preview (blue rings) on hover over reachable tile
- Cost tooltip shows yards consumed
- Position reverts if player changes maneuver after moving
- GM can place any selected token on any tile (ignores budget)
- Occupied tiles (non-dead combatants) blocked as movement endpoints
- Full undo/redo via MOVE_PARTICIPANT action
- Movement logged to combat log

### Phase E: Range and Modifiers -- COMPLETE
**Implemented:** Auto-calculated range between combatants with GURPS Speed/Range table modifiers injected into the attack workflow.

**Files modified (4 existing + 1 new):**
- `src/utils/rangeUtils.ts` -- **NEW** Grid distance (Chebyshev for square, axial for hex), GURPS Speed/Range table lookup (B550), `rangeModifierLabel()`, `isAdjacentPosition()`
- `src/utils/combatViewFilter.js` -- Added `position`, `size`, `elevation`, `facing` to Player view `filterParticipant()` output (spatial data is non-secret)
- `src/components/combat/AttackAssist.tsx` -- Extended `Target` with position/size, extended props with `actorPosition`/`gridType`, added range + SM auto-modifier injection as locked modifiers, added range display UI
- `src/components/combat/ActionPanel.tsx` -- Extended `Participant` interface with position/size, added `gridType` prop, pipes position data and gridType to AttackAssist
- `src/components/combat/CombatTracker.tsx` -- Passes `combat.gridType` to ActionPanel

**GURPS Speed/Range Table (B550):**
| Range (yards) | Modifier |
|---------------|----------|
| ≤2 | 0 |
| 3 | -1 |
| 5 | -2 |
| 7 | -3 |
| 10 | -4 |
| 15 | -5 |
| 20 | -6 |
| 30 | -7 |
| 50 | -8 |
| 70 | -9 |
| 100 | -10 |
| (extended to 5000 yds / -20) | |

**Key behaviors:**
- Range auto-calculates when both attacker and target have grid positions
- Range modifier appears as a locked (non-removable) modifier in the attack modifier stack
- Target Size Modifier (SM) also auto-injected when non-zero
- "Melee range" indicator shown for adjacent targets (≤1 yard, no penalty)
- No range display or modifiers in abstract (non-map) combat
- Player view now preserves position data through the view filter
- All modifiers flow into `calculateEffective()` and appear in logged `AttackData.injectedModifiers`

### Phase F: Line of Sight -- COMPLETE
**Implemented:** LoS calculation between grid positions with Bresenham line tracing, cover modifiers injected into the attack workflow, and visual LoS overlay on the tactical map.

**Files modified (7 existing + 1 new):**
- `src/utils/losUtils.ts` -- **NEW** Supercover Bresenham line algorithm, `getLineOfSight()` with blocking/cover analysis, `getLoSForTargets()` batch computation, `coverModifierLabel()` helper
- `src/components/combat/AttackAssist.tsx` -- Added `map` prop, LoS/cover auto-calculation via `useMemo`, cover modifier injection into locked modifiers, LoS indicator in target dropdown, cover/LoS status display UI
- `src/components/combat/ActionPanel.tsx` -- Added `map` prop passthrough to AttackAssist
- `src/components/combat/CombatTracker.tsx` -- Extracted shared `linkedMap` reference, passes `map` to ActionPanel, computes LoS overlay tile IDs via `useMemo`, passes `losTileIds` to CombatMapPanel
- `src/components/combat/CombatMapPanel.tsx` -- Added `losTileIds` prop, forwards to MapGrid
- `src/components/map/views/MapGrid.tsx` -- Added `losTileIds` prop with `losSet` memo, passes `isLoSHighlight` to MapTile
- `src/components/map/views/MapTile.tsx` -- Added `isLoSHighlight` prop, renders red ring overlay for LoS line tiles
- `src/constants/map.ts` -- Added `tactical-barricade` terrain preset (heavy cover -4, blocks movement, doesn't block LoS)

**Cover levels (GURPS):**
| Level | Modifier | Condition |
|-------|----------|-----------|
| None | 0 | Clear line of sight |
| Light | -2 | Partial obstruction (e.g., elevation terrain) |
| Heavy | -4 | Mostly obscured (e.g., barricade) |
| Full | blocked | No line of sight (e.g., wall) |

**Key behaviors:**
- LoS auto-calculated when both attacker and target have grid positions
- Cover modifier appears as a locked (non-removable) modifier in the attack modifier stack
- Target dropdown shows "(No LoS)" indicator for targets behind walls
- Red ring overlay on map tiles shows the LoS line between current actor and selected participant
- Same-tile and adjacent-tile combatants always have clear LoS
- Terrain `blocksLoS` and tile `isBlocking` both checked along the line
- Worst cover level along the path determines the modifier
- GM override: targets behind cover remain selectable (GM adjudicates)
- No LoS calculations in abstract (non-map) combat
