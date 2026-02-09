# Downtime System

The Downtime System manages time-based non-combat activities for party members in the GURPS Party Management Tool. It handles scheduling, validation, resolution, and tracking of activities like fishing, foraging, alchemy, crafting, and rest.

## Architecture Overview

```
src/
├── types/
│   └── downtime.ts           # TypeScript interfaces and type guards
├── state/
│   └── downtime/
│       ├── index.ts          # Public API exports
│       ├── downtimeActions.ts      # Action creators
│       ├── downtimeReducer.ts      # State mutations (Immer)
│       ├── downtimeSelectors.ts    # Query functions
│       ├── downtimeValidation.ts   # Validation rules
│       ├── downtimeErrors.ts       # Error types
│       ├── downtimeInitialState.ts # Initial state
│       └── downtimeMigration.ts    # Legacy format migration
└── components/
    └── downtime/
        ├── DowntimeContext.tsx     # React context provider
        ├── DowntimePanel.tsx       # Main container
        ├── DowntimeTile.tsx        # Activity tile button
        └── views/
            ├── TileGrid.tsx              # Activity selection grid
            ├── TimeAdvancementBlocker.tsx # Advance warning UI
            ├── CharacterStatusBadge.tsx  # Party sidebar badge
            ├── FishingActivity.tsx       # Activity views
            ├── FishingTaskForm.tsx       # Task creation forms
            ├── FishingTaskCard.tsx       # Task display cards
            ├── ForagingActivity.tsx
            ├── ForagingTaskForm.tsx
            ├── ForagingTaskCard.tsx
            ├── AlchemyActivity.tsx
            ├── AlchemyTaskForm.tsx
            ├── AlchemyTaskCard.tsx
            ├── CraftingActivity.tsx
            ├── CraftingTaskForm.tsx
            ├── CraftingTaskCard.tsx
            └── shared/                   # Shared components
                ├── index.ts
                ├── StatusBadge.tsx
                ├── TaskResultsDisplay.tsx
                ├── TaskActions.tsx
                ├── ValidationError.tsx
                ├── CharacterSelector.tsx
                └── ToolSelector.tsx
```

## Core Concepts

### Task Lifecycle

```
┌─────────┐     ┌─────────────┐     ┌──────────┐
│ pending │ ──> │ in_progress │ ──> │ resolved │
└─────────┘     └─────────────┘     └──────────┘
     │                │
     │                │
     v                v
┌───────────────────────┐
│      cancelled        │
└───────────────────────┘
```

- **pending**: Task created but not yet started
- **in_progress**: Task being actively resolved
- **resolved**: Task completed (success or failure)
- **cancelled**: Task cancelled before completion

### Time Model

- Days are divided into numbered **slots** (0, 1, 2, ...)
- Each slot represents a time period for activities
- Time **cannot advance** until all tasks in the current slot are resolved or cancelled
- Characters track **fatigue** across slots within a day

### Validation Rules

The system enforces three core validation rules:

1. **Single Assignment Per Slot**
   - A character can only be assigned to ONE task per slot
   - Cannot be both a leader and a helper in the same slot
   - Cannot be a helper on multiple tasks

2. **Lock-on-Create**
   - Once a character creates a task for (activityType, targetKey) in a slot, they cannot create another
   - Lock **persists through cancellation** to prevent retry spam
   - Different characters CAN target the same resource

3. **Tool Exclusivity**
   - Each tool instance can only be used by one task per slot
   - Cancelled and resolved tasks **free their tools**
   - Pending and in_progress tasks reserve their tools

## Adding New Activities

### 1. Add to Type Union

```typescript
// src/types/downtime.ts
export type DowntimeActivityType =
  | 'fishing'
  | 'foraging'
  | 'alchemy'
  | 'crafting'
  | 'rest'
  | 'your_new_activity';  // Add here
```

### 2. Create Activity Data Interface

```typescript
// src/types/downtime.ts
export interface YourActivityData {
  type: 'your_new_activity';  // Discriminator
  // Activity-specific fields
  targetId: string;
  toolIds: string[];
  skillModifier: number;
}

// Add to union
export type ActivityData =
  | FishingData
  | ForagingData
  // ...
  | YourActivityData;
```

### 3. Add Type Guard

```typescript
// src/types/downtime.ts
export function isYourActivityTask(
  task: DowntimeTask
): task is DowntimeTask & { activityData: YourActivityData } {
  return task.activityData.type === 'your_new_activity';
}
```

### 4. Update Selectors

```typescript
// src/state/downtime/downtimeSelectors.ts

// Update getTargetKeyFromActivityData
case 'your_new_activity':
  return `target:${(activityData as YourActivityData).targetId}`;
```

### 5. Update Validation (if needed)

```typescript
// src/state/downtime/downtimeValidation.ts

// Update getToolIdsFromActivityData
case 'your_new_activity':
  return activityData.toolIds;
```

### 6. Create Components

Create three components in `src/components/downtime/views/`:

