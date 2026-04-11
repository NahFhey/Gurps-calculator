/**
 * @fileoverview Utility helper functions for the GURPS calculator application
 *
 * This module provides common utility functions used across the application:
 * - Safe JSON parsing with fallback values
 * - Number validation and conversion
 * - Quality determination from crafting points
 * - Crafting project material management
 * - Reagent identification level visibility logic
 */

/**
 * Safely parses a JSON string with fallback value on failure
 *
 * @param {string|null|undefined} value - JSON string to parse
 * @param {*} fallback - Value to return if parsing fails or value is falsy
 * @returns {*} Parsed JSON object or fallback value
 *
 * @example
 * safeParse('{"key": "value"}', {}) // Returns: {key: "value"}
 * safeParse(null, []) // Returns: []
 * safeParse('invalid json', {}) // Returns: {}
 */
export function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Deep-clone an object via JSON serialization with crash safety.
 * Returns the original reference (no clone) if serialization fails.
 *
 * @param {T} obj - Object to deep clone
 * @returns {T} Cloned object, or original if clone fails
 */
export function safeDeepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    console.warn('[safeDeepClone] Failed to clone object, returning original reference');
    return obj;
  }
}

/**
 * Converts a value to a finite number or returns a fallback
 * Prevents NaN from entering storage or calculations
 *
 * @param {number|string|*} value - Value to convert to number
 * @param {number} [fallback=0] - Value to return if conversion fails
 * @returns {number} Finite number or fallback
 *
 * @example
 * toNumberOr("123", 0) // Returns: 123
 * toNumberOr("abc", 10) // Returns: 10
 * toNumberOr(NaN, 5) // Returns: 5
 * toNumberOr(Infinity, 0) // Returns: 0
 */
export function toNumberOr(value, fallback = 0) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Determines quality label from Crafting Points (CP) value
 * Used in GURPS crafting system to describe item quality
 *
 * CP Quality Scale:
 * - 0: Clean (no flaws)
 * - 1: Works with minor drawback
 * - 2: Unstable
 * - 3: Flawed
 * - 4+: Mishap
 *
 * @param {number} cp - Crafting points value
 * @returns {string} Quality description label
 */
export function determineQuality(cp) {
  if (cp === 0) return 'Clean';
  if (cp === 1) return 'Works (Minor Drawback)';
  if (cp === 2) return 'Unstable';
  if (cp === 3) return 'Flawed';
  return 'Mishap';
}

/**
 * Refunds materials consumed by a crafting project back to inventory
 *
 * This function handles the case where a project is abandoned or cancelled,
 * returning consumed materials to the inventory. If the original material
 * entry was deleted, it recreates a minimal entry with the refunded quantity.
 *
 * @param {Object} project - The crafting project containing consumed materials
 * @param {Array<Object>} project.consumedMaterials - Materials used by project
 * @param {string} project.consumedMaterials[].materialId - Original material ID
 * @param {number} project.consumedMaterials[].amount - Amount consumed
 * @param {string} project.consumedMaterials[].name - Material name (for recreation)
 * @param {string} project.consumedMaterials[].type - Material type (for recreation)
 * @param {Array<Object>} materials - Current material inventory
 * @returns {Array<Object>} Updated material inventory with refunded quantities
 */
export function refundMaterialsFromProject(project, materials) {
  const usage = project?.consumedMaterials;
  if (!usage || usage.length === 0) return materials;

  const byId = new Map(materials.map(m => [m.id, {...m}]));
  for (const u of usage) {
    if (byId.has(u.materialId)) {
      // Add back to existing material entry
      const m = byId.get(u.materialId);
      m.quantity = (Number.isFinite(m.quantity) ? m.quantity : 0) + u.amount;
      byId.set(u.materialId, m);
    } else {
      // Material entry was deleted; recreate a minimal one
      byId.set(u.materialId, {
        id: u.materialId,
        name: u.name || 'refunded material',
        type: u.type || '',
        quantity: u.amount
      });
    }
  }
  return Array.from(byId.values());
}

/**
 * Updates or inserts a craft project in the crafts list
 * If a craft with matching ID exists, it's replaced; otherwise appended
 *
 * @param {Array<Object>} list - Current list of craft projects
 * @param {Object} craft - Craft project to upsert
 * @param {string} craft.id - Unique craft identifier
 * @returns {Array<Object>} Updated crafts list
 */
export function upsertCraft(list, craft) {
  const idx = list.findIndex(x => x.id === craft.id);
  if (idx >= 0) return list.map((x, i) => (i === idx ? craft : x));
  return [...list, craft];
}

