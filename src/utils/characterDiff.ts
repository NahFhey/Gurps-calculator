import type { Character } from '../types/campaign';
import type {
  Advantage,
  Disadvantage,
  Equipment,
  Perk,
  Quirk,
  Skill,
  Spell,
} from '../types/characterSheet';
import { createDefaultGCSData } from '../types/characterSheet';

export interface FieldChange {
  path: string;
  label: string;
  from: string | number;
  to: string | number;
}

export interface ChangedCollectionEntry {
  name: string;
  changes: FieldChange[];
}

export interface CollectionDiff<T> {
  added: T[];
  removed: T[];
  changed: ChangedCollectionEntry[];
}

export interface CharacterDiffSummary {
  changedFields: number;
  added: number;
  removed: number;
  modified: number;
}

export interface CharacterDiff {
  scalarChanges: FieldChange[];
  skills: CollectionDiff<Skill>;
  spells: CollectionDiff<Spell>;
  advantages: CollectionDiff<Advantage>;
  perks: CollectionDiff<Perk>;
  disadvantages: CollectionDiff<Disadvantage>;
  quirks: CollectionDiff<Quirk>;
  equipment: CollectionDiff<Equipment>;
  summary: CharacterDiffSummary;
}

interface NamedEntry {
  id: string;
  name: string;
}

interface FieldDefinition<T> {
  key: keyof T;
  label: string;
}

const SKILL_FIELDS: ReadonlyArray<FieldDefinition<Skill>> = [
  { key: 'specialization', label: 'Specialization' },
  { key: 'techLevel', label: 'Tech level' },
  { key: 'attribute', label: 'Attribute' },
  { key: 'relativeLevel', label: 'Relative level' },
  { key: 'points', label: 'Points' },
  { key: 'level', label: 'Level' },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'notes', label: 'Notes' },
  { key: 'reference', label: 'Reference' },
];

const SPELL_FIELDS: ReadonlyArray<FieldDefinition<Spell>> = [
  { key: 'level', label: 'Level' },
  { key: 'attribute', label: 'Attribute' },
  { key: 'relativeLevel', label: 'Relative level' },
  { key: 'points', label: 'Points' },
  { key: 'spellClass', label: 'Class' },
  { key: 'castingCost', label: 'Casting cost' },
  { key: 'maintenanceCost', label: 'Maintenance cost' },
  { key: 'castingTime', label: 'Casting time' },
  { key: 'duration', label: 'Duration' },
  { key: 'college', label: 'College' },
  { key: 'notes', label: 'Notes' },
  { key: 'reference', label: 'Reference' },
];

const TRAIT_FIELDS = [
  { key: 'points', label: 'Points' },
  { key: 'level', label: 'Level' },
  { key: 'specialization', label: 'Specialization' },
  { key: 'notes', label: 'Notes' },
  { key: 'reference', label: 'Reference' },
] as const;

const EQUIPMENT_FIELDS: ReadonlyArray<FieldDefinition<Equipment>> = [
  { key: 'quantity', label: 'Quantity' },
  { key: 'weight', label: 'Weight' },
  { key: 'cost', label: 'Cost' },
  { key: 'equipped', label: 'Equipped' },
  { key: 'location', label: 'Location' },
  { key: 'category', label: 'Category' },
  { key: 'notes', label: 'Notes' },
  { key: 'reference', label: 'Reference' },
  { key: 'damage', label: 'Damage' },
  { key: 'reach', label: 'Reach' },
  { key: 'rangeHalf', label: 'Half-damage range' },
  { key: 'rangeFull', label: 'Maximum range' },
  { key: 'dr', label: 'DR' },
  { key: 'drLocations', label: 'DR locations' },
  { key: 'db', label: 'Defense bonus' },
];

function displayValue(value: unknown): string | number {
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return JSON.stringify(value);
}

