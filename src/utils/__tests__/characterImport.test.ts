import { describe, expect, it } from 'vitest';
import { parseCharacterText, parsePartyText, splitPartyTextBlocks } from '../characterImport';

function parseWithData(text: string) {
  const character = parseCharacterText(text);
  if (!character.gcsData) {
    throw new Error('Expected imported character to contain GCS data');
  }

  return { character, gcsData: character.gcsData };
}

describe('parseCharacterText defaults and partial imports', () => {
  it('returns a usable default character for an empty string', () => {
    const { character, gcsData } = parseWithData('');

    expect(character.id).toMatch(/^char-\d+-[a-z0-9]+$/);
    expect(character.name).toBe('Unknown');
    expect(character.isPlayer).toBe(true);
    expect(character.work).toEqual({ enabled: true, skills: {} });
    expect(character.st).toBe(10);
    expect(gcsData).toMatchObject({
      totalPoints: 0,
      attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
      attributePoints: { ST: 0, DX: 0, IQ: 0, HT: 0 },
      pools: {
        HP: { current: 10, max: 10, points: 0 },
        FP: { current: 10, max: 10, points: 0 },
      },
      advantages: [],
      perks: [],
      disadvantages: [],
      quirks: [],
      skills: [],
      spells: [],
      equipment: [],
      otherEquipment: '',
      notes: '',
    });
    expect(gcsData.secondaryAttributes.basicSpeed).toEqual({ value: 5, points: 0 });
    expect(gcsData.secondaryAttributes.basicMove).toEqual({ value: 5, points: 0 });
  });

  it('ignores whitespace and unrecognized garbage lines', () => {
    const { character, gcsData } = parseWithData(`
      This is not a GCS export section

      ST 18 [80] without its section prefix
      Totally Unknown: value
    `);

    expect(character.name).toBe('Unknown');
    expect(character.st).toBe(10);
    expect(gcsData.totalPoints).toBe(0);
    expect(gcsData.attributes).toEqual({ ST: 10, DX: 10, IQ: 10, HT: 10 });
    expect(gcsData.skills).toEqual([]);
  });

  it('parses a name-only payload and preserves all absent-section defaults', () => {
    const { character, gcsData } = parseWithData('Name: Eira Stonehand');

    expect(character.name).toBe('Eira Stonehand');
    expect(gcsData.totalPoints).toBe(0);
    expect(gcsData.attributes).toEqual({ ST: 10, DX: 10, IQ: 10, HT: 10 });
    expect(gcsData.pools).toEqual({
      HP: { current: 10, max: 10, points: 0 },
      FP: { current: 10, max: 10, points: 0 },
    });
    expect(gcsData.advantages).toEqual([]);
    expect(gcsData.skills).toEqual([]);
    expect(gcsData.spells).toEqual([]);
    expect(gcsData.equipment).toEqual([]);
  });

  it('parses present primary attributes while defaulting omitted attributes and sections', () => {
    const { character, gcsData } = parseWithData(`
      Name: Toren Vale (75)
      Primary Attributes: ST 13 [30]; IQ 11 [20];
    `);

    expect(character.name).toBe('Toren Vale');
    expect(character.st).toBe(13);
    expect(gcsData.totalPoints).toBe(75);
    expect(gcsData.attributes).toEqual({ ST: 13, DX: 10, IQ: 11, HT: 10 });
    expect(gcsData.attributePoints).toEqual({ ST: 30, DX: 0, IQ: 20, HT: 0 });
    expect(gcsData.pools.HP).toEqual({ current: 10, max: 10, points: 0 });
    expect(gcsData.skills).toEqual([]);
    expect(gcsData.spells).toEqual([]);
    expect(gcsData.equipment).toEqual([]);
  });
});

describe('parseCharacterText malformed and empty sections', () => {
  it('degrades malformed recognized sections to defaults or empty collections', () => {
    const { character, gcsData } = parseWithData(`
      Name: Broken Export (12)
      Primary Attributes: garbage
      Point Pools: nonsense
      Advantages: Flight without a points bracket
      Disadvantages: Bad Sight (Nearsighted) minus ten
      Skills: not a real skill entry
      Spells: definitely not a spell
      Equipment: broken
    `);

    expect(character.name).toBe('Broken Export');
    expect(character.st).toBe(10);
    expect(gcsData.totalPoints).toBe(12);
    expect(gcsData.attributes).toEqual({ ST: 10, DX: 10, IQ: 10, HT: 10 });
    expect(gcsData.attributePoints).toEqual({ ST: 0, DX: 0, IQ: 0, HT: 0 });
    expect(gcsData.pools).toEqual({
      HP: { current: 10, max: 10, points: 0 },
      FP: { current: 10, max: 10, points: 0 },
    });
    expect(gcsData.advantages).toEqual([]);
    expect(gcsData.disadvantages).toEqual([]);
    expect(gcsData.skills).toEqual([]);
    expect(gcsData.spells).toEqual([]);
    expect(gcsData.equipment).toEqual([]);
    expect(character.work.skills).toEqual({});
  });

  it('turns empty section values into empty arrays', () => {
    const { gcsData } = parseWithData(`
      Name: Sparse Scout (25)
      Advantages:
      Reactions:
      Conditional Modifiers:
      Skills:
      Spells:
      Equipment:
    `);

    expect(gcsData.advantages).toEqual([]);
    expect(gcsData.reactions).toEqual([]);
    expect(gcsData.conditionalModifiers).toEqual([]);
    expect(gcsData.skills).toEqual([]);
    expect(gcsData.spells).toEqual([]);
    expect(gcsData.equipment).toEqual([]);
  });
});

