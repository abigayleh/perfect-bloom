import { describe, expect, it } from 'vitest';

import { computeSchedule } from '@/lib/schedule';

/**
 * Ported from the API's test_schedule.py. Two of the originals compared Halifax
 * against Tokyo to prove the stored zone was honoured; on-device there is only
 * the device's own zone, so those are replaced by the TZ-pinned cases below.
 * vitest.config.ts pins America/New_York (UTC-4 in summer, UTC-5 in winter).
 */
function utc(year: number, month: number, day: number, hour = 12): string {
  return new Date(Date.UTC(year, month - 1, day, hour)).toISOString();
}

function schedule(overrides: Partial<Parameters<typeof computeSchedule>[0]> = {}) {
  return computeSchedule({
    intervalDays: 7,
    lastWateredAt: utc(2026, 7, 1),
    createdAt: utc(2026, 6, 1),
    now: new Date(utc(2026, 7, 1)),
    ...overrides,
  });
}

describe('computeSchedule', () => {
  it('sets next due to last watered plus the interval', () => {
    const result = schedule();

    expect(result.next_due_on).toBe('2026-07-08');
    expect(result.days_until_due).toBe(7);
    expect(result.is_due).toBe(false);
    expect(result.anchor).toBe('watering');
  });

  it('is due on the day itself', () => {
    const result = schedule({ now: new Date(utc(2026, 7, 8)) });

    expect(result.days_until_due).toBe(0);
    expect(result.is_due).toBe(true);
  });

  it('counts up while overdue', () => {
    const result = schedule({ now: new Date(utc(2026, 7, 11)) });

    expect(result.days_until_due).toBe(-3);
    expect(result.is_due).toBe(true);
  });

  it('shifts every later date when you water late', () => {
    // The core domain rule: the schedule re-anchors to reality, it does not catch up.
    expect(schedule().next_due_on).toBe('2026-07-08');

    const afterLate = schedule({
      lastWateredAt: utc(2026, 7, 10),
      now: new Date(utc(2026, 7, 10)),
    });

    expect(afterLate.next_due_on).toBe('2026-07-17'); // not the 15th
    expect(afterLate.is_due).toBe(false);
  });

  it('has no schedule without an interval', () => {
    const result = schedule({ intervalDays: null });

    expect(result.next_due_on).toBeNull();
    expect(result.days_until_due).toBeNull();
    expect(result.is_due).toBe(false);
  });

  it('anchors on when the plant was added if never watered', () => {
    const result = schedule({
      lastWateredAt: null,
      createdAt: utc(2026, 7, 2),
      now: new Date(utc(2026, 7, 2)),
    });

    expect(result.anchor).toBe('created');
    expect(result.next_due_on).toBe('2026-07-09');
    expect(result.last_watered_at).toBeNull();
  });

  it('treats a late-evening watering as the local day', () => {
    // 23:00 UTC is 19:00 in New York — still the 1st locally, so due the 8th.
    const result = schedule({ lastWateredAt: utc(2026, 7, 1, 23) });

    expect(result.next_due_on).toBe('2026-07-08');
  });

  it('treats after-midnight UTC as still the previous local day', () => {
    // 02:00 UTC on the 2nd is 22:00 on the 1st in New York — the 8th, not the 9th.
    const result = schedule({ lastWateredAt: utc(2026, 7, 2, 2) });

    expect(result.next_due_on).toBe('2026-07-08');
  });

  it('keeps an interval spanning a DST transition on the calendar', () => {
    // New York leaves DST on 2026-11-01. 14 days must stay 14 calendar days,
    // not 14x24 hours, or the date slips.
    const result = schedule({
      lastWateredAt: utc(2026, 10, 25, 16),
      intervalDays: 14,
      now: new Date(utc(2026, 10, 25, 16)),
    });

    expect(result.next_due_on).toBe('2026-11-08');
  });

  it('counts days correctly across a DST transition', () => {
    const result = schedule({
      lastWateredAt: utc(2026, 10, 25, 16),
      intervalDays: 14,
      now: new Date(utc(2026, 11, 8, 17)), // noon local on the due date
    });

    expect(result.days_until_due).toBe(0);
    expect(result.is_due).toBe(true);
  });

  it.each([1, 3, 30, 365])('handles an interval of %i days', (interval) => {
    const result = schedule({
      lastWateredAt: utc(2026, 1, 1),
      intervalDays: interval,
      now: new Date(utc(2026, 1, 1)),
    });

    expect(result.days_until_due).toBe(interval);
  });
});
