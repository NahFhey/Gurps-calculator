/**
 * Character Import Parser
 * Parses text format character sheets (GCS export text format)
 */

import type { Character } from '../types/campaign';
import type {
  GCSCharacterData,
  PrimaryAttributes,
  PrimaryAttributePoints,
  SecondaryAttributes,
  PointPools,
  Advantage,
  Perk,
  Disadvantage,
  Quirk,
  Skill,
  Spell,
  SpellClass,
  Equipment,
  Reaction,
  ConditionalModifier,
  SkillAttribute,
} from '../types/characterSheet';
import { createDefaultGCSData, syncWorkSkillsFromGCS } from '../types/characterSheet';

/**
 * Parse a text character sheet and return a Character object
 */
export function parseCharacterText(text: string): Character {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l);
  const gcsData = createDefaultGCSData();
  let name = 'Unknown';
  let totalPoints = 0;

  for (const line of lines) {
    if (line.startsWith('Name:')) {
      const result = parseName(line);
      name = result.name;
      totalPoints = result.totalPoints;
    } else if (line.startsWith('Primary Attributes:')) {
      const result = parsePrimaryAttributes(line);
      gcsData.attributes = result.attributes;
      gcsData.attributePoints = result.points;
    } else if (line.startsWith('Secondary Attributes:')) {
      parseSecondaryAttributes(line, gcsData);
    } else if (line.startsWith('Point Pools:')) {
      gcsData.pools = parsePointPools(line);
    } else if (line.startsWith('Reactions:')) {
      gcsData.reactions = parseReactions(line);
    } else if (line.startsWith('Conditional Modifiers:')) {
      gcsData.conditionalModifiers = parseConditionalModifiers(line);
    } else if (line.startsWith('Advantages:')) {
      gcsData.advantages = parseTraits(line, 'advantage') as Advantage[];
    } else if (line.startsWith('Perks:')) {
      gcsData.perks = parseTraits(line, 'perk') as Perk[];
    } else if (line.startsWith('Disadvantages:')) {
      gcsData.disadvantages = parseTraits(line, 'disadvantage') as Disadvantage[];
    } else if (line.startsWith('Quirks:')) {
      gcsData.quirks = parseTraits(line, 'quirk') as Quirk[];
    } else if (line.startsWith('Skills:')) {
      gcsData.skills = parseSkills(line, gcsData.attributes, gcsData.secondaryAttributes);
    } else if (line.startsWith('Spells:')) {
      gcsData.spells = parseSpells(line, gcsData.attributes.IQ);
    } else if (line.startsWith('Equipment:')) {
      gcsData.equipment = parseEquipment(line);
    } else if (line.startsWith('Other Equipment:')) {
      gcsData.otherEquipment = line.replace('Other Equipment:', '').trim();
    } else if (line.startsWith('Notes:')) {
      gcsData.notes = line.replace('Notes:', '').trim();
    }
  }

  gcsData.totalPoints = totalPoints;

  // Sync work.skills from the parsed skills
  const workSkills = syncWorkSkillsFromGCS(gcsData);

  return {
    id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    isPlayer: true,
    work: {
      enabled: true,
      skills: workSkills,
    },
    st: gcsData.attributes.ST,
    gcsData,
  };
}

/**
 * Parse name line: "Name: Bertok (Dusty) Darkwing (169)"
 */
function parseName(line: string): { name: string; totalPoints: number } {
  const content = line.replace('Name:', '').trim();
  // Extract total points from end (number in parentheses)
  const pointsMatch = content.match(/\((\d+)\)$/);
  const totalPoints = pointsMatch ? parseInt(pointsMatch[1], 10) : 0;
  const name = content.replace(/\s*\(\d+\)$/, '').trim();
  return { name, totalPoints };
}

/**
 * Parse primary attributes: "Primary Attributes: ST 9 [0]; DX 12 [0]; IQ 14 [60]; HT 9 [0];"
 */
function parsePrimaryAttributes(line: string): {
  attributes: PrimaryAttributes;
  points: PrimaryAttributePoints;
} {
  const content = line.replace('Primary Attributes:', '').trim();
  const attributes: PrimaryAttributes = { ST: 10, DX: 10, IQ: 10, HT: 10 };
  const points: PrimaryAttributePoints = { ST: 0, DX: 0, IQ: 0, HT: 0 };

  // Match: ST 9 [0]
  const attrRegex = /(ST|DX|IQ|HT)\s+(\d+)\s+\[(-?\d+)\]/g;
  let match;
  while ((match = attrRegex.exec(content)) !== null) {
    const attr = match[1] as keyof PrimaryAttributes;
    attributes[attr] = parseInt(match[2], 10);
    points[attr] = parseInt(match[3], 10);
  }

  return { attributes, points };
}

/**
 * Parse secondary attributes
 */
