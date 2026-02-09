# Downtime System Overhaul Specification

**Created:** 2026-01-28
**Status:** Draft - Pending Review
**Author:** Claude Code Assistant

---

## Overview

This document specifies a comprehensive overhaul of the existing gathering/activities system into a unified "Downtime" system. The goal is to create a streamlined, intuitive interface for managing all time-based party activities during non-combat gameplay.

### Key Changes Summary

1. **Rename "Activities" to "Downtime"** in the navigation rail
2. **Separate Fishing and Foraging** into distinct downtime activities
3. **Remove redundant UI elements** (Day/Slot display, Workers panel) - already shown elsewhere
4. **Integrate with Party sidebar** - highlight assigned characters in green
5. **Unified task system** - all time-based activities use the same resolution flow
6. **Enforce rest/work rules** - prevent double-work without consequences
7. **Block time advancement** until all tasks are resolved
8. **Add activity locking** - prevent same person working same project twice per slot

---

## Current Architecture

### Existing Components

| Component | Location | Purpose |
|-----------|----------|---------|
| ActivitiesPanel | `src/components/activities/ActivitiesPanel.tsx` | Grid launcher for activity systems |
| DayPlannerTab | `src/components/DayPlannerTab.tsx` | Fishing/Foraging gameplay |
| AlchemyTab | `src/components/AlchemyTab.tsx` | Potion creation |
| CookingTab | `src/components/CookingTab.tsx` | Meal preparation |
| CraftingTab | `src/components/CraftingTab.tsx` | Equipment crafting |

### Current Data Flow

```
ActivitiesPanel (tile grid)
    ↓ Opens modal with activity component
DayPlannerTab / AlchemyTab / CookingTab / CraftingTab
    ↓ Uses useCampaignStore()
state.dayPlanner / state.entities
```

### Current Pain Points

1. **Redundant information** - Day/Slot shown in both banner and gathering panel
2. **Disconnected workers UI** - Separate workers panel when party is visible in sidebar
3. **Inconsistent task flow** - Alchemy/Crafting can be done freely without time constraints
4. **Fishing and Foraging bundled** - Users want separate tiles for each
5. **No prevention of overwork** - Characters can work unlimited times per slot

---

## Proposed Architecture

### New Component Structure

```
DowntimePanel (replaces ActivitiesPanel)
├── FishingTile → FishingActivity (new)
├── ForagingTile → ForagingActivity (new)
├── AlchemyTile → AlchemyActivity (modified)
├── CraftingTile → CraftingActivity (modified)
├── CookingTile → CookingActivity (modified - 1/day limit)
└── RestTile → RestActivity (new - default for unassigned)
```

### State Structure Changes

```typescript
// New: Unified task tracking across all downtime activities
interface DowntimeState {
  // Existing (moved from dayPlanner)
  currentSlot: number;
  timeSlots: TimeSlot[];
  pendingDayLedger: PendingDayLedger | null;

  // New: Unified task system
  tasks: DowntimeTask[];
  characterSlotStatus: Record<CharacterId, SlotStatus>;

  // New: Activity-specific locks
  activityLocks: ActivityLock[];
}

interface DowntimeTask {
  id: Id;
  activityType: DowntimeActivityType;
  dayKey: number;
  slot: number;
  leaderId: CharacterId;
  helperIds: CharacterId[];
  status: 'pending' | 'in_progress' | 'resolved' | 'cancelled';

  // Activity-specific data stored as discriminated union
  activityData: FishingData | ForagingData | AlchemyData | CraftingData | CookingData;

  // Results after resolution
  results?: TaskResults;
}

type DowntimeActivityType =
  | 'fishing'
  | 'foraging'
  | 'alchemy'
  | 'crafting'
  | 'cooking'
  | 'rest';

interface SlotStatus {
  characterId: CharacterId;
  dayKey: number;
  slot: number;
  activity: DowntimeActivityType | null;
  taskId: Id | null;
  workedThisDay: boolean;
}

interface ActivityLock {
  activityType: DowntimeActivityType;
  targetId: Id; // Recipe ID, species ID, etc.
  characterId: CharacterId;
  dayKey: number;
  slot: number;
}
```

