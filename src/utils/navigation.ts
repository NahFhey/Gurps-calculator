import { getCharacterSkills } from '../types/characterSheet';
import type { Character } from '../types/campaign';
import type { TravelMode } from '../types/map';

const normalize = (value: string): string => value.trim().toLowerCase();

export function getNavigationSkill(
  character: Character,
  mode: TravelMode
): { level: number; isDefault: boolean } {
  const specialty = mode === 'foot' ? 'Land' : mode === 'boat' ? 'Sea' : 'Air';
  const skills = getCharacterSkills(character);
  for (const wanted of [`Navigation (${specialty})`, 'Navigation']) {
    const match = Object.entries(skills).find(([key]) => normalize(key) === normalize(wanted));
    if (match && match[1] > 0) return { level: match[1], isDefault: false };
  }
  return { level: (character.gcsData?.attributes.IQ ?? 10) - 6, isDefault: true };
}
