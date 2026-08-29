# Trading/Commerce (13c) — Design Concept

**Status:** Designed 2026-08-28 (grill-me session, 11 questions). Implementation
dispatched same day (codex-shepherd, spec `2026-08-28-trading-13c.md`).
**Origin:** ROADMAP.md Phase 13c bullet "Trading/Commerce (buy/sell with market
prices, haggling rolls)".

## Problem

The gather→craft→cook production loop dead-ends: the party accumulates hauls with
no way to turn surplus into money, and no way to spend money on goods. Money
itself half-exists (`Inventory.currency` maps, transfer console, loot credits)
but has no spend path, no canonical denomination, and nothing sellable has a
price.

## Decisions (all locked in grilling)

1. **Purpose:** selling surplus is the center of gravity; buying is secondary.
   NO market simulation, price fluctuation, or arbitrage gameplay in v1.
2. **Money:** the existing `Inventory.currency` maps are the one money system.
   Sale proceeds default to the party inventory. A new validated spend path is
   added; no new money structure.
3. **Denomination:** a campaign-level `currencyConfig` — list of currencies
   (key + display name) with one flagged **primary trade currency**; all
   pricing/haggling math runs in the primary only. Default `cp`/"Copper" for
   coherence with existing saves and loot labels. No exchange rates. Setting is
   generic, not Drakenfire-specific.
4. **Prices: learning price book.** GM sets a price the first time an item
   trades; the book (keyed lowercase name + kind: material/food/item) remembers
   and pre-fills next time, editable per transaction. Equipment `ItemInstance.value`
   pre-fills when no book entry exists. No up-front catalog pricing.
5. **Haggling: opt-in Quick Contest** per trip. Leader's Merchant skill (new
   `merchant` key, GCS `'Merchant'` mapping, unskilled default IQ−5) vs GM-set
   opposing skill (default 12). Price shift ±5% per point of net margin, capped
   ±30%, applied favorably per line (sells up, buys down on a win; reversed on a
   loss). Critical success = full +30%. Leader critical failure = merchant
   offended, no deal. Not haggling takes book prices as-is.
6. **No structural buy/sell spread.** One book price; GM edits per transaction;
   haggling models merchant margin. (Followup: optional "merchant markup %"
   config — one field + one multiplication if the table wants it.)
7. **Scope of goods:** sell party-owned materials/food (via owner-aware
   `consumeMaterials`/`consumeFoods`) and equipment/other items from ANY
   inventory (via `consumeItem`, owner-labeled picker). Buys enter the party
   stash via `acquireItem` with new `'trade'` `AcquisitionSource`. A freeform
   **currency adjust line** (± amount + note) covers services, lodging, tolls,
   bribes, rewards.
8. **Task shape:** real `'trading'` `DowntimeTask`; **one task = one market
   trip** occupying a slot with a leader (the negotiator). Resolution panel is a
   transaction console: multiple sell/buy/adjust lines, one optional haggle
   contest for the whole basket, single atomic Apply (inventory + currency +
   price book + changelog). Tile NOT skill-gated (IQ−5 default means anyone can
   trade). No batch mode (per-task config is the substance, same rationale as
   alchemy/crafting).
9. **Location-agnostic v1.** Whether a merchant exists is GM narration. Free-
   text merchant/market name on the task form, pre-filled with current location
   name, flows to card + changelog. Phase 14c will make market availability
   (and possibly per-market books) location-driven later.
10. **Config home:** `currencyConfig` + price book persist in campaign state and
    ride exports. One new **Manager tab "Trading" view**: currency CRUD with
    primary flag, price book table with edit/delete.
11. **Small calls:** insufficient funds → UI blocks Apply, reducer clamps at
    zero, no debt modeling. Crit-success haggle = capped best (+30%).

## Out of scope (recorded followups)

- Market simulation / price fluctuation by location or time (explicitly rejected
  for v1; revisit only if the table demonstrates the need).
- Merchant markup % config (trivial followup if buys feel too cheap).
- Exchange rates / multi-currency pricing; per-merchant currency preferences.
- Location/market gating and settlement services — Phase 14c.
- Selling alchemy reagents (siloed lab stock; own feature if ever).
- Per-character material sourcing for sales (inventory followup #12
  "personal-stake activities" owns this).
- "Sell with these" chaining affordance on gathering hauls (parity with 13b
  chaining scope; add alongside other chaining extensions).
- Debt / negative balances.

## Testing decisions

Mirror the rest-recovery lane: pure engine tests with mocked dice
(`src/utils/trading.ts` — haggle contest, shift clamps, crit paths, line-total
math, rounding), reducer tests (currency spend clamp, price book upsert/remove,
config defaults + migration), transaction-console component tests (sell + buy +
adjust + insufficient-funds block, mocked stores), Manager view tests, changelog
family assertions.
