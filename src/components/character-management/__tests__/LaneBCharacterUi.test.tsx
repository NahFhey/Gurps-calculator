import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createBlankCharacter } from '../../../utils/characterManagement';
import { CharacterCompareModal } from '../CharacterCompareModal';
import { CharacterCreationModal } from '../CharacterCreationModal';

describe('CharacterCreationModal NPC generation', () => {
  it('generates previews, supports name rerolls, and adds the batch', () => {
    const onCharacterCreated = vi.fn();
    render(<CharacterCreationModal onClose={vi.fn()} onCharacterCreated={onCharacterCreated} />);
    fireEvent.click(screen.getByText('Generate NPC'));
    fireEvent.change(screen.getByLabelText('NPC template'), { target: { value: 'builtin-fighter' } });
    fireEvent.change(screen.getByLabelText('NPC count'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('NPC variance'), { target: { value: 'none' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(screen.getByTestId('npc-preview-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('reroll-name-button')).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId('reroll-name-button')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 characters' }));
    expect(onCharacterCreated).toHaveBeenCalledTimes(2);
    expect(onCharacterCreated.mock.calls.every(([character]) => character.isPlayer === false)).toBe(true);
  });
});

describe('CharacterCompareModal', () => {
  it('renders unchanged, changed, and one-sided rows', () => {
    const left = createBlankCharacter('Left');
    const right = createBlankCharacter('Right');
    if (!right.gcsData) throw new Error('Expected GCS data');
    right.gcsData.attributes.ST = 12;
    right.gcsData.skills.push({
      id: 'skill-only-right', name: 'Stealth', attribute: 'DX', difficulty: 'A', relativeLevel: 0, points: 2, level: 10,
    });
    render(<CharacterCompareModal character={left} characters={[left, right]} onClose={vi.fn()} />);
    const rows = screen.getByTestId('character-comparison-rows');
    expect(rows.querySelector('[data-status="same"]')).toBeInTheDocument();
    expect(rows.querySelector('[data-status="changed"]')).toBeInTheDocument();
    expect(rows.querySelector('[data-status="added"]')).toBeInTheDocument();
    expect(screen.getByText('Stealth')).toBeInTheDocument();
  });
});
