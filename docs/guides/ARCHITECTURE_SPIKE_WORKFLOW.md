# Architecture Spike Workflow

This guide captures what worked well in the April 19, 2026 Godot/hybrid architecture exploration and what to keep doing when we test large runtime changes without destabilizing the main app.

## Keep Doing

- Start from the real repo shape before offering architecture advice. Reading the current app, store, persistence, and server layers produced a better answer than generic migration pros/cons.
- Separate "move everything" from "carve out one client-worthy slice." The hybrid recommendation was stronger once the map/combat experience was isolated from the broader campaign-management UI.
- Pick a source of truth early. Keeping TypeScript/server state authoritative made the Godot idea feel additive instead of rewrite-heavy.
- Define the contract before transport or client work. Shared snapshot, command, and event types gave the spike a concrete seam.
- Keep the first prototype narrow. One tactical snapshot plus a few commands is enough to validate the architecture without dragging the whole campaign schema into the spike.
- Validate both sides of the seam. Root `npm run typecheck` plus `server` build verification caught cross-runtime contract issues quickly.

## Improve Next Time

- Call out sooner when roadmap/status docs are already dirty with unrelated work. For exploratory sessions, a dedicated guide or skill update is safer than editing broad status docs in place.
- Make the "intentionally missing" list explicit as soon as the spike lands. Selectors, API routes, and campaign-state adapters should be named as next steps so the scaffold does not look more complete than it is.
- Prefer contract files and server seams over UI integration in the first pass. Client wiring is easier to judge after the shared types and command flow feel stable.
- If the question starts as advice and turns into code, say when the work has shifted from recommendation to spike so the closeout can separate decisions from implementation.

## Recommended Order

Use this order for future architecture spikes in this repo:

```bash
git status --short
```

Then inspect the current stack and identify:

1. what stays where it is
2. what could move
3. what remains the source of truth

Then build the seam in this order:

1. `shared/<domain>/types.ts`
2. `shared/<domain>/commands.ts`
3. `shared/<domain>/events.ts`
4. server-side snapshot/command handlers
5. client integration or prototype runtime

## Closeout Checklist

- Record what the spike proved.
- Record what is still intentionally unimplemented.
- Validate the smallest useful cross-runtime checks.
- Stage only the spike artifacts and retro/process updates, not unrelated feature work.

## Current Session Baseline

As of 2026-04-19:

- `shared/tactical/` holds a first-pass tactical snapshot, command, and event contract
- `server/src/tactical/applyTacticalCommand.ts` contains a narrow snapshot-level command applier for `move`, `set_maneuver`, `end_turn`, and `apply_damage`
- the spike is still missing tactical selectors, HTTP routes, and campaign-state adapters
- the main roadmap target remains combat decomposition; the tactical scaffold is a future-facing seam, not a branch pivot by itself
