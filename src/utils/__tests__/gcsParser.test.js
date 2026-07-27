import { describe, expect, it } from 'vitest';

import { parseGCSText, validateCharacter } from '../gcsParser';

const rheaVanceGCSExport = `
GURPS Character Sheet
Name: Rhea Vance (250)

Primary Attributes: ST 12 [20]; DX 13 [60]; IQ 11 [20]; HT 11 [10];
Secondary Attributes: Will 12 [5]; Per 12 [5]; Basic Speed 6.00 [5]; Basic Move 6 [0];
Point Pools: FP 8 / 11 [0]; HP 9 / 13 [4];

Advantages:
Combat Reflexes [15]
High Pain Threshold [10]

Disadvantages:
Code of Honor (Soldier's) [-10]

Skills:
Broadsword DX+2 15 [8]
Shield (Buckler) DX+1 14 [2]
First Aid IQ+1 12 [2]
`.trim();

describe('parseGCSText', () => {
  it('parses a realistic GCS text export into the combat character shape', () => {
    const result = parseGCSText(rheaVanceGCSExport);

    expect(result).toEqual({
      data: {
        name: 'Rhea Vance',
        category: 'player',
        st: 12,
        dx: 13,
        iq: 11,
        ht: 11,
        hp: 13,
        fp: 11,
        mp: 0,
        basicSpeed: 6,
        basicMove: 6,
        dodge: 9,
        parry: 8,
        block: 8,
        dr: 0,
        notes: '',
        currentHP: 13,
        currentFP: 11
      },
      issues: [
        'Dodge calculated from Basic Speed',
        'Parry using default (8) - weapon dependent',
        'Block using default (8) - shield dependent',
        'DR using default (0) - check equipment/advantages manually'
      ],
      confidence: 'high',
      needsReview: false
    });
  });

  it('ignores populated skill and trait sections because they are not part of the exported data', () => {
    const { data } = parseGCSText(rheaVanceGCSExport);

    expect(data).not.toHaveProperty('skills');
    expect(data).not.toHaveProperty('traits');
    expect(data).not.toHaveProperty('advantages');
    expect(data).not.toHaveProperty('disadvantages');
  });

  it('also ignores explicitly empty skill and trait lists', () => {
    const result = parseGCSText(`
      Name: Tomas Greaves (100)
      Primary Attributes: ST 10 [0]; DX 10 [0]; IQ 10 [0]; HT 10 [0];
      Secondary Attributes: Basic Speed 5.00 [0]; Basic Move 5 [0];
      Point Pools: FP 10 / 10 [0]; HP 10 / 10 [0];
      Advantages:
      Disadvantages:
      Skills:
    `);

    expect(result.data).not.toHaveProperty('skills');
    expect(result.data).not.toHaveProperty('traits');
    expect(result.confidence).toBe('high');
  });

  it('returns low-confidence defaults and review issues for non-GCS garbage', () => {
    const result = parseGCSText('This is a grocery list, not a character sheet.');

    expect(result.data).toMatchObject({
      name: '',
      st: 10,
      dx: 10,
      iq: 10,
      ht: 10,
      hp: 10,
      currentHP: 10,
      fp: 10,
      currentFP: 10,
      basicSpeed: 5,
      basicMove: 5,
      dodge: 8
    });
    expect(result.issues).toContain('Name not found');
    expect(result.issues).toContain('Primary Attributes line not found, using defaults');
    expect(result.issues).toContain('Character name missing - review required');
    expect(result.confidence).toBe('low');
    expect(result.needsReview).toBe(true);
  });

  it.each([
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined]
  ])('returns the invalid-input fallback for %s', (_label, input) => {
    expect(parseGCSText(input)).toEqual({
      data: {
        name: '',
        category: 'player',
        st: 10,
        dx: 10,
        iq: 10,
        ht: 10,
        hp: 10,
        fp: 10,
        mp: 0,
        basicSpeed: 5,
        basicMove: 5,
        dodge: 8,
        parry: 8,
        block: 8,
        dr: 0,
        notes: ''
      },
      issues: ['Invalid or empty input'],
      confidence: 'none',
      needsReview: true
    });
  });

  it('treats whitespace-only text as malformed text rather than the empty-input fallback', () => {
    const result = parseGCSText(' \n\t ');

    expect(result.confidence).toBe('low');
    expect(result.needsReview).toBe(true);
    expect(result.issues).toContain('Name not found');
    expect(result.issues).not.toContain('Invalid or empty input');
  });

  it('keeps defaults for missing primary stats and calculates dependent defaults', () => {
    const result = parseGCSText(`
      Name: Brannoc Vale (175)
      Primary Attributes: ST 14 [40]; IQ 12 [40];
    `);

    expect(result.data).toMatchObject({
      name: 'Brannoc Vale',
      st: 14,
      dx: 10,
      iq: 12,
      ht: 10,
      hp: 10,
      fp: 10,
      basicSpeed: 5,
      basicMove: 5,
      dodge: 8
    });
    expect(result.issues).toContain('DX not found, using default (10)');
    expect(result.issues).toContain('HT not found, using default (10)');
    expect(result.confidence).toBe('low');
    expect(result.needsReview).toBe(true);
  });

  it('calculates speed and move when the secondary attribute block is absent', () => {
    const result = parseGCSText(`
      Name: Ilyra Sorn (150)
      Primary Attributes: ST 10 [0]; DX 13 [60]; IQ 12 [40]; HT 11 [10];
      Point Pools: FP 11 / 11 [0]; HP 11 / 11 [0];
    `);

    expect(result.data.basicSpeed).toBe(6);
    expect(result.data.basicMove).toBe(6);
    expect(result.data.dodge).toBe(9);
    expect(result.issues).toContain('Secondary Attributes line not found, calculated defaults');
  });

  it('calculates omitted values inside a partial secondary attribute block', () => {
    const result = parseGCSText(`
      Name: Kestrel Ward (125)
      Primary Attributes: ST 11 [10]; DX 12 [40]; IQ 10 [0]; HT 11 [10];
      Secondary Attributes: Will 10 [0]; Per 11 [5];
      Point Pools: FP 11 / 11 [0]; HP 11 / 11 [0];
    `);

    expect(result.data.basicSpeed).toBe(5.75);
    expect(result.data.basicMove).toBe(5);
    expect(result.issues).toContain('Basic Speed not found, calculated from DX+HT');
    expect(result.issues).toContain('Basic Move not found, calculated from Basic Speed');
  });

  it('uses HT for an omitted pool while preserving the pool that was present', () => {
    const result = parseGCSText(`
      Name: Nia Calder (125)
      Primary Attributes: ST 10 [0]; DX 11 [20]; IQ 12 [40]; HT 12 [20];
      Secondary Attributes: Basic Speed 5.75 [0]; Basic Move 5 [0];
      Point Pools: FP 6 / 14 [6];
    `);

    expect(result.data.hp).toBe(12);
    expect(result.data.currentHP).toBe(12);
    expect(result.data.fp).toBe(14);
    expect(result.data.currentFP).toBe(14);
    expect(result.issues).toContain('HP not found, using HT');
  });
});

describe('validateCharacter', () => {
  it('accepts a combat-ready parsed character', () => {
    const { data } = parseGCSText(rheaVanceGCSExport);

    expect(validateCharacter(data)).toEqual([]);
  });

  it('reports every required field that has an explicitly invalid value', () => {
    expect(validateCharacter({
      name: '   ',
      hp: 0,
      basicSpeed: -0.25,
      dx: 21
    })).toEqual([
      'Character must have a name',
      'HP must be greater than 0',
      'Basic Speed must be greater than 0',
      'DX must be between 1 and 20'
    ]);
  });

  it('reports a missing name but does not report absent numeric fields', () => {
    expect(validateCharacter({})).toEqual(['Character must have a name']);
  });

  it('accepts the inclusive DX boundaries', () => {
    const baseCharacter = { name: 'Boundary Tester', hp: 10, basicSpeed: 5 };

    expect(validateCharacter({ ...baseCharacter, dx: 1 })).toEqual([]);
    expect(validateCharacter({ ...baseCharacter, dx: 20 })).toEqual([]);
  });
});
