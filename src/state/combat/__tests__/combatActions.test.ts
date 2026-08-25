import { describe, expect, it } from 'vitest';
import {
  COMBAT_CHARACTER_ADD,
  COMBAT_CHARACTER_UPDATE,
  COMBAT_CHARACTER_REMOVE,
  COMBAT_CHARACTERS_SET,
  COMBAT_ACTIVE_SET,
  COMBAT_ACTIVE_UPDATE,
  COMBAT_HISTORY_SET,
  COMBAT_TOMBSTONES_SET,
  COMBAT_RULES_PRESET_SET,
  COMBAT_ITEMS_SET,
  COMBAT_ITEM_ADD,
  COMBAT_REVEAL_STATE_SET,
  ENCOUNTER_TEMPLATE_ADD,
  ENCOUNTER_TEMPLATE_UPDATE,
  ENCOUNTER_TEMPLATE_REMOVE,
  ENCOUNTER_TEMPLATES_SET,
  isCombatAction,
  type CombatAction
} from '../combatActions';
import type { CombatCharacter, CombatItem } from '../../../types/campaign';
import type { CombatState } from '../../../types/combatTracker';
import type { EncounterTemplate } from '../../../types/combatTracker';

const mockCombatCharacter = (overrides?: Partial<CombatCharacter>): CombatCharacter =>
  ({
    id: 'char-1',
    name: 'Test Fighter',
    isNPC: false,
    hp: 12,
    maxHP: 12,
    ...overrides
  } as unknown as CombatCharacter);

const mockCombatSession = (overrides?: Partial<CombatState>): CombatState =>
  ({
    id: 'session-1',
    name: 'Test Battle',
    startTime: 1767225600000,
    participants: [],
    turnOrder: [],
    currentTurnIndex: 0,
    currentRound: 1,
    turnDecisions: {},
    log: [],
    ...overrides
  } as CombatState);

const mockCombatItem = (overrides?: Partial<CombatItem>): CombatItem =>
  ({
    id: 'item-1',
    name: 'Healing Potion',
    ...overrides
  } as unknown as CombatItem);

const mockEncounterTemplate = (overrides?: Partial<EncounterTemplate>): EncounterTemplate =>
  ({
    id: 'tpl-1',
    name: 'Goblin Ambush',
    ...overrides
  } as unknown as EncounterTemplate);

