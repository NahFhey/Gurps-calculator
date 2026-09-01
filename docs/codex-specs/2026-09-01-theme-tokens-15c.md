# SPEC: Theme Token Infrastructure + Mechanical Class Swap (Phase 1 of 15c)

## Background (why)

This React 18 + TypeScript + Tailwind + Vite app (a GURPS campaign manager) is hardcoded dark: ~1,470 `bg-gray-*` instances across 199 files, no CSS variables, no shared color definitions. We are introducing a semantic theme-token layer (CSS custom properties mapped into Tailwind color names) and mechanically migrating every call site onto it. Dark is the only shipped palette; a rough light palette exists behind a dev-only toggle purely to validate that the token indirection works. Full design context: `docs/UX_DESIGN_15C_PLAN.md` (decisions 7–14). The launch must be **pixel-identical** except where noted below.

## Deliverables

### 1. CSS variables — `src/index.css`

Define all tokens as CSS custom properties on `:root` holding **raw RGB triplets** (e.g. `--surface-0: 17 24 39;`) so Tailwind opacity modifiers keep working. Add a `:root[data-theme="light"]` override block with a rough light palette (see §5). Dark values are the Tailwind v3 defaults of the classes they replace (exact hex → RGB, no rounding).

**Neutral tokens** (values = Tailwind gray):

| Token | Source shade | Hex |
|---|---|---|
| `surface-sunken` | gray-950 | #030712 |
| `surface-0` | gray-900 | #111827 |
| `surface-1` | gray-800 | #1f2937 |
| `surface-2` | gray-700 | #374151 |
| `surface-3` | gray-600 | #4b5563 |
| `surface-4` | gray-500 | #6b7280 |
| `fg-bright` | gray-100 | #f3f4f6 |
| `fg-primary` | gray-200 | #e5e7eb |
| `fg-secondary` | gray-300 | #d1d5db |
| `fg-muted` | gray-400 | #9ca3af |
| `fg-faint` | gray-500 | #6b7280 |
| `fg-disabled` | gray-600 | #4b5563 |
| `edge-bright` | gray-500 | #6b7280 |
| `edge-strong` | gray-600 | #4b5563 |
| `edge` (DEFAULT) | gray-700 | #374151 |
| `edge-subtle` | gray-800 | #1f2937 |

