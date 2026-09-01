import { describe, expect, it } from 'vitest';
import { createDefaultGCSData } from '../../types/characterSheet';
import type { Character } from '../../types/campaign';
import { getNavigationSkill } from '../navigation';

const character = (skills: Record<string, number> = {}): Character => ({
  id: 'c', name: 'Navigator', work: { skills },
});

describe('getNavigationSkill', () => {
  it('uses Navigation (Land) for foot travel', () => {
    expect(getNavigationSkill(character({ 'Navigation (Land)': 14, Navigation: 11 }), 'foot'))
      .toEqual({ level: 14, isDefault: false });
  });

  it('uses Navigation (Sea) for boat travel', () => {
    expect(getNavigationSkill(character({ 'Navigation (Sea)': 13 }), 'boat'))
      .toEqual({ level: 13, isDefault: false });
  });

  it('uses Navigation (Air) for airships', () => {
    expect(getNavigationSkill(character({ 'navigation (air)': 16 }), 'airship'))
      .toEqual({ level: 16, isDefault: false });
  });

  it('falls back to plain Navigation', () => {
    expect(getNavigationSkill(character({ Navigation: 12 }), 'boat'))
      .toEqual({ level: 12, isDefault: false });
  });

  it('defaults to IQ minus six when untrained', () => {
    const c = character();
    c.gcsData = createDefaultGCSData();
    c.gcsData.attributes.IQ = 13;
    expect(getNavigationSkill(c, 'foot')).toEqual({ level: 7, isDefault: true });
  });
});