function parseSecondaryAttributes(line: string, gcsData: GCSCharacterData): void {
  const content = line.replace('Secondary Attributes:', '').trim();

  // Parse each secondary attribute: "Will 14 [0]"
  const parseAttr = (name: string): { value: number; points: number } => {
    const regex = new RegExp(`${name}\\s+([\\d.]+)\\s+\\[(-?\\d+)\\]`);
    const match = content.match(regex);
    if (match) {
      return { value: parseFloat(match[1]), points: parseInt(match[2], 10) };
    }
    return { value: 10, points: 0 };
  };

  gcsData.secondaryAttributes = {
    will: parseAttr('Will'),
    frightCheck: parseAttr('Fright Check'),
    per: parseAttr('Per'),
    vision: parseAttr('Vision'),
    hearing: parseAttr('Hearing'),
    tasteSmell: parseAttr('Taste & Smell'),
    touch: parseAttr('Touch'),
    basicSpeed: parseAttr('Basic Speed'),
    basicMove: parseAttr('Basic Move'),
  };
}

/**
 * Parse point pools: "Point Pools: FP 9 / 9 [0]; HP 10 / 10 [0];"
 */
function parsePointPools(line: string): PointPools {
  const content = line.replace('Point Pools:', '').trim();

  const parsePool = (name: string): { current: number; max: number; points: number } => {
    const regex = new RegExp(`${name}\\s+(\\d+)\\s*/\\s*(\\d+)\\s+\\[(-?\\d+)\\]`);
    const match = content.match(regex);
    if (match) {
      return {
        current: parseInt(match[1], 10),
        max: parseInt(match[2], 10),
        points: parseInt(match[3], 10),
      };
    }
    return { current: 10, max: 10, points: 0 };
  };

  return {
    HP: parsePool('HP'),
    FP: parsePool('FP'),
  };
}

/**
 * Parse reactions: "Reactions: -2 from others except your own kind;"
 */
function parseReactions(line: string): Reaction[] {
  const content = line.replace('Reactions:', '').trim();
  if (!content) return [];

  const reactions: Reaction[] = [];
  // Split by semicolon and parse each
  const parts = content.split(';').filter((p) => p.trim());

  for (const part of parts) {
    const match = part.trim().match(/^([+-]?\d+)\s+(.+)$/);
    if (match) {
      reactions.push({
        modifier: parseInt(match[1], 10),
        condition: match[2].trim(),
      });
    }
  }

  return reactions;
}

/**
 * Parse conditional modifiers
 */
function parseConditionalModifiers(line: string): ConditionalModifier[] {
  const content = line.replace('Conditional Modifiers:', '').trim();
  if (!content) return [];

  const modifiers: ConditionalModifier[] = [];
  const parts = content.split(';').filter((p) => p.trim());

  for (const part of parts) {
    const match = part.trim().match(/^([+-]?\d+)\s+(.+)$/);
    if (match) {
      modifiers.push({
        modifier: parseInt(match[1], 10),
        condition: match[2].trim(),
      });
    }
  }

  return modifiers;
}

/**
 * Parse traits (advantages, perks, disadvantages, quirks)
 * Format: "Corvi [10]; Flight [30]; Increased Dexterity 2 [40];"
 */
function parseTraits(
  line: string,
  type: 'advantage' | 'perk' | 'disadvantage' | 'quirk'
): (Advantage | Perk | Disadvantage | Quirk)[] {
  const labelMap = {
    advantage: 'Advantages:',
    perk: 'Perks:',
    disadvantage: 'Disadvantages:',
    quirk: 'Quirks:',
  };
  const content = line.replace(labelMap[type], '').trim();
  if (!content) return [];

  const traits: (Advantage | Perk | Disadvantage | Quirk)[] = [];
  // Split by semicolon, but be careful with parentheses
  const parts = splitBySemicolon(content);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Match: "Name (Specialization) Level [Points]" or "Name Level [Points]" or "Name [Points]"
    // Examples: "Bad Sight (Nearsighted) [-10]", "Increased Dexterity 2 [40]", "Flight [30]"
    const match = trimmed.match(/^(.+?)\s+\[(-?\d+)\]$/);
    if (match) {
      const fullName = match[1].trim();
      const points = parseInt(match[2], 10);

      // Check for level number at end
      const levelMatch = fullName.match(/^(.+?)\s+(\d+)$/);
      // Check for specialization in parentheses
      const specMatch = fullName.match(/^(.+?)\s+\(([^)]+)\)(?:\s+(\d+))?$/);

      let name = fullName;
      let specialization: string | undefined;
      let level: number | undefined;

      if (specMatch) {
        name = specMatch[1].trim();
        specialization = specMatch[2].trim();
        if (specMatch[3]) level = parseInt(specMatch[3], 10);
      } else if (levelMatch) {
        name = levelMatch[1].trim();
        level = parseInt(levelMatch[2], 10);
      }

      traits.push({
        id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        name,
        specialization,
        level,
        points,
      } as Advantage | Perk | Disadvantage | Quirk);
    }
  }

  return traits;
}

