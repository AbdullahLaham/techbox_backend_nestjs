import type { HomeActivityDay, HomeWeeklyActivity, LocalDate, Weekday } from '../types/home.contract.js';

/** Saturday first, as the app's weekly strip. */
export const WEEK_ORDER: readonly Weekday[] = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];

const SHORT_WEEKDAY: Record<string, Weekday> = {
  Sat: 'SAT',
  Sun: 'SUN',
  Mon: 'MON',
  Tue: 'TUE',
  Wed: 'WED',
  Thu: 'THU',
  Fri: 'FRI',
};

/** Widest UTC offset in use (UTC+14), so a UTC window always covers the local week. */
const MAX_OFFSET_MS = 14 * 60 * 60 * 1000;

function formatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

function localParts(fmt: Intl.DateTimeFormat, at: Date): { date: LocalDate; weekday: Weekday } {
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: SHORT_WEEKDAY[parts.weekday] };
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Saturday of the week that contains `now` in `timeZone`. */
export function weekStartOf(now: Date, timeZone: string): LocalDate {
  const today = localParts(formatter(timeZone), now);
  return addDays(today.date, -WEEK_ORDER.indexOf(today.weekday));
}

/** Earliest instant that can fall in the current local week (a little early is fine: days are bucketed later). */
export function activityWindowStart(now: Date, timeZone: string): Date {
  return new Date(Date.parse(`${weekStartOf(now, timeZone)}T00:00:00Z`) - MAX_OFFSET_MS);
}

/** The Saturday-to-Friday strip of the current week, from the student's activity timestamps. */
export function buildWeeklyActivity(now: Date, timeZone: string, activity: Date[]): HomeWeeklyActivity {
  const fmt = formatter(timeZone);
  const today = localParts(fmt, now).date;
  const weekStart = weekStartOf(now, timeZone);
  const activeDates = new Set(activity.map((at) => localParts(fmt, at).date));

  const days: HomeActivityDay[] = WEEK_ORDER.map((weekday, i) => {
    const date = addDays(weekStart, i);
    const isFuture = date > today;
    return { date, weekday, isActive: !isFuture && activeDates.has(date), isToday: date === today, isFuture };
  });

  return {
    timeZone,
    weekStart,
    weekEnd: days[6].date,
    days,
    activeDaysCount: days.filter((d) => d.isActive).length,
  };
}
