---
name: session-retrospective
description: Use when the user asks to look back on the current session, capture what went well, identify what could be improved, turn lessons into workflow or skill updates, prepare handoff notes, or cleanly close a work session with docs and commits.
---

# Session Retrospective

Use this skill to turn a "what did we learn?" request into concrete repo improvements instead of a one-off summary.

## Workflow

1. Rebuild the recent context first:
   - check `git status --short --branch`
   - inspect the most recent commits
   - read the docs or skills that guided the work
   - identify which changes in the worktree belong to the just-finished session
2. Separate the retro into two buckets:
   - what worked well and should be kept
   - what caused friction, delay, stale docs, or avoidable rework
3. Prefer tightening existing instructions before creating new ones:
   - update the relevant workflow guide when the lesson is repo-specific
   - update an existing skill when the gap belongs in a current skill's workflow or guardrails
   - create a new skill only if the pattern is likely to recur and does not fit cleanly into an existing skill
4. Encode lessons as behavior, not slogans:
   - turn "we should verify earlier" into a specific command/order change
   - turn "docs got stale" into an explicit same-session update rule
   - turn "the test fixture drifted" into a fixture/type guardrail
   - turn "the decomposition went smoothly" into a repeatable seam-order rule and before/after measurement habit
   - turn "the hook extraction broke lint/typecheck first" into a targeted validation sequence before the final full verify
5. If code or docs changed during the session, refresh the "next target" so the branch no longer points at already-finished work.
6. Rerun the smallest useful validation for the updates you made, then do the final closeout checks the task requires.
7. If the user asked for a commit, stage only the relevant files, leave unrelated changes alone, and commit with a message that reflects the retrospective improvements.

## Heuristics

- Favor concise, reusable rules over long narrative writeups.
- Keep the retro grounded in actual repo artifacts, not memory alone.
- If an existing workflow already says the right thing, do not duplicate it elsewhere just to "document more."
- If the lesson is "this should have been a skill," make the skill small and narrowly triggered.
- If the session involved decomposition, capture the quantitative deltas that matter for re-entry: file sizes before/after, new hooks or views introduced, and the next clean seam.
- React hook-order and type-boundary regressions are common decomposition failure modes; if they showed up this session, encode the guardrail where the next resume will see it.
- Call out unrelated untracked files explicitly before committing.

## Good Output

- a short summary of what worked and what changed
- updated workflow docs or skills that encode the lesson
- a clear statement about whether a new skill was added or existing ones were enough
- a clean verification/commit closeout when requested
