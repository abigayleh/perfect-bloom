import { describe, expect, it } from 'vitest';

import type { Plant } from '@/api/types';
import { buildPlan, digestBody, digestTitle } from '@/notifications/plan';

function plant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 1,
    nickname: 'Monty',
    scientific_name: 'Monstera deliciosa',
    common_name: null,
    image_url: null,
    interval_days: 7,
    created_at: '2026-07-01T00:00:00Z',
    last_watered_at: '2026-07-01T00:00:00Z',
    next_due_on: '2026-07-08',
    days_until_due: 7,
    is_due: false,
    anchor: 'watering',
    ...overrides,
  };
}

/** 9am on 1 July, device-local. */
const morning = new Date(2026, 6, 1, 9, 0, 0);

describe('buildPlan', () => {
  it('schedules nothing when no plant has a due date', () => {
    const plants = [plant({ next_due_on: null, interval_days: null, days_until_due: null })];

    expect(buildPlan(plants, morning)).toEqual([]);
  });

  it('schedules one digest on the due date', () => {
    const plan = buildPlan([plant({ next_due_on: '2026-07-08' })], morning);

    expect(plan).toHaveLength(8); // the 8th through the 15th, the horizon edge
    expect(plan[0].at).toEqual(new Date(2026, 6, 8, 12, 0, 0));
    expect(plan[0].names).toEqual(['Monty']);
  });

  it('keeps nudging daily while a plant stays overdue', () => {
    const plan = buildPlan([plant({ next_due_on: '2026-07-02' })], morning);

    // The 2nd through the 15th: every day it remains unwatered.
    expect(plan).toHaveLength(14);
    expect(plan.every((reminder) => reminder.names.length === 1)).toBe(true);
  });

  it('includes today when noon has not passed yet', () => {
    const plan = buildPlan([plant({ next_due_on: '2026-07-01' })], morning);

    expect(plan[0].at).toEqual(new Date(2026, 6, 1, 12, 0, 0));
  });

  it('skips today once noon has passed', () => {
    const afternoon = new Date(2026, 6, 1, 15, 0, 0);

    const plan = buildPlan([plant({ next_due_on: '2026-07-01' })], afternoon);

    expect(plan[0].at).toEqual(new Date(2026, 6, 2, 12, 0, 0));
  });

  it('rolls several plants into one digest per day', () => {
    const plan = buildPlan(
      [
        plant({ id: 1, nickname: 'Monty', next_due_on: '2026-07-03' }),
        plant({ id: 2, nickname: 'Fern', next_due_on: '2026-07-03' }),
        plant({ id: 3, nickname: 'Basil', next_due_on: '2026-07-05' }),
      ],
      morning,
    );

    const third = plan.find((r) => r.at.getDate() === 3);
    const fifth = plan.find((r) => r.at.getDate() === 5);
    expect(third?.names).toEqual(['Monty', 'Fern']);
    expect(fifth?.names).toEqual(['Monty', 'Fern', 'Basil']);
  });

  it('ignores plants with no schedule while still scheduling the rest', () => {
    const plan = buildPlan(
      [
        plant({ id: 1, nickname: 'Monty', next_due_on: '2026-07-03' }),
        plant({ id: 2, nickname: 'Unscheduled', next_due_on: null, interval_days: null }),
      ],
      morning,
    );

    expect(plan[0].names).toEqual(['Monty']);
  });

  it('stops at the horizon so the pending-notification cap is not blown', () => {
    const plan = buildPlan([plant({ next_due_on: '2026-07-02' })], morning, 5);

    expect(plan).toHaveLength(5);
  });

  it('schedules nothing for a plant due beyond the horizon', () => {
    const plan = buildPlan([plant({ next_due_on: '2026-09-01' })], morning);

    expect(plan).toEqual([]);
  });
});

describe('digest copy', () => {
  it('pluralises', () => {
    expect(digestTitle(['Monty'])).toBe('1 plant needs water');
    expect(digestTitle(['Monty', 'Fern'])).toBe('2 plants need water');
  });

  it('truncates a long list', () => {
    expect(digestBody(['a', 'b', 'c'])).toBe('a, b, c');
    expect(digestBody(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('a, b, c, d and 2 more');
  });
});
