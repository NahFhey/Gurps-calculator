/**
 * Character State Module
 *
 * Exports for the character system state slice.
 */

// Reducer
export { handleCharacterAction } from './characterReducer';

// Actions
export {
  // Action type constants
  CHARACTER_ADD,
  CHARACTER_UPDATE,
  CHARACTER_REMOVE,
  CHARACTERS_SET,
  // Type guard
  isCharacterAction,
  // Types
  type CharacterAction
} from './characterActions';

// Re-export selectors from central location
export * from '../selectors/characterSelectors';
