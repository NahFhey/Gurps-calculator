---
name: gurps-verify
description: Run a structured verification pass after completing work on the GURPS Character Sheet or GURPS VTT codebase. Use this skill whenever you've finished a coding task, before reporting results to the user — it catches regressions, type errors, build bloat, and semantic status violations. Also trigger when the user says "verify", "check the build", "run the checks", "does it pass", "evaluate", "QA this", or asks you to validate your own work. This skill is the evaluator leg of a planner/generator/evaluator harness — the resume skills are the planner, your coding is the generator, and this skill closes the loop.
---

# GURPS Verify — Post-Work Evaluation Skill

You just finished writing code on one of Devin's GURPS projects. This skill runs a structured verification pass so you catch problems before reporting success. The goal is to separate generation from evaluation — you wrote the code, now put on a different hat and try to break it.

## When to Run This

Run this skill after every meaningful code change. "Meaningful" means anything beyond a comment edit or whitespace fix. The checks are fast and the cost of skipping is high — a silent regression in the calculator or a type error that only surfaces downstream wastes far more time than the 30 seconds these checks take.

You should also run this if the user explicitly asks you to verify, QA, or validate work.

## Step 1: Detect Which Project

Check which project you've been working in. The two codebases live at:

- **Charsheet:** `projects/Gurps-charsheet/`
- **VTT:** The VTT project root (look for `ROADMAP.md`, `server/`, `src/components/`)

If you touched files in both projects in one session, run verification for both — sequentially, not interleaved.

## Step 2: Run the Checks

### For GURPS Character Sheet

Run these in order. Stop and report if any step fails — don't barrel through hoping later steps will be fine.

#### 2a. Type Check
```bash
cd projects/Gurps-charsheet && npx tsc --noEmit 2>&1
```
**Pass criteria:** Zero errors. Warnings are acceptable but note them.
**If it fails:** Report the exact errors. Don't try to fix them silently — the user needs to know what broke and why.

#### 2b. Test Suite
```bash
cd projects/Gurps-charsheet && npx vitest run 2>&1
```
**Pass criteria:** All tests pass. No skipped tests unless they were already skipped before your changes.
**If it fails:** Report which tests failed and what the assertion errors say. If a test failure is clearly caused by your changes (e.g., you changed a calculator formula and the calculator test now expects a different value), say so. If it's unclear, say that too.

#### 2c. Vault Census (if parser or schema changes were made)
Only run this if you touched anything in `packages/parser/` or `packages/shared/`:
```bash
cd projects/Gurps-charsheet && node --import tsx/esm packages/cli/src/index.ts vault-health "../../context/Obsidian/Dnd"
```
**Check:** Compare structural and computational parse rates against the last known baseline in `.auto-memory/project_gurps_charsheet.md`. If either metric dropped, that's a regression — your parser change broke something it previously handled.

#### 2d. Semantic Status Audit
This is the charsheet-specific check that catches the project's #1 failure mode: silently promoting `partial`/`unresolved` entries to `parsed`/`actionable`.

Grep your diff for these patterns:
```bash
git diff HEAD~1 -- packages/ | grep -n "structural\|computational\|actionable\|parsed\|unresolved\|partial"
```
For every status assignment in your diff, verify:
- If you're setting `structural: 'parsed'`, the parser actually extracted all required fields — not just some.
- If you're setting `computational: 'actionable'`, the engine can fully calculate costs — no variable formulas, no missing prerequisites, no ambiguous modifiers.
- If something is uncertain, it must be `partial`/`unresolved` with a warning string. This is not conservative — it's honest.

#### 2e. Shadow Calculator Check
The project's #2 failure mode: creating secondary point-totaling paths that drift from the canonical calculator. All point math must flow through `packages/core/src/calculator.ts`.

```bash
git diff HEAD~1 -- packages/ | grep -n "pointCost\|totalPoints\|calculateCost\|costPer"
```
If any new cost calculation logic appears outside `calculator.ts`, flag it. This includes "temporary" helpers, CLI convenience functions, and test utilities that replicate cost math instead of calling the calculator.

Note: always use `node --import tsx/esm` to run TypeScript in this project — `tsx` as a standalone command has IPC permission issues in the Cowork VM.

### For GURPS VTT

#### 2a. Type Check
```bash
cd <vtt-project-root> && npx tsc --noEmit 2>&1 | tail -20
```
**Pass criteria:** Zero errors. The project runs `strict: true`.

