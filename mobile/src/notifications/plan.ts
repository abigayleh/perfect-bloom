import { plantName, type Plant } from '@/api/types';
import { localDateKey } from '@/lib/dates';

/** How far ahead to schedule. iOS caps pending notifications at 64. */
export const HORIZON_DAYS = 14;
export const REMINDER_HOUR = 12;

export type Reminder = {
  at: Date;
  names: string[];
};

function noonOn(year: number, month: number, day: number): Date {
  return new Date(year, month, day, REMINDER_HOUR, 0, 0, 0);
}

/**
 * One digest per day, for every day something is due or still overdue.
 *
 * Compares against the server's `next_due_on` strings directly rather than
 * redoing the date maths — the server already resolved the user's timezone, and
 * ISO dates sort lexicographically. A local notification can't run code when it
 * fires, so days are scheduled ahead assuming nothing gets watered; every
 * watering re-syncs and replaces them.
 */
export function buildPlan(plants: Plant[], now: Date, horizonDays = HORIZON_DAYS): Reminder[] {
  const scheduled = plants.filter((plant) => plant.next_due_on !== null);
  if (scheduled.length === 0) return [];

  const reminders: Reminder[] = [];

  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const at = noonOn(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (at <= now) continue; // today's noon has already passed

    const key = localDateKey(at);
    const due = scheduled.filter((plant) => plant.next_due_on! <= key);
    if (due.length > 0) {
      reminders.push({ at, names: due.map(plantName) });
    }
  }

  return reminders;
}

export function digestTitle(names: string[]): string {
  return names.length === 1 ? '1 plant needs water' : `${names.length} plants need water`;
}

export function digestBody(names: string[], limit = 4): string {
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} and ${names.length - limit} more`;
}
