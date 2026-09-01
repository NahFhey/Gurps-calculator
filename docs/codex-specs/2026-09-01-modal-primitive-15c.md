# SPEC: Shared Modal Primitive + Migration (Phase 2 of 15c)

## Background (why)

This React 18 + TypeScript + Tailwind + Vite app (GURPS campaign manager) has ~15 modal components and ~38 `fixed inset-0` overlay sites across 33 files, each hand-rolling its own backdrop, panel, Escape handling, and (usually missing) accessibility wiring. Phase 1 (already merged) introduced semantic theme tokens (`surface-*`, `fg-*`, `edge-*`, `accent/danger/...-*`) — a grep-gate (`npm run check:tokens`) bans raw gray/status Tailwind families. This phase builds ONE shared `Modal` primitive and migrates every modal-shaped overlay onto it, centralizing dialog accessibility (this intentionally lands most of roadmap phase 15d's modal items). Design context: `docs/UX_DESIGN_15C_PLAN.md` (decisions 11, 15).

## Deliverables

### 1. `src/components/ui/Modal.tsx`

A single Modal primitive. Requirements:

- **Props (shape, adjust names to codebase idiom):**
  - `isOpen: boolean`, `onClose: () => void`
  - `title?: ReactNode` — rendered in a standard header with a close (×) button; when provided, wire `aria-labelledby`. Allow `hideCloseButton?: boolean` for modals that must confirm/cancel explicitly (e.g. GM lock).
  - `size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'` → max-width presets (audit existing modals and pick presets that cover them; `full` ≈ near-viewport for things like the rules browser / GCS import if they need it).
  - `closeOnBackdrop?: boolean` (default `true`) and `closeOnEscape?: boolean` (default `true`).
  - `footer?: ReactNode` — optional standard footer slot (right-aligned button row).
  - `className?` escape hatch for the panel; `children` for body content.
- **Rendering:** `createPortal` to `document.body`. Backdrop `bg-black/60`; panel uses phase-1 tokens (`bg-surface-1 border border-edge rounded-lg` family — match the app's existing modal look so this is not a redesign).
- **Accessibility (the point of this phase):** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (title) or `aria-label` prop fallback. **Focus management with no new dependencies:** on open, focus the panel (or first autofocusable element); Tab/Shift+Tab cycle within the panel; on close, restore focus to the previously focused element.
- **Stacking-safe behavior:** modals can nest (e.g. a confirm on top of a form). Body scroll-lock must use a counter (not naive set/unset). Escape must close only the topmost open modal. A simple module-level open-modal registry is fine. Consistent z-index tier (audit current `z-*` usage first so the modal layer sits above panels/HUD but below toasts if that's the current ordering).
- Scroll: panel `max-h` with internal scroll — long content scrolls inside the panel, never the page.

### 2. Refactor `ConfirmDialog` onto `Modal`

`src/components/ui/ConfirmDialog.tsx` keeps its **exact public API** (`ConfirmDialogProps`, `useConfirmDialog` hook if present) but renders via `Modal` internally. Its tests must keep passing (update only if they assert internal markup).

### 3. Migrate every modal-shaped overlay

Enumerate all `fixed inset-0` sites (33 files listed by `rg -l "fixed inset-0" src -g '*.tsx'`). For each site, classify:

- **Modal-shaped** (centered panel over backdrop, blocks interaction): migrate onto `Modal`. This includes the named `*Modal`/`*Dialog` components AND inline ad-hoc modals (e.g. two inside `src/unified/UnifiedShell.tsx` — the generic `layoutState.modalContent` overlay and the delete-character confirm; the delete confirm should become a `ConfirmDialog`). Preserve each modal's existing behavior: current backdrop-click and Escape semantics (set the props to match what the site does today; where a site has NO Escape/backdrop handling today, adopt the defaults — that's a deliberate UX upgrade, not a regression), sizes approximated to presets, existing buttons move to `footer` where they fit naturally.
- **Not modal-shaped** (full-screen click-catcher for a dropdown/popover, drag shields, etc.): leave as-is, but list each in your summary with one line of justification.

After migration, no migrated site may retain its own backdrop div, Escape listener, `role="dialog"`, or body-scroll-lock — that all lives in `Modal` now.

### 4. Export + tests

- Export `Modal` from `src/components/ui/index.ts`.
- New test file `src/components/ui/__tests__/Modal.test.tsx` covering at minimum: renders nothing when closed; `role="dialog"`/`aria-modal`/`aria-labelledby` present when open; Escape calls `onClose`; Escape with two stacked modals closes only the top one; backdrop click honors `closeOnBackdrop`; focus moves into the panel on open and returns on close; body scroll-lock applied and released (incl. nested counter case); footer renders.
- Existing modal tests: keep green; update assertions that touched hand-rolled markup.

## Constraints

- `strict: true` clean (`npx tsc --noEmit`); no `as any`, no `@ts-ignore`.
- No new runtime dependencies (focus trap is hand-rolled).
- Theme-token classes only — `npm run check:tokens` must stay green.
- **No visual redesign**: same backdrop opacity, same panel styling family, same sizes (approximated to presets). This is a consolidation, not a restyle.
- Do not touch `src/components/map/three/**`. Do not build Button/Panel/Card primitives — out of scope.
- Behavior parity: forms must not lose state on accidental backdrop clicks if they are protected today (`closeOnBackdrop={false}` at those sites).

## Definition of done — self-verify before finishing

1. `npx tsc --noEmit` → clean.
2. `npm run check:tokens` → exit 0.
3. `npx vitest run` → full suite green (~4,209 tests + your new ones). Fix failures you caused. (If the sandbox blocks server-socket listeners, note the skips.)
4. `npm run build` → succeeds.
5. `rg -n "role=\"dialog\"" src` → only in `Modal.tsx` (plus tests). `rg -l "fixed inset-0" src -g '*.tsx'` → only `Modal.tsx` and the justified non-modal sites.

## Final summary requested

One paragraph on the Modal API and focus/stacking design, then three lists: (a) every migrated site with its chosen size preset and backdrop/Escape settings (flagging which sites *gained* Escape/backdrop-close), (b) every `fixed inset-0` site left unmigrated and why, (c) any behavior you could not preserve exactly, with what you did instead. Flag anything unanticipated rather than silently working around it.
