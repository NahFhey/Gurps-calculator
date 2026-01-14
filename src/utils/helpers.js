// Safe JSON parse helper
export function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

// Helper to prevent NaN from entering storage
export function toNumberOr(value, fallback = 0) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

// Determine quality from CP
export function determineQuality(cp) {
  if (cp === 0) return 'Clean';
  if (cp === 1) return 'Works (Minor Drawback)';
  if (cp === 2) return 'Unstable';
  if (cp === 3) return 'Flawed';
  return 'Mishap';
}

// Refund materials used by a project back into inventory.
// If the original material entry no longer exists, recreate it.
export function refundMaterialsFromProject(project, materials) {
  const usage = project?.consumedMaterials;
  if (!usage || usage.length === 0) return materials;

  const byId = new Map(materials.map(m => [m.id, {...m}]));
  for (const u of usage) {
    if (byId.has(u.materialId)) {
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

// Helper functions for craft management
export function upsertCraft(list, craft) {
  const idx = list.findIndex(x => x.id === craft.id);
  if (idx >= 0) return list.map((x, i) => (i === idx ? craft : x));
  return [...list, craft];
}

export function removeCraft(list, craftId) {
  return list.filter(x => x.id !== craftId);
}

// Get visible reagent information based on identification level
export function getVisibleReagentInfo(reagent, showObviousRoles = true) {
  if (!reagent) return null;

  const level = reagent.identificationLevel || 0;
  const useProfile = reagent.falseProfile || reagent;

  // Physical roles that may be obvious
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

// Check if a reagent property should be visible
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
