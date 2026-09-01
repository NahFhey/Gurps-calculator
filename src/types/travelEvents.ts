import type { Id } from './campaign';
import type { TerrainId } from './map';
import type { WeatherType } from './location';

export type TravelEventKind = 'nothing' | 'flavor' | 'hazard' | 'encounter';

/** Weather is an eligibility gate authored directly into an event entry. */
export interface TravelEventConditions {
  weatherTypes?: WeatherType[];
  nightOnly?: boolean;
  forcedMarchOnly?: boolean;
}

export interface TravelHazardEffects {
  lostMiles?: number;
  fpLossFormula?: string;
  hpLossFormula?: string;
}

export interface TravelEventEntry {
  id: Id;
  kind: TravelEventKind;
  weight: number;
  name: string;
  description: string;
  conditions?: TravelEventConditions;
  hazard?: TravelHazardEffects;
  encounterTemplateId?: Id | null;
}

export interface TravelEventTable {
  id: Id;
  name: string;
  description?: string;
  entries: TravelEventEntry[];
  builtin?: boolean;
}

export interface TravelEventTableSet {
  id: Id;
  name: string;
  byTerrain: Record<TerrainId, Id | undefined>;
  fallbackTableId?: Id | null;
  builtin?: boolean;
}