/**
 * Removes a craft project from the crafts list by ID
 *
 * @param {Array<Object>} list - Current list of craft projects
 * @param {string} craftId - ID of craft to remove
 * @returns {Array<Object>} Updated crafts list without specified craft
 */
export function removeCraft(list, craftId) {
  return list.filter(x => x.id !== craftId);
}

/**
 * Gets visible reagent information based on identification level
 *
 * This implements the GURPS alchemy identification system where reagent
 * properties are revealed progressively as identification level increases:
 *
 * Level 0 (Unidentified):
 * - Name, quantity visible
 * - Physical roles (Solvent, Binder, Tool) may be obvious
 *
 * Level 1:
 * - Primary aspect revealed
 *
 * Level 2:
 * - Primary + secondary aspects revealed
 *
 * Level 3:
 * - All aspects (primary, secondary, tertiary) revealed
 *
 * Level 4 (Full Identification):
 * - All aspects, potency, hazards, roles, refinement, concentration
 *
 * @param {Object} reagent - The reagent to get visible info for
 * @param {string} reagent.id - Reagent unique identifier
 * @param {string} reagent.name - Reagent display name
 * @param {number} reagent.quantity - Current quantity in units
 * @param {number} reagent.identificationLevel - Current ID level (0-4)
 * @param {Object} reagent.aspects - Aspect data (may be false profile)
 * @param {Object} [reagent.falseProfile] - False profile if analysis failed
 * @param {Array<string>} reagent.roles - Ingredient roles
 * @param {boolean} [showObviousRoles=true] - Whether to show physical roles at level 0
 * @returns {Object|null} Visible reagent data or null if reagent is null
 */
export function getVisibleReagentInfo(reagent, showObviousRoles = true) {
  if (!reagent) return null;

  const level = reagent.identificationLevel || 0;
  // Use false profile if present (analysis was fooled)
  const useProfile = reagent.falseProfile || reagent;

  // Physical roles that may be obvious without identification
  const physicalRoles = ['Solvent', 'Binder', 'Tool'];
  const visibleRoles = showObviousRoles
    ? (reagent.roles || []).filter(r => physicalRoles.includes(r))
    : [];

  const visible = {
    id: reagent.id,
    name: reagent.name, // Name is always visible
    quantity: reagent.quantity,
    identificationLevel: level,
    analysisHistory: reagent.analysisHistory,
    falseProfile: reagent.falseProfile,
    // Physical properties that may be obvious
    visibleRoles: visibleRoles,
  };

  // Level 0: Unidentified - only name, quantity, and maybe physical roles
  if (level === 0) {
    return visible;
  }

  // Level 1: Primary Aspect
  if (level >= 1) {
    visible.aspects = {
      primary: useProfile.aspects?.primary
    };
  }

  // Level 2: Primary + Secondary Aspects
  if (level >= 2) {
    visible.aspects = {
      primary: useProfile.aspects?.primary,
      secondary: useProfile.aspects?.secondary
    };
  }

  // Level 3: All Aspects
  if (level >= 3) {
    visible.aspects = {
      primary: useProfile.aspects?.primary,
      secondary: useProfile.aspects?.secondary,
      tertiary: useProfile.aspects?.tertiary
    };
  }

  // Level 4: Full Profile (aspects + potency + hazards + all roles)
  if (level >= 4) {
    visible.aspects = useProfile.aspects;
    visible.basePotency = useProfile.basePotency;
    visible.hazards = useProfile.hazards;
    visible.roles = useProfile.roles;
    visible.primaryRole = useProfile.primaryRole;
    visible.refinement = useProfile.refinement;
    visible.concentrationSteps = useProfile.concentrationSteps;
    visible.processingNotes = useProfile.processingNotes;
  }

  return visible;
}

/**
 * Checks if a specific reagent property should be visible at current ID level
 *
 * Property visibility thresholds:
 * - Level 1: primaryAspect
 * - Level 2: secondaryAspect
 * - Level 3: tertiaryAspect
 * - Level 4: basePotency, hazards, roles, refinement, concentrationSteps, processingNotes
 *
 * @param {Object} reagent - The reagent to check
 * @param {number} reagent.identificationLevel - Current identification level
 * @param {string} property - Property name to check visibility for
 * @returns {boolean} True if property should be visible
 */
export function isReagentPropertyVisible(reagent, property) {
  const level = reagent?.identificationLevel || 0;

  const propertyLevels = {
    primaryAspect: 1,
    secondaryAspect: 2,
    tertiaryAspect: 3,
    basePotency: 4,
    hazards: 4,
    roles: 4,
    refinement: 4,
    concentrationSteps: 4,
    processingNotes: 4
  };

  return level >= (propertyLevels[property] || 4);
}
