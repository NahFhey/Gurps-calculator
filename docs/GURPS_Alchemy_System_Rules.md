# GURPS 4e Alchemy System Rules (As Implemented)

This document describes the alchemy rules as currently implemented in the GURPS Calculator tool. It covers reagents, formulas, brewing, processing, and all modifier calculations.

---

## 1. Reagents

Reagents are the raw materials of alchemy. Each reagent has several properties.

### Aspects

Every reagent has up to three magical aspects drawn from the eight elements: Water, Air, Fire, Earth, Vital, Mind, Shadow, and Light. These are ranked by strength on the reagent: primary (strongest affinity), secondary (moderate), and tertiary (weakest).

### Refinement

Reagents exist at one of three refinement levels, which controls which aspects actually contribute when used in a formula:

- **Crude** — All three aspects are active. Primary contributes 3 points, secondary 2, tertiary 1.
- **Prepared** — Tertiary aspect is stripped away. Only primary (3 pts) and secondary (2 pts) contribute.
- **Refined** — Only the primary aspect remains, contributing 3 points.

Higher refinement means a purer ingredient with less "noise" from unwanted aspects, but requires processing work to achieve.

### Potency

Reagents have a base potency level on a five-step scale: P0 (weakest) through P4 (strongest). Higher potency produces more powerful effects but makes the formula harder to brew and pushes it into higher tiers.

### Concentration

Reagents can be concentrated through processing, which increases their effective potency. Each concentration step advances the potency by one level (a P1 reagent with 1 concentration step functions as P2). Concentration is tracked separately from base potency.

### Hazards

Reagents may carry hazard tags that introduce risk during brewing. The seven hazard types are: Flammable, Volatile, Reactive, Unstable, Toxic, Intoxicant, and Hallucinogenic.

### Roles

When placed into a formula, each ingredient is assigned a role that determines how it contributes to the brewing process. The eight roles are: Active, Catalyst, Stabilizer, Solvent, Binder, Vector, Signature, and Tool.

---

## 2. Formula Design

A formula is a recipe — a specific list of ingredients with assigned roles, a chosen delivery vector, and (optionally) selected traits.

### Delivery Vectors

The vector determines how the finished product is delivered. Each vector modifies the base Work Requirement (WR) and Difficulty Modifier (DM), and requires certain ingredient roles to be present:

| Vector | WR Mod | DM Mod | Required Roles |
|--------|--------|--------|----------------|
| Potion | +0 | +0 | Active, Stabilizer, Solvent, Tool |
| Salve/Poultice | +1 | -1 | Active, Binder, Tool |
| Ink/Coating | +1 | -1 | Active, Binder, Tool |
| Aerosol/Smoke | +2 | -2 | Active, Catalyst, Tool |
| Bomb/Grenade | +3 | -3 | Active, Catalyst, Stabilizer, Tool |

### Batch Constraints

- Maximum 8 reagents per batch.
- Maximum units per reagent depend on role: Active (3U), Catalyst (2U), Stabilizer (2U), Solvent (5U), Binder (3U), Vector (1U), Signature (1U), Tool (1U).

### Aspect Tally

When calculating a formula's properties, only the Active ingredients contribute to the aspect tally. Each active ingredient contributes aspect points based on its refinement level and the number of units used. For example, 2 units of a crude reagent with Fire/Light/Shadow aspects contributes Fire 6, Light 4, Shadow 2.

The two aspects with the highest point totals become the formula's dominant and secondary aspects. These determine what kind of effect the potion produces.

### Conflict Pairs

Certain aspects oppose each other. Having both present in the tally causes penalties:

- Fire vs Water
- Light vs Shadow
- Shadow vs Vital

Each conflict pair present reduces DM by 1.

### Coherence

A formula is "coherent" when the dominant aspect leads the secondary by 3 or more tally points. An incoherent formula (too close a spread) adds +1 WR.

---

## 3. Tier System

Formulas are categorized into power tiers (1-4) based on the total potency load of their active ingredients.

### Potency Load Calculation

For each active ingredient: (base potency index + concentration steps) x units used. Sum all actives to get total potency load.

For example: 2 units of a P1 reagent (index 1, 0 concentration) contributes (1+0) x 2 = 2. One unit of a P2 reagent (index 2) with 1 concentration step contributes (2+1) x 1 = 3. Total potency load = 5.

