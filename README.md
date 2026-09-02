# GURPS VTT

A virtual tabletop and campaign manager for GURPS. It runs as an Electron desktop app for the GM, embeds its own multiplayer server, and lets players join from a browser on the local network.

Current status lives in [ROADMAP.md](ROADMAP.md). Phases 10 through 14 are complete; Phase 15 (integration and polish) is in progress; Phase 16 (desktop packaging and networking depth) and Phase 17 (battlemap depth and structures) are next.

## Features

### Combat

- Full tactical combat tracker: initiative, maneuvers, hit locations, active defenses, conditions, and injury resolution
- Injury persistence: conditions, crippled limbs, and death carry back to the character after combat
- Consumables usable from inventory mid-fight
- Participants placed on a linked battle map, with a dedicated maneuver rail during combat

### Characters

- Character library with stats, skills, equipment, and point tracking
- GURPS Character Sheet (GCS) import with validation, diff preview, non-destructive updates, and batch party import
- Templates, an NPC generator, and a side-by-side comparison view
- Earned-points economy: awards, a ledger, and a spend cart
- Inventory to sheet equipment bridge

### Map and travel

- Hex map rendered in three.js with a per-tile elevation heightfield and terrain painting
- Imported battlemap images as under or overlay layers, with size-to-grid, snapping, and a Roll20-style 3×3 align tool
- Structure layers, markers, hidden locations with discovery, and cross-map tile portals
- Group and vehicle tokens, per-map climate and weather, and a travel wizard that runs journeys with navigation rolls, drift, and terrain-keyed event tables
- Travel and downtime share one time system

### Downtime and activities

- Crafting, alchemy, cooking, fishing, foraging, and mining, each with material requirements, quality, and hazards
- Activity chaining: results from one activity feed the next
- Rest that resolves into real HP and FP recovery
- Study, social influence with a relationship ledger, and trading

### Inventory

- Party and personal inventories, owner-attributed material holdings, shared pools with take-from-shared
- Attunement state machine and dietary restrictions for cooking

### Multiplayer and GM tools

- Host a session from the desktop app; players join over the LAN from a browser
- JWT-authenticated Socket.IO server with rate limiting and sql.js persistence
- GM mode with player-safe visibility for conditions, hazards, hidden pins, and weather
- Player assignment panel, connection dialog, and role reconciliation between the local toggle and the network role

### Data

- IndexedDB persistence with a localStorage fallback, plus a cross-tab overwrite guard
- Import and export with AES-GCM encryption for locked, player-safe files
- Schema versioning with automatic migrations
- Global undo and redo, keyboard shortcuts (Alt+1 through Alt+7 switch modules, `?` shows the overlay), and notifications

## Tech stack

- React 18 and TypeScript, built with Vite
- three.js for the map renderer
- Immer for reducer updates, Zod for import validation
- Tailwind CSS with a theme token layer
- Socket.IO client and server, Express 5, sql.js, jose
- Electron with electron-builder targets for Windows, macOS, and Linux
- Vitest and Testing Library

## Getting started

Node 22 or newer is required.

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build          # production build
npm test               # vitest in watch mode
npm run test:coverage  # coverage report
npm run lint           # eslint
npm run check:tokens   # theme token allowlist check
```

The multiplayer server has its own package under `server/`:

```bash
cd server && npm install && npm run dev
```

The Electron main process in `electron/` embeds the built server and opens the app on its port. Packaging is configured in `electron-builder.yml` but is not yet wired into npm scripts; that is Phase 16a on the roadmap.

## Project structure

```
src/
├── App.tsx                 # migration check, state load, providers, shell
├── unified/UnifiedShell.tsx# app shell: party column, center pane, module rail
├── components/
│   ├── combat/             # combat tracker, encounter setup, GCS import
│   ├── character-sheet/, character-panels/, character-management/
│   ├── map/                # map panel, editors, travel wizard, three/ renderer
│   ├── downtime/, crafting/, alchemy/, cooking/, gathering/
│   ├── inventory/, location/, manager/, rules/, header/, ui/
│   └── *Tab.tsx            # top-level module tabs
├── state/
│   ├── campaignStore.tsx   # useSyncExternalStore store with undo/redo history
│   ├── campaignReducer.ts  # root reducer delegating to domain slices
│   └── alchemy/ character/ combat/ crafting/ downtime/ gathering/ inventory/ map/ party/ selectors/
├── persistence/            # campaign save/load, revision guard, data migration
├── net/                    # ConnectionManager and SyncProvider (multiplayer client)
├── hooks/                  # data hooks, storage, time advancement, shortcuts
├── utils/                  # engines: combat, alchemy, gathering, journeys, storage, crypto, GCS parser
├── types/                  # domain type modules
└── constants/              # seeds and catalogs
server/src/                 # Express + Socket.IO server: routes, socket, auth, db
shared/                     # wire protocol and session types shared by client and server
electron/                   # desktop main process and preload
```

Modules on the rail, in order: Inventory, Downtime, Combat, Map, Manager, Rules, Changelog.

## Architecture

**State.** A single Redux-style store built on `useSyncExternalStore`, with the root reducer delegating to per-domain sub-reducers under `src/state/`. Immer handles immutable updates. The store keeps a 50-snapshot history for undo and redo.

**Components.** Large features follow the thin-router pattern: a parent handles navigation and coordination, and each view under a `views/` directory is self-contained. See `docs/guides/` for the decomposition guide.

**Persistence.** The whole campaign state is saved as one blob in IndexedDB. A monotonic revision number guards against one tab overwriting another. Hydration migrations run on load, and the schema version is tracked separately from the app version.

**TypeScript.** The `src/` tree is fully TypeScript. The only remaining JavaScript files are legacy tests under `src/utils/__tests__/`.

## Testing

The suite has roughly 280 test files and 4,200 test cases across utilities, reducers, views, and the server.

```bash
npm test              # watch mode
npm run test:ui       # interactive UI
npm run test:coverage # coverage
cd server && npm test # server suite
```

## Documentation

- [ROADMAP.md](ROADMAP.md) is the source of truth for what is shipped, in progress, and parked.
- `docs/` holds per-feature design and plan documents, one per shipped lane.
- `docs/codex-specs/` is the dated implementation spec log.
- `docs/guides/` covers decomposition, schema versioning, performance monitoring, and the stabilization workflow.
- `docs/Archive/` holds superseded documents.

## Development notes

This project is built largely with AI coding agents. Implementation specs go to Codex through the codex-shepherd workflow, and the main session reviews and verifies. The repo carries a graphify knowledge graph (`graphify-out/`, gitignored) for codebase queries; see `CLAUDE.md`.

## License

No license file has been added yet. All rights reserved until one is chosen.
