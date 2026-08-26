/**
 * Character Text Exporter
 * Serializes character sheet data to the text format consumed by characterImport
 */

import type { Character } from '../types/campaign';
import type {
  AnyTrait,
  ConditionalModifier,
  Equipment,
  GCSCharacterData,
  Reaction,
  Skill,
  Spell,
} from '../types/characterSheet';

/**
 * Export a character to the GCS-style plain-text format.
 */
export function exportCharacterText(character: Character): string {
  const data = character.gcsData;
  if (!data) {
    return `Name: ${singleLine(character.name)}`;
  }

  const lines = [
    `Name: ${singleLine(character.name)} (${data.totalPoints})`,
    formatPrimaryAttributes(data),
    formatSecondaryAttributes(data),
    formatPointPools(data),
  ];

  pushCollection(lines, 'Reactions', data.reactions.map(formatReaction));
  pushCollection(
    lines,
    'Conditional Modifiers',
    data.conditionalModifiers.map(formatConditionalModifier)
  );
  pushCollection(lines, 'Advantages', data.advantages.map(formatTrait));
  pushCollection(lines, 'Perks', data.perks.map(formatTrait));
  pushCollection(lines, 'Disadvantages', data.disadvantages.map(formatTrait));
  pushCollection(lines, 'Quirks', data.quirks.map(formatTrait));
  pushCollection(lines, 'Skills', data.skills.map(formatSkill));
  pushCollection(lines, 'Spells', data.spells.map(formatSpell));
  pushCollection(lines, 'Equipment', data.equipment.map(formatEquipment));

  if (data.otherEquipment.trim()) {
    lines.push(`Other Equipment: ${singleLine(data.otherEquipment)}`);
  }
  if (data.notes.trim()) {
    lines.push(`Notes: ${singleLine(data.notes)}`);
  }

  return lines.join('\n');
}

/**
 * Format required attribute sections.
 */
function formatPrimaryAttributes(data: GCSCharacterData): string {
  const { attributes, attributePoints } = data;
  return 'Primary Attributes: '
    + `ST ${attributes.ST} [${attributePoints.ST}]; `
    + `DX ${attributes.DX} [${attributePoints.DX}]; `
    + `IQ ${attributes.IQ} [${attributePoints.IQ}]; `
    + `HT ${attributes.HT} [${attributePoints.HT}];`;
}

function formatSecondaryAttributes(data: GCSCharacterData): string {
  const attributes = data.secondaryAttributes;
  const entries = [
    formatSecondaryAttribute('Will', attributes.will),
    formatSecondaryAttribute('Fright Check', attributes.frightCheck),
    formatSecondaryAttribute('Per', attributes.per),
    formatSecondaryAttribute('Vision', attributes.vision),
    formatSecondaryAttribute('Hearing', attributes.hearing),
    formatSecondaryAttribute('Taste & Smell', attributes.tasteSmell),
    formatSecondaryAttribute('Touch', attributes.touch),
    formatSecondaryAttribute('Basic Speed', attributes.basicSpeed),
    formatSecondaryAttribute('Basic Move', attributes.basicMove),
  ];
  return `Secondary Attributes: ${entries.join('; ')};`;
}

function formatSecondaryAttribute(
  name: string,
  attribute: { value: number; points: number }
): string {
  return `${name} ${attribute.value} [${attribute.points}]`;
}

function formatPointPools(data: GCSCharacterData): string {
  const { HP, FP } = data.pools;
  return 'Point Pools: '
    + `FP ${FP.current} / ${FP.max} [${FP.points}]; `
    + `HP ${HP.current} / ${HP.max} [${HP.points}];`;
}

/**
 * Format optional collection sections.
 */
function pushCollection(lines: string[], label: string, entries: string[]): void {
  if (entries.length > 0) {
    lines.push(`${label}: ${entries.join('; ')};`);
  }
}

function formatReaction(reaction: Reaction): string {
  return `${formatSigned(reaction.modifier)} ${singleLine(reaction.condition)}`;
}

function formatConditionalModifier(modifier: ConditionalModifier): string {
  return `${formatSigned(modifier.modifier)} ${singleLine(modifier.condition)}`;
}

function formatTrait(trait: AnyTrait): string {
  const specialization = trait.specialization
    ? ` (${singleLine(trait.specialization)})`
    : '';
  const level = trait.level === undefined ? '' : ` ${trait.level}`;
  return `${singleLine(trait.name)}${specialization}${level} [${trait.points}]`;
}

function formatSkill(skill: Skill): string {
  const techLevel = skill.techLevel === undefined ? '' : `/TL${skill.techLevel}`;
  const specialization = skill.specialization
    ? ` (${singleLine(skill.specialization)})`
    : '';
  return `${singleLine(skill.name)}${techLevel}${specialization} `
    + `${skill.attribute}${formatSigned(skill.relativeLevel)} `
    + `[${skill.points}]-${skill.level}`;
}

function formatSpell(spell: Spell): string {
  return `${singleLine(spell.name)} ${spell.level}(IQ${formatSigned(spell.relativeLevel)}) `
    + `[${spell.points}] [Class: ${spell.spellClass}; Cost: ${singleLine(spell.castingCost)}; `
    + `Maintain: ${singleLine(spell.maintenanceCost)}; Time: ${singleLine(spell.castingTime)}; `
    + `Duration: ${singleLine(spell.duration)}]`;
}

function formatEquipment(equipment: Equipment): string {
  return `${equipment.quantity} ${singleLine(equipment.name)} `
    + `[$${equipment.cost}; ${equipment.weight} lb]`;
}

/**
 * Normalize scalar values to the parser's one-line representation.
 */
function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