describe('combatActions', () => {
  describe('action type constants', () => {
    it('exposes stable string literals', () => {
      expect(COMBAT_CHARACTER_ADD).toBe('addCombatCharacter');
      expect(COMBAT_CHARACTER_UPDATE).toBe('updateCombatCharacter');
      expect(COMBAT_CHARACTER_REMOVE).toBe('removeCombatCharacter');
      expect(COMBAT_CHARACTERS_SET).toBe('setCombatCharacters');
      expect(COMBAT_ACTIVE_SET).toBe('setCombatActive');
      expect(COMBAT_ACTIVE_UPDATE).toBe('updateCombatActive');
      expect(COMBAT_HISTORY_SET).toBe('setCombatHistory');
      expect(COMBAT_TOMBSTONES_SET).toBe('setCombatTombstones');
      expect(COMBAT_RULES_PRESET_SET).toBe('setCombatRulesPreset');
      expect(COMBAT_ITEMS_SET).toBe('setCombatItems');
      expect(COMBAT_ITEM_ADD).toBe('addCombatItem');
      expect(COMBAT_REVEAL_STATE_SET).toBe('setCombatRevealState');
      expect(ENCOUNTER_TEMPLATE_ADD).toBe('addEncounterTemplate');
      expect(ENCOUNTER_TEMPLATE_UPDATE).toBe('updateEncounterTemplate');
      expect(ENCOUNTER_TEMPLATE_REMOVE).toBe('removeEncounterTemplate');
      expect(ENCOUNTER_TEMPLATES_SET).toBe('setEncounterTemplates');
    });

    it('constants are all unique', () => {
      const values = [
        COMBAT_CHARACTER_ADD,
        COMBAT_CHARACTER_UPDATE,
        COMBAT_CHARACTER_REMOVE,
        COMBAT_CHARACTERS_SET,
        COMBAT_ACTIVE_SET,
        COMBAT_ACTIVE_UPDATE,
        COMBAT_HISTORY_SET,
        COMBAT_TOMBSTONES_SET,
        COMBAT_RULES_PRESET_SET,
        COMBAT_ITEMS_SET,
        COMBAT_ITEM_ADD,
        COMBAT_REVEAL_STATE_SET,
        ENCOUNTER_TEMPLATE_ADD,
        ENCOUNTER_TEMPLATE_UPDATE,
        ENCOUNTER_TEMPLATE_REMOVE,
        ENCOUNTER_TEMPLATES_SET
      ];
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('isCombatAction', () => {
    it('returns true for combat character actions', () => {
      const add: CombatAction = { type: COMBAT_CHARACTER_ADD, payload: mockCombatCharacter() };
      const update: CombatAction = {
        type: COMBAT_CHARACTER_UPDATE,
        payload: { id: 'char-1', changes: { name: 'Renamed' } }
      };
      const remove: CombatAction = { type: COMBAT_CHARACTER_REMOVE, payload: 'char-1' };
      const setAll: CombatAction = {
        type: COMBAT_CHARACTERS_SET,
        payload: { 'char-1': mockCombatCharacter() }
      };
      expect(isCombatAction(add)).toBe(true);
      expect(isCombatAction(update)).toBe(true);
      expect(isCombatAction(remove)).toBe(true);
      expect(isCombatAction(setAll)).toBe(true);
    });

    it('returns true for combat session actions', () => {
      const setActive: CombatAction = { type: COMBAT_ACTIVE_SET, payload: mockCombatSession() };
      const updateActive: CombatAction = {
        type: COMBAT_ACTIVE_UPDATE,
        payload: { currentRound: 2 }
      };
      expect(isCombatAction(setActive)).toBe(true);
      expect(isCombatAction(updateActive)).toBe(true);
    });

    it('returns true for COMBAT_ACTIVE_SET with null payload', () => {
      const action: CombatAction = { type: COMBAT_ACTIVE_SET, payload: null };
      expect(isCombatAction(action)).toBe(true);
    });

    it('returns true for history, tombstone, and rules actions', () => {
      const history: CombatAction = { type: COMBAT_HISTORY_SET, payload: [] };
      const tombstones: CombatAction = { type: COMBAT_TOMBSTONES_SET, payload: [] };
      const rules: CombatAction = { type: COMBAT_RULES_PRESET_SET, payload: 'standard' };
      expect(isCombatAction(history)).toBe(true);
      expect(isCombatAction(tombstones)).toBe(true);
      expect(isCombatAction(rules)).toBe(true);
    });

    it('returns true for combat item actions', () => {
      const setItems: CombatAction = { type: COMBAT_ITEMS_SET, payload: {} };
      const addItem: CombatAction = { type: COMBAT_ITEM_ADD, payload: mockCombatItem() };
      expect(isCombatAction(setItems)).toBe(true);
      expect(isCombatAction(addItem)).toBe(true);
    });

    it('returns true for reveal state action (including null payload)', () => {
      const nullReveal: CombatAction = { type: COMBAT_REVEAL_STATE_SET, payload: null };
      const reveal: CombatAction = {
        type: COMBAT_REVEAL_STATE_SET,
        payload: { version: 1, combatId: 'c-1', byInstanceId: {} }
      };
      expect(isCombatAction(nullReveal)).toBe(true);
      expect(isCombatAction(reveal)).toBe(true);
    });

    it('returns true for encounter template actions', () => {
      const add: CombatAction = {
        type: ENCOUNTER_TEMPLATE_ADD,
        payload: mockEncounterTemplate()
      };
      const update: CombatAction = {
        type: ENCOUNTER_TEMPLATE_UPDATE,
        payload: { id: 'tpl-1', changes: { name: 'New' } }
      };
      const remove: CombatAction = { type: ENCOUNTER_TEMPLATE_REMOVE, payload: 'tpl-1' };
      const setAll: CombatAction = { type: ENCOUNTER_TEMPLATES_SET, payload: {} };
      expect(isCombatAction(add)).toBe(true);
      expect(isCombatAction(update)).toBe(true);
      expect(isCombatAction(remove)).toBe(true);
      expect(isCombatAction(setAll)).toBe(true);
    });

    it('returns false for unrelated action types', () => {
      expect(isCombatAction({ type: 'addCharacter' })).toBe(false);
      expect(isCombatAction({ type: 'addInventoryItem' })).toBe(false);
      expect(isCombatAction({ type: 'addAlchemyRecipe' })).toBe(false);
    });

    it('returns false for empty string type', () => {
      expect(isCombatAction({ type: '' })).toBe(false);
    });

    it('returns false for substring or near-miss types', () => {
      expect(isCombatAction({ type: 'addCombat' })).toBe(false);
      expect(isCombatAction({ type: 'Combat' })).toBe(false);
      expect(isCombatAction({ type: 'addCombatCharacters' })).toBe(false);
    });

    it('narrows the action type for TypeScript consumers', () => {
      const unknownAction: { type: string; payload?: unknown } = {
        type: COMBAT_CHARACTER_ADD,
        payload: mockCombatCharacter()
      };
      if (isCombatAction(unknownAction)) {
        expect([
          COMBAT_CHARACTER_ADD,
          COMBAT_CHARACTER_UPDATE,
          COMBAT_CHARACTER_REMOVE,
          COMBAT_CHARACTERS_SET,
          COMBAT_ACTIVE_SET,
          COMBAT_ACTIVE_UPDATE,
          COMBAT_HISTORY_SET,
          COMBAT_TOMBSTONES_SET,
          COMBAT_RULES_PRESET_SET,
          COMBAT_ITEMS_SET,
          COMBAT_ITEM_ADD,
          COMBAT_REVEAL_STATE_SET,
          ENCOUNTER_TEMPLATE_ADD,
          ENCOUNTER_TEMPLATE_UPDATE,
          ENCOUNTER_TEMPLATE_REMOVE,
          ENCOUNTER_TEMPLATES_SET
        ]).toContain(unknownAction.type);
      } else {
        throw new Error('expected type guard to accept COMBAT_CHARACTER_ADD');
      }
    });
  });
});
