import type { Character } from '../types/campaign';
import type { GCSCharacterData } from '../types/characterSheet';
import { syncWorkSkillsFromGCS } from '../types/characterSheet';
import type { CharacterTextSection } from './characterImportValidation';

interface NamedImportEntry {
  id: string;
  name: string;
}

export interface CharacterImportUpdateOptions {
  source: 'text' | 'json';
  presentSections?: ReadonlySet<CharacterTextSection>;
  nonEmptySections?: ReadonlySet<CharacterTextSection>;
}

function mergeNamedEntries<T extends NamedImportEntry>(existing: readonly T[], incoming: readonly T[]): T[] {
  const existingByName = new Map<string, T[]>();
  for (const entry of existing) {
    const key = entry.name.trim().toLocaleLowerCase();
    existingByName.set(key, [...(existingByName.get(key) ?? []), entry]);
  }

  return incoming.map((entry) => {
    const key = entry.name.trim().toLocaleLowerCase();
    const match = existingByName.get(key)?.shift();
    return match ? { ...match, ...entry, id: match.id } : entry;
  });
}

function mergeJsonData(existing: GCSCharacterData, incoming: GCSCharacterData): GCSCharacterData {
  return {
    ...existing,
    ...incoming,
    advantages: mergeNamedEntries(existing.advantages, incoming.advantages),
    perks: mergeNamedEntries(existing.perks, incoming.perks),
    disadvantages: mergeNamedEntries(existing.disadvantages, incoming.disadvantages),
    quirks: mergeNamedEntries(existing.quirks, incoming.quirks),
    skills: mergeNamedEntries(existing.skills, incoming.skills),
    spells: mergeNamedEntries(existing.spells, incoming.spells),
    equipment: mergeNamedEntries(existing.equipment, incoming.equipment),
    skillHistory: incoming.skillHistory ?? existing.skillHistory,
  };
}

function mergeTextData(
  existing: GCSCharacterData,
  incoming: GCSCharacterData,
  sections: ReadonlySet<CharacterTextSection>,
  nonEmptySections: ReadonlySet<CharacterTextSection>
): GCSCharacterData {
  const merged: GCSCharacterData = {
    ...existing,
    totalPoints: incoming.totalPoints,
  };

  if (sections.has('Primary Attributes')) {
    merged.attributes = incoming.attributes;
    merged.attributePoints = incoming.attributePoints;
  }
  if (sections.has('Secondary Attributes')) merged.secondaryAttributes = incoming.secondaryAttributes;
  if (sections.has('Point Pools')) merged.pools = incoming.pools;
  const shouldApplyCollection = (section: CharacterTextSection, length: number) =>
    sections.has(section) && (length > 0 || !nonEmptySections.has(section));

  if (shouldApplyCollection('Reactions', incoming.reactions.length)) merged.reactions = incoming.reactions;
  if (shouldApplyCollection('Conditional Modifiers', incoming.conditionalModifiers.length)) merged.conditionalModifiers = incoming.conditionalModifiers;
  if (shouldApplyCollection('Advantages', incoming.advantages.length)) merged.advantages = mergeNamedEntries(existing.advantages, incoming.advantages);
  if (shouldApplyCollection('Perks', incoming.perks.length)) merged.perks = mergeNamedEntries(existing.perks, incoming.perks);
  if (shouldApplyCollection('Disadvantages', incoming.disadvantages.length)) merged.disadvantages = mergeNamedEntries(existing.disadvantages, incoming.disadvantages);
  if (shouldApplyCollection('Quirks', incoming.quirks.length)) merged.quirks = mergeNamedEntries(existing.quirks, incoming.quirks);
  if (shouldApplyCollection('Skills', incoming.skills.length)) merged.skills = mergeNamedEntries(existing.skills, incoming.skills);
  if (shouldApplyCollection('Spells', incoming.spells.length)) merged.spells = mergeNamedEntries(existing.spells, incoming.spells);
  if (shouldApplyCollection('Equipment', incoming.equipment.length)) merged.equipment = mergeNamedEntries(existing.equipment, incoming.equipment);
  if (sections.has('Other Equipment')) merged.otherEquipment = incoming.otherEquipment;
  if (sections.has('Notes')) merged.notes = incoming.notes;

  return merged;
}

/**
 * Build the narrow Partial<Character> used by updateCharacter. Top-level IDs,
 * images, hit-location choice, and player flags are deliberately omitted.
 * Text-only updates also preserve absent sections and rich entry metadata that
 * the text export cannot represent.
 */
export function buildCharacterImportUpdate(
  existing: Character,
  incoming: Character,
  options: CharacterImportUpdateOptions
): Partial<Character> {
  const changes: Partial<Character> = { name: incoming.name };
  const existingData = existing.gcsData;
  const incomingData = incoming.gcsData;

  if (incomingData) {
    const mergedData = existingData
      ? options.source === 'text'
        ? mergeTextData(
            existingData,
            incomingData,
            options.presentSections ?? new Set(),
            options.nonEmptySections ?? new Set()
          )
        : mergeJsonData(existingData, incomingData)
      : incomingData;

    changes.gcsData = mergedData;
    changes.st = mergedData.attributes.ST;
    changes.work = {
      ...existing.work,
      skills: syncWorkSkillsFromGCS(mergedData),
    };
  } else {
    if (incoming.st !== undefined) changes.st = incoming.st;
    changes.work = {
      ...existing.work,
      ...incoming.work,
      skills: { ...incoming.work.skills },
    };
  }

  return changes;
}
