import { describe, expect, it, beforeEach } from 'vitest';
import { produce } from 'immer';
import { handleCharacterAction } from '../characterReducer';
import {
  CHARACTER_ADD,
  CHARACTER_UPDATE,
  CHARACTER_REMOVE,
  CHARACTERS_SET,
  type CharacterAction
} from '../characterActions';
import type { CampaignState } from '../../campaignReducer';
import type { Character, Inventory } from '../../../types/campaign';

const createMockCharacter = (overrides?: Partial<Character>): Character => ({
  id: 'char-1',
  name: 'Test Hero',
  work: { skills: {} },
  ...overrides
});

const createMockInventory = (overrides?: Partial<Inventory>): Inventory => ({
  id: 'inv-1',
  ownerType: 'character',
  ownerId: 'char-1',
  currency: {},
  items: [],
  tools: [],
  materials: [],
  food: [],
  ...overrides
});

const createMinimalCampaignState = (): CampaignState => (({
  entities: {
    characters: {},
    inventories: {}
  }
} as unknown)) as CampaignState;

function applyAction(state: CampaignState, action: CharacterAction): CampaignState {
  return produce(state, draft => {
    handleCharacterAction(draft, action);
  });
}

describe('characterReducer', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createMinimalCampaignState();
  });

  describe('CHARACTER_ADD', () => {
    it('adds a character to entities.characters', () => {
      const char = createMockCharacter();
      const next = applyAction(state, { type: CHARACTER_ADD, payload: char });

      expect(next.entities.characters['char-1']).toEqual(char);
    });

    it('overwrites an existing character with the same id', () => {
      const original = createMockCharacter({ name: 'Original' });
      const replacement = createMockCharacter({ name: 'Replacement' });

      let next = applyAction(state, { type: CHARACTER_ADD, payload: original });
      next = applyAction(next, { type: CHARACTER_ADD, payload: replacement });

      expect(next.entities.characters['char-1'].name).toBe('Replacement');
    });
  });

  describe('CHARACTER_UPDATE', () => {
    it('merges changes into the existing character', () => {
      const char = createMockCharacter();
      state = applyAction(state, { type: CHARACTER_ADD, payload: char });

      const next = applyAction(state, {
        type: CHARACTER_UPDATE,
        payload: { id: 'char-1', changes: { name: 'Renamed', isPlayer: true } }
      });

      expect(next.entities.characters['char-1'].name).toBe('Renamed');
      expect(next.entities.characters['char-1'].isPlayer).toBe(true);
      // Preserves other fields
      expect(next.entities.characters['char-1'].work).toEqual({ skills: {} });
    });

    it('is a no-op when the character does not exist', () => {
      const next = applyAction(state, {
        type: CHARACTER_UPDATE,
        payload: { id: 'missing', changes: { name: 'Ghost' } }
      });

      expect(next.entities.characters['missing']).toBeUndefined();
    });
  });

  describe('CHARACTER_REMOVE', () => {
    it('removes the character from entities.characters', () => {
      const char = createMockCharacter();
      state = applyAction(state, { type: CHARACTER_ADD, payload: char });

      const next = applyAction(state, { type: CHARACTER_REMOVE, payload: 'char-1' });

      expect(next.entities.characters['char-1']).toBeUndefined();
    });

    it("removes the character's owned inventory", () => {
      const char = createMockCharacter();
      const inv = createMockInventory({ id: 'inv-1', ownerId: 'char-1' });
      state = applyAction(state, { type: CHARACTER_ADD, payload: char });
      state = produce(state, draft => {
        draft.entities.inventories['inv-1'] = inv;
      });

      const next = applyAction(state, { type: CHARACTER_REMOVE, payload: 'char-1' });

      expect(next.entities.inventories['inv-1']).toBeUndefined();
    });

    it('leaves party inventories and other characters\' inventories intact', () => {
      state = produce(state, draft => {
        draft.entities.characters['char-1'] = createMockCharacter();
        draft.entities.characters['char-2'] = createMockCharacter({ id: 'char-2', name: 'Other' });
        draft.entities.inventories['inv-1'] = createMockInventory({
          id: 'inv-1',
          ownerId: 'char-1'
        });
        draft.entities.inventories['inv-2'] = createMockInventory({
          id: 'inv-2',
          ownerId: 'char-2'
        });
        draft.entities.inventories['inv-party'] = createMockInventory({
          id: 'inv-party',
          ownerType: 'party',
          ownerId: null
        });
      });

      const next = applyAction(state, { type: CHARACTER_REMOVE, payload: 'char-1' });

      expect(next.entities.inventories['inv-1']).toBeUndefined();
      expect(next.entities.inventories['inv-2']).toBeDefined();
      expect(next.entities.inventories['inv-party']).toBeDefined();
      expect(next.entities.characters['char-2']).toBeDefined();
    });

    it('is a no-op when removing a non-existent character', () => {
      state = applyAction(state, { type: CHARACTER_ADD, payload: createMockCharacter() });

      const next = applyAction(state, { type: CHARACTER_REMOVE, payload: 'missing' });

      expect(next.entities.characters['char-1']).toBeDefined();
    });
  });

  describe('CHARACTERS_SET', () => {
    it('replaces the characters map wholesale', () => {
      state = applyAction(state, {
        type: CHARACTER_ADD,
        payload: createMockCharacter({ id: 'old' })
      });

      const replacement: Record<string, Character> = {
        'new-1': createMockCharacter({ id: 'new-1', name: 'New One' }),
        'new-2': createMockCharacter({ id: 'new-2', name: 'New Two' })
      };

      const next = applyAction(state, { type: CHARACTERS_SET, payload: replacement });

      expect(next.entities.characters['old']).toBeUndefined();
      expect(next.entities.characters['new-1'].name).toBe('New One');
      expect(next.entities.characters['new-2'].name).toBe('New Two');
    });

    it('can clear the characters map with an empty object', () => {
      state = applyAction(state, { type: CHARACTER_ADD, payload: createMockCharacter() });

      const next = applyAction(state, { type: CHARACTERS_SET, payload: {} });

      expect(Object.keys(next.entities.characters)).toHaveLength(0);
    });
  });

  describe('return value', () => {
    it('returns true for handled actions', () => {
      const draft = createMinimalCampaignState();
      const result = produce(draft, d => {
        const handled = handleCharacterAction(d, {
          type: CHARACTER_ADD,
          payload: createMockCharacter()
        });
        expect(handled).toBe(true);
      });
      expect(result.entities.characters['char-1']).toBeDefined();
    });

    it('returns false for unknown action types', () => {
      const draft = createMinimalCampaignState();
      produce(draft, d => {
        const handled = handleCharacterAction(
          d,
          { type: 'unknown/action', payload: null } as unknown as CharacterAction
        );
        expect(handled).toBe(false);
      });
    });
  });
});