### Tier Thresholds

| Tier | Potency Load Range | Base WR | Base DM | Trait Budget |
|------|-------------------|---------|---------|--------------|
| 1 | 0–3 | 4 | 0 | 10 |
| 2 | 4–6 | 8 | -1 | 25 |
| 3 | 7–9 | 12 | -2 | 50 |
| 4 | 10+ | 16 | -4 | 100 |

The tier can also be manually overridden for backward compatibility with older formulas.

---

## 4. WR/DM Calculation Pipeline

This is the core algorithm. Starting from the tier's base values, the system applies modifiers in this order:

### Step 1 — Vector Modifier

Add the vector's WR and DM modifiers to the base values.

### Step 2 — Role Coverage Penalties

If required roles are missing for the chosen vector:

| Missing Role | WR Penalty | DM Penalty |
|-------------|------------|------------|
| Active | Cannot brew (blocked) | — |
| Tool | Cannot brew (blocked) | — |
| Stabilizer | +2 | -1 |
| Solvent | +2 | -1 |
| Binder | +2 | -1 |
| Catalyst | +1 | +0 |

### Step 3 — Hazard Modifiers

Hazards from ingredients apply WR/DM modifiers based on their trigger conditions:

| Hazard | WR Mod | DM Mod | Trigger |
|--------|--------|--------|---------|
| Flammable | +1 | +0 | Always active (not roll-gated) |
| Volatile | +2 | +0 | Always active (not roll-gated) |
| Reactive | +1 | -1 | Only if conflict pairs are present in the tally |
| Unstable | +1 | +0 | Always active (not roll-gated) |
| Toxic | +0 | +0 | Exposure/mishap only (no WR/DM mod) |
| Intoxicant | +0 | +0 | Exposure only (no WR/DM mod) |
| Hallucinogenic | +0 | +0 | Exposure only (no WR/DM mod) |

Note: Hazards that only trigger on roll outcomes (failure, mishap, exposure) do not apply their WR/DM mods during formula design — they only trigger during brewing.

### Step 4 — Complexity Penalty (Active Aspect Count)

Count distinct aspects with non-zero points in the tally:

- 1–2 aspects: No penalty.
- 3 aspects: +1 WR, -1 DM.
- 4+ aspects: +2 WR, -2 DM.

### Step 5 — Coherence Check

If the dominant aspect does not lead the secondary by at least 3 tally points: +1 WR.

### Step 6 — Conflict Pairs

Each conflict pair (both aspects present with >0 points) reduces DM by 1. (Fire+Water, Light+Shadow, or Shadow+Vital.)

### Step 7 — Concentration Penalty

Uses the highest concentration step count among all active ingredients:

- WR increases by 2 per concentration step.
- DM decreases by 1 per concentration step.

### Step 8 — Refinement Bonus

- If all active ingredients are refined: -2 WR.
- If at least one active is prepared or refined (but not all refined): -1 WR.

### Step 9 — Catalyst Matching Bonus

If any catalyst ingredient shares aspects with the formula's dominant or secondary aspect:

- Matches both dominant and secondary: -2 WR, +1 DM.
- Matches one of them: -1 WR, +1 DM.

### Step 10 — Lab Rating Reduction

Lab Rating ranges from 0 to 4. Subtract the lab rating directly from WR.

### Final Clamp

WR is clamped to a minimum of 1 (you always need at least one work block).

---

## 5. Brewing (Work Blocks)

Once a batch is started, the alchemist performs work blocks — each representing a period of focused labor. Each work block involves a skill roll.

### Effective Skill

Effective Skill = Base Alchemy Skill + DM (from formula) + Lab Rating

Note: Lab Rating is applied twice in the system — once during formula design (reducing WR in Step 10) and again here (boosting the effective skill for each roll). This means a lab with rating 4 both shortens the work and makes each roll easier.

### Roll Classification (GURPS 3d6)

**Critical Success:**
- Always on a roll of 3 or 4.
- On 5 if effective skill is 15+.
- On 6 if effective skill is 16+.

**Critical Failure (Mishap):**
- Always on 18.
- On 17 if effective skill is 15 or less.
- On 16 if effective skill is 6 or less.

**Success:** Roll is equal to or under effective skill (and not a critical).