---

## Detailed Requirements

### 1. UI Changes

#### 1.1 Rename Activities to Downtime

**Files to modify:**
- `src/components/UnifiedShell.tsx` - Change rail label
- `src/components/activities/ActivitiesPanel.tsx` - Rename to DowntimePanel
- Move files from `src/components/activities/` to `src/components/downtime/`

**Rail Item Change:**
```
Before: Activities (🎯 icon)
After:  Downtime (🌙 icon or similar)
```

#### 1.2 Separate Fishing and Foraging Tiles

Replace single "Gathering" tile with two distinct tiles:

| Tile | Icon | Description | Component |
|------|------|-------------|-----------|
| Fishing | 🎣 | "Fish & Seafood" | FishingActivity |
| Foraging | 🌿 | "Herbs & Materials" | ForagingActivity |

Each activity has its own:
- Skill requirements (Fishing vs Naturalist/Survival)
- Environment options
- Tool loadouts
- Species/item tables

#### 1.3 Remove Redundant UI Elements

**Remove from DayPlannerTab/Activity panels:**
- Day/Slot header bar (already shown in top banner via `state.time`)
- Workers panel (party sidebar serves this purpose)
- Sleep/Advance buttons (handled by main banner)

**Keep in panels:**
- Task list for current slot
- Task detail configuration
- Pending inventory summary

#### 1.4 Party Sidebar Integration

**Requirement:** When a character is assigned to a task in the current slot, their card in the party sidebar should be visually highlighted.

**Implementation approach:**
```typescript
// In PartyColumn or character card component
const { tasks } = useDowntimeStore();
const currentSlotTasks = tasks.filter(t =>
  t.dayKey === currentDay && t.slot === currentSlot
);

const isAssigned = currentSlotTasks.some(task =>
  task.leaderId === character.id || task.helperIds.includes(character.id)
);

// Apply green highlight if assigned
className={isAssigned ? 'border-green-500 bg-green-900/20' : ''}
```

**Visual design:**
- Unassigned: Normal card style (current)
- Assigned: Green border glow, subtle green background tint
- Overworked (needs rest): Yellow/orange warning border
- Exhausted: Red border with warning icon

### 2. Task System Rules

#### 2.1 Helper Restrictions

**Rule:** A character can only help on ONE task per time slot.

```typescript
function canAssignHelper(characterId: CharacterId, slot: number, day: number): boolean {
  const existingAssignments = tasks.filter(t =>
    t.dayKey === day &&
    t.slot === slot &&
    (t.leaderId === characterId || t.helperIds.includes(characterId))
  );
  return existingAssignments.length === 0;
}
```

**UI behavior:**
- Grey out already-assigned characters in helper selection
- Show tooltip: "Already assigned to [Task Name] this slot"

#### 2.2 Work/Rest Cycle

**Rules:**
1. Characters who work in any slot during a day become "tired"
2. Tired characters must rest in a later slot or suffer exhaustion
3. Default action for unassigned characters is Rest
4. Working twice without rest forces exhaustion penalties

**State tracking:**
```typescript
interface CharacterDayStatus {
  characterId: CharacterId;
  dayKey: number;
  slotsWorked: number[];
  slotsRested: number[];
  isExhausted: boolean;
}
```

**Exhaustion effects (out of scope for Phase 1, but noted):**
- -1 to all skill rolls next day
- Stacks if continued
- Cleared after full day of rest

**UI indicators:**
- Fresh: Normal card
- Worked this slot: Green highlight
- Needs rest: Yellow warning in sidebar
- Exhausted: Red warning with debuff indicator

#### 2.3 Resolution Order

**Rule:** Player chooses the order to resolve tasks.

**Implementation:**
- Task list shows all pending tasks for current slot
- Player clicks "Resolve" on any task in any order
- Once resolved, task moves to "Completed" section
- Cannot advance time until all tasks resolved

