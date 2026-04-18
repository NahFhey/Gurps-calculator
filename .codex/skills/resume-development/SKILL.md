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
   - whether there is already uncommitted work in the tree that should be carried forward instead of re-done
4. Choose the next task instead of waiting for more direction when the user simply says to continue:
   - prefer the current roadmap phase
   - prefer the smallest high-value slice that keeps momentum
   - if the baseline is green but `build` or `verify` still emits warnings, treat the warning as real prioritization input instead of assuming Phase 10 is "done"
   - if there is a warning/backlog cluster, handle it in thematic sweeps
   - if docs or selectors describe a workflow invariant that the UI does not appear to enforce, treat that mismatch as a strong next-task candidate
   - if the chosen task closes the current phase's last named gap, update the docs and pivot the next target to the following phase in the same turn
5. Start the work in the same turn:
   - make the change
   - rerun affected checks
   - if the change is test-focused, run the narrow suite first and then finish with the full verification set
   - end with the updated next target

## Repo Heuristics

- Treat the roadmap as guidance, but trust the current verification output more than stale notes.
- Do not assume a large dirty worktree means the branch is broken.
- If docs disagree with the code, update the docs once the code reality is verified.
- When deciding between cleanup options, prefer the path with current evidence behind it:
  - warning-producing build output beats speculative dependency cleanup
  - a large untested workflow component beats another round of shallow view tests
- Treat dependency audits as a starting point, not the answer: they can reveal missing direct dependencies and config-only false positives, not just removable packages.
- If Phase 10 is active and the baseline is green, the usual next targets are:
  - dependency cleanup
  - focused test expansion
  - bundle-size follow-up
  - then Phase 11 combat decomposition
- Keep test fixtures honest during focused coverage work; shared type drift is a real failure mode even when the runtime behavior is fine.

## Good Output

- a short resume note grounded in current files and gates
- one clear next task with a reason
- immediate execution when the user asked to continue, not just a plan
