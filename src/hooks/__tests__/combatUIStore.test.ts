import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ViewMode } from '../../utils/combatViewFilter';
import { useCombatUI, setCombatUI, resetCombatUI } from '../combatUIStore';

const initialState = {
  selectedParticipantId: null,
  gmMode: false,
  viewMode: ViewMode.PLAYER,
  diceExpression: '3d6',
  rollTarget: '',
};

describe('combatUIStore', () => {
  beforeEach(() => {
    act(() => {
      resetCombatUI();
    });
  });

  afterEach(() => {
    act(() => {
      resetCombatUI();
    });
  });

  it('returns the initial state', () => {
    const { result } = renderHook(() => useCombatUI());

    expect(result.current).toEqual(initialState);
  });

  it('shallow-merges updates and re-renders subscribed hooks', () => {
    const { result } = renderHook(() => useCombatUI());

    act(() => {
      setCombatUI({ gmMode: true, selectedParticipantId: 'p1' });
    });

    expect(result.current).toEqual({
      selectedParticipantId: 'p1',
      gmMode: true,
      viewMode: ViewMode.PLAYER,
      diceExpression: '3d6',
      rollTarget: '',
    });
  });

  it('restores the initial state after reset', () => {
    const { result } = renderHook(() => useCombatUI());

    act(() => {
      setCombatUI({
        selectedParticipantId: 'p1',
        gmMode: true,
        diceExpression: '2d6+1',
        rollTarget: '12',
      });
    });

    act(() => {
      resetCombatUI();
    });

    expect(result.current).toEqual(initialState);
  });

  it('keeps all other keys intact after a single-key update', () => {
    const { result } = renderHook(() => useCombatUI());

    act(() => {
      setCombatUI({ rollTarget: '12' });
    });

    expect(result.current).toEqual({
      ...initialState,
      rollTarget: '12',
    });
  });
});
