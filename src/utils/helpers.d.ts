/**
 * Type definitions for helpers.js utilities
 */

import type { Craft, Material } from '../types/campaign';

export function safeParse<T = unknown>(value: string | null | undefined, fallback: T): T;

export function toNumberOr(value: number | string | unknown, fallback?: number): number;

export function determineQuality(cp: number): string;

export function refundMaterialsFromProject(
  project: Pick<Craft, 'consumedMaterials'>,
  materials: Material[]
): Material[];

export function upsertCraft<T extends { id: string }>(list: T[], craft: T): T[];

export function removeCraft<T extends { id: string }>(list: T[], craftId: string): T[];

export function getVisibleReagentInfo(reagent: any, identificationLevel: number): any;

export function getCrystalInfo(crystal: any, identificationLevel: number): any;

export function getVisibleAspects(
  aspects: { primary?: string; secondary?: string; tertiary?: string } | undefined,
  identificationLevel: number
): { primary?: string; secondary?: string; tertiary?: string } | undefined;