```typescript
// YourActivity.tsx - Main activity view
export function YourActivity() {
  // List pending and completed tasks
  // Provide task creation button
}

// YourActivityTaskForm.tsx - Task creation form
export function YourActivityTaskForm({ onSubmit, onCancel }) {
  // Form fields for activity configuration
  // Character selector
  // Tool selector
  // Submit/cancel buttons
}

// YourActivityTaskCard.tsx - Task display card
export function YourActivityTaskCard({ task, onResolve, onCancel }) {
  // Display task details
  // Show status badge
  // Resolve/cancel actions
  // Display results when resolved
}
```

### 7. Add to TileGrid

```typescript
// src/components/downtime/views/TileGrid.tsx
const ACTIVITIES = [
  // ...existing activities
  { type: 'your_new_activity', label: 'Your Activity', icon: SomeIcon },
];
```

### 8. Wire in DowntimePanel

```typescript
// src/components/downtime/DowntimePanel.tsx
case 'your_new_activity':
  return <YourActivity />;
```

### 9. Add Resolution Logic

Implement resolution based on your activity's rules (dice rolls, skill checks, etc.).

## Testing

### Run All Downtime Tests

```bash
npm test -- --grep "downtime"
```

### Test Categories

| Category | Location | Description |
|----------|----------|-------------|
| Unit (State) | `src/state/downtime/__tests__/` | Actions, reducer, selectors, validation |
| Unit (Components) | `src/components/downtime/views/__tests__/` | Individual component tests |
| Integration | `src/__tests__/downtimeIntegration.test.ts` | End-to-end workflows |
| Exploit Prevention | `src/__tests__/downtimeExploitPrevention.test.ts` | Security/gaming tests |

### Key Test Patterns

```typescript
// Create test state helper
function createTestState(tasks: DowntimeTask[]): DowntimeState {
  const tasksById: Record<string, DowntimeTask> = {};
  const taskOrder: string[] = [];
  for (const task of tasks) {
    tasksById[task.id] = task;
    taskOrder.push(task.id);
  }
  return { tasksById, taskOrder, pendingDayLedger: null };
}

// Create task payload helper
function createTaskPayload(overrides?: Partial<CreateTaskPayload>): CreateTaskPayload {
  return {
    activityType: 'fishing',
    dayKey: 1,
    slot: 0,
    leaderId: 'char-1',
    helperIds: [],
    activityData: createFishingData(),
    ...overrides,
  };
}
```

## Error Handling

### Error Codes

| Code | Description | Recovery |
|------|-------------|----------|
| `LEADER_ALREADY_ASSIGNED` | Character already leading/helping a task | Choose different character |
| `HELPER_ALREADY_ASSIGNED` | Helper already assigned to another task | Choose different helper |
| `LOCK_CONFLICT` | Cannot retry same target after cancellation | Choose different target |
| `TOOL_CONFLICT` | Tool reserved by another task | Choose different tool or cancel other task |

### Handling Validation Errors

```typescript
import { DowntimeValidationError, DOWNTIME_ERROR_CODES } from '../state/downtime/downtimeErrors';

try {
  dispatch(createTask(payload));
} catch (error) {
  if (error instanceof DowntimeValidationError) {
    switch (error.code) {
      case DOWNTIME_ERROR_CODES.LEADER_ALREADY_ASSIGNED:
        // Show character already assigned message
        break;
      case DOWNTIME_ERROR_CODES.LOCK_CONFLICT:
        // Show retry blocked message
        break;
      case DOWNTIME_ERROR_CODES.TOOL_CONFLICT:
        // Show tool in use message
        break;
    }
  }
}
```

## Migration

The system includes automatic migration from legacy `dayPlanner` format:

```typescript
import { initializeDowntimeState } from '../state/downtime/downtimeMigration';

// During state initialization
const { state, migrationResult } = initializeDowntimeState(savedState, savedVersion);

if (migrationResult) {
  console.log(`Migrated ${migrationResult.tasksConverted} tasks`);
  if (migrationResult.warnings.length > 0) {
    console.warn('Migration warnings:', migrationResult.warnings);
  }
}
```

## Shared Components

Import shared components for consistent UI:

```typescript
import {
  StatusBadge,
  TaskActions,
  TaskResultsDisplay,
  CancelledMessage,
  ValidationError,
  CharacterSelector,
  MultiCharacterSelector,
  ToolSelector,
} from './views/shared';
```

### Component Reference

| Component | Purpose |
|-----------|---------|
| `StatusBadge` | Display task status with icon |
| `TaskActions` | Resolve/Cancel button pair |
| `TaskResultsDisplay` | Show resolved task results |
| `CancelledMessage` | Show cancelled task message |
| `ValidationError` | Display validation errors |
| `InlineError` | Compact form field error |
| `CharacterSelector` | Single character dropdown |
| `MultiCharacterSelector` | Multi-select for helpers |
| `ToolSelector` | Multi-select for tools |
| `ToolDisplay` | Read-only tool list |

## Performance Considerations

- Selectors are pure functions for memoization compatibility
- Use `selectTasksForSlot` instead of filtering all tasks
- Large task histories should consider pagination
- Tool reservation checks are O(n) where n = tasks in slot

## Accessibility

- All interactive elements have keyboard support
- Status badges include appropriate ARIA labels
- Error messages are announced to screen readers
- Color is not the only indicator of status
