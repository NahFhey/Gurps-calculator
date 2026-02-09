/**
 * Foraging Resolution Engine
 *
 * Implements the revamped foraging system with three modes:
 * - General: No target, system selects from zone weights
 * - Category: Target a specific category
 * - Specific: Target a specific item with rarity penalties
 *
 * Single-roll resolution: skill check → tier outcome → category/item selection → yield.
 * Reuses GURPS 3d6 mechanics from gathering.js.
 */

import {
  roll3d6,
  isCriticalSuccess,
  isCriticalFailure,
  parseDiceFormula,
} from './gathering';

import type {
  ForageActionInput,
  ForageActionResult,
  ForageZoneProfile,
  ForageItem,
  ForageCategoryMeta,
  ForageTier,
  TierOutcome,
  ForagingConfig,
  ForageEvent,
  FoundStack,
  WeightedCategory,
  ZoneTierCategory,
  AppliedModifier,
  CritState,
  ForageCategoryId,
} from '../types/foraging';

import type { GatheringItemExtended } from '../types/gathering';

import {
  FORAGE_CATEGORY_META,
  FORAGE_TIER_MULTIPLIERS,
  FORAGE_MOS_TIER_THRESHOLDS,
  FORAGE_SPECIFIC_PENALTIES,
  FORAGE_CONTEXT_MODIFIERS,
  getHelperBonus,
  FORAGE_SUPERVISOR_BONUS,
  FORAGE_EVENT_THRESHOLDS,
  FORAGE_HAZARDS,
  FORAGE_EVENTS_MILD,
  FORAGE_EVENTS_RARE,
} from '../constants/foraging';

// ============================================================================
// ZONE PROFILE MIGRATION
// ============================================================================

/**
 * Migrate a zone profile's category arrays from the old WeightedCategory format
 * (no `items` array) to the new ZoneTierCategory format (with `items: []`).
 * Safe to call on already-migrated profiles.
 */
export function migrateZoneProfileCategories(zone: ForageZoneProfile): ForageZoneProfile {
  function migrateCategories(cats: any[]): ZoneTierCategory[] {
    if (!Array.isArray(cats)) return [];
    return cats.map((c: any) => ({
      categoryId: c.categoryId,
      weight: c.weight ?? 1,
      items: Array.isArray(c.items) ? c.items : [],
    }));
  }

  return {
    ...zone,
    commonCategories: migrateCategories(zone.commonCategories),
    uncommonCategories: migrateCategories(zone.uncommonCategories),
    rareCategories: migrateCategories(zone.rareCategories),
  };
}

// ============================================================================
// ITEM SELECTION FROM ZONE PROFILE
// ============================================================================

/**
 * Select a specific item from a zone profile's per-item weights for a given tier and category.
 *
 * Looks up the ZoneTierCategory for the tier+category in the zone profile,
 * performs weighted random selection from category.items[],
 * then looks up the selected item in gatheringItems to get full details.
 *
 * @returns The matched GatheringItemExtended, or null if no items configured
 */
export function selectItemFromZoneProfile(
  zone: ForageZoneProfile,
  tier: ForageTier,
  categoryId: ForageCategoryId,
  gatheringItems: GatheringItemExtended[]
): GatheringItemExtended | null {
  const tierCategories: ZoneTierCategory[] =
    tier === 'common' ? zone.commonCategories :
    tier === 'uncommon' ? zone.uncommonCategories :
    zone.rareCategories;

  const category = tierCategories.find((c) => c.categoryId === categoryId);
  if (!category || !category.items || category.items.length === 0) return null;

  // Weighted random selection among items
  const totalWeight = category.items.reduce((sum, wi) => sum + wi.weight, 0);
  if (totalWeight <= 0) return null;

  let random = Math.random() * totalWeight;
  let selectedItemId: string | null = null;
  for (const wi of category.items) {
    random -= wi.weight;
    if (random <= 0) {
      selectedItemId = wi.itemId;
      break;
    }
  }
  if (!selectedItemId) {
    selectedItemId = category.items[category.items.length - 1].itemId;
  }

  // Look up the GatheringItemExtended
  return gatheringItems.find((item) => item.id === selectedItemId) ?? null;
}

// ============================================================================
// SKILL CALCULATION
// ============================================================================

/**
 * Calculate the effective skill for a forage action, including all modifiers.
 */