function comparableValue(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function compareCollection<T extends NamedEntry>(
  path: string,
  existing: readonly T[],
  incoming: readonly T[],
  fields: ReadonlyArray<FieldDefinition<T>>
): CollectionDiff<T> {
  const existingByName = new Map<string, T[]>();
  for (const entry of existing) {
    const key = entry.name.trim().toLocaleLowerCase();
    existingByName.set(key, [...(existingByName.get(key) ?? []), entry]);
  }

  const added: T[] = [];
  const changed: ChangedCollectionEntry[] = [];

  for (const incomingEntry of incoming) {
    const key = incomingEntry.name.trim().toLocaleLowerCase();
    const matches = existingByName.get(key);
    const existingEntry = matches?.shift();
    if (!existingEntry) {
      added.push(incomingEntry);
      continue;
    }

    const changes = fields.flatMap((field): FieldChange[] => {
      const from = existingEntry[field.key];
      const to = incomingEntry[field.key];
      if (comparableValue(from) === comparableValue(to)) return [];
      return [{
        path: `${path}.${incomingEntry.name}.${String(field.key)}`,
        label: field.label,
        from: displayValue(from),
        to: displayValue(to),
      }];
    });

    if (changes.length > 0) changed.push({ name: incomingEntry.name, changes });
  }

  const removed = Array.from(existingByName.values()).flat();
  return { added, removed, changed };
}

function addScalar(
  changes: FieldChange[],
  path: string,
  label: string,
  from: string | number,
  to: string | number
): void {
  if (from !== to) changes.push({ path, label, from, to });
}

/** Compare import-relevant character sheet data while ignoring generated IDs. */
export function diffCharacters(existing: Character, incoming: Character): CharacterDiff {
  const before = existing.gcsData ?? createDefaultGCSData();
  const after = incoming.gcsData ?? createDefaultGCSData();
  const scalarChanges: FieldChange[] = [];

  addScalar(scalarChanges, 'name', 'Name', existing.name, incoming.name);
  addScalar(scalarChanges, 'gcsData.totalPoints', 'Total points', before.totalPoints, after.totalPoints);

  for (const attribute of ['ST', 'DX', 'IQ', 'HT'] as const) {
    addScalar(scalarChanges, `gcsData.attributes.${attribute}`, attribute, before.attributes[attribute], after.attributes[attribute]);
    addScalar(
      scalarChanges,
      `gcsData.attributePoints.${attribute}`,
      `${attribute} points`,
      before.attributePoints[attribute],
      after.attributePoints[attribute]
    );
  }

  const secondaryLabels = {
    will: 'Will',
    frightCheck: 'Fright Check',
    per: 'Perception',
    vision: 'Vision',
    hearing: 'Hearing',
    tasteSmell: 'Taste & Smell',
    touch: 'Touch',
    basicSpeed: 'Basic Speed',
    basicMove: 'Basic Move',
  } as const;
  for (const key of Object.keys(secondaryLabels) as Array<keyof typeof secondaryLabels>) {
    addScalar(scalarChanges, `gcsData.secondaryAttributes.${key}.value`, secondaryLabels[key], before.secondaryAttributes[key].value, after.secondaryAttributes[key].value);
    addScalar(scalarChanges, `gcsData.secondaryAttributes.${key}.points`, `${secondaryLabels[key]} points`, before.secondaryAttributes[key].points, after.secondaryAttributes[key].points);
  }

  for (const key of ['HP', 'FP'] as const) {
    addScalar(scalarChanges, `gcsData.pools.${key}.current`, `${key} current`, before.pools[key].current, after.pools[key].current);
    addScalar(scalarChanges, `gcsData.pools.${key}.max`, `${key} maximum`, before.pools[key].max, after.pools[key].max);
    addScalar(scalarChanges, `gcsData.pools.${key}.points`, `${key} points`, before.pools[key].points, after.pools[key].points);
  }

  const skills = compareCollection('gcsData.skills', before.skills, after.skills, SKILL_FIELDS);
  const spells = compareCollection('gcsData.spells', before.spells, after.spells, SPELL_FIELDS);
  const advantages = compareCollection('gcsData.advantages', before.advantages, after.advantages, TRAIT_FIELDS);
  const perks = compareCollection('gcsData.perks', before.perks, after.perks, TRAIT_FIELDS);
  const disadvantages = compareCollection('gcsData.disadvantages', before.disadvantages, after.disadvantages, TRAIT_FIELDS);
  const quirks = compareCollection('gcsData.quirks', before.quirks, after.quirks, TRAIT_FIELDS);
  const equipment = compareCollection('gcsData.equipment', before.equipment, after.equipment, EQUIPMENT_FIELDS);

  const collections = [skills, spells, advantages, perks, disadvantages, quirks, equipment];
  const summary = collections.reduce<CharacterDiffSummary>(
    (total, collection) => ({
      changedFields: total.changedFields,
      added: total.added + collection.added.length,
      removed: total.removed + collection.removed.length,
      modified: total.modified + collection.changed.length,
    }),
    { changedFields: scalarChanges.length, added: 0, removed: 0, modified: 0 }
  );

  return {
    scalarChanges,
    skills,
    spells,
    advantages,
    perks,
    disadvantages,
    quirks,
    equipment,
    summary,
  };
}

export function hasChanges(diff: CharacterDiff): boolean {
  const { changedFields, added, removed, modified } = diff.summary;
  return changedFields + added + removed + modified > 0;
}
