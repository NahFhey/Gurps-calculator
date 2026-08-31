import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR, getCurrentSeason, type CalendarConfig } from '../timeSystem';

describe('getCurrentSeason', () => {
  it('starts day 1 on Spring day 1', () => {
    expect(getCurrentSeason(1, DEFAULT_CALENDAR)).toMatchObject({ index: 0, dayOfSeason: 1 });
  });

  it('keeps the last day of Spring in Spring', () => {
    expect(getCurrentSeason(90, DEFAULT_CALENDAR)).toMatchObject({ index: 0, dayOfSeason: 90 });
  });

  it('moves to Summer on day 91', () => {
    expect(getCurrentSeason(91, DEFAULT_CALENDAR)).toMatchObject({ index: 1, dayOfSeason: 1 });
  });

  it('resolves the last day of the full cycle', () => {
    expect(getCurrentSeason(360, DEFAULT_CALENDAR)).toMatchObject({ index: 3, dayOfSeason: 90 });
  });

  it('wraps after a full cycle', () => {
    expect(getCurrentSeason(361, DEFAULT_CALENDAR)).toMatchObject({ index: 0, dayOfSeason: 1 });
  });

  it('wraps across multiple cycles', () => {
    expect(getCurrentSeason(811, DEFAULT_CALENDAR)).toMatchObject({ index: 1, dayOfSeason: 1 });
  });

  it('honors a non-zero starting season', () => {
    expect(getCurrentSeason(1, { ...DEFAULT_CALENDAR, startSeasonIndex: 2 })).toMatchObject({ index: 2, dayOfSeason: 1 });
  });

  it('wraps from a non-zero starting season', () => {
    expect(getCurrentSeason(181, { ...DEFAULT_CALENDAR, startSeasonIndex: 3 })).toMatchObject({ index: 1, dayOfSeason: 1 });
  });

  it('normalizes a negative starting season index', () => {
    expect(getCurrentSeason(1, { ...DEFAULT_CALENDAR, startSeasonIndex: -1 })).toMatchObject({ index: 3, dayOfSeason: 1 });
  });

  it('falls back for an empty calendar', () => {
    expect(getCurrentSeason(1, { seasons: [], startSeasonIndex: 0 })).toMatchObject({
      index: 0,
      dayOfSeason: 1,
      def: { name: 'Season', days: 90 },
    });
  });

  it('falls back when every season has zero days', () => {
    const calendar: CalendarConfig = {
      seasons: [{ name: 'Still', days: 0, temperatureShift: 0, precipitationMultiplier: 1 }],
      startSeasonIndex: 0,
    };
    expect(getCurrentSeason(91, calendar)).toMatchObject({ index: 0, dayOfSeason: 1, def: { name: 'Season' } });
  });

  it('skips a zero-length season when other seasons are valid', () => {
    const calendar: CalendarConfig = {
      seasons: [
        { name: 'Zero', days: 0, temperatureShift: 0, precipitationMultiplier: 1 },
        { name: 'Short', days: 2, temperatureShift: 0, precipitationMultiplier: 1 },
      ],
      startSeasonIndex: 0,
    };
    expect(getCurrentSeason(1, calendar)).toMatchObject({ index: 1, dayOfSeason: 1 });
  });

  it('treats non-positive campaign days as day 1', () => {
    expect(getCurrentSeason(0, DEFAULT_CALENDAR)).toMatchObject({ index: 0, dayOfSeason: 1 });
  });

  it('uses the configured season object in the result', () => {
    expect(getCurrentSeason(181, DEFAULT_CALENDAR).def).toBe(DEFAULT_CALENDAR.seasons[2]);
  });
});
