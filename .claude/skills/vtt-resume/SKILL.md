---
name: vtt-resume
description: Onboard and orient to the GURPS VTT desktop app before doing any work. Use this skill whenever the user mentions the GURPS VTT, VTT app, party management tool, or wants to continue work on the Gurps-calculator project. Also trigger when the user says things like 'let's work on the VTT', 'pick up where we left off on the app', 'what's next for the VTT', 'resume work on the calculator', or mentions combat tracker, downtime system, crafting, or multiplayer features in the context of code work. This skill MUST be consulted before writing any code in the Gurps-calculator codebase.
---

# GURPS VTT — Project Resume Skill

You are picking up work on Devin's GURPS VTT desktop application. This skill gets you oriented before you touch anything. Follow these steps in order.

## Step 1: Read the roadmap

The roadmap is the authoritative source for what's planned and what's done:

```
ROADMAP.md
```

It contains phases 10–16 with specific sub-tasks, status markers, and estimated effort. Pay attention to which items are marked ✅ vs remaining — the roadmap is updated each session.

## Step 2: Check auto-memory

Read the project memory files to understand recent work and known issues:

```
.auto-memory/project_gurps_vtt.md
.auto-memory/project_test_memory_limits.md
.auto-memory/feedback_type_fixes.md
.auto-memory/feedback_verify_agent_work.md
```

These carry session-to-session context: architecture decisions, known gotchas, and preferences. Memory files may be stale (check timestamps) — verify claims against current code before acting on them.

## Step 3: Environment note (draken, updated 2026-07-13)

