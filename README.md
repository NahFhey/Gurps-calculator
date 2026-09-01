# GURPS Party Management Tool — `auto-dev` worktree

> **Retired checkout. Do not work here.**
>
> This is not a separate project. It is a git worktree of
> [`gurps-calculator`](../gurps-calculator), checked out on branch `auto-dev`, and it has been
> frozen since **2026-08-03** (`06bc86f`). Its work queue is drained and its review loop is
> switched off. Open the main `gurps-calculator` checkout instead; that is where the live
> branch and the live queue are.

## What this checkout is

It was the working tree for the project's autonomous development loop — kept as a separate
worktree so the loop could commit to `auto-dev` without touching whatever branch the main
checkout had open.

- **`gurps-vtt-auto-dev`** (scheduled, every 4 hours) drained `AUTO_QUEUE.md` top-to-bottom:
  one item per run, one commit max, never pushed. Items were scoped to need no new
  dependencies, no design decisions, and no human judgement.
- **`gurps-vtt-auto-review`** (scheduled, 10pm daily) graded those `auto-dev:` commits into
  `AUTO_REVIEW.md` on test depth, type discipline, deferral honesty, and scope discipline,
  with suppressions tracked in `KNOWN_ISSUES.md`.

Both are done. `AUTO_QUEUE.md` holds **0 open items and 153 completed**, and its header records
that this copy went stale around 2026-07-25: the live queue moved to the main checkout, where
the 21 items still open here were finished by hand and verified item-by-item on 2026-08-02. The
`[x]` marks on those 21 are a bookkeeping reconciliation, **not** a run record — re-enabling the
loop against this file would hand it 21 already-implemented items. `.review-state.json` reads
`{"consecutiveEmptyRuns": 12, "retired": true}`.

## How this differs from `gurps-calculator`

Same repository, older tree. Every difference below is a fact about the checkout, not about the
application:

- **Branch.** This worktree is on `auto-dev` at `06bc86f` (2026-08-03). The main checkout has
  moved on and is several branches further along.
- **No unique source.** There is no top-level file or directory here that the main checkout
  lacks. The parent additionally carries `data/`, `public/`, `scripts/`, `graphify-out/`,
  `SPEC-map-three.md`, `gurps-vtt-resume.skill` and `CODEX_PROVENANCE.jsonl`.
- **`package.json` is identical** to the parent's, version and all — it was never forked apart,
  so the version number below is not evidence of what this tree contains.
- **The loop's own files** (`AUTO_QUEUE.md`, `AUTO_REVIEW.md`, `.review-state.json`) exist in
  both, but the parent's copies are the live ones. The copies here are the retired originals.

If you are reading this because two READMEs were flagged as identical: that is now fixed. This
file used to be a byte-for-byte copy of the parent's, so it described the main checkout under
this worktree's name.

---

## About the application

Everything below describes the GURPS Party Management Tool itself, which this worktree shares
with the main checkout. It is kept here because it is accurate about the application, but read
it against the main checkout — this tree is a month behind.

**Version 2.5.0**

A comprehensive campaign management tool for GURPS tabletop RPG sessions. Manage your party's
characters, combat encounters, inventory, crafting, alchemy, cooking, gathering, and daily
activities - all in one place.

## Features

### Core Systems

- **Combat Tracker** - Full tactical combat management with initiative, maneuvers, hit locations, conditions, and injury resolution
- **Character Library** - Create and manage characters with stats, skills, equipment, and work assignments
- **Party Integration** - Characters seamlessly flow between combat and activity systems
- **Day Planner** - Schedule daily activities with time slots, task assignments, and resource tracking

### Activity Systems

- **Crafting** - Multi-phase projects (Setup → Design → Craft) with material requirements and quality levels
- **Alchemy** - Reagent management, formula design, batch brewing with aspect-based mechanics and hazard systems
- **Cooking** - Recipe creation with ingredient substitution and difficulty calculation
- **Gathering** - Fishing and foraging with species tracking, skill calculations, and yield generation

