import { localDateKey } from '@/lib/dates';

export type Anchor = 'watering' | 'created';

/**
 * A plant's watering state, always computed — never stored.
 *
 * Field names match the Plant view model so a row plus its schedule spread
 * together. Nothing here is persisted: writing a future due date is what makes
 * schedules drift out of sync with reality when a user waters late.
 *
 * The server needed a stored IANA zone to do this. On-device there is only one
 * zone that matters, so "local" is free and travel needs no code at all.
 */
export type Schedule = {
  interval_days: number | null;
  last_watered_at: string | null;
  anchor: Anchor;
  next_due_on: string | null;
  days_until_due: number | null;
  is_due: boolean;
};

/** Calendar days, not 24-hour blocks — so an interval spanning DST stays put. */
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Whole calendar days between two instants. Rounded because a DST transition
 * inside the range makes the span 23 or 25 hours, which would otherwise floor
 * to the wrong day.
 */
function daysBetween(from: Date, to: Date): number {
  const span = localMidnight(to).getTime() - localMidnight(from).getTime();
  return Math.round(span / 86_400_000);
}

type Input = {
  intervalDays: number | null;
  /** ISO 8601, UTC. Null when nothing has been logged yet. */
  lastWateredAt: string | null;
  createdAt: string;
  now?: Date;
};

/**
 * Next due = last watered + interval, on the local calendar.
 *
 * Local dates, not instants: a reminder fires at noon, so a plant watered at
 * 11pm must be due on the calendar day the reminder lands. Water two days late
 * and every subsequent date shifts with you — intended, not drift.
 *
 * With no watering logged, the anchor is when the plant joined the collection.
 * That is a real timestamp, not an invented schedule.
 */
export function computeSchedule({
  intervalDays,
  lastWateredAt,
  createdAt,
  now = new Date(),
}: Input): Schedule {
  const anchor: Anchor = lastWateredAt ? 'watering' : 'created';

  if (intervalDays === null) {
    return {
      interval_days: null,
      last_watered_at: lastWateredAt,
      anchor,
      next_due_on: null,
      days_until_due: null,
      is_due: false,
    };
  }

  const due = addDays(new Date(lastWateredAt ?? createdAt), intervalDays);
  const daysUntilDue = daysBetween(now, due);

  return {
    interval_days: intervalDays,
    last_watered_at: lastWateredAt,
    anchor,
    next_due_on: localDateKey(due),
    days_until_due: daysUntilDue,
    is_due: daysUntilDue <= 0,
  };
}