**UI:**
```
┌─────────────────────────────────────┐
│ Current Slot: Morning               │
├─────────────────────────────────────┤
│ Pending Tasks:                      │
│   [Resolve] Marcus - Fishing        │
│   [Resolve] Elena - Foraging        │
│   [Resolve] Thom - Alchemy          │
├─────────────────────────────────────┤
│ Completed Tasks:                    │
│   ✓ Sarah - Crafting (3 arrows)     │
└─────────────────────────────────────┘
```

#### 2.4 Task Cancellation

**Rule:** Tasks can be cancelled if not yet resolved.

**Implementation:**
- "Cancel" button appears on pending tasks
- Cancelled tasks free up assigned characters
- Cannot cancel resolved tasks
- Confirmation dialog: "Cancel this task? [Character] will be unassigned."

```typescript
function cancelTask(taskId: Id) {
  const task = tasks.find(t => t.id === taskId);
  if (!task || task.status === 'resolved') return;

  // Remove task
  tasks = tasks.filter(t => t.id !== taskId);

  // Update character slot status
  [task.leaderId, ...task.helperIds].forEach(charId => {
    characterSlotStatus[charId] = {
      ...characterSlotStatus[charId],
      activity: null,
      taskId: null
    };
  });
}
```

#### 2.5 Time Advancement Blocking

**Rule:** Cannot advance to next time slot until all tasks are resolved.

**Implementation:**
```typescript
function canAdvanceSlot(currentDay: number, currentSlot: number): CanAdvanceResult {
  const pendingTasks = tasks.filter(t =>
    t.dayKey === currentDay &&
    t.slot === currentSlot &&
    t.status !== 'resolved' &&
    t.status !== 'cancelled'
  );

  if (pendingTasks.length > 0) {
    return {
      canAdvance: false,
      reason: `${pendingTasks.length} task(s) not yet resolved`
    };
  }

  return { canAdvance: true };
}
```

**UI in banner:**
- Advance button disabled when tasks pending
- Tooltip shows: "Resolve 3 pending tasks before advancing"
- Visual indicator of pending task count

### 3. Activity-Specific Rules

#### 3.1 Cooking (1 per Day Limit)

**Rule:** Each character can only cook once per day.

**Implementation:**
```typescript
function canCookToday(characterId: CharacterId, day: number): boolean {
  const cookingTasks = tasks.filter(t =>
    t.dayKey === day &&
    t.activityType === 'cooking' &&
    t.leaderId === characterId &&
    t.status !== 'cancelled'
  );
  return cookingTasks.length === 0;
}
```

**UI behavior:**
- After cooking, character's cooking tile shows "Cooked today ✓"
- Cannot start new cooking task for that character
- Helpers not restricted (can help multiple cooking sessions)

**Future consideration (out of scope):**
- Cooking skill buffs apply to entire party's meals
- Quality affects rest recovery

#### 3.2 Alchemy/Crafting Activity Locks

**Rule:** Same character cannot work on same recipe/project twice in one slot.

**Implementation:**
```typescript
interface ActivityLock {
  activityType: 'alchemy' | 'crafting';
  recipeId: Id;
  characterId: CharacterId;
  dayKey: number;
  slot: number;
}

function isActivityLocked(
  characterId: CharacterId,
  activityType: DowntimeActivityType,
  recipeId: Id,
  day: number,
  slot: number
): boolean {
  return activityLocks.some(lock =>
    lock.characterId === characterId &&
    lock.activityType === activityType &&
    lock.recipeId === recipeId &&
    lock.dayKey === day &&
    lock.slot === slot
  );
}
```

**UI behavior:**
- Completed recipes for this character greyed out for rest of slot
- Tooltip: "Already worked on this project this slot"
- Can work on different recipes
- Different character can work on same recipe

#### 3.3 Fishing and Foraging

Both activities follow the existing DayPlannerTab flow but separated:

**Fishing:**
- Requires Fishing skill
- Uses fishing environments (shore, boat, pier)
- Uses fishing tools (rod, net, spear)
- Bait optional
- Catches fish species

**Foraging:**
- Requires Naturalist or Survival skill
- Uses foraging environments (forest, meadow, mountain)
- Uses foraging tools (basket, knife, guide book)
- No bait
- Finds herbs, materials, items

### 4. Rest Activity

**New activity type for explicitly resting.**

