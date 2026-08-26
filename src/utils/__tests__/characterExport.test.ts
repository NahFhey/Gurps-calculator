import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/campaign';
import type { GCSCharacterData } from '../../types/characterSheet';
import { createDefaultGCSData } from '../../types/characterSheet';
import { exportCharacterText } from '../characterExport';
import { parseCharacterText } from '../characterImport';

const BERTOK_TEXT = `
Name: Bertok Darkwing (169)
Primary Attributes: ST 9 [0]; DX 12 [0]; IQ 14 [60]; HT 9 [0];
Secondary Attributes: Will 14 [0]; Fright Check 14 [0]; Per 13 [-5]; Vision 13 [0]; Hearing 14 [0]; Taste & Smell 13 [0]; Touch 13 [0]; Basic Speed 5.25 [0]; Basic Move 5 [0];
Point Pools: FP 9 / 9 [0]; HP 10 / 10 [0];
Reactions: -2 from others except your own kind; +1 from scholars;
Conditional Modifiers: +2 to resist poison; -1 in bright light;
Advantages: Flight [30]; Increased Dexterity 2 [40];
Perks: Alcohol Tolerance [1];
Disadvantages: Bad Sight (Nearsighted) [-10];
Quirks: Dislikes deep water [-1];
Skills: Acting IQ-1 [1]-13; Alchemy/TL3 IQ+1 [12]-15;
Spells: Apportation 14(IQ+0) [1] [Class: Regular; Cost: 2; Maintain: ; Time: 1 sec; Duration: 1 min];
Equipment: 1 Boots [$80; 3 lb]; 2 Healing Potions [$120; 0.5 lb];
Other Equipment: Bedroll, flint and steel
Notes: Corvi alchemist and reluctant adventurer.
`;

function makeCharacter(): Character {
  return {
    id: 'character-1',
    name: 'Mira Vale',
    isPlayer: true,
    work: { enabled: true, skills: {} },
    st: 10,
    gcsData: createDefaultGCSData(),
  };
}

function requireData(character: Character): GCSCharacterData {
  if (!character.gcsData) {
    throw new Error('Expected character to contain GCS data');
  }
  return character.gcsData;
}

function projectParsedSections(data: GCSCharacterData) {
  const projectTrait = (trait: GCSCharacterData['advantages'][number]) => ({
    type: trait.type,
    name: trait.name,
    specialization: trait.specialization,
    level: trait.level,
    points: trait.points,
  });

  return {
    attributes: data.attributes,
    attributePoints: data.attributePoints,
    secondaryAttributes: data.secondaryAttributes,
    pools: data.pools,
    reactions: data.reactions,
    conditionalModifiers: data.conditionalModifiers,
    advantages: data.advantages.map(projectTrait),
    perks: data.perks.map((trait) => ({
      type: trait.type,
      name: trait.name,
      specialization: trait.specialization,
      level: trait.level,
      points: trait.points,
    })),
    disadvantages: data.disadvantages.map((trait) => ({
      type: trait.type,
      name: trait.name,
      specialization: trait.specialization,
      level: trait.level,
      points: trait.points,
    })),
    quirks: data.quirks.map((trait) => ({
      type: trait.type,
      name: trait.name,
      specialization: trait.specialization,
      level: trait.level,
      points: trait.points,
    })),
    skills: data.skills.map((skill) => ({
      name: skill.name,
      specialization: skill.specialization,
      techLevel: skill.techLevel,
      attribute: skill.attribute,
      relativeLevel: skill.relativeLevel,
      points: skill.points,
      level: skill.level,
    })),
    spells: data.spells.map((spell) => ({
      name: spell.name,
      level: spell.level,
      attribute: spell.attribute,
      relativeLevel: spell.relativeLevel,
      points: spell.points,
      spellClass: spell.spellClass,
      castingCost: spell.castingCost,
      maintenanceCost: spell.maintenanceCost,
      castingTime: spell.castingTime,
      duration: spell.duration,
    })),
    equipment: data.equipment.map((equipment) => ({
      name: equipment.name,
      quantity: equipment.quantity,
      cost: equipment.cost,
      weight: equipment.weight,
    })),
  };
}