export function calculateForageEffectiveSkill(
  input: ForageActionInput,
  targetItem?: ForageItem
): { effectiveSkill: number; modifiers: AppliedModifier[] } {
  const modifiers: AppliedModifier[] = [];
  let total = input.baseSkillLevel;
  modifiers.push({ label: 'Base Skill', value: input.baseSkillLevel });

  // Tool bonus
  if (input.toolSkillBonus !== 0) {
    total += input.toolSkillBonus;
    modifiers.push({ label: 'Tools', value: input.toolSkillBonus });
  }

  // Helper bonus
  const helperBonus = getHelperBonus(input.helperCount);
  if (helperBonus !== 0) {
    total += helperBonus;
    modifiers.push({ label: `Helpers (${input.helperCount})`, value: helperBonus });
  }

  // Supervisor bonus
  if (input.supervisorSkill15Plus) {
    total += FORAGE_SUPERVISOR_BONUS;
    modifiers.push({ label: 'Supervisor (15+)', value: FORAGE_SUPERVISOR_BONUS });
  }

  // Context modifiers
  if (input.contextFlags.hasMapOrGuide) {
    total += FORAGE_CONTEXT_MODIFIERS.mapGuide.value;
    modifiers.push({ label: FORAGE_CONTEXT_MODIFIERS.mapGuide.label, value: FORAGE_CONTEXT_MODIFIERS.mapGuide.value });
  }
  if (input.contextFlags.isUnfamiliarOrHostile) {
    total += FORAGE_CONTEXT_MODIFIERS.unfamiliar.value;
    modifiers.push({ label: FORAGE_CONTEXT_MODIFIERS.unfamiliar.label, value: FORAGE_CONTEXT_MODIFIERS.unfamiliar.value });
  }
  if (input.contextFlags.isPeakSeason) {
    total += FORAGE_CONTEXT_MODIFIERS.peakSeason.value;
    modifiers.push({ label: FORAGE_CONTEXT_MODIFIERS.peakSeason.label, value: FORAGE_CONTEXT_MODIFIERS.peakSeason.value });
  }
  if (input.contextFlags.isOffSeason) {
    total += FORAGE_CONTEXT_MODIFIERS.offSeason.value;
    modifiers.push({ label: FORAGE_CONTEXT_MODIFIERS.offSeason.label, value: FORAGE_CONTEXT_MODIFIERS.offSeason.value });
  }
  if (input.contextFlags.hasProperTools) {
    total += FORAGE_CONTEXT_MODIFIERS.properTools.value;
    modifiers.push({ label: FORAGE_CONTEXT_MODIFIERS.properTools.label, value: FORAGE_CONTEXT_MODIFIERS.properTools.value });
  }
  if (input.contextFlags.isDenseOrDangerousTerrain && !input.contextFlags.hasProperTools) {
    total += FORAGE_CONTEXT_MODIFIERS.denseTerrainNoTools.value;
    modifiers.push({ label: FORAGE_CONTEXT_MODIFIERS.denseTerrainNoTools.label, value: FORAGE_CONTEXT_MODIFIERS.denseTerrainNoTools.value });
  }

  // Weather modifier
  if (input.weatherModifier !== 0) {
    total += input.weatherModifier;
    modifiers.push({ label: 'Weather', value: input.weatherModifier });
  }

  // Specific item targeting penalty
  if (input.mode === 'specific' && targetItem) {
    const penalty = FORAGE_SPECIFIC_PENALTIES[targetItem.tier] ?? 0;
    if (penalty !== 0) {
      total += penalty;
      modifiers.push({ label: `Rarity (${targetItem.tier})`, value: penalty });
    }
  }

  return { effectiveSkill: total, modifiers };
}

// ============================================================================
// TIER DETERMINATION
// ============================================================================

/**
 * Determine the tier outcome from the margin of success.
 */
export function determineTierOutcome(
  margin: number,
  success: boolean,
  critSuccess: boolean,
  critFailure: boolean,
  config: ForagingConfig
): TierOutcome {
  if (critFailure) {
    return config.failureGivesNothing ? 'nothing' : 'scraps';
  }
  if (!success) {
    return config.failureGivesNothing ? 'nothing' : 'scraps';
  }
  if (critSuccess) {
    return 'rare';
  }
  if (margin >= FORAGE_MOS_TIER_THRESHOLDS.rare.min) {
    return 'rare';
  }
  if (margin >= FORAGE_MOS_TIER_THRESHOLDS.uncommon.min) {
    return 'uncommon';
  }
  return 'common';
}

