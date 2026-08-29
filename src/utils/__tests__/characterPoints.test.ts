import { describe, expect, it } from 'vitest';
import { createDefaultGCSData } from '../../types/characterSheet';
import {
  ATTRIBUTE_COSTS,
  SECONDARY_COSTS,
  POOL_COSTS,
  calculateTotalPoints,
} from '../characterPoints';

describe('character point rules', () => {
  it('exports the sheet cost constants', () => {
    expect(ATTRIBUTE_COSTS).toEqual({ ST: 10, DX: 20, IQ: 20, HT: 10 });
    expect(SECONDARY_COSTS).toEqual({
      will: 5, frightCheck: 2, per: 5, vision: 2, hearing: 2,
      tasteSmell: 2, touch: 2, basicSpeed: 5, basicMove: 5,
    });
    expect(POOL_COSTS).toEqual({ HP: 2, FP: 3 });
  });

  it('includes every secondary characteristic, including senses and Fright Check', () => {
    const data = createDefaultGCSData();
    data.secondaryAttributes.will.points = 5;
    data.secondaryAttributes.per.points = 10;
    data.secondaryAttributes.basicSpeed.points = 5;
    data.secondaryAttributes.basicMove.points = 5;
    data.secondaryAttributes.frightCheck.points = 2;
    data.secondaryAttributes.vision.points = 2;
    data.secondaryAttributes.hearing.points = 4;
    data.secondaryAttributes.tasteSmell.points = 6;
    data.secondaryAttributes.touch.points = 8;

    expect(calculateTotalPoints(data)).toBe(47);
  });
});