#### 2b. Build Check
```bash
cd <vtt-project-root> && npx vite build 2>&1 | tail -15
```
**Pass criteria:** Build succeeds. Note the bundle size — baseline is ~624KB. If it grew by more than 10% (>686KB), flag it and explain what's adding weight.

#### 2c. Targeted Tests
The full Vitest suite OOMs in the Cowork VM. Run only the tests relevant to what you changed:
```bash
cd <vtt-project-root> && NODE_OPTIONS="--max-old-space-size=256" npx vitest run src/path/to/relevant.test.ts 2>&1
```
If you're unsure which test files are relevant, find them:
```bash
find src/ -name "*.test.*" | xargs grep -l "YourChangedComponent\|yourChangedFunction"
```
**Pass criteria:** All targeted tests pass.

#### 2d. Convention Compliance
Check your diff against the VTT's architectural rules:

- **No business logic in the CLI or UI layer.** If your diff adds calculation, validation, or state mutation logic outside of `src/state/` or `packages/core/`, flag it.
- **No legacy bridge context usage.** If your diff imports from `src/contexts/` (except `CombatContext` in combat sub-components), flag it.
- **Store access pattern.** New components should use `useCampaignStore()` directly, not receive state as props drilled from a parent.

```bash
git diff HEAD~1 -- src/ | grep -n "import.*from.*contexts\|require.*contexts"
```

## Step 3: Update the Knowledge Graph & Check Impact

Both projects carry a graphify knowledge graph at `graphify-out/` in the repo root. Skip this step only if `graphify-out/graph.json` does not exist in the checkout you're working in (e.g., the auto-dev clone) — in that case report Graph: SKIPPED.

### 3a. Graph Update

```bash
cd <project-root> && graphify update .
```

AST-only, no API cost, takes seconds. This keeps the graph in sync with what's on disk so the next session's queries aren't answering from a stale graph. Run it even if earlier checks failed — the graph should reflect the code as it currently stands.

### 3b. Impact Analysis

For each exported function, type, or store you modified in `packages/core/`, `packages/parser/`, or `packages/shared/` (charsheet) / `src/state/` or `src/utils/` (VTT), check its fan-in against your diff:

```bash
graphify explain "<symbolName>"
```

Any caller in the connections list that isn't in your diff and wasn't consciously considered is a flag — the graph shows blast radius the diff alone doesn't. God nodes (listed in `graphify-out/GRAPH_REPORT.md`) deserve extra scrutiny: `Character`, `createCharacter()`, `scanVault()`, `validateCharacter()` on the charsheet; `useCampaignStore()` and the campaign reducer on the VTT.

This is a review aid, not a hard gate — report unconsidered callers as flags in the verdict, same as convention violations. Don't fail the run over them; explain what the graph surfaced and let the user judge.

## Step 4: Report the Verdict

After running all applicable checks, report results in this format:

**Project:** [Charsheet / VTT]

**Type Check:** PASS / FAIL (with errors)
**Tests:** PASS / FAIL (N passed, M failed — list failures)
**Build:** PASS / FAIL (bundle size if VTT)
**Census:** PASS / SKIP / REGRESSED (parse rates if run)
**Conventions:** PASS / FLAGS (list any violations)
**Graph:** UPDATED / SKIPPED (no graph in checkout) — add FLAGS with the callers if impact analysis surfaced unconsidered fan-in

**Overall: CLEAN / ISSUES FOUND**

If issues were found, list them with enough context that the user can make a decision — don't just say "test failed," say which test, what it expected, what it got, and whether your changes caused it.

## Step 5: Suggest Fixes (But Don't Apply Them)

If verification found problems, suggest what to fix but **do not fix anything automatically**. The whole point of separating evaluation from generation is that the evaluator doesn't silently patch things up. The user decides whether to fix, revert, or accept the issue.

Exception: if the user explicitly says "fix it" or "go ahead and address those," then you can re-enter generator mode, make the fixes, and run this skill again afterward.

## Philosophy

This skill exists because self-evaluation is unreliable. When you just wrote code, you're biased toward thinking it works. The structured checklist forces you to actually verify rather than assume. The "suggest but don't fix" rule prevents the evaluator from quietly covering for the generator — if something is broken, the user should know about it before it gets buried under the next change.

Think of it as a code review from a colleague who doesn't have context on why you made the choices you did — they just see the diff and the test results.
