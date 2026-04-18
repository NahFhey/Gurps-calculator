---
name: resume-development
description: Use when the user says `/resume-development`, asks to continue working, pick back up, resume development, or wants a fast project rehydration for this repo. Rebuild the current repo context quickly, verify the baseline, summarize what was just finished, identify the best next task, and then continue execution instead of stopping at analysis.
---

# Resume Development

Use this skill to restart momentum in the `Gurps-calculator` repo without making the user restate recent work.

## Workflow

1. Rehydrate the current repo state first:
   - `git status --short --branch`
   - `git log --oneline -5`
   - skim `ROADMAP.md`, `PROJECT_STATUS.md`, and `docs/guides/STABILIZATION_WORKFLOW.md`
   - inspect `package.json` scripts before assuming the right verification command
2. Reconfirm the baseline with evidence:
   - prefer `npm run verify` when the repo is in a stabilization phase
   - if the user is resuming a narrowly scoped feature, run the smallest useful gate first and expand as needed
3. Summarize the branch in a compact way:
   - what is already done
   - whether lint/typecheck/build/tests are green
   - what is actually left in the current phase
4. Choose the next task instead of waiting for more direction when the user simply says to continue:
   - prefer the current roadmap phase
   - prefer the smallest high-value slice that keeps momentum
   - if there is a warning/backlog cluster, handle it in thematic sweeps
5. Start the work in the same turn:
   - make the change
   - rerun affected checks
   - end with the updated next target

## Repo Heuristics

- Treat the roadmap as guidance, but trust the current verification output more than stale notes.
- Do not assume a large dirty worktree means the branch is broken.
- If docs disagree with the code, update the docs once the code reality is verified.
- If Phase 10 is active and the baseline is green, the usual next targets are:
  - dependency cleanup
  - focused test expansion
  - bundle-size follow-up
  - then Phase 11 combat decomposition

## Good Output

- a short resume note grounded in current files and gates
- one clear next task with a reason
- immediate execution when the user asked to continue, not just a plan
