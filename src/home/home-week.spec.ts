import { activityWindowStart, buildWeeklyActivity, weekStartOf } from './home-week.js';
import { isTimeZone } from './home.dto.js';

describe('home weekly activity', () => {
  // Saturday 2026-11-07, 10:00 in Gaza (UTC+2 in November).
  const saturday = new Date('2026-11-07T08:00:00Z');

  it('builds Saturday-to-Friday, marks today and the future', () => {
    const week = buildWeeklyActivity(saturday, 'Asia/Gaza', []);
    expect(week.weekStart).toBe('2026-11-07');
    expect(week.weekEnd).toBe('2026-11-13');
    expect(week.days.map((d) => d.weekday)).toEqual(['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI']);
    expect(week.days[0]).toMatchObject({ isToday: true, isFuture: false });
    expect(week.days.slice(1).every((d) => d.isFuture && !d.isToday)).toBe(true);
    expect(week.activeDaysCount).toBe(0);
  });

  it('buckets activity by the local day, not the UTC day', () => {
    // Thursday 2026-11-12 23:30 UTC is already Friday 01:30 in Gaza.
    const friday = new Date('2026-11-13T12:00:00Z');
    const week = buildWeeklyActivity(friday, 'Asia/Gaza', [
      new Date('2026-11-12T23:30:00Z'),
      new Date('2026-11-09T10:00:00Z'),
      new Date('2026-11-09T11:00:00Z'), // same day twice
      new Date('2026-11-06T21:00:00Z'), // Friday 23:00 local: previous week
    ]);
    expect(week.weekStart).toBe('2026-11-07');
    expect(week.days.filter((d) => d.isActive).map((d) => d.weekday)).toEqual(['MON', 'FRI']);
    expect(week.activeDaysCount).toBe(2);
    expect(buildWeeklyActivity(friday, 'UTC', [new Date('2026-11-12T23:30:00Z')]).days[5]).toMatchObject({
      weekday: 'THU',
      isActive: true,
    });
  });

  it('starts the week on the previous Saturday and opens the query window early enough', () => {
    const wednesday = new Date('2026-11-11T09:00:00Z');
    expect(weekStartOf(wednesday, 'Asia/Gaza')).toBe('2026-11-07');
    // Local Saturday 00:00 in the widest timezone (UTC+14) is Friday 10:00 UTC.
    expect(activityWindowStart(wednesday, 'Asia/Gaza').toISOString()).toBe('2026-11-06T10:00:00.000Z');
  });

  it('accepts IANA names only', () => {
    expect(isTimeZone('Asia/Gaza')).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('Mars/Olympus')).toBe(false);
    expect(isTimeZone('')).toBe(false);
  });
});
