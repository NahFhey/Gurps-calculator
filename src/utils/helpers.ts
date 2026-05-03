/**
 * @fileoverview Utility helper functions for the GURPS calculator application
 */

import type { Craft, Material, CraftConsumedMaterial } from '../types/campaign';

export function safeParse<T = unknown>(
  value: string | null | undefined,
  fallback: T
): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function safeDeepClone<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj)) as T;
  } catch {
    console.warn('[safeDeepClone] Failed to clone object, returning original reference');
    return obj;
  }
}

export function toNumberOr(value: unknown, fallback: number = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(value as string);
  return Number.isFinite(n) ? n : fallback;
}

export function determineQuality(cp: number): string {
  if (cp === 0) return 'Clean';
  if (cp === 1) return 'Works (Minor Drawback)';
  if (cp === 2) return 'Unstable';
  if (cp === 3) return 'Flawed';
  return 'Mishap';
}

export function refundMaterialsFromProject(
  project: Pick<Craft, 'consumedMaterials'> | null | undefined,
  materials: Material[]
): Material[] {
  const usage: CraftConsumedMaterial[] | undefined = project?.consumedMaterials;
  if (!usage || usage.length === 0) return materials;

  const byId = new Map<string, Material>(materials.map(m => [m.id, { ...m }]));
  for (const u of usage) {
    if (!u.materialId) continue;
    const existing = byId.get(u.materialId);
    if (existing) {
      existing.quantity = (Number.isFinite(existing.quantity) ? existing.quantity : 0) + u.amount;
      byId.set(u.materialId, existing);
    } else {
      byId.set(u.materialId, {
        id: u.materialId,
        name: u.name || 'refunded material',
        type: u.type || '',
        quantity: u.amount,
      });
    }
  }
  return Array.from(byId.values());
}

export function upsertCraft<T extends { id: string }>(list: T[], craft: T): T[] {
  const idx = list.findIndex(x => x.id === craft.id);
  if (idx >= 0) return list.map((x, i) => (i === idx ? craft : x));
  return [...list, craft];
}

export function removeCraft<T extends { id: string }>(list: T[], craftId: string): T[] {
  return list.filter(x => x.id !== craftId);
}

interface ReagentAspects {
  primary?: string;
  secondary?: string;
  tertiary?: string;
}

interface ReagentLike {
  id?: string;
  name?: string;
  quantity?: number;
  identificationLevel?: number;
  aspects?: ReagentAspects;
  falseProfile?: ReagentLike;
  roles?: string[];
  primaryRole?: string;
  basePotency?: unknown;
  hazards?: unknown;
  refinement?: unknown;
  concentrationSteps?: unknown;
  processingNotes?: unknown;
  analysisHistory?: unknown;
}

export function getVisibleReagentInfo(
  reagent: ReagentLike | null | undefined,
  showObviousRoles: boolean = true
): Record<string, unknown> | null {
  if (!reagent) return null;

  const level = reagent.identificationLevel || 0;
  const useProfile: ReagentLike = reagent.falseProfile || reagent;

  const physicalRoles = ['Solvent', 'Binder', 'Tool'];
  const visibleRoles = showObviousRoles
    ? (reagent.roles || []).filter(r => physicalRoles.includes(r))
    : [];

  const visible: Record<string, unknown> = {
    id: reagent.id,
    name: reagent.name,
    quantity: reagent.quantity,
    identificationLevel: level,
    analysisHistory: reagent.analysisHistory,
    falseProfile: reagent.falseProfile,
    visibleRoles: visibleRoles,
  };

  if (level === 0) {
    return visible;
  }

  if (level >= 1) {
    visible.aspects = {
      primary: useProfile.aspects?.primary,
    };
  }

  if (level >= 2) {
    visible.aspects = {
      primary: useProfile.aspects?.primary,
      secondary: useProfile.aspects?.secondary,
    };
  }

  if (level >= 3) {
    visible.aspects = {
      primary: useProfile.aspects?.primary,
      secondary: useProfile.aspects?.secondary,
      tertiary: useProfile.aspects?.tertiary,
    };
  }

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

export function isReagentPropertyVisible(
  reagent: ReagentLike | null | undefined,
  property: string
): boolean {
  const level = reagent?.identificationLevel || 0;

  const propertyLevels: Record<string, number> = {
    primaryAspect: 1,
    secondaryAspect: 2,
    tertiaryAspect: 3,
    basePotency: 4,
    hazards: 4,
    roles: 4,
    refinement: 4,
    concentrationSteps: 4,
    processingNotes: 4,
  };

  return level >= (propertyLevels[property] || 4);
}
