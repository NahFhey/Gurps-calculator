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
5. Burn down backlog in thematic sweeps when possible (for example hook dependencies, unused variables, or log-policy cleanup) so each pass stays reviewable.
6. If you change tooling, scripts, or the project baseline, update the docs and roadmap in the same session.
7. Finish with a full closeout pass:
   - rerun `npm run lint`
   - rerun `npm run typecheck`
   - rerun `npm run build`
   - rerun `npx vitest run`
   - refresh the "next session" target based on the actual remaining work

## Guardrails

- Do not treat a large dirty worktree as proof that the branch is broken.
- Prefer objective gate output over roadmap assumptions.
- When expanding tooling, expect a warning backlog; keep it visible without confusing it with blocking failures.
- If you add a new standard command, put it in `package.json` so the workflow is repeatable.
- If the remaining issues are policy-only warnings, fix them intentionally instead of doing blind search-and-replace. Choose the right logger or allowed log level for each case.

## Good Outputs

- a short "what is actually left" summary grounded in current gates
- updated scripts or docs when the validation workflow changes
- a clear distinction between blocking regressions and follow-up cleanup
- an updated closeout note so the next session can start from current facts instead of stale assumptions
