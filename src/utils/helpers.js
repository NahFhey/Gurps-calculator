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