**Purpose:**
- Default state for unassigned characters
- Clears "tired" status
- Can be explicitly assigned

**Implementation:**
```typescript
interface RestData {
  quality: 'basic' | 'comfortable' | 'luxury';
  location: 'camp' | 'inn' | 'wilderness';
}
```

**Automatic rest:**
- Characters not assigned to any task automatically rest
- No explicit task needed for default rest
- System tracks rest status implicitly

**Explicit rest task:**
- Player can assign rest task to guarantee rest
- Useful for ensuring a character rests this slot
- Shows in task list for visibility

---

## Implementation Phases

### Phase 1: Foundation (State Restructuring)

**Goal:** Create unified downtime state without changing UI.

**Tasks:**
1. Create `src/types/downtime.ts` with new type definitions
2. Add `downtime` slice to campaign state
3. Create migration for existing dayPlanner data
4. Add new reducer actions for downtime tasks
5. Create `useDowntimeStore()` convenience hook

**Files to create:**
- `src/types/downtime.ts`
- `src/state/downtimeReducer.ts`
- `src/hooks/useDowntime.ts`

**Files to modify:**
- `src/types/campaign.ts` - Add DowntimeState to CampaignState
- `src/state/campaignReducer.ts` - Import downtime reducer
- `src/state/campaignStore.tsx` - Add downtime actions

### Phase 2: UI Restructuring

**Goal:** Implement new component structure and navigation.

**Tasks:**
1. Rename ActivitiesPanel to DowntimePanel
2. Move files to `src/components/downtime/`
3. Update rail navigation label
4. Split gathering into Fishing/Foraging tiles
5. Remove redundant Day/Slot header from panels

**Files to create:**
- `src/components/downtime/DowntimePanel.tsx`
- `src/components/downtime/DowntimeTile.tsx`
- `src/components/downtime/FishingActivity.tsx`
- `src/components/downtime/ForagingActivity.tsx`

**Files to modify:**
- `src/components/UnifiedShell.tsx` - Update rail
- `src/components/DayPlannerTab.tsx` - Remove header, split logic

**Files to archive:**
- `src/components/activities/` (entire folder)

### Phase 3: Party Integration

**Goal:** Connect downtime tasks to party sidebar visualization.

**Tasks:**
1. Add assignment status to party card component
2. Implement green highlight for assigned characters
3. Add warning states for tired/exhausted
4. Show activity icon on assigned characters

**Files to modify:**
- `src/components/party/CharacterCard.tsx` (or equivalent)
- `src/components/UnifiedShell.tsx` - Pass downtime context

### Phase 4: Task Flow Enforcement

**Goal:** Implement all business rules for tasks.

**Tasks:**
1. Helper restriction (1 per slot)
2. Work/rest cycle tracking
3. Resolution order UI
4. Task cancellation
5. Time advancement blocking
6. Activity-specific locks

**Files to modify:**
- `src/components/downtime/*.tsx` - Add restrictions
- `src/state/downtimeReducer.ts` - Add validation logic
- Banner component - Add advancement blocking

### Phase 5: Activity Migration

**Goal:** Connect existing activities to unified system.

**Tasks:**
1. Modify AlchemyTab to use downtime task system
2. Modify CraftingTab to use downtime task system
3. Modify CookingTab with 1/day limit
4. Add Rest activity
5. Ensure all activities block time advancement

**Files to modify:**
- `src/components/AlchemyTab.tsx`
- `src/components/CraftingTab.tsx`
- `src/components/CookingTab.tsx`

---

## State Migration

### From Current to New

```typescript
// Current state
state.dayPlanner = {
  currentSlot: number;
  timeSlots: TimeSlot[];
  taskAssignments: TaskAssignment[];
  pendingDayLedger: PendingDayLedger | null;
}

// New state (additions)
state.downtime = {
  currentSlot: number;  // Moved from dayPlanner
  tasks: DowntimeTask[];  // Migrated from taskAssignments
  characterSlotStatus: Record<Id, SlotStatus>;
  activityLocks: ActivityLock[];
  pendingLedger: PendingDayLedger | null;  // Moved from dayPlanner
}

// dayPlanner can be deprecated after migration
```

