/**
 * Character Reducer
 *
 * Handles state mutations for character-related operations using Immer draft.
 */

import type { Draft } from 'immer';
import type { CampaignState } from '../campaignReducer';
import {
  type CharacterAction,
  CHARACTER_ADD,
  CHARACTER_UPDATE,
  CHARACTER_REMOVE,
  CHARACTERS_SET,
  CHARACTER_TEMPLATE_UPSERT,
  CHARACTER_TEMPLATE_REMOVE
} from './characterActions';

/**
 * Process character actions on the campaign state draft.
 */
export function handleCharacterAction(
  draft: Draft<CampaignState>,
  action: CharacterAction
): boolean {
  switch (action.type) {
    case CHARACTER_ADD:
      draft.entities.characters[action.payload.id] = action.payload;
      return true;

    case CHARACTER_UPDATE:
      if (draft.entities.characters[action.payload.id]) {
        draft.entities.characters[action.payload.id] = {
          ...draft.entities.characters[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case CHARACTER_REMOVE:
      delete draft.entities.characters[action.payload];
      // Also delete the character's inventory if it exists
      for (const [invId, inv] of Object.entries(draft.entities.inventories)) {
        if (inv.ownerType === 'character' && inv.ownerId === action.payload) {
          delete draft.entities.inventories[invId];
        }
      }
      return true;

    case CHARACTERS_SET:
      draft.entities.characters = action.payload;
      return true;

    case CHARACTER_TEMPLATE_UPSERT:
      if (!draft.entities.characterTemplates) draft.entities.characterTemplates = {};
      draft.entities.characterTemplates[action.payload.id] = action.payload;
      draft.entities.deletedBuiltinTemplateIds = (draft.entities.deletedBuiltinTemplateIds ?? [])
        .filter((id) => id !== action.payload.id);
      return true;

    case CHARACTER_TEMPLATE_REMOVE: {
      const template = draft.entities.characterTemplates?.[action.payload];
      if (template?.builtin) {
        const deleted = draft.entities.deletedBuiltinTemplateIds ?? [];
        if (!deleted.includes(action.payload)) deleted.push(action.payload);
        draft.entities.deletedBuiltinTemplateIds = deleted;
      }
      if (draft.entities.characterTemplates) delete draft.entities.characterTemplates[action.payload];
      return true;
    }

    default:
      return false;
  }
}
