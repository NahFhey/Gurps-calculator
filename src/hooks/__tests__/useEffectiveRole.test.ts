/**
 * useEffectiveRole — effective role and permission derivation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { mockUseSyncContext } = vi.hoisted(() => ({
  mockUseSyncContext: vi.fn(),
}));

vi.mock('../../net/SyncProvider', () => ({
  useSyncContext: mockUseSyncContext,
}));

import { useEffectiveRole } from '../useEffectiveRole';
import { Role } from '../../../shared/session';

describe('useEffectiveRole', () => {
  beforeEach(() => {
    mockUseSyncContext.mockReset();
  });

  it('uses the connected player role and display name', () => {
    mockUseSyncContext.mockReturnValue({
      status: 'connected',
      role: Role.Player,
      displayName: 'Alice',
    });

    const { result } = renderHook(() => useEffectiveRole());

    expect(result.current.effectiveRole).toBe(Role.Player);
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isPlayer).toBe(true);
    expect(result.current.isGM).toBe(false);
    expect(result.current.isSpectator).toBe(false);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.displayName).toBe('Alice');
  });

  it.each([
    { status: 'disconnected', label: 'disconnected' },
    { status: 'connected', label: 'connected without an assigned role' },
  ])('falls back to GM full access when $label', ({ status }) => {
    mockUseSyncContext.mockReturnValue({
      status,
      role: null,
      displayName: null,
    });

    const { result } = renderHook(() => useEffectiveRole());

    expect(result.current.effectiveRole).toBe(Role.GM);
    expect(result.current.isOnline).toBe(false);
    expect(result.current.isGM).toBe(true);
    expect(result.current.canEdit).toBe(true);
    expect(result.current.isPlayer).toBe(false);
    expect(result.current.isSpectator).toBe(false);
    expect(result.current.displayName).toBeNull();
  });

  it('grants edit access to a connected GM', () => {
    mockUseSyncContext.mockReturnValue({
      status: 'connected',
      role: Role.GM,
      displayName: 'Morgan',
    });

    const { result } = renderHook(() => useEffectiveRole());

    expect(result.current.effectiveRole).toBe(Role.GM);
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isGM).toBe(true);
    expect(result.current.isPlayer).toBe(false);
    expect(result.current.isSpectator).toBe(false);
    expect(result.current.canEdit).toBe(true);
    expect(result.current.displayName).toBe('Morgan');
  });

  it('uses the connected spectator role without edit access', () => {
    mockUseSyncContext.mockReturnValue({
      status: 'connected',
      role: Role.Spectator,
      displayName: 'Observer',
    });

    const { result } = renderHook(() => useEffectiveRole());

    expect(result.current.effectiveRole).toBe(Role.Spectator);
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isGM).toBe(false);
    expect(result.current.isPlayer).toBe(false);
    expect(result.current.isSpectator).toBe(true);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.displayName).toBe('Observer');
  });

  it('coalesces an undefined display name to null', () => {
    mockUseSyncContext.mockReturnValue({
      status: 'connected',
      role: Role.Player,
      displayName: undefined,
    });

    const { result } = renderHook(() => useEffectiveRole());

    expect(result.current.displayName).toBeNull();
  });
});
