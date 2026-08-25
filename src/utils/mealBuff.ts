import type { MealBuff } from '../types/campaign';

export function isMealBuffActive(buff: MealBuff | null, currentDay: number): boolean {
  return buff !== null && buff.day === currentDay;
}