This machine is draken (native Linux). node_modules is installed natively — root **and** `server/` — in both the main checkout (`/home/arlavale/Meta/projects/gurps-calculator`, Devin's working copy) and the auto-dev worktree (`/home/arlavale/Meta/projects/gurps-calculator-auto`, branch `auto-dev`). No esbuild platform fix is needed. If node_modules is ever missing, stop and ask a human — autonomous runs must never run npm install.

## Step 4: Run a smoke test

Verify the codebase is healthy:

```bash
cd <repo root> && npx vitest run src/__tests__/combatIntegration.test.ts 2>&1 | tail -8
```

If this passes, the core reducer pipeline is working. If it fails, investigate before doing anything else.

**Note:** draken can run the full suite (`npx vitest run`, ~11 s, verified 2026-07-13) — the old Cowork-VM OOM limit no longer applies. Targeted runs are still preferred inside autonomous loops for speed and clearer failure attribution.

## Step 5: Ask the user what's next

Now that you're oriented, ask the user where they want to focus. Don't assume — the roadmap has a phased plan, but the user may want to jump to a specific issue.

---

## Project Overview

**What it is:** A comprehensive GURPS 4e campaign management desktop app — combat tracker, character library, downtime activities (crafting, alchemy, cooking, gathering), day planner, map system, inventory, and multiplayer. Built for Devin's Drakenfire Skies TTRPG setting.

**Tech stack:** React 18 + TypeScript + Tailwind CSS + Vite (frontend), Electron (desktop), Express + Socket.io + sql.js (multiplayer backend), Vitest (testing).

**Scale:** ~370 TS/TSX files, ~32 JS files, ~72 test files, 192 components across 16 subsystems.

---

## Architecture Rules

These are the rules of the road. Follow them when writing code in this project.

### State management

- **Redux-style with Immer.** The entire app state lives in `CampaignState`, managed by `campaignReducer.ts` with Immer's `produce()`. Components access state via `useCampaign()` hook from `campaignStore.tsx`.
- **Domain reducers handle their own actions.** Combat, crafting, alchemy, gathering, inventory, downtime, and map each have their own reducer in `src/state/<domain>/`. The campaign reducer delegates via type guards (`isCombatAction`, `isCraftingAction`, etc.).
- **Selectors live in `src/state/selectors/`.** Memoized query functions. Use them instead of digging into raw state shape.
- **Actions are `{ type: string, payload?: T }`.** Action types are defined as string constants in each domain's `*Actions.ts` file.

### Component patterns

- **Thin router + view decomposition.** Large components get split into a thin router (handles state + dispatch) and view components (pure rendering). This was the Phase 6 pattern. Don't create new god components.
- **Direct store access, not bridge contexts.** Use `useCampaign()` directly. The legacy `CombatContext` and other bridge contexts are deprecated — don't add new ones.
- **Components live in `src/components/<subsystem>/`.** Views go in a `views/` subdirectory. Tests go in `__tests__/`.

### Type safety

- **`strict: true` is non-negotiable.** tsc must pass clean. Don't add `@ts-ignore` or `// @ts-expect-error`.
- **Prefer updating type definitions over `as any`.** If a type is wrong, fix it at the source (`src/types/campaign.ts` or the relevant type file). Don't paper over it with casts. There are 203 `as any` casts remaining — don't add more.
- **Use `type` imports for types.** `import type { Character } from '../types/campaign'`.

### Testing

- **Vitest with jsdom.** Config is in `vitest.config.js`.
- **Memory limit in VM.** Always use `NODE_OPTIONS="--max-old-space-size=256"` when running tests. Never run the full suite at once.
- **Server tests use a separate config.** `server/vitest.config.ts` with `environment: 'node'`.
- **Use real data patterns in tests.** Don't create synthetic test data that's cleaner than what the app actually handles. The existing integration tests (`combatIntegration.test.ts`, `timeAdvancementIntegration.test.ts`, `craftingIntegration.test.ts`) show the pattern.

### Multiplayer

- **ConnectionManager is a singleton class, not a hook.** Lives in `src/net/ConnectionManager.ts`.
- **Shared protocol types** are in `shared/protocol.ts` and `shared/session.ts`.
- **The server has zero auth.** Phase 10.5 adds authentication — don't ship multiplayer without it.

---

## Directory Structure (abbreviated)

```
Gurps-calculator/
├── src/
│   ├── App.tsx
│   ├── types/                    # Type definitions (campaign.ts is 820 lines)
│   ├── state/                    # Redux-style store
│   │   ├── campaignStore.tsx     # React Context + useReducer (696 lines)
│   │   ├── campaignReducer.ts   # Main reducer with Immer (1,368 lines)
│   │   ├── character/           # Character domain
│   │   ├── combat/              # Combat domain
│   │   ├── crafting/            # Crafting domain
│   │   ├── downtime/            # Downtime domain (13 files, well-tested)
│   │   ├── gathering/           # Gathering domain
│   │   ├── alchemy/             # Alchemy domain
│   │   ├── inventory/           # Inventory domain
│   │   ├── map/                 # Map domain
│   │   └── selectors/           # Memoized query functions
│   ├── components/              # 192 files across 16 subsystems
│   │   ├── combat/              # 34 files (largest component group)
│   │   ├── downtime/            # 45 files (largest subsystem)
│   │   ├── manager/             # 20 files (config UI)
│   │   ├── map/                 # 20 files
│   │   ├── gathering/           # 11 files
│   │   ├── character-sheet/     # 12 files
│   │   └── ...                  # alchemy, crafting, dayplanner, header, ui, etc.
│   ├── hooks/                   # Custom React hooks
│   ├── net/                     # ConnectionManager.ts (multiplayer)
│   ├── persistence/             # campaignStorage.ts, schema versioning
│   ├── utils/                   # Utility functions (combat, alchemy, gathering, etc.)
│   └── __tests__/               # Integration tests
├── server/                      # Express + Socket.io backend
│   └── src/                     # routes.ts, socket.ts, db.ts + 4 test files
├── shared/                      # protocol.ts, session.ts (shared with server)
├── electron/                    # main.ts, preload.ts
├── ROADMAP.md                   # Phase 10–16 plan (source of truth)
├── PROJECT_STATUS.md            # Phases 1–9 history
├── vitest.config.js             # Test config (jsdom, forked processes)
└── tsconfig.json                # strict: true
```

---

## Key Files Quick Reference

| What | Where |
|------|-------|
| Main reducer | `src/state/campaignReducer.ts` |
| Store/context | `src/state/campaignStore.tsx` |
| Campaign types | `src/types/campaign.ts` |
| Combat actions | `src/state/combat/combatActions.ts` |
| Crafting reducer | `src/state/crafting/craftingReducer.ts` |
| Downtime reducer | `src/state/downtime/downtimeReducer.ts` |
| Connection manager | `src/net/ConnectionManager.ts` |
| Server routes | `server/src/routes.ts` |
| Server sockets | `server/src/socket.ts` |
| Integration tests | `src/__tests__/combat|time|crafting Integration.test.ts` |
| Constants | `src/constants/index.ts` |
| Time system | `src/utils/timeSystem.ts` |

---

## What NOT to Do

- Don't run the full test suite at once — it will OOM.
- Don't add new `as any` casts — fix the types instead.
- Don't create new bridge contexts — use `useCampaign()` directly.
- Don't put business logic in components — it belongs in reducers or utils.
- Don't create new god components — use the thin router + view pattern.
- Don't bypass `strict: true` with `@ts-ignore`.
- Don't ship multiplayer features without Phase 10.5 auth.
- Don't assume the memory entries are current — verify against code.
