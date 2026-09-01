# 15c UX Design Session — Responsive Layout + Theme Tokens

**Date:** 2026-09-01 · **Method:** grill-me (15 decisions) · **Status:** aligned, ready for implementation phases

## Problem

The app is non-responsive by construction and hardcoded dark with no theme layer:

- `UnifiedShell` builds a hand-computed `gridTemplateColumns` string with fixed pixel columns (party 220px, rail 160px, collapsed 56px, decorative 4–8px edges). Only 28 of ~300 component files use any Tailwind responsive prefix. At half-screen snap (~960px) the fixed columns strangle the center pane.
- ~1,470 `bg-gray-*` instances across 199 files, no CSS variables, no `darkMode` config, no shared Button/Modal/Panel/Card (only 7 files import from `components/ui`). 15 hand-rolled modals duplicate `fixed inset-0 bg-black` overlay markup 21 times. 414 ad-hoc decorative accent instances across 111 files. Three stray light-gray files (`DowntimePanel`, `AlchemyTaskCard`, `PerformanceDashboard`).

## Decisions

### Scope & targets
1. **Viewports:** desktop window range only, 900px→ultrawide. Critical target: half-screen snap (~950–1280px). Players only ever join on laptops/desktops — no phone/tablet support.
2. **Shell shape stays:** header / party column left / center / module rail right / combat tile footer. Any rearranging is its own future effort.
3. **Narrow behavior — auto-collapse with manual pin:** below ~1150px the rail collapses to its 56px icon strip; below ~1000px the party column follows. A manual expand pins that column open for the session. (Thresholds are starting points; tune during implementation.)
4. **Wide behavior — stretch, no shell cap.** Width-wasting is fixed per-screen (character sheet goes multi-column at wide widths), not by capping the center.
5. **Per-screen scope:** combat tracker + character sheet only, plus a mechanical `overflow-x-auto` safety net on all data tables. Inventory, downtime, map dialogs, manager, rules: explicitly out.
6. **Combat tracker at narrow widths — progressive disclosure**, not shrink-everything: secondary panels fold away so what remains stays full-size and readable. Exact fold order is a prototype-phase question.

### Theme
7. **Tokens-first, dark-only shipped.** No light theme feature. A rough draft light palette lives behind a dev-only toggle purely to keep the token system honest.
8. **Token vocabulary:** neutral chrome (`surface-0..3`, `text-primary/secondary/muted`, `border-default/strong`) + five semantic statuses (`accent`, `success`, `danger`, `warning`, `info`) — mandatory. Decorative domain accents (purple/teal/cyan/…) deferred; inventory them so the follow-up is cheap.
9. **Mechanism:** CSS custom properties on `:root` holding raw RGB triplets, mapped into `tailwind.config.js` `theme.extend.colors` so opacity modifiers (`bg-surface-1/60`) keep working. Palette swap via `data-theme` attribute. No `dark:` variants.
10. **3D map exempt, permanently-ish.** Three.js scene colors are world colors, not chrome — no CSS-variable bridge gets built. Only the DOM overlays around the canvas get tokenized.
11. **Migration:** mechanical scripted class-swap at call sites (`bg-gray-900→bg-surface-0`, `bg-gray-800→bg-surface-1`, `bg-gray-700→bg-surface-2`, `text-gray-400→text-muted`, …). One exception: build a shared **`Modal` primitive now** (also lands 15d's `role="dialog"`/`aria-modal`/focus-trap/Escape centrally). `Button`/`Panel`/`Card` primitives created for new code, adopted opportunistically — no forced sweep.
12. **Enforcement:** CI grep-gate (wired into gurps-verify) failing on `(bg|text|border)-(gray|slate|zinc|neutral|stone)-` in `src/` outside an allowlist; swapped status colors join the gate too. The three stray light-gray files are bugs — hand-fixed to dark tokens during the sweep (they can't go through the mechanical map).
13. **Sequencing:** (1) tokens + swap + grep-gate → (2) Modal primitive → (3) responsive (shell grid conversion, combat tracker, character sheet), with prototyping at the start of phase 3. Tokens don't need prototypes. Phase 1 is a codex-shepherd candidate; phase 3 is prototype-driven.
14. **Visual fidelity:** pixel-identical launch, except `slate-*` (~40 instances) folds onto the gray-equivalent tokens — the slate ramp is eliminated. Palette tuning afterward is a one-file edit; that's the point of tokens.

### Definition of done
15. Per phase:
- **Phase 1 (tokens):** grep-gate green in CI; full suite green; screenshot diff shows no change except known slate spots; dev light-toggle renders every module legible (ugly OK, illegible not).
- **Phase 2 (Modal):** all 15 modals on the primitive; all 21 hand-rolled `fixed inset-0` overlays gone (incl. UnifiedShell's two inline ones); dialog a11y + focus trap + Escape wired once.
- **Phase 3 (responsive):** at 960px — shell auto-collapse + pin works, combat tracker fully operable via progressive disclosure, character sheet cleanly readable; at ≥1920px — character sheet multi-column; all data tables `overflow-x-auto`. Devin hand-tests at half-snap; screenshots at 960/1280/1920.

## Out of scope

- Light theme as a shipped feature (dev harness only)
- Phone/tablet viewports
- Shell rearrangement (any IA change is its own effort)
- Decorative domain accent tokens (deferred; inventory documented during phase 1)
- Three.js map color bridge
- Forced migration onto Button/Panel/Card primitives
- Responsive passes on inventory, downtime, map dialogs, manager, rules (beyond the table safety net)

## Open questions punted to the prototype phase

- Combat tracker fold order: what collapses first, and into what (participants strip? rail-into-action-panel?)
- Character sheet multi-column arrangement at wide widths
- Exact auto-collapse thresholds (starting points: rail ~1150px, party ~1000px)
