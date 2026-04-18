# Stabilization Workflow

This guide captures what worked well in the April 17, 2026 cleanup session and what we should keep improving.

## Keep Doing

- Start with evidence, not guesses: check `git status`, current scripts, and roadmap/docs before deciding what is "left."
- Run the real quality gates early: lint, typecheck, build, and tests tell us more than file counts.
- Fix the smallest blocking issue first: clearing one hard failure often reveals the true remaining work.
- Expand tooling carefully: enabling TypeScript linting was useful because it surfaced real issues without blocking progress behind dozens of unrelated changes.
- Burn down warning backlogs in thematic sweeps. Grouping hook-dependency fixes separately from console-policy cleanup kept the work reviewable and low risk.
- Re-run verification after each meaningful change so the branch state stays trustworthy.

## Improve Next Time

- Update docs as soon as tooling changes. We improved the lint pipeline first, but the README and roadmap lagged behind until afterward.
- Separate "blocking" from "backlog" more explicitly. The TypeScript lint rollout introduced many warnings; those should stay visible without being confused with release blockers.
- Prefer reusable commands over ad hoc shell history. `npm run typecheck` and `npm run verify` make the healthy path easy to repeat.
- Capture session lessons in a reusable place. If a workflow helped once, it should be easy to reuse in the next cleanup pass.
- When console warnings are policy-only, decide deliberately whether the right fix is `warn`, `error`, or a real logger abstraction instead of treating them as a mechanical rename.

## Recommended Order

Use this order when stabilizing a branch:

```bash
git status --short
npm run lint
npm run typecheck
npm run build
npx vitest run
```

Or run the bundled command:

```bash
npm run verify
```

## Closeout Checklist

- Refresh roadmap/status docs if the current baseline changed.
- Record what should be kept versus what should improve next time.
- End the session with the full verification set, not just the last targeted gate.

## Current Baseline

As of 2026-04-17:

- `npm run lint` passes and now covers `js`, `jsx`, `ts`, and `tsx` with no warnings
- `npm run typecheck` passes
- `npm run build` passes
- `npx vitest run` passes

The remaining Phase 10 backlog is no longer lint cleanup. The next likely targets are dependency audit, focused coverage expansion, and bundle-size follow-up.
