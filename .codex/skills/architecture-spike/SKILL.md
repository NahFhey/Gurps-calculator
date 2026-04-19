---
name: architecture-spike
description: Use when the user asks whether part of this repo should move to another runtime or client (for example Godot), wants a hybrid architecture plan, or wants a narrow prototype that proves the seam before a rewrite.
---

# Architecture Spike

Use this skill when the user is exploring a major architecture change but wants the answer grounded in this repo instead of generic pros/cons.

## Workflow

1. Inspect the current codebase before recommending a migration:
   - `git status --short`
   - skim `package.json`, `server/package.json`, `ROADMAP.md`, and `PROJECT_STATUS.md`
   - read the specific modules that would be affected
2. Separate the question into three decisions:
   - what should stay in the current stack
   - what could move to a new runtime/client
   - what must remain the source of truth
3. Prefer carve-outs over rewrites:
   - keep campaign storage, schema migration, and broad management UI in the existing app unless there is strong evidence otherwise
   - move only the narrow experience the new runtime is clearly better at
4. Define the seam before writing much code:
   - shared tactical/domain contract first
   - source-of-truth owner second
   - transport/API shape third
   - client prototype last
5. For repo spikes, prefer this order of artifacts:
   - `shared/<domain>/types.ts`
   - `shared/<domain>/commands.ts`
   - `shared/<domain>/events.ts`
   - server-side command application or snapshot builder
   - only then any new client integration
6. Keep the first spike narrow:
   - choose one snapshot shape
   - choose one command
   - validate the scaffold with the smallest useful checks
7. Capture the result for the next session:
   - what the spike proved
   - what remains intentionally unimplemented
   - what should happen next if the user wants to continue

## Repo Heuristics

- In this repo, React/Electron is strong at dense management UI; treat proposals to move everything out of it as a rewrite unless proven otherwise.
- The current server and sync layer are thin and state-oriented, which makes them a good seam for hybrid clients.
- Do not let a prototype depend on raw `CampaignState` if a narrower serialized contract can represent the tactical/client use case.
- Prefer TypeScript-owned rule resolution in the first spike so Godot or another client can stay focused on rendering and input.
- If roadmap/status docs are already dirty with unrelated changes, record architecture-spike lessons in a dedicated workflow guide or skill update instead of mixing concerns into those files.

## Good Output

- a recommendation grounded in current files
- a clear keep/move/source-of-truth split
- a concrete phased plan
- a minimal scaffold if the user wants code, not a speculative rewrite
