# Spec: Phase 14 Lane A2 — Groups & vehicles UI: map tokens, group selector, wizard composition, Manager Vehicles view

**Date:** 2026-08-31
**Repo:** GURPS VTT (React 18 + TypeScript strict + Vite, Redux-style state with Immer, Vitest/jsdom)
**Branch:** you are on `codex/lane-a-groups-vehicles`. Commit nothing; leave changes in the working tree.
**Design doc (read for intent):** `docs/MAP_TRAVEL_14_PLAN.md`, decisions D12, D17, D22.
**This is stage 2 of 2.** Stage A1 (spec `2026-08-31-lane-a1-groups-vehicles-state-14.md`) already landed on this branch: `TravelGroup`/`Vehicle`/`VehicleTypeDef` types in `src/types/party.ts`, the `party/` state domain (`src/state/party/`), position helpers in `src/utils/partyPosition.ts`, selectors in `src/state/selectors/partySelectors.ts`, `ui.activeTravelGroupId`, group-aware `map/executeTravel`, and rewritten `validateTravelRoute`. **The A1 spec describes intent; the code on this branch is the authority — read the actual as-built interfaces before using them and follow what exists.**

## Background (why)

A1 made groups and vehicles real in state but left the UI minimally adapted: the map still renders a single party sphere for the active group, there is no way to see or switch groups, no way to compose who travels, and no vehicle management surface. A2 delivers the UI: every group and parked vehicle visible as a map token, an active-group selector, a portrait-drag composition step in the TravelWizard, GM placement for groups AND vehicles, and a Manager Vehicles view.

## Architecture rules (non-negotiable)

- `strict: true` stays clean (`npx tsc --noEmit` → 0 errors). **No new `as any`.** `import type` for types.
- Thin router + views: no business logic in components — composition math, token building, and offset math go in utils/selectors.
- `@dnd-kit/core` + `@dnd-kit/sortable` are already dependencies (see `src/components/combat/views/InitiativeTimeline.tsx` for the established drag pattern). Do not add dependencies; do not run `npm install`.
- Token arrays passed to the 3D scene MUST be memoized — `MapScene` rebuilds the whole world on token array identity change (`MapScene.ts` ~:157-165). Follow `CombatMapPanel.tsx:143-158`.

---

## Part 1 — Map tokens for groups and vehicles

### 1a. Extend `MapToken` (`src/components/map/three/MapScene.ts` ~:47-56)

```ts
export interface MapToken {
  id: string;                    // NEW: stable identity
  tileId: TileId;
  color: string;
  kind?: 'group' | 'vehicle';    // NEW (default 'group' visual)
  image?: string;                // NEW: data-URL portrait/icon → sprite texture
  label?: string;                // NEW: short text fallback (vehicle type icon char or initials)
  dimmed?: boolean;              // NEW: parked/crewless vehicles render at reduced opacity
  isCurrent?: boolean;
  isSelected?: boolean;
}
```

### 1b. Rendering (`buildTokens`, ~:718-753)