// ============================================================================
// WEIGHTED RANDOM SELECTION
// ============================================================================

/**
 * Select a category from weighted options using random sampling.
 */
export function weightedRandomSelect(weights: WeightedCategory[]): ForageCategoryId | null {
  if (weights.length === 0) return null;

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight <= 0) return null;

  let random = Math.random() * totalWeight;
  for (const entry of weights) {
    random -= entry.weight;
    if (random <= 0) {
      return entry.categoryId;
    }
  }

  // Fallback to last entry
  return weights[weights.length - 1].categoryId;
}

// ============================================================================
// CATEGORY SELECTION
// ============================================================================

/**
 * Select a category based on mode and zone weights.
 */
export function selectCategory(
  input: ForageActionInput,
  tier: ForageTier,
  zone: ForageZoneProfile,
  targetItem?: ForageItem
): ForageCategoryId | null {
  if (input.mode === 'category' && input.targetCategory) {
    return input.targetCategory;
  }
  if (input.mode === 'specific' && targetItem) {
    return targetItem.categoryId;
  }

  // General mode: weighted random from zone profile
  const weights =
    tier === 'common' ? zone.commonCategories :
    tier === 'uncommon' ? zone.uncommonCategories :
    zone.rareCategories;

  // If the specific tier has no categories, fall back to common
  if (weights.length === 0 && tier !== 'common') {
    return weightedRandomSelect(zone.commonCategories);
  }

  return weightedRandomSelect(weights);
}

// ============================================================================
// ITEM SELECTION
// ============================================================================

/**
 * Select an item filtered by tier, category, zone, and season restrictions.
 */