/**
 * Parse skills
 * Format: "Acting IQ-1 [1]-13; Airshipman/TL3 IQ+0 [1]-14; Alchemy/TL3 IQ+1 [12]-15;"
 */
function parseSkills(
  line: string,
  _attributes: PrimaryAttributes,
  _secondaryAttributes: SecondaryAttributes
): Skill[] {
  const content = line.replace('Skills:', '').trim();
  if (!content) return [];

  const skills: Skill[] = [];
  const parts = splitBySemicolon(content);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Match: "SkillName/TL3 (Spec) ATTR+N [P]-L" or variations
    // Examples: "Acting IQ-1 [1]-13", "Alchemy/TL3 IQ+1 [12]-15", "Area Knowledge (Tuto; Lived there) IQ+0 [1]-14"
    const match = trimmed.match(
      /^(.+?)\s+(ST|DX|IQ|HT|Will|Per)([+-]\d+)\s+\[(\d+)\]-(\d+)$/
    );

    if (match) {
      let fullName = match[1].trim();
      const attribute = match[2] as SkillAttribute;
      const relativeLevel = parseInt(match[3], 10);
      const points = parseInt(match[4], 10);
      const level = parseInt(match[5], 10);

      // Extract TL if present
      let techLevel: number | undefined;
      const tlMatch = fullName.match(/\/TL(\d+)/);
      if (tlMatch) {
        techLevel = parseInt(tlMatch[1], 10);
        fullName = fullName.replace(/\/TL\d+/, '');
      }

      // Extract specialization if present
      let specialization: string | undefined;
      const specMatch = fullName.match(/^(.+?)\s+\(([^)]+)\)$/);
      if (specMatch) {
        fullName = specMatch[1].trim();
        specialization = specMatch[2].trim();
      }

      skills.push({
        id: `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: fullName,
        specialization,
        techLevel,
        attribute,
        relativeLevel,
        points,
        level,
      });
    }
  }

  return skills;
}

/**
 * Parse spells
 * Format: "Apportation 14(IQ+0) [1] [Class: Regular; Cost: Varies; Maintain: ; Time: 1 sec; Duration: 1 min];"
 */
function parseSpells(line: string, _iq: number): Spell[] {
  const content = line.replace('Spells:', '').trim();
  if (!content) return [];

  const spells: Spell[] = [];
  const parts = splitBySemicolonSpells(content);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Match: "SpellName Level(IQ+N) [Points] [Class: X; Cost: Y; Maintain: Z; Time: T; Duration: D]"
    const match = trimmed.match(
      /^(.+?)\s+(\d+)\(IQ([+-]\d+)\)\s+\[(\d+)\]\s+\[Class:\s*([^;]+);\s*Cost:\s*([^;]+);\s*Maintain:\s*([^;]*);\s*Time:\s*([^;]+);\s*Duration:\s*([^\]]+)\]$/
    );

    if (match) {
      const name = match[1].trim();
      const level = parseInt(match[2], 10);
      const relativeLevel = parseInt(match[3], 10);
      const points = parseInt(match[4], 10);
      const spellClass = match[5].trim() as SpellClass;
      const castingCost = match[6].trim();
      const maintenanceCost = match[7].trim() || '-';
      const castingTime = match[8].trim();
      const duration = match[9].trim();

      spells.push({
        id: `spell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        level,
        attribute: 'IQ',
        relativeLevel,
        points,
        spellClass,
        castingCost,
        maintenanceCost,
        castingTime,
        duration,
      });
    }
  }

  return spells;
}

/**
 * Parse equipment
 * Format: "1 Dracano FIn Rod [$3000; 2 lb]; 1 Boots [$80; 3 lb];"
 */
function parseEquipment(line: string): Equipment[] {
  const content = line.replace('Equipment:', '').trim();
  if (!content) return [];

  const equipment: Equipment[] = [];
  const parts = splitBySemicolon(content);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Match: "Qty Name [$Cost; Weight lb]"
    const match = trimmed.match(/^(\d+)\s+(.+?)\s+\[\$(\d+);\s*([\d.]+)\s*lb\]$/);

    if (match) {
      const quantity = parseInt(match[1], 10);
      const name = match[2].trim();
      const cost = parseInt(match[3], 10);
      const weight = parseFloat(match[4]);

      equipment.push({
        id: `equip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        quantity,
        cost,
        weight,
      });
    }
  }

  return equipment;
}

/**
 * Helper to split by semicolon while respecting parentheses
 */
function splitBySemicolon(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (const char of text) {
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    else if (char === ';' && parenDepth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

/**
 * Helper to split spells (they have nested brackets)
 */
function splitBySemicolonSpells(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let bracketDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '[') bracketDepth++;
    else if (char === ']') bracketDepth--;
    else if (char === ';' && bracketDepth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}