### Migration Function

```typescript
function migrateToDowntimeState(oldState: CampaignState): CampaignState {
  const newTasks: DowntimeTask[] = oldState.dayPlanner.taskAssignments.map(ta => ({
    id: ta.id,
    activityType: ta.mode.toLowerCase() as DowntimeActivityType,
    dayKey: ta.dayKey,
    slot: ta.slot,
    leaderId: ta.leaderWorkerId || '',
    helperIds: ta.helperWorkerIds,
    status: mapTaskStatus(ta.resolutionState),
    activityData: {
      type: ta.mode.toLowerCase(),
      environmentId: ta.environmentId,
      toolIds: ta.selectedToolIds,
      speciesId: ta.targetSpeciesId,
      // ... other mode-specific data
    },
    results: ta.inventoryDelta ? { inventory: ta.inventoryDelta } : undefined
  }));

  return {
    ...oldState,
    downtime: {
      currentSlot: oldState.dayPlanner.currentSlot || 0,
      tasks: newTasks,
      characterSlotStatus: {},
      activityLocks: [],
      pendingLedger: oldState.dayPlanner.pendingDayLedger
    }
  };
}
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing saves | Medium | High | Schema versioning, migration function |
| Performance with many tasks | Low | Medium | Memoization, lazy loading |
| User confusion with new flow | Medium | Medium | Tutorial tooltips, gradual rollout |
| Alchemy/Crafting integration complexity | Medium | Medium | Phase separately, test thoroughly |
| Edge cases in work/rest logic | Medium | Low | Comprehensive unit tests |

---

## Success Criteria

1. ✓ Rail shows "Downtime" instead of "Activities"
2. ✓ Fishing and Foraging are separate tiles
3. ✓ No redundant Day/Slot display in downtime panels
4. ✓ Party sidebar shows green highlight for assigned characters
5. ✓ Characters can only help one task per slot
6. ✓ Working twice without rest triggers exhaustion warning
7. ✓ Cannot advance time with unresolved tasks
8. ✓ Same character cannot work same recipe twice per slot
9. ✓ Cooking limited to once per day per character
10. ✓ Tasks can be cancelled if unresolved
11. ✓ Existing saves migrate cleanly

---

## Open Questions

1. **Exhaustion mechanics:** What are the exact penalties? How long to recover?
2. **Multi-day projects:** Can alchemy/crafting span multiple days?
3. **Party-wide cooking buffs:** What buffs apply? How long do they last?
4. **Environmental restrictions:** Can you fish at night? Forage in rain?
5. **Tool sharing:** Can multiple characters use the same tool in different tasks?
6. **Partial resolution:** What if combat interrupts a slot?

---

## Dependencies

### Existing Systems Used
- `useCampaignStore()` - State management
- `state.time` - Day/slot tracking
- `state.entities.characters` - Party members
- Gathering data entities (species, tools, environments, etc.)

### External Requirements
- Party sidebar component must accept highlight props
- Banner must support advancement blocking UI
- Modal system for activity panels

---

## Related Files Reference

### Core Files
- `src/state/campaignStore.tsx` - Main store
- `src/state/campaignReducer.ts` - State reducer
- `src/types/campaign.ts` - Type definitions
- `src/types/dayplanner.ts` - Current task types

### Activity Components
- `src/components/DayPlannerTab.tsx` - Gathering gameplay
- `src/components/AlchemyTab.tsx` - Alchemy system
- `src/components/CraftingTab.tsx` - Crafting system
- `src/components/CookingTab.tsx` - Cooking system

### UI Components
- `src/components/activities/ActivitiesPanel.tsx` - Current launcher
- `src/components/activities/ActivityTile.tsx` - Tile component
- `src/components/UnifiedShell.tsx` - Main layout with rail

### Utility Functions
- `src/utils/dayPlanner.ts` - Task management utilities
- `src/state/campaignUtils.ts` - Normalize/denormalize helpers

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-28 | Initial draft | Claude Code |

---

## Approval

- [ ] Design review completed
- [ ] User feedback incorporated
- [ ] Ready for Phase 1 implementation
