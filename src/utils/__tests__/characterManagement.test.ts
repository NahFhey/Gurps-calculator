import { describe, it, expect } from 'vitest';
import {
  createBlankCharacter,
  createCharacterFromTemplateEntity,
  duplicateCharacter,
  exportCharacterJSON,
  importCharacterJSON,
  importCharactersJSON,
} from '../characterManagement';
import type { Character } from '../../types/campaign';
import { CHARACTER_TEMPLATE_SEEDS } from '../../constants/characterTemplateSeeds';

describe('characterManagement', () => {
  describe('createBlankCharacter', () => {
    it('creates a character with default name and required fields', () => {
      const c = createBlankCharacter();
      expect(c.name).toBe('New Character');
      expect(c.isPlayer).toBe(true);
      expect(c.id).toMatch(/^char-/);
      expect(c.work?.enabled).toBe(true);
      expect(c.gcsData).toBeDefined();
    });

    it('honors a provided name', () => {
      const c = createBlankCharacter('Bob');
      expect(c.name).toBe('Bob');
    });

    it('produces unique IDs across calls', () => {
      const a = createBlankCharacter();
      const b = createBlankCharacter();
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('createCharacterFromTemplateEntity', () => {
    it('creates a fighter with the template name and point value', () => {
      const fighter = CHARACTER_TEMPLATE_SEEDS.find((template) => template.id === 'builtin-fighter');
      expect(fighter).toBeDefined();
      if (!fighter) return;
      const c = createCharacterFromTemplateEntity(fighter);
      expect(c.name).toBe('New Fighter');
      expect(c.gcsData?.totalPoints).toBe(150);
    });

    it('covers every declared template type', () => {
      for (const tmpl of CHARACTER_TEMPLATE_SEEDS) {
        const c = createCharacterFromTemplateEntity(tmpl);
        expect(c.name).toBe(`New ${tmpl.name}`);
        expect(c.gcsData?.totalPoints).toBe(tmpl.gcsData.totalPoints);
      }
    });
  });

  describe('duplicateCharacter', () => {
    it('produces a deep copy with a new ID and "(Copy)" suffix', () => {
      const original = createBlankCharacter('Alice');
      const copy = duplicateCharacter(original);

      expect(copy.name).toBe('Alice (Copy)');
      expect(copy.id).not.toBe(original.id);
      expect(copy.gcsData).not.toBe(original.gcsData);
    });

    it('regenerates IDs for nested gcsData items', () => {
      const original = createBlankCharacter('Alice');
      if (original.gcsData) {
        original.gcsData.advantages.push({
          id: 'advantage-original',
          name: 'Test',
          points: 5,
          type: 'advantage',
        } as never);
        original.gcsData.skills.push({
          id: 'skill-original',
          name: 'Test',
          points: 1,
        } as never);
      }

      const copy = duplicateCharacter(original);
      expect(copy.gcsData?.advantages[0]?.id).not.toBe('advantage-original');
      expect(copy.gcsData?.advantages[0]?.id).toMatch(/^advantage-/);
      expect(copy.gcsData?.skills[0]?.id).not.toBe('skill-original');
      expect(copy.gcsData?.skills[0]?.id).toMatch(/^skill-/);
    });

    it('remaps skill history references to regenerated skill IDs', () => {
      const original = createBlankCharacter('Historian');
      if (!original.gcsData) throw new Error('Expected GCS data');
      original.gcsData.skills = [{
        id: 'skill-original', name: 'Research', attribute: 'IQ', difficulty: 'A',
        points: 1, relativeLevel: -1, level: 9,
      }];
      original.gcsData.skillHistory = [{
        id: 'history-1', skillId: 'skill-original', skillName: 'Research',
        date: new Date().toISOString(), pointsAdded: 1, previousPoints: 0,
        newPoints: 1, previousLevel: 0, newLevel: 9,
      }];

      const copy = duplicateCharacter(original);
      expect(copy.gcsData?.skillHistory?.[0]?.skillId).toBe(copy.gcsData?.skills[0]?.id);
      expect(copy.gcsData?.skillHistory?.[0]?.skillId).not.toBe('skill-original');
    });

    it('handles a character with no gcsData', () => {
      const original: Character = {
        id: 'char-x',
        name: 'NoGCS',
        isPlayer: false,
        work: { enabled: false, skills: {} },
      } as Character;
      const copy = duplicateCharacter(original);
      expect(copy.name).toBe('NoGCS (Copy)');
      expect(copy.id).not.toBe('char-x');
    });
  });

  describe('exportCharacterJSON / importCharacterJSON', () => {
    it('round-trips a blank character preserving name and isPlayer', () => {
      const original = createBlankCharacter('RoundTrip');
      const json = exportCharacterJSON(original);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('1.0');
      expect(parsed.character.name).toBe('RoundTrip');

      const imported = importCharacterJSON(json);
      expect(imported.name).toBe('RoundTrip');
      expect(imported.isPlayer).toBe(true);
      expect(imported.id).not.toBe(original.id);
      expect(imported.gcsData).toBeDefined();
    });

    it('imports a bare (unwrapped) character object', () => {
      const bare = JSON.stringify({ name: 'Bare', isPlayer: false });
      const imported = importCharacterJSON(bare);
      expect(imported.name).toBe('Bare');
      expect(imported.isPlayer).toBe(false);
      expect(imported.work).toEqual({ enabled: true, skills: {} });
    });

    it('defaults the name when none is provided', () => {
      const imported = importCharacterJSON('{}');
      expect(imported.name).toBe('Imported Character');
    });

    it('throws on malformed JSON', () => {
      expect(() => importCharacterJSON('{not json')).toThrow(/Invalid character JSON/);
    });

    it('throws on a JSON array (not an object)', () => {
      expect(() => importCharacterJSON('[]')).toThrow(/expected a JSON object/);
    });

    it('throws on a non-string name', () => {
      expect(() => importCharacterJSON('{"name": 123}')).toThrow(/name must be a string/);
    });

    it('rejects oversized input (>50MB)', () => {
      const oversized = 'x'.repeat(50 * 1024 * 1024 + 1);
      expect(() => importCharacterJSON(oversized)).toThrow(/maximum import size/);
    });

    it('imports a top-level JSON character array', () => {
      const imported = importCharactersJSON(JSON.stringify([
        { name: 'Ari', work: { skills: {} } },
        { name: 'Bea', work: { skills: {} } },
      ]));
      expect(imported.map((character) => character.name)).toEqual(['Ari', 'Bea']);
      expect(imported[0]?.id).not.toBe(imported[1]?.id);
    });

    it('mirrors single-character JSON as a one-item array', () => {
      expect(importCharactersJSON('{"name":"Solo"}')).toHaveLength(1);
      expect(importCharactersJSON('{"name":"Solo"}')[0]?.name).toBe('Solo');
    });

    it('rejects an empty JSON character array', () => {
      expect(() => importCharactersJSON('[]')).toThrow(/at least one character/);
    });

    it('identifies the invalid array entry index', () => {
      expect(() => importCharactersJSON('[{"name":"Valid"},{"name":4}]')).toThrow(/index 1/);
    });
  });
});
