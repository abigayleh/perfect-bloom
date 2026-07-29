import { describe, expect, it } from 'vitest';

import { localDateKey } from '@/lib/dates';

describe('localDateKey', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 9pm in a negative-offset zone is already tomorrow in UTC. The second
    // assertion is the bug this guards: it fails if the TZ pin ever stops
    // working, rather than letting the first assertion go quietly tautological.
    const evening = new Date(2026, 6, 29, 21, 0, 0);

    expect(localDateKey(evening)).toBe('2026-07-29');
    expect(evening.toISOString().slice(0, 10)).toBe('2026-07-30');
  });

  it('pads single-digit months and days', () => {
    expect(localDateKey(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });
});
