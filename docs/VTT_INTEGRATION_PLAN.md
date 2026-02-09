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
  row: number;
  col: number;
};
facing?: number; // 0-5 for hex, 0-7 for square (defer decision)
```

**Changes to `EncounterSetup`** (`src/components/combat/EncounterSetup.tsx`):
- Optional "Place on Map" step after generating turn order
- If no map linked, combat works as it does today (abstract mode)
- If map linked, participants get initial positions

**Changes to `CombatState`** (`src/types/combatTracker.ts`):
```typescript
// Add to CombatState
mapId?: string;        // Link to a MapModel
mapScale?: number;     // Yards per tile for this combat
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
2. Reachable tiles highlighted (Dijkstra flood-fill within budget — **already exists** as `getReachableTiles()` in `mapRouter.ts`)
3. Player clicks destination tile
4. Path validated and shown (A* — **already exists** as `findRoute()`)
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

**This phase is optional for MVP.** The VTT works without it — the GM just adjudicates cover manually as they do in tabletop play.

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
// src/types/combatTracker.ts — Additions to Participant
interface Participant {
  // ... existing fields ...
  position?: { row: number; col: number };
  facing?: number;
}

// src/types/combatTracker.ts — Additions to CombatState
interface CombatState {
  // ... existing fields ...
  mapId?: string;
  mapScale?: number; // yards per tile
}

// src/types/map.ts — Addition to TileModel
interface TileModel {
  // ... existing fields ...
  elevation?: number;
  isBlocking?: boolean;
}

// src/types/map.ts — Scale unit support
interface MapModel {
  // ... existing fields ...
  scaleUnit?: 'miles' | 'yards';
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

## Open Questions

1. **Hex vs Square grid** — Start square, but should we plan hex data structures now?
2. **Combat map creation** — Separate "New Tactical Map" flow, or reuse existing map creation with a new scale option?
3. **Abstract mode coexistence** — Should every combat require a map, or should abstract (no-map) combat remain as an option?
4. **Multi-hex creatures** — GURPS has size modifiers. Do large creatures occupy multiple tiles? (Defer for MVP)
5. **Vertical space** — Track elevation for flying/climbing? (Data field now, visual later)
6. **Map persistence** — Are tactical maps saved permanently like overland maps, or ephemeral per combat?

---

## Estimated Effort

| Phase | Scope | Estimate | Dependencies |
|-------|-------|----------|-------------|
| A — Position data | Type changes + optional placement UI | Small | None |
| B — Tactical scale | New scale option + combat terrain presets | Medium | None |
| C — Token rendering | New component + MapGrid integration | Medium | A, B |
| D — Movement on grid | Movement flow + pathfinding integration | Medium-Large | A, B, C |
| E — Range modifiers | Range calculation + ActionPanel integration | Small-Medium | A |
| F — Line of sight | LoS algorithm + cover modifiers | Large | A, B, E |

Phases A and B are structural groundwork. C and D are where it starts feeling like a VTT. E is high value for low effort once positions exist. F is the most complex and can ship last or be deferred.
