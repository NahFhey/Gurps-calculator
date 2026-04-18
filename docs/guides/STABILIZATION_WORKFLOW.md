# Stabilization Workflow

This guide captures what worked well in the April 17, 2026 cleanup session and what we should keep improving.

## Keep Doing

- Start with evidence, not guesses: check `git status`, current scripts, and roadmap/docs before deciding what is "left."
- Run the real quality gates early: lint, typecheck, build, and tests tell us more than file counts.
- Fix the smallest blocking issue first: clearing one hard failure often reveals the true remaining work.
- If the branch is green but `build` still warns, treat that warning as real Phase 10 input instead of waving it off as "good enough."
- Expand tooling carefully: enabling TypeScript linting was useful because it surfaced real issues without blocking progress behind dozens of unrelated changes.
- Burn down warning backlogs in thematic sweeps. Grouping hook-dependency fixes separately from console-policy cleanup kept the work reviewable and low risk.
- Re-run verification after each meaningful change so the branch state stays trustworthy.
- For coverage work, target the branch-heavy workflow component that is still mocked or lightly tested, then run its focused suite before the full closeout pass.
- Compare documented invariants and selector behavior against the actual UI. When they disagree, that mismatch is often the highest-value next fix.

## Improve Next Time

- Update docs as soon as tooling changes. We improved the lint pipeline first, but the README and roadmap lagged behind until afterward.
- Separate "blocking" from "backlog" more explicitly. The TypeScript lint rollout introduced many warnings; those should stay visible without being confused with release blockers.
- Prefer reusable commands over ad hoc shell history. `npm run typecheck` and `npm run verify` make the healthy path easy to repeat.
- Capture session lessons in a reusable place. If a workflow helped once, it should be easy to reuse in the next cleanup pass.
- When console warnings are policy-only, decide deliberately whether the right fix is `warn`, `error`, or a real logger abstraction instead of treating them as a mechanical rename.
- Keep test fixtures honest. If TypeScript-heavy tests need simplified fixture data, make the test-only cast explicit instead of letting the fixture drift silently from production types.
- Treat dependency audits as advisory. Verify config files, lint/build tooling, and packaging scripts before removing packages, and use audit output to look for missing direct dependencies too.

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
- built-in shell modules lazy-load and the production build no longer emits chunk-size warnings
- the root dependency audit did not reveal a safe unused-package removal, but it did add the missing direct tool dependencies `@eslint/js` and `resedit`
- `CraftingWorkbench` now has direct workflow coverage for reservation, progression, completion, and refund behavior
- `LocationManager` now has direct workflow coverage for creation, current-location changes, last-location delete protection, custom climates, and weather-table usage
- shell-header `TimeControls` now honor unresolved current-slot downtime tasks and have direct coverage for compact slot/day advancement

The remaining Phase 10 backlog is no longer lint cleanup, dependency hygiene, or bundle warning cleanup. The next likely target is combat-round workflow coverage, then Phase 11a combat decomposition.