export function selectItem(
  allItems: ForageItem[],
  tier: ForageTier,
  categoryId: ForageCategoryId,
  zoneId: string,
  zoneTags: string[],
  season?: string
): ForageItem | null {
  const candidates = allItems.filter((item) => {
    if (item.tier !== tier) return false;
    if (item.categoryId !== categoryId) return false;

    // Zone restrictions
    if (item.zoneRestrictions && item.zoneRestrictions.length > 0) {
      if (!item.zoneRestrictions.includes(zoneId)) return false;
    }

    // Tag restrictions
    if (item.tagRestrictions && item.tagRestrictions.length > 0) {
      if (!item.tagRestrictions.some((tag) => zoneTags.includes(tag))) return false;
    }

    // Season restrictions
    if (season && item.seasonRestrictions && item.seasonRestrictions.length > 0) {
      if (!item.seasonRestrictions.includes(season)) return false;
    }

    return true;
  });

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ============================================================================
// YIELD CALCULATION
// ============================================================================

/**
 * Evaluate a GURPS dice formula (e.g., "3d+1") and return the total.
 */
function rollDiceFormula(formula: string): number {
  const parsed = parseDiceFormula(formula);
  if (!parsed) return 1;

  let total = 0;
  for (let i = 0; i < parsed.count; i++) {
    total += Math.floor(Math.random() * (parsed.sides || 6)) + 1;
  }
  total += parsed.modifier || 0;
  return Math.max(1, total);
}

/**
 * Calculate yield for a found item.
 */
export function calculateForageYield(
  item: ForageItem | null,
  categoryMeta: ForageCategoryMeta | null,
  tierOutcome: TierOutcome,
  toolYieldBonus: number = 0,
  skillLevel: number = 0
): number {
  const formula = item?.yieldFormula ?? categoryMeta?.defaultYieldFormula ?? '1d';
  let baseRoll = rollDiceFormula(formula);

  // Skill 15+ bonus: add 1d to yield before multiplier
  if (skillLevel >= 15) {
    baseRoll += rollDiceFormula('1d');
  }

  // Tool yield bonus (extra flat units)
  baseRoll += toolYieldBonus;

  const multiplier = FORAGE_TIER_MULTIPLIERS[tierOutcome] ?? 1.0;
  return Math.max(1, Math.floor(baseRoll * multiplier));
}

// ============================================================================
// EVENT SYSTEM
// ============================================================================

/**
 * Determine if an event check should be made based on mode and outcomes.
 */
export function shouldCheckForEvent(
  mode: ForageActionInput['mode'],
  tierOutcome: TierOutcome,
  success: boolean,
  critSuccess: boolean,
  critFailure: boolean
): boolean {
  switch (mode) {
    case 'general':
      // Only on crits
      return critSuccess || critFailure;
    case 'category':
      // On rare tier, failure, or crits
      return tierOutcome === 'rare' || !success || critSuccess || critFailure;
    case 'specific':
      // Always
      return true;
    default:
      return false;
  }
}

/**
 * Roll for an event and determine its severity and content.
 */
export function resolveEvent(
  critFailure: boolean,
  config: ForagingConfig
): ForageEvent | undefined {
  if (!config.eventsEnabled) return undefined;

  const { total: eventRoll } = roll3d6();

  // Determine severity from roll
  let severity: 'rare' | 'mild' | 'none';
  if (eventRoll <= FORAGE_EVENT_THRESHOLDS.rare.max) {
    severity = 'rare';
  } else if (eventRoll <= FORAGE_EVENT_THRESHOLDS.mild.max) {
    severity = 'mild';
  } else {
    severity = 'none';
  }

  // Critical failure forces at least mild
  if (critFailure && severity === 'none') {
    severity = 'mild';
  }

  if (severity === 'none') return undefined;

  // Select event from appropriate table
  const table = severity === 'rare' ? FORAGE_EVENTS_RARE : FORAGE_EVENTS_MILD;
  const eventTemplate = table[Math.floor(Math.random() * table.length)];

  return {
    severity,
    name: eventTemplate.name,
    effects: eventTemplate.effects.map((e: any) => ({
      kind: e.kind,
      value: e.value,
      diceFormula: e.diceFormula,
      tag: e.tag,
      statusName: e.statusName,
      description: e.description,
    })),
    notes: eventTemplate.description,
  };
}

// ============================================================================
// LOG TEXT BUILDER
// ============================================================================

/**
 * Build a human-readable log line from the resolution result.
 */
export function buildForageLogText(
  actorName: string,
  skillLabel: string,
  zoneName: string,
  roll: number,
  effectiveSkill: number,
  margin: number,
  success: boolean,
  critSuccess: boolean,
  critFailure: boolean,
  tierOutcome: TierOutcome,
  foundStacks: FoundStack[],
  event?: ForageEvent
): string {
  const parts: string[] = [];

  // Actor and skill
  parts.push(`${actorName} forages (${skillLabel}) in ${zoneName}:`);

  // Roll result
  if (critSuccess) {
    parts.push(`Critical Success!`);
  } else if (critFailure) {
    parts.push(`Critical Failure!`);
  } else if (success) {
    parts.push(`Success by ${margin}.`);
  } else {
    parts.push(`Failure by ${Math.abs(margin)}.`);
  }

  parts.push(`Rolled ${roll} vs ${effectiveSkill} → ${tierOutcome}.`);

  // Found items
  if (foundStacks.length > 0) {
    const itemStrs = foundStacks.map(
      (s) => `${s.itemName} ${s.quantity} units${s.quality === 'high' ? ' (high quality)' : ''}`
    );
    parts.push(`Found ${itemStrs.join(', ')}.`);
  } else {
    parts.push('Found nothing harvestable.');
  }

  // Event
  if (event) {
    parts.push(`${event.severity === 'rare' ? 'Rare' : 'Mild'} event: ${event.name}.`);
    if (event.effects.length > 0) {
      parts.push(event.effects.map((e) => e.description).join('; ') + '.');
    }
  }

  return parts.join(' ');
}

// ============================================================================
// MAIN RESOLUTION FUNCTION
// ============================================================================

/**
 * Resolve a single forage action.
 *
 * This is the main entry point called by ForagingActivity on task resolution.
 * It orchestrates the full pipeline: skill check → tier → category → item → yield → events.
 *
 * @param input - The forage action input with all context
 * @param zone - The zone profile being foraged
 * @param allItems - All available forage items
 * @param config - Foraging configuration flags
 * @param actorName - Display name for log text
 * @param gatheringItems - Optional items from the Gathering Manager Items tab for per-item selection
 * @returns Complete resolution result
 */
export function resolveForage(
  input: ForageActionInput,
  zone: ForageZoneProfile | undefined,
  allItems: ForageItem[],
  config: ForagingConfig,
  actorName: string = 'Worker',
  gatheringItems: GatheringItemExtended[] = []
): ForageActionResult {
  // Resolve the target item for specific mode
  const targetItem = input.mode === 'specific' && input.targetItemId
    ? allItems.find((i) => i.id === input.targetItemId)
    : undefined;

  // 1. Calculate effective skill
  const { effectiveSkill, modifiers } = calculateForageEffectiveSkill(input, targetItem);

  // 2. Roll 3d6
  const { total: rollTotal } = roll3d6();
  const margin = effectiveSkill - rollTotal;
  const success = rollTotal <= effectiveSkill && !isCriticalFailure(rollTotal, effectiveSkill);
  const critSuccess = isCriticalSuccess(rollTotal, effectiveSkill);
  const critFailure = isCriticalFailure(rollTotal, effectiveSkill);

  const crit: CritState = critSuccess ? 'critical_success' : critFailure ? 'critical_failure' : 'none';

  // 3. Determine tier
  const tierOutcome = determineTierOutcome(margin, success, critSuccess, critFailure, config);

  if (tierOutcome === 'nothing') {
    const skillLabel = input.skillUsed === 'herbLore' ? 'Herb Lore' :
      input.skillUsed.charAt(0).toUpperCase() + input.skillUsed.slice(1);
    const logText = buildForageLogText(
      actorName, skillLabel, zone?.name ?? 'unknown zone',
      rollTotal, effectiveSkill, margin, false, critSuccess, critFailure,
      tierOutcome, []
    );
    return {
      actorId: input.actorId,
      zoneId: input.zoneId,
      mode: input.mode,
      roll: { total: rollTotal, margin, crit, modifiersApplied: modifiers },
      tierOutcome,
      found: [],
      logText,
    };
  }

  // 4. Select category + item(s)
  const foundStacks: FoundStack[] = [];
  const effectiveTier: ForageTier = tierOutcome === 'scraps' ? 'common' : tierOutcome as ForageTier;

  if (input.mode === 'specific' && targetItem && success) {
    // Specific mode: use the target item directly
    const qty = calculateForageYield(
      targetItem,
      FORAGE_CATEGORY_META[targetItem.categoryId] ?? null,
      tierOutcome,
      input.toolYieldBonus,
      effectiveSkill
    );
    foundStacks.push({
      itemId: targetItem.id,
      itemName: targetItem.name,
      categoryId: targetItem.categoryId,
      quantity: qty,
      quality: critSuccess ? 'high' : 'normal',
      inventoryKind: targetItem.inventoryKind,
      typeId: targetItem.typeId,
    });
  } else if (zone) {
    // General or Category mode: select from zone weights
    const catId = selectCategory(input, effectiveTier, zone, targetItem);
    if (catId) {
      const catMeta = FORAGE_CATEGORY_META[catId] ?? null;

      // Try per-item weighted selection from zone profile first (new system)
      const gatheringItem = selectItemFromZoneProfile(zone, effectiveTier, catId, gatheringItems);

      if (gatheringItem) {
        // Found an item from the Gathering Manager Items tab
        const yieldFormula = gatheringItem.yieldFormula || catMeta?.defaultYieldFormula || '1d';
        const fakeForageItem: ForageItem = {
          id: gatheringItem.id,
          name: gatheringItem.name,
          categoryId: catId,
          tier: effectiveTier,
          yieldFormula,
          inventoryKind: gatheringItem.inventoryKind,
          typeId: gatheringItem.typeId,
        };
        const qty = calculateForageYield(fakeForageItem, catMeta, tierOutcome, input.toolYieldBonus, effectiveSkill);
        foundStacks.push({
          itemId: gatheringItem.id,
          itemName: gatheringItem.name,
          categoryId: catId,
          quantity: qty,
          quality: critSuccess ? 'high' : 'normal',
          inventoryKind: gatheringItem.inventoryKind,
          typeId: gatheringItem.typeId,
        });
      } else {
        // Fall back to old ForageItem-based selection
        const item = selectItem(allItems, effectiveTier, catId, zone.id, zone.tags, zone.currentSeason);

        if (item) {
          const qty = calculateForageYield(item, catMeta, tierOutcome, input.toolYieldBonus, effectiveSkill);
          foundStacks.push({
            itemId: item.id,
            itemName: item.name,
            categoryId: item.categoryId,
            quantity: qty,
            quality: critSuccess ? 'high' : 'normal',
            inventoryKind: item.inventoryKind,
            typeId: item.typeId,
          });
        } else if (catMeta) {
          // No specific item found, yield generic units from the category
          const qty = calculateForageYield(null, catMeta, tierOutcome, input.toolYieldBonus, effectiveSkill);
          foundStacks.push({
            itemId: `generic-${catId}`,
            itemName: catMeta.label,
            categoryId: catId,
            quantity: qty,
            quality: critSuccess ? 'high' : 'normal',
            inventoryKind: catMeta.inventoryKind,
            typeId: catMeta.label,
          });
        }
      }

      // Critical success mixed basket
      if (critSuccess && config.critSuccessMixedBasketEnabled && foundStacks.length === 1) {
        const cat2 = selectCategory(input, 'uncommon', zone, targetItem);
        if (cat2 && cat2 !== catId) {
          // Try per-item zone selection for second item too
          const gatheringItem2 = selectItemFromZoneProfile(zone, 'uncommon', cat2, gatheringItems);
          const catMeta2 = FORAGE_CATEGORY_META[cat2] ?? null;

          if (gatheringItem2) {
            const yieldFormula2 = gatheringItem2.yieldFormula || catMeta2?.defaultYieldFormula || '1d';
            const fakeForageItem2: ForageItem = {
              id: gatheringItem2.id,
              name: gatheringItem2.name,
              categoryId: cat2,
              tier: 'uncommon',
              yieldFormula: yieldFormula2,
              inventoryKind: gatheringItem2.inventoryKind,
              typeId: gatheringItem2.typeId,
            };
            const qty2 = calculateForageYield(fakeForageItem2, catMeta2, 'uncommon', 0, effectiveSkill);
            foundStacks.push({
              itemId: gatheringItem2.id,
              itemName: gatheringItem2.name,
              categoryId: cat2,
              quantity: qty2,
              quality: 'normal',
              inventoryKind: gatheringItem2.inventoryKind,
              typeId: gatheringItem2.typeId,
            });
          } else {
            const item2 = selectItem(allItems, 'uncommon', cat2, zone.id, zone.tags, zone.currentSeason);
            if (item2) {
              const qty2 = calculateForageYield(item2, catMeta2, 'uncommon', 0, effectiveSkill);
              foundStacks.push({
                itemId: item2.id,
                itemName: item2.name,
                categoryId: item2.categoryId,
                quantity: qty2,
                quality: 'normal',
                inventoryKind: item2.inventoryKind,
                typeId: item2.typeId,
              });
            } else if (catMeta2) {
              const qty2 = calculateForageYield(null, catMeta2, 'uncommon', 0, effectiveSkill);
              foundStacks.push({
                itemId: `generic-${cat2}`,
                itemName: catMeta2.label,
                categoryId: cat2,
                quantity: qty2,
                quality: 'normal',
                inventoryKind: catMeta2.inventoryKind,
                typeId: catMeta2.label,
              });
            }
          }
        }
      }
    }
  }

  // 5. Events
  let event: ForageEvent | undefined;
  if (shouldCheckForEvent(input.mode, tierOutcome, success, critSuccess, critFailure)) {
    event = resolveEvent(critFailure, config);
  }

  // Apply event yield effects
  if (event) {
    for (const effect of event.effects) {
      if (effect.kind === 'yield_multiplier' && typeof effect.value === 'number') {
        for (const stack of foundStacks) {
          stack.quantity = Math.max(1, Math.floor(stack.quantity * (1 + effect.value)));
        }
      }
      if (effect.kind === 'extra_units' && typeof effect.value === 'number') {
        for (const stack of foundStacks) {
          stack.quantity += effect.value;
        }
      }
    }
  }

  // Critical failure hazard (add as event if no event already)
  if (critFailure && !event) {
    const hazard = FORAGE_HAZARDS[Math.floor(Math.random() * FORAGE_HAZARDS.length)];
    event = {
      severity: 'mild',
      name: 'Hazard',
      effects: [],
      notes: hazard,
    };
  }

  // 6. Build log text
  const skillLabel = input.skillUsed === 'herbLore' ? 'Herb Lore' :
    input.skillUsed.charAt(0).toUpperCase() + input.skillUsed.slice(1);
  const logText = buildForageLogText(
    actorName, skillLabel, zone?.name ?? 'unknown zone',
    rollTotal, effectiveSkill, margin, success, critSuccess, critFailure,
    tierOutcome, foundStacks, event
  );

  return {
    actorId: input.actorId,
    zoneId: input.zoneId,
    mode: input.mode,
    roll: { total: rollTotal, margin, crit, modifiersApplied: modifiers },
    tierOutcome,
    found: foundStacks,
    event,
    logText,
  };
}
