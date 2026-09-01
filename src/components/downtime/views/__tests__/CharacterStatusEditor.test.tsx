import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CharacterStatusEditor } from '../../../character-management/CharacterStatusEditor';
import type { Character } from '../../../../types/campaign';

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'Aldric',
    work: { skills: {} },
    ...overrides,
  };
}

describe('CharacterStatusEditor', () => {
  it('removes a condition while preserving the remaining status', () => {
    const onUpdate = vi.fn();
    render(<CharacterStatusEditor
      character={character({ status: {
        conditions: [{ instanceId: 'poison', conditionId: 'poisoned', label: 'Poisoned' }],
        crippled: ['armR'],
      } })}
      onUpdate={onUpdate}
      onClose={() => undefined}
    />);

    fireEvent.click(screen.getByTestId('remove-condition-poison'));
    expect(onUpdate).toHaveBeenCalledWith({ crippled: ['armR'] });
  });

  it('drops the status field when its last crippled entry is removed', () => {
    const onUpdate = vi.fn();
    render(<CharacterStatusEditor
      character={character({ status: { crippled: ['armR'] } })}
      onUpdate={onUpdate}
      onClose={() => undefined}
    />);

    fireEvent.click(screen.getByTestId('remove-crippled-armR'));
    expect(onUpdate).toHaveBeenCalledWith(undefined);
  });

  it('toggles death in both directions', () => {
    const markDead = vi.fn();
    const { unmount } = render(<CharacterStatusEditor
      character={character()}
      onUpdate={markDead}
      onClose={() => undefined}
    />);
    fireEvent.click(screen.getByTestId('toggle-dead-status'));
    expect(markDead).toHaveBeenCalledWith({ dead: true });
    unmount();

    const markAlive = vi.fn();
    render(<CharacterStatusEditor
      character={character({ status: { dead: true } })}
      onUpdate={markAlive}
      onClose={() => undefined}
    />);
    fireEvent.click(screen.getByTestId('toggle-dead-status'));
    expect(markAlive).toHaveBeenCalledWith(undefined);
  });
});
