# GURPS Party Management Tool

**Version 2.5.0**

A comprehensive campaign management tool for GURPS tabletop RPG sessions. Manage your party's characters, combat encounters, inventory, crafting, alchemy, cooking, gathering, and daily activities - all in one place.

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

## Desktop Build

This project now supports a packaged Windows desktop workflow with a custom icon, installer, and shortcut helper.

```bash
# Regenerate icon assets
npm run icon:generate

# Stop the packaged app if it is running
npm run electron:stop

# Build unpacked desktop app
npm run electron:pack

# Build Windows installer
npm run electron:dist

# Create a desktop shortcut to the unpacked build
npm run electron:shortcut
```

Key outputs:

- `release/win-unpacked/GURPS VTT.exe`
- `release/GURPS VTT Setup <version>.exe`

See `docs/guides/DESKTOP_PACKAGING_GUIDE.md` for the full workflow and the packaging lessons learned.

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
