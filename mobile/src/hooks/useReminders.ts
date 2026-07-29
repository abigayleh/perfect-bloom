import { useCallback, useEffect, useState } from 'react';

import type { Plant } from '@/api/types';
import { hasPermission, requestPermission, syncReminders } from '@/notifications';

/**
 * Keeps scheduled reminders in step with the collection.
 *
 * Re-syncs whenever the plants data changes, which covers watering, adding,
 * removing, and changing an interval without each screen having to remember to.
 */
export function useReminders(plants: Plant[] | undefined) {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    hasPermission().then(setGranted);
  }, []);

  useEffect(() => {
    if (!granted || !plants) return;
    syncReminders(plants);
  }, [granted, plants]);

  const enable = useCallback(async () => {
    const ok = await requestPermission();
    setGranted(ok);
    if (ok && plants) await syncReminders(plants);
    return ok;
  }, [plants]);

  return { granted, enable };
}