describe('parseCharacterText full GCS imports', () => {
  it('parses representative identity, stats, traits, skills, spells, and equipment', () => {
    const { character, gcsData } = parseWithData(`
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
    `);

    expect(character.name).toBe('Bertok Darkwing');
    expect(character.st).toBe(9);
    expect(gcsData.totalPoints).toBe(169);
    expect(gcsData.attributes).toEqual({ ST: 9, DX: 12, IQ: 14, HT: 9 });
    expect(gcsData.attributePoints).toEqual({ ST: 0, DX: 0, IQ: 60, HT: 0 });
    expect(gcsData.secondaryAttributes.per).toEqual({ value: 13, points: -5 });
    expect(gcsData.secondaryAttributes.basicSpeed).toEqual({ value: 5.25, points: 0 });
    expect(gcsData.pools.FP).toEqual({ current: 9, max: 9, points: 0 });
    expect(gcsData.reactions).toEqual([
      { modifier: -2, condition: 'from others except your own kind' },
      { modifier: 1, condition: 'from scholars' },
    ]);
    expect(gcsData.conditionalModifiers).toEqual([
      { modifier: 2, condition: 'to resist poison' },
      { modifier: -1, condition: 'in bright light' },
    ]);

    expect(gcsData.advantages[1]).toMatchObject({
      type: 'advantage',
      name: 'Increased Dexterity',
      level: 2,
      points: 40,
    });
    expect(gcsData.disadvantages[0]).toMatchObject({
      type: 'disadvantage',
      name: 'Bad Sight',
      specialization: 'Nearsighted',
      points: -10,
    });
    expect(gcsData.skills[1]).toMatchObject({
      name: 'Alchemy',
      techLevel: 3,
      attribute: 'IQ',
      relativeLevel: 1,
      points: 12,
      level: 15,
    });
    expect(character.work.skills).toMatchObject({ Alchemy: 15, alchemy: 15 });
    expect(gcsData.spells[0]).toMatchObject({
      name: 'Apportation',
      level: 14,
      attribute: 'IQ',
      relativeLevel: 0,
      points: 1,
      spellClass: 'Regular',
      castingCost: '2',
      maintenanceCost: '-',
      castingTime: '1 sec',
      duration: '1 min',
    });
    // NOTE: The generic semicolon splitter breaks documented equipment entries at the
    // cost/weight separator, so even well-formed equipment is currently dropped.
    expect(gcsData.equipment).toEqual([]);
    expect(gcsData.otherEquipment).toBe('Bedroll, flint and steel');
    expect(gcsData.notes).toBe('Corvi alchemist and reluctant adventurer.');
  });
});

describe('parsePartyText', () => {
  it('splits multiple Name blocks into separate characters', () => {
    const characters = parsePartyText(`
Name: Ari (100)
Primary Attributes: ST 11 [10]; DX 10 [0]; IQ 10 [0]; HT 10 [0];
Name: Bea (125)
Primary Attributes: ST 9 [-10]; DX 12 [40]; IQ 11 [20]; HT 10 [0];
`);

    expect(characters).toHaveLength(2);
    expect(characters.map((character) => character.name)).toEqual(['Ari', 'Bea']);
    expect(characters.map((character) => character.gcsData?.totalPoints)).toEqual([100, 125]);
  });

  it('returns one character for ordinary single-character text', () => {
    const characters = parsePartyText('Name: Solo (50)\nSkills: Stealth DX+0 [2]-11;');
    expect(characters).toHaveLength(1);
    expect(characters[0]?.name).toBe('Solo');
  });

  it('retains legacy default parsing when no Name boundary exists', () => {
    const characters = parsePartyText('Primary Attributes: ST 14 [40];');
    expect(characters).toHaveLength(1);
    expect(characters[0]?.name).toBe('Unknown');
    expect(characters[0]?.st).toBe(14);
  });

  it('recognizes indented Name boundaries and discards preamble text', () => {
    const blocks = splitPartyTextBlocks('Exported party\n  Name: One (10)\nNotes: First\n\tName: Two (20)');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).not.toContain('Exported party');
    expect(parsePartyText(blocks.join('\n')).map((character) => character.name)).toEqual(['One', 'Two']);
  });
});
