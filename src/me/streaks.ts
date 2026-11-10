import { addDays, localDateOf } from '../home/home-week.js';
import type { LocalDate } from '../types/home.contract.js';

export type ActivityDays = { activeDays: number; currentStreakDays: number; longestStreakDays: number };

/**
 * Active days and streaks from activity instants, in `timeZone`.
 * The current streak still counts when today has no activity yet (it ends yesterday).
 */
export function activityDays(now: Date, timeZone: string, activity: Date[]): ActivityDays {
  const toLocal = localDateOf(timeZone);
  const dates = [...new Set(activity.map(toLocal))].sort();
  if (dates.length === 0) return { activeDays: 0, currentStreakDays: 0, longestStreakDays: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    run = dates[i] === addDays(dates[i - 1], 1) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const days = new Set<LocalDate>(dates);
  const today = toLocal(now);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { activeDays: dates.length, currentStreakDays: current, longestStreakDays: longest };
}
