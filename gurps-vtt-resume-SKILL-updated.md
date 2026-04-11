---
name: gurps-vtt-resume
description: "Onboard and orient to the GURPS VTT desktop app project before doing any work. Use this skill whenever the user mentions the GURPS VTT, VTT app, party tool, party management tool, campaign manager, combat tracker app, or wants to continue work on the VTT project. Also trigger when the user says things like 'let's work on the VTT', 'pick up where we left off on the app', 'continue on the project', 'resume work on the VTT', 'what's next for the VTT', or references any of the VTT's systems (combat, downtime, crafting, alchemy, gathering, inventory, map). This skill MUST be consulted before writing any code in the GURPS VTT codebase."
---

# GURPS VTT — Project Resume

You are picking up work on Devin's GURPS Party Management Tool (v2.5.0), a comprehensive campaign management desktop app for GURPS tabletop RPG sessions. This skill gets you oriented before you touch anything — the codebase is large (~330 files, ~210 components) and has strong architectural conventions that are easy to violate if you dive in blind.

## Step 1: Read the roadmap

The roadmap is the authoritative source for what's been done, what's in progress, and what comes next:

```
ROADMAP.md
```

Pay close attention to:
- **Phase 10** (current) — stabilization, TS error cleanup, defensive JSON handling, memory leak fixes, test expansion
- **Phase 10.5** — server security (auth, authorization, rate limiting) — must happen before multiplayer ships
- **Phase 11+** — feature phases (combat enhancement, character depth, downtime polish, map system, integration)

The roadmap was hardened by an adversarial review (2026-04-05), so the phases reflect real priorities, not aspirational ones.

## Step 2: Check git status and COMMIT UNCOMMITTED WORK IMMEDIATELY

```bash
cd <project-root> && git status && git log --oneline -10
```

Look for:
- What branch you're on and whether there are uncommitted changes
- What was worked on most recently — this tells you where the user's head is at
- Whether there are any work-in-progress commits that need finishing

**CRITICAL — COMMIT BEFORE ANYTHING ELSE:**

If `git status` shows modified or staged files, **commit them now** before doing any other git operations. This is non-negotiable. Here's why:

1. The Cowork VM mounts the project directory from the user's computer. The mounted filesystem can corrupt the git index (error: `bad signature 0x00000000`) during multi-step git operations.
2. If the index corrupts and you attempt recovery with `git reset`, `git read-tree`, or `git checkout HEAD -- .`, **all uncommitted working tree changes will be destroyed**. There is no undo — the changes are written directly to the user's disk.
3. A checkpoint commit costs nothing and can always be reorganized later. Lost working tree changes are gone forever.

**How to commit:**
- Ask the user: "I see uncommitted changes. Want me to commit them as a checkpoint before we start?"
- If yes, group changes into 1-3 themed commits or a single checkpoint commit.
- If the git index corrupts during staging, use `GIT_INDEX_FILE=/tmp/git-index-temp` as a workaround — the local filesystem doesn't have the corruption issue. Then copy back: `rm -f .git/index && cp /tmp/git-index-temp .git/index`.

**What NEVER to do on a dirty working tree:**
- `git checkout HEAD -- .` (overwrites all tracked file modifications)
- `git reset --hard` (same)
- `rm -f .git/index && git read-tree HEAD` followed by `git checkout` (same)

Only proceed to Step 3 after the working tree is clean (committed or confirmed no changes).

## Step 3: Check the build

```bash
npx tsc --noEmit 2>&1 | tail -5
```

This tells you whether the TypeScript compiler is happy. As of the last known state, `tsc` passes clean with `strict: true` enabled, but there are still ~203 `as any` casts scattered around (mostly in tests and non-critical views).

Then check the Vite build:

```bash
npx vite build 2>&1 | tail -10
```

Bundle target is ~624KB. If it's significantly larger, something may have regressed.

## Step 4: Check auto-memory

Read the project memories for current state and known issues:

```
.auto-memory/project_gurps_vtt.md
.auto-memory/project_test_memory_limits.md
```

The test memory limit note is especially important: the full Vitest suite OOMs in the Cowork VM. Run tests individually with:

```bash
NODE_OPTIONS="--max-old-space-size=256" npx vitest run src/path/to/test.ts
```

Also check any feedback memories — they capture conventions Devin has established.

## Step 5: Ask the user what's next

Now that you're oriented, ask the user where they want to focus. Don't assume. The roadmap has a phased plan, but the user may want to jump to a specific issue, fix a particular bug, or work on something off-roadmap.

---

## Architecture Overview

Understanding this architecture prevents you from creating patterns that fight the existing design.

### Tech Stack
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS
- **State:** Redux-style CampaignStore with Immer (normalized entities)
- **Backend:** Express + Socket.io (multiplayer sync), SQL.js (persistence)
- **Desktop:** Electron (packaging only — no Electron-specific logic in the app)
- **Testing:** Vitest + React Testing Library

### State Management

All application state flows through a single `CampaignStore` with Immer-based immutable updates:

