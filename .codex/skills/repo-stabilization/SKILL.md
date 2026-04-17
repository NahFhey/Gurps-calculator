---
name: repo-stabilization
description: Use when the task is to assess project health, clean up lint/type/test issues, decide what is still unfinished, or prepare a branch for handoff. Start with repo state, run the quality gates, separate blockers from warning-level debt, and update docs/scripts when the workflow changes.
---

# Repo Stabilization

## Workflow

1. Check repo state first:
   - `git status --short`
   - read the relevant roadmap/status docs
   - inspect `package.json` scripts before assuming the verification path
2. Run the quality gates early:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
   - `npx vitest run`
3. Classify findings:
   - blockers: failing lint errors, type errors, broken tests, build failures
   - backlog: warnings, stale docs, large-bundle notes, low-risk cleanup
4. Fix the smallest blocker first, then rerun the affected gate before moving on.
5. If you change tooling or scripts, update the docs in the same session.

## Guardrails

- Do not treat a large dirty worktree as proof that the branch is broken.
- Prefer objective gate output over roadmap assumptions.
- When expanding tooling, expect a warning backlog; keep it visible without confusing it with blocking failures.
- If you add a new standard command, put it in `package.json` so the workflow is repeatable.

## Good Outputs

- a short "what is actually left" summary grounded in current gates
- updated scripts or docs when the validation workflow changes
- a clear distinction between blocking regressions and follow-up cleanup