**Failure:** Roll is above effective skill (and not a critical failure).

### Progress and Contamination

Each roll produces changes to Progress Points (PP) and Contamination Points (CP):

| Outcome | PP Gained | CP Change |
|---------|-----------|-----------|
| Critical Success | +2 PP | -1 CP |
| Success | +1 PP + floor(Margin of Success / 2) | +0 CP |
| Failure | +0 PP | +1 CP |
| Critical Failure | +0 PP | +2 CP |

PP is clamped between 0 and WR. CP cannot go below 0.

### Completion

When PP reaches or exceeds WR, the batch is complete. Final quality depends on accumulated CP:

| CP | Quality |
|----|---------|
| 0 | Clean |
| 1 | Works (Minor Drawback) |
| 2 | Unstable |
| 3 | Flawed |
| 4+ | Mishap |

A Mishap quality marks the batch as failed.

### Hazard Triggers During Brewing

Hazards can fire during work blocks based on roll outcomes:

- **Volatile:** Triggers on any failure or mishap. The batch is immediately destroyed (explosion).
- **Unstable:** Triggers on any failure. Adds +1 extra CP on top of the normal failure penalty.
- **Flammable:** Triggers on completion if the final quality is Unstable, Flawed, or Mishap. Causes fire damage to the lab and workers.
- **Toxic:** Triggers on exposure or mishap. Requires an HT roll or take toxic damage.
- **Intoxicant:** Triggers on exposure. Causes IQ/DX penalties and possible unconsciousness.
- **Hallucinogenic:** Triggers on exposure. Causes mental effects and hallucinations.

### Stabilizer Matching

A stabilizer whose aspects match the formula's dominant aspect is flagged as a "matching stabilizer." This is tracked for display purposes but does not currently modify WR or DM directly.

### Final Potency

The finished product's potency is determined by taking the highest base potency among all active ingredients and adding the maximum concentration steps. This is capped at P4.

---

## 6. Reagent Processing

Reagents can be processed to change their refinement level or concentration. Processing uses its own difficulty system separate from brewing.

### Processing Types

**Refinement** raises a reagent's refinement level:
- Crude to Prepared: Process Step DM = -1
- Prepared to Refined: Process Step DM = -2

**Concentration** increases a reagent's concentration steps:
- Process Step DM = -2 (always)

### Processing Difficulty Calculation

Effective Skill = Alchemy Skill + Lab Rating + Process Step DM + Batch Size Penalty + Potency Control Penalty

**Batch Size Penalty** (per output unit):
- Crude to Prepared: -1 per unit
- Prepared to Refined: -2 per unit
- Concentration: -2 per unit

**Potency Control Penalty:** Equal to the negative of the potency index being worked with. P0 = 0, P1 = -1, P2 = -2, P3 = -3, P4 = -4.

### Processing Roll Outcomes

**Critical Success (roll of 4 or less):** Output produced. May reclaim +1 unit of input.

**Success:** Output produced normally.

**Minor Failure (Margin of Failure 1–2):** Output is still produced, but it gains a hazard tag. Default escalation: first Volatile, then Flammable, then Unstable.

**Regular Failure (Margin of Failure 3+):** Input consumed, no output produced.

**Critical Failure (18, or 17 with effective skill 15 or less):** Input consumed, no output, possible complication.

---

## 7. Trait Budget

Each tier grants a Trait Budget that determines how many effect traits the potion can carry:

| Tier | Trait Budget |
|------|-------------|
| 1 | 10 |
| 2 | 25 |
| 3 | 50 |
| 4 | 100 |

Traits are the specific mechanical effects (advantages, damage, healing, etc.) that the potion provides when used.

---

## 8. Effect Families

Potions are categorized into effect families based on their dominant and secondary aspects. The combination of the two highest aspects (in alphabetical order) determines the family. For example, a potion with dominant Fire and secondary Light falls into the "Fire/Light" family.

---

## 9. GM vs Player Visibility

Hazards have a two-layer visibility system:

- **Player view:** Shows only that a hazard exists, its severity level, and whether it has been identified. Unidentified hazards appear as "Unknown Complication."
- **GM view:** Shows full details including effect text, trigger conditions, and source reagent.

Hazards can be marked as "known" (visible to players) or hidden until triggered or identified through play.