**Status ramps** (shade-preserving renames; define a variable **only for shades actually used in src/** — enumerate with grep before writing):

- `accent-<N>` ← `blue-<N>` (Tailwind v3 default blue values)
- `success-<N>` ← `green-<N>`
- `danger-<N>` ← `red-<N>`
- `warning-<N>` ← `amber-<N>`
- `info-<N>` ← `sky-<N>` (only 2 uses today)

### 2. Tailwind mapping — `tailwind.config.js`

`theme.extend.colors` entries of the form `'surface-0': 'rgb(var(--surface-0) / <alpha-value>)'`, for every token. Nested object form is fine (e.g. `surface: { 0: ..., sunken: ... }`, `edge: { DEFAULT: ..., strong: ... }`, `accent: { 500: ..., 600: ... }`). Do **not** set a `darkMode` key and do not introduce any `dark:` variants anywhere.

### 3. Mechanical swap — committed codemod

Write `scripts/codemods/theme-token-swap.mjs` (Node, no new deps, idempotent) and run it over `src/**/*.{ts,tsx}` and `index.html`. It must be **utility-aware** — the semantic family depends on the utility prefix, not just the color:

- **Surface rule** — utilities `bg-`, `from-`, `to-`, `via-` with `(gray|slate|stone)-<shade>`: 950→`surface-sunken`, 900→`surface-0`, 800→`surface-1`, 700→`surface-2`, 600→`surface-3`, 500→`surface-4`. Also the bogus shades that don't exist in Tailwind and currently render as **no-ops**: 850→`surface-1`, 750→`surface-2`, 650→`surface-3` (this is a deliberate bug fix — these classes did nothing before; list all occurrences in your summary).
- **Text rule** — utilities `text-`, `placeholder-` with `(gray|slate)-<shade>`: 100→`fg-bright`, 200→`fg-primary`, 300→`fg-secondary`, 400→`fg-muted`, 500→`fg-faint`, 600→`fg-disabled`.
- **Edge rule** — utilities `border-`, `ring-`, `divide-`, `outline-` with `(gray|slate|stone)-<shade>`: 500→`edge-bright`, 600→`edge-strong`, 700→`edge`, 800→`edge-subtle`.
- **Status rule** — any utility with `blue-<N>`→`accent-<N>`, `green-<N>`→`success-<N>`, `red-<N>`→`danger-<N>`, `amber-<N>`→`warning-<N>`, `sky-<N>`→`info-<N>`. Shade preserved verbatim, opacity suffixes (`/10`, `/60`) and variant prefixes (`hover:`, `focus:`, `group-hover:`, etc.) preserved untouched.
- The swap applies inside test files too (3 test files assert gray classes today — update their expectations via the same rules).
- **Out of swap scope:** `server/`, `electron/` (the `#111827` splash color stays hardcoded), `docs/`, `scripts/`, and `src/components/map/three/**` (raw Three.js hex — exempt by design; it uses no Tailwind classes anyway). Do not swap `yellow`, `cyan`, `emerald`, `purple`, `teal`, `indigo`, `pink`, `rose`, `orange`, `lime` — decorative accents are deferred by design.

### 4. Hand-fixes — light-end strays (not mechanical)

Occurrences of light-end classes in the dark app are un-migrated legacy styling — fix each **by context** to the appropriate dark token so the screen matches the rest of the app: `bg-gray-50/100/200`, `text-gray-700/800/900` (when used as dark-text-on-dark, it's a bug; when intentionally dark-on-light-accent, pick the closest token by hex value), `border-gray-100/200/300/400`, `ring-gray-400`, and any slate equivalents. Known offenders: `src/components/downtime/DowntimePanel.tsx` (~lines 62, 66), `src/components/downtime/views/AlchemyTaskCard.tsx`, `src/components/PerformanceDashboard.tsx`. Enumerate every one you find and list the per-site decision in your summary. Last resort for a genuinely intentional case: add it to the gate allowlist (§6) with a reason.

### 5. Dev-only light palette + toggle

- Rough light values in the `:root[data-theme="light"]` block — sensible inversions (e.g. `surface-0` ≈ #f9fafb, `surface-1` ≈ #ffffff, fg ramp flipped to dark grays, edges to light grays; status ramps may initially keep their dark-theme values). **Ugly is acceptable; illegible is not** — every module must render readable text in light mode. This is a validation harness, not a feature.
- `src/components/ui/ThemeDevToggle.tsx`: tiny button toggling `document.documentElement.dataset.theme` between unset (dark) and `"light"`. Rendered **only when `import.meta.env.DEV`** — mount it in the header area of `src/unified/UnifiedShell.tsx` (near the existing debug UI, ~line 444). No persistence.

### 6. Grep-gate — `scripts/check-theme-tokens.mjs`

Node script, no deps. Scans `src/**/*.{ts,tsx}` + `index.html` for the banned pattern `\b(gray|slate|zinc|neutral|stone|blue|green|red|amber|sky)-(50|100|200|300|400|500|600|700|800|900|950)\b`. Reads an allowlist at `scripts/theme-token-allowlist.json` (array of `{ "file": "...", "pattern": "...", "reason": "..." }`; create it, empty or minimal). Exits 1 with a per-file, per-line report of violations; exits 0 clean. Add `"check:tokens": "node scripts/check-theme-tokens.mjs"` to `package.json` scripts. The gate must pass at the end of your work.

## Constraints

- TypeScript `strict: true` must stay clean: `npx tsc --noEmit` zero errors. No `as any`, no `@ts-ignore`.
- No new runtime dependencies. No visual redesign — this is a rename, not a restyle (exceptions: the no-op-shade bug fixes and the stray-file hand-fixes, both listed in your summary).
- Slate/stone fold into the gray-equivalent tokens per the tables (a known, accepted subtle shift).
- Do not build Modal/Button/Panel/Card primitives — that is phase 2.

## Definition of done — self-verify before finishing

1. `node scripts/check-theme-tokens.mjs` → exit 0.
2. `npx tsc --noEmit` → clean.
3. `npx vitest run` → full suite green (~4,185 tests). Fix any failures you caused.
4. `npm run build` → succeeds.
5. Codemod re-run is a no-op (idempotent).

## Final summary requested

One paragraph on design decisions plus three lists: (a) every no-op-shade (650/750/850) occurrence fixed, (b) every light-end stray and what you changed it to, (c) any allowlist entries added and why. Flag anything you found that the spec didn't anticipate (dynamic class construction, inline hex styles matching the gray palette, etc.) rather than silently working around it.
