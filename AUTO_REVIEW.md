# AUTO_REVIEW.md

Daily code review log produced by the `gurps-vtt-auto-review` Claude Code routine (10pm local).

## How this file works

- **Append-only.** Each daily run prepends a new dated section directly below this header. Past entries are immutable history.
- **Marker-based look-back.** Each run reads `auto-dev:` commits made since the previous `review:` commit, so missed days don't lose coverage.
- **Suppression list lives in `KNOWN_ISSUES.md`.** Items there are not re-flagged.

## Evaluation axes

Each `auto-dev:` commit is graded on:

1. **Test depth** — meaningful behavioral assertions vs snapshot fluff. Engine code (dice, damage, injury, effects, fog-of-war, LOS, weather, wounding, hit locations) gets stricter scrutiny than filters/selectors.
2. **Type discipline** — no new `:any` annotations, no `as any` casts, no `@ts-nocheck` (outside grandfathered files listed in `KNOWN_ISSUES.md`).
3. **Auto-deferral honesty** — `[!]` markers on `AUTO_QUEUE.md` items must cite reasons that match the actual current file state, not fabricated rationalizations.
4. **Scope discipline** — commit touches only what the queue item described. No "while I was here" drift.

## Verdict taxonomy

- **PASS** — rubber-stamp. No concerns above noise floor.
- **NOTE** — worth flagging but not blocking. Pattern emerging that may want attention later, or a one-off the autodev got slightly suboptimal.
- **CONCERN** — look at this before the next auto-dev run. Real risk: shallow test on engine code, type erosion, scope creep, or a deferred item that was actually doable.

The Discord roar carries the highest verdict in the day's batch plus counts (e.g., `2026-05-09 review: PASS — 4 commits (4P, 0N, 0C)`).

## End-state

When `AUTO_QUEUE.md` has zero `- [ ]` items AND seven consecutive runs find zero `auto-dev:` commits to review, the routine disables itself and roars FINAL.

---

<!-- Daily entries are prepended directly below this line, newest first. -->