```
CampaignStore
├── entities/        (normalized: characters, inventory, materials, crafts, workers, etc.)
├── collections/     (arrays: foodTypes, materialTypes, alchemyReagents, etc.)
└── checkpoints/     (save/restore points)
```

Access state via `useCampaignStore()` — never through legacy bridge contexts. The bridge contexts (`src/contexts/`) are dead code candidates except `CombatContext`, which is still used by a couple of combat sub-components.

### Component Architecture

The app follows a **thin router + view component** pattern. Major tabs were once god components (1,000-2,600 lines each) and have been decomposed into:

1. **Thin router** — the tab component itself, now just a switch/router that picks which view to render
2. **View components** — self-contained, testable, each under ~500 lines

```
src/components/
├── manager/views/       (12 views — settings, templates, reagents, etc.)
├── gathering/views/     (7 views — species, items, tools, environments, etc.)
├── dayplanner/views/    (5 views — header, workers, tasks, summary, detail)
├── combat/views/        (5 views — header, turn controls, dice, participants, log)
├── rules/views/         (2 views + data file)
├── combat/              (CombatTracker + 16 sub-components)
├── map/                 (MapPanel, MapGrid, TerrainEditor, TravelWizard — 25 files)
├── character-management/ (character CRUD, context menus)
├── character-panels/    (stat display panels)
├── character-sheet/     (full character sheet)
├── alchemy/             (alchemy sub-components, still .jsx)
├── crafting/            (crafting tab)
├── downtime/            (downtime scheduling)
├── location/            (LocationManager — 1,091 lines, decomposition candidate)
├── header/              (app header)
└── ui/                  (shared UI primitives)
```

### State Slices

Domain logic is organized by feature in `src/state/`:

```
src/state/
├── campaignStore.js     (main store)
├── campaignReducer.ts   (root reducer)
├── alchemy/             (alchemy state logic)
├── character/           (character state logic)
├── combat/              (combat state logic)
├── crafting/            (crafting state logic)
├── downtime/            (downtime state logic)
├── gathering/           (gathering state logic)
├── inventory/           (inventory state logic)
├── map/                 (map state logic)
└── selectors/           (derived state selectors)
```

### Server

The multiplayer server lives in `server/` with its own `package.json`:

```
server/src/
├── index.ts      (Express + Socket.io server entry)
├── routes.ts     (REST API routes)
├── socket.ts     (Socket.io event handlers)
└── db.ts         (SQL.js database operations)
```

Currently has **zero authentication** — Phase 10.5 addresses this. Don't ship multiplayer features without auth.

---

## Development Conventions

### Pattern: Thin Router + Views

When working on any tab component, follow the established decomposition pattern:
1. The tab component is a thin router — it picks which view to show and passes props
2. Each view is a self-contained component with its own types
3. Views get state from `useCampaignStore()` directly — no prop drilling from the router
4. Delete handlers use the `onDelete` callback pattern

If you need to add a feature to a tab, add it to the relevant view or create a new view. Don't inflate the router.

### Pattern: Direct Store Access

All components access state via `useCampaignStore()`. The old bridge contexts exist but are being phased out. Never import from `src/contexts/` in new code.

### TypeScript

- `strict: true` is enabled in tsconfig
- Prefer updating type definitions over using `as any` casts
- Shared types live in `src/types/` (views.ts, gathering.ts, dayplanner.ts, rules.ts, combatTracker.ts)
- When adding new component types, create or extend the appropriate file in `src/types/`

### Testing

- Vitest + React Testing Library
- Tests live alongside code in `__tests__/` directories or as `.test.tsx` siblings
- **VM memory constraint:** run tests individually, not the full suite
- Use real-ish data in tests — the app's data structures are complex and synthetic oversimplifications miss edge cases
- Target: all tests green before committing

### Build & Run

```bash
# Dev server (frontend only)
npm run dev

# Full build
npm run build

# TypeScript check
npx tsc --noEmit

# Lint
npm run lint

# Server (separate terminal)
cd server && npm run dev

# Electron (full desktop app)
npm run electron:dev

# Single test file
NODE_OPTIONS="--max-old-space-size=256" npx vitest run src/path/to/test.ts
```

---

## What NOT to Do

- **Don't skip orientation.** Read the roadmap and check git history first. The project has a clear plan and strong conventions — working blind creates rework.
- **Don't add features to god components.** If a file is over 500 lines and isn't CombatTracker, it probably needs decomposition before new features.
- **Don't use bridge contexts in new code.** Use `useCampaignStore()` directly.
- **Don't run the full test suite at once.** It will OOM. Run tests individually.
- **Don't use `as any` to fix type errors.** Update the type definitions instead.
- **Don't add multiplayer features without auth.** Phase 10.5 must land first.
- **Don't create secondary state management.** All state goes through CampaignStore. No local stores, no React context for app state, no Redux additions.
- **Don't inflate the bundle unnecessarily.** Current target is ~624KB. If adding a dependency, justify it.