### Management Tools

- **Inventory System** - Track party and personal inventories with categorized materials and equipment
- **Configuration Manager** - Customize food types, material types, workers, templates, and alchemy settings
- **Rules Reference** - Built-in GURPS rules quick reference

### Data & Security

- **GM/Player Mode** - Password-protected content separation for safe player access
- **Import/Export** - Save and share game state with optional AES-GCM encryption
- **Schema Versioning** - Automatic data migration with backup and recovery
- **Local Storage** - Persistent data with automatic saves

## Tech Stack

- **React 18** + **TypeScript** - Type-safe UI components
- **Vite** - Fast build tooling
- **Tailwind CSS** - Utility-first styling
- **Immer** - Immutable state management
- **Lucide React** - Icon library
- **Vitest** - Testing framework

## Project Structure

```
src/
├── App.tsx                      # Application entry point
├── types/                       # TypeScript type definitions
│   ├── campaign.ts              # Core campaign types
│   ├── combatTracker.ts         # Combat system types
│   ├── gathering.ts             # Gathering system types
│   └── ...
├── components/
│   ├── combat/                  # Combat system (23 components)
│   │   ├── CombatTracker.tsx    # Main combat interface
│   │   ├── CharacterLibrary.tsx # Character management
│   │   ├── ActionPanel.tsx      # Combat actions
│   │   └── views/               # Extracted view components
│   ├── manager/                 # Configuration management
│   │   └── views/               # 12 manager view components
│   ├── gathering/               # Gathering system
│   │   └── views/               # 7 gathering view components
│   ├── dayplanner/              # Day planning system
│   │   └── views/               # 5 day planner view components
│   ├── alchemy/                 # Alchemy subsystem
│   ├── AlchemyTab.tsx           # Alchemy interface
│   ├── CombatTab.tsx            # Combat interface
│   ├── CookingTab.tsx           # Cooking interface
│   ├── CraftingTab.tsx          # Crafting interface
│   ├── InventoryTab.tsx         # Inventory interface
│   ├── GatheringTab.jsx         # Gathering interface
│   ├── DayPlannerTab.tsx        # Day planner interface
│   ├── ManagerTab.tsx           # Configuration interface
│   └── RulesTab.tsx             # Rules reference
├── state/
│   ├── campaignStore.js         # Redux-style store
│   └── campaignReducer.ts       # State reducer with Immer
├── utils/                       # Utility functions
│   ├── combat*.js               # Combat utilities
│   ├── alchemy.js               # Alchemy calculations
│   ├── gathering.js             # Gathering mechanics
│   └── ...
├── hooks/                       # Custom React hooks
└── contexts/                    # React contexts (legacy)
```

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Architecture

### State Management

The application uses a Redux-style store pattern with Immer for immutable updates:

```
CampaignStore
├── entities/           # Normalized data (characters, inventory, materials, etc.)
├── collections/        # Array data (food types, material types, reagents, etc.)
└── checkpoints/        # Save points and history
```

### Component Pattern

Large components follow the "thin router" decomposition pattern:
- Parent component handles navigation and state coordination
- Child view components handle specific UI sections
- Each view is self-contained and testable (50-500 lines)

### TypeScript Coverage

- **146 TypeScript files** (.tsx/.ts)
- **25 legacy JavaScript files** (.jsx) - remaining for migration
- Full type safety for combat, manager, gathering, and day planner systems

## Testing

```bash
npm test              # Run tests in watch mode
npm run test:ui       # Interactive test UI
npm run test:coverage # Generate coverage report
```

**Test Coverage:**
- 300+ unit tests
- Utility function tests (helpers, alchemy, gathering, combat)
- View component tests
- State reducer tests

## Documentation

Additional documentation is available in the `docs/` folder:

- `docs/guides/` - Reference guides for performance monitoring, schema versioning, and decomposition patterns
- `docs/Archive/` - Historical development documentation

## License

MIT