describe('exportCharacterText', () => {
  it('exports a minimal name line when GCS data is absent', () => {
    const character = makeCharacter();
    delete character.gcsData;

    expect(exportCharacterText(character)).toBe('Name: Mira Vale');
  });

  it('exports name, total points, and primary attributes', () => {
    const character = makeCharacter();
    const data = requireData(character);
    data.totalPoints = 125;
    data.attributes = { ST: 11, DX: 12, IQ: 13, HT: 14 };
    data.attributePoints = { ST: 10, DX: 40, IQ: 60, HT: 40 };

    const text = exportCharacterText(character);
    expect(text).toContain('Name: Mira Vale (125)');
    expect(text).toContain(
      'Primary Attributes: ST 11 [10]; DX 12 [40]; IQ 13 [60]; HT 14 [40];'
    );
  });

  it('exports every secondary attribute in parser order', () => {
    const text = exportCharacterText(makeCharacter());

    expect(text).toContain(
      'Secondary Attributes: Will 10 [0]; Fright Check 10 [0]; Per 10 [0]; '
      + 'Vision 10 [0]; Hearing 10 [0]; Taste & Smell 10 [0]; Touch 10 [0]; '
      + 'Basic Speed 5 [0]; Basic Move 5 [0];'
    );
  });

  it('exports FP and HP current, maximum, and point values', () => {
    const character = makeCharacter();
    const data = requireData(character);
    data.pools.FP = { current: 7, max: 11, points: 6 };
    data.pools.HP = { current: 9, max: 12, points: 4 };

    expect(exportCharacterText(character)).toContain(
      'Point Pools: FP 7 / 11 [6]; HP 9 / 12 [4];'
    );
  });

  it('omits empty optional sections', () => {
    const text = exportCharacterText(makeCharacter());

    for (const label of [
      'Reactions:',
      'Conditional Modifiers:',
      'Advantages:',
      'Perks:',
      'Disadvantages:',
      'Quirks:',
      'Skills:',
      'Spells:',
      'Equipment:',
      'Other Equipment:',
      'Notes:',
    ]) {
      expect(text).not.toContain(label);
    }
  });

  it('exports signed reactions and conditional modifiers', () => {
    const character = makeCharacter();
    const data = requireData(character);
    data.reactions = [{ modifier: 2, condition: 'from guild members' }];
    data.conditionalModifiers = [{ modifier: -1, condition: 'in bright light' }];

    const text = exportCharacterText(character);
    expect(text).toContain('Reactions: +2 from guild members;');
    expect(text).toContain('Conditional Modifiers: -1 in bright light;');
  });

  it('exports all trait sections with specializations and levels', () => {
    const character = makeCharacter();
    const data = requireData(character);
    data.advantages = [{
      id: 'advantage-1',
      type: 'advantage',
      name: 'Talent',
      specialization: 'Crafting',
      level: 2,
      points: 10,
    }];
    data.perks = [{ id: 'perk-1', type: 'perk', name: 'Sure-Footed', points: 1 }];
    data.disadvantages = [{
      id: 'disadvantage-1',
      type: 'disadvantage',
      name: 'Bad Sight',
      specialization: 'Nearsighted',
      points: -10,
    }];
    data.quirks = [{ id: 'quirk-1', type: 'quirk', name: 'Careful', points: -1 }];

    const text = exportCharacterText(character);
    expect(text).toContain('Advantages: Talent (Crafting) 2 [10];');
    expect(text).toContain('Perks: Sure-Footed [1];');
    expect(text).toContain('Disadvantages: Bad Sight (Nearsighted) [-10];');
    expect(text).toContain('Quirks: Careful [-1];');
  });

  it('exports skills with tech levels, specializations, and signed relative levels', () => {
    const character = makeCharacter();
    requireData(character).skills = [{
      id: 'skill-1',
      name: 'Armoury',
      specialization: 'Body Armor',
      techLevel: 3,
      attribute: 'IQ',
      relativeLevel: 1,
      points: 4,
      level: 13,
    }];

    expect(exportCharacterText(character)).toContain(
      'Skills: Armoury/TL3 (Body Armor) IQ+1 [4]-13;'
    );
  });

  it('exports complete spell metadata', () => {
    const character = makeCharacter();
    requireData(character).spells = [{
      id: 'spell-1',
      name: 'Fireball',
      level: 15,
      attribute: 'IQ',
      relativeLevel: -1,
      points: 2,
      spellClass: 'Missile',
      castingCost: '1-3',
      maintenanceCost: '-',
      castingTime: '1 sec',
      duration: 'Instant',
    }];

    expect(exportCharacterText(character)).toContain(
      'Spells: Fireball 15(IQ-1) [2] '
      + '[Class: Missile; Cost: 1-3; Maintain: -; Time: 1 sec; Duration: Instant];'
    );
  });

  it('exports equipment with quantity, decimal cost, and weight', () => {
    const character = makeCharacter();
    requireData(character).equipment = [{
      id: 'equipment-1',
      name: 'Fine Boots',
      quantity: 2,
      cost: 80.5,
      weight: 3.25,
    }];

    expect(exportCharacterText(character)).toContain(
      'Equipment: 2 Fine Boots [$80.5; 3.25 lb];'
    );
  });

  it('exports other equipment and notes as single-line scalar sections', () => {
    const character = makeCharacter();
    const data = requireData(character);
    data.otherEquipment = 'Bedroll,\nflint and steel';
    data.notes = 'First line\r\nsecond line';

    const text = exportCharacterText(character);
    expect(text).toContain('Other Equipment: Bedroll, flint and steel');
    expect(text).toContain('Notes: First line second line');
  });

  it('round-trips every parser-backed Bertok data section', () => {
    const original = parseCharacterText(BERTOK_TEXT);
    const roundTrip = parseCharacterText(exportCharacterText(original));

    expect(roundTrip.name).toBe(original.name);
    expect(requireData(roundTrip).totalPoints).toBe(requireData(original).totalPoints);
    expect(projectParsedSections(requireData(roundTrip))).toEqual(
      projectParsedSections(requireData(original))
    );
    expect(requireData(roundTrip).otherEquipment).toBe(requireData(original).otherEquipment);
    expect(requireData(roundTrip).notes).toBe(requireData(original).notes);
  });
});