- **Per-tile fan-out:** when N tokens share a tile, offset them in a small circle so none coincide. Put the math in `src/utils/mapSceneMath.ts` as a pure function `tokenOffsets(count: number, radius?: number): Array<{dx: number; dz: number}>` (N=1 → [{0,0}]; N>1 → evenly spaced on a circle of radius ~0.22 tile units) and unit-test it.
- **Image tokens:** when `token.image` is set, render a `THREE.Sprite` with a round-cropped `CanvasTexture` (draw the image clipped to a circle with a 2px rim in `token.color`) instead of the plain sphere. Copy the texture pattern from `getMarkerTexture` (~:803-828) and **cache by token id + image reference** in a Map like `imageTextures` (~:107-108) so base64 portraits aren't re-decoded every rebuild; dispose replaced textures.
- **Label fallback:** no image → sphere in `token.color` as today, `kind:'vehicle'` slightly larger and box-ish or with the type icon rendered via a small canvas-texture sprite above it — keep it simple; a sphere + icon sprite is fine.
- `dimmed` → material opacity ~0.45.
- `isCurrent` keeps the white ring (this now marks the ACTIVE group's token).
- **Delete `buildParty()`** (~:695-716), its disposal (~:861-865), and the scene-data `partyTileId` plumbing A1 left in place (`Map3DView` prop `activeGroupTileId` feeding it) — the active group is now just a token with `isCurrent`. Keep `frameParty()` but have it frame the active group's token tile: rename to `frameActive(tileId: TileId | null)` taking the tile from scene data (a `focusTileId` field is fine); update the "Frame party" button in `Map3DView.tsx` (~:139-147) → label/aria "Frame active group".

### 1c. Feeding tokens (`MapPanel.tsx`)

Memoized `tokens: MapToken[]` from `selectGroupsOnMap` + `selectVehiclesOnMap` for the active map:
- Group token: id = group id, color by stable hash of group id from a small palette (put palette + hash in a util), `image` = the FIRST member's `character.images?.token` if present, else `label` = group initials (first letters of name, max 2), `isCurrent` = active group.
- Vehicle token: id = vehicle id, `kind:'vehicle'`, `label`/icon from its `VehicleTypeDef.icon`, `dimmed` = no group aboard it (parked). Docked vehicles are NOT rendered (they're inside the carrier).
- Pass through the existing `tokens` prop of `Map3DView` (CombatMapPanel usage must keep working — it supplies the same extended shape with `id` added; update its memo ~:143-158 to include `id: p.id`).

## Part 2 — Active-group selector + placement flow (`MapHeader.tsx`, `MapPanel.tsx`)

- New selector dropdown in `MapHeader` beside the map selector (props stay dumb: `groups: Array<{id; name; memberCount; vehicleName: string | null; onThisMap: boolean}>`, `activeGroupId`, `onSelectGroup(id)`): each option shows name, member count, "aboard ‹vehicle›" when applicable, and a marker when the group is elsewhere (not on the active map). Selecting dispatches `party/setActiveGroup`.
- The Travel button logic (`hasPartyOnMap`) already keys on the active group per A1 — verify and keep.
- **Placement generalization:** replace the single `isPlacingParty` boolean in `MapPanel` (~:63) with `placing: { kind: 'group'; id: Id } | { kind: 'vehicle'; id: Id } | null`. The GM "Move to Map" button becomes a small popover listing: the active group, plus every vehicle (unplaced ones first, labeled). Choosing one enters placement mode (existing banner, text "Click any tile to place ‹name›"); tile click dispatches `party/placeGroup` or `party/placeVehicle` (+ the existing `mapRevealTiles` for the clicked tile) and exits the mode. MapHeader props adapt accordingly (keep them serializable-dumb; MapPanel owns the state).

## Part 3 — TravelWizard composition step (portrait drag)

Steps renumber to **1 Party → 2 Route → 3 Confirm** (the old Mode step folds into step 1 as the conveyance choice; delete `TravelStep1Mode.tsx` and reuse its `SCALE_TO_MODES` gating logic in the new step).

### New `TravelStep1Party.tsx`

Two drop columns, **Traveling** and **Staying behind**, using `@dnd-kit/core` (`DndContext` + `useDraggable`/`useDroppable`; the InitiativeTimeline shows the house drag style):
- The pool = the active group's members PLUS members of every other group co-located with it (same resolved tile, per `areCoLocated`/position helpers) — chips grouped under subtle headers by source group. A chip = round portrait (`character.images?.token` → `portrait` → initials fallback) + name.
- Initial layout: active group's members in Traveling; co-located others in Staying.
- **Conveyance picker** below the columns: radio list — "On foot" plus every vehicle whose resolved tile equals the active group's tile, each showing type name, mode, minCrew, and a disabled state (with reason) when the vehicle's mode isn't allowed at this map scale. Default: the active group's current vehicle if aboard, else On foot.
- **Everything is STAGED locally in wizard state** — no dispatches while composing, so Cancel/Escape leaves state untouched.

### Applying the staged composition (on final Confirm, before travel)

In the wizard's confirm handler (MapPanel level), realize the staged composition with the minimal action sequence, then travel:
1. Members of OTHER co-located groups dragged into Traveling → `party/moveMembers { memberIds, toGroupId: activeGroup.id }`.
2. Active-group members dragged into Staying → `party/createGroup { name: 'Staying behind', memberIds, fromGroupId: activeGroup.id }` (skip if none; the emptied-source rule in the reducer already guards the last-group case — if the user drags EVERYONE to Staying, disable Next with an inline note "Someone has to travel").
3. Conveyance ≠ current: `party/disembark` and/or `party/boardVehicle` for the active group as needed.
4. `map/executeTravel` with `groupId: activeGroup.id`.

Validation (step 3 Confirm) must run against the **staged** composition: build a staged `TravelGroup` object (active group id + staged traveling memberIds + staged vehicleId) in a pure helper `buildStagedGroup(...)` (unit-test it) and pass that to `validateTravelRoute`/`getRouteStats`, so `INSUFFICIENT_CREW`/`PARTY_INCAPACITATED` reflect what will actually travel.

Route step (`TravelStep2Route`) start tile and reachable/route computation stay keyed on the active group's resolved tile; mode for routing = staged conveyance's mode (vehicle type's mode, else 'foot').

## Part 4 — Manager Vehicles view

`src/components/ManagerTab.tsx`: add `'vehicles'` to the `ManagerView` union (~:35-53), a nav button (~:432-490, pick an unused accent color), import + render branch (~:600-610). New file `src/components/manager/views/VehiclesView.tsx` (pattern: `FacilitiesView.tsx` for CRUD scaffolding, `CharacterTemplatesView.tsx` for builtin badges):

**Section 1 — Vehicle types (catalog):** table of name / mode / speed (mi/slot, "mode default" when unset) / minCrew / hangarSlots / icon, `Built-in` badge, add + inline-edit + delete (confirm dialog; deleting a builtin tombstones it per the A1 reducer). Numeric fields clamp ≥ 0; minCrew ≥ 1.

**Section 2 — Vehicles (instances):** rows with name (editable), type (select from catalog), notes, and a read-only **position readout**: "‹Map name› (r,c)" / "Docked to ‹carrier›" / "Unplaced", plus the names of groups aboard. Row actions:
- **Dock…** — enabled when at least one eligible carrier exists (per the A1 reducer's rules: same resolved tile, carrier has free hangar slots, no nesting); a small select of eligible carriers dispatches `party/dockVehicle`.
- **Undock** — when docked, dispatches `party/undockVehicle`.
- **Delete** — confirm dialog; the A1 reducer cascades occupants.
- Create defaults: first catalog type, position null (Unplaced) — placement happens on the Map tab (Part 2).

`data-testid` attributes on rows and action buttons for tests.

## Part 5 — Tests

Fallout: update `MapViewComponents.test.tsx` (MapHeader props changed, Map3DView prop changes, TravelStep1Mode deleted), any test rendering TravelWizard.

New:
1. `mapSceneMath` — `tokenOffsets` (N=1 centered; N=3 distinct, on-radius, deterministic).
2. `buildStagedGroup` + the composition-apply helper — pure-function tests: no-op composition dispatches nothing; stay-split + pull-in + board compose the right action list in the right order.
3. `TravelStep1Party` RTL — renders pool chips from active + co-located groups; conveyance radio disables scale-incompatible vehicles; "everyone staying" disables Next. (Drag interactions themselves may be exercised via the component's exposed callbacks rather than synthetic pointer events — dnd-kit drag simulation is flaky in jsdom; structure the component so moves go through a testable `onMoveChip(memberId, to)` callback.)
4. `VehiclesView` RTL — lists seeded types with Built-in badge; add/edit/delete type; instance position readout for tile/docked/unplaced; dock button eligibility (mock `useCampaignStore` with `actions` — note `FacilitiesView.test.tsx:1-16` mocks `dispatch`, but the real hook exposes `actions`; mock what the component uses).
5. `MapHeader` — group selector renders groups with member counts and dispatches `onSelectGroup`.
6. MapPanel token memo — groups/vehicles on the active map produce tokens with correct `isCurrent`/`dimmed`/docked-exclusion (a selector-level test is fine if the memo logic lives in a selector/util; put it there).

## Definition of done — self-verify before finishing

```
npx tsc --noEmit                 # 0 errors
npx vitest run                   # full suite green
grep -rn "buildParty\|activeGroupTileId\|isPlacingParty\|TravelStep1Mode" src/   # zero hits
```

At least 20 new tests across the six areas. If something unrelated is red on a clean checkout, note it and leave it.

## Final summary requested

One paragraph: how the staged-composition → action-sequence apply is structured, any deviation from the as-built A1 interfaces you had to accommodate, how token textures are cached/disposed, and anything about the dnd-kit step that future work should know.
