import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSQLiteContext } from 'expo-sqlite';

import { logWatering } from '@/db/waterings';

/**
 * Log a watering and let the reads re-derive everything.
 *
 * Pessimistic on purpose. This used to predict the server's re-anchored schedule
 * so the tap felt instant, which meant a second copy of the schedule maths in the
 * client — and that copy is where the UTC-vs-local bug lived. A local insert takes
 * milliseconds, so the prediction and the rollback path it required are both gone,
 * leaving `computeSchedule` with exactly one implementation.
 */
export function useWaterPlant() {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plantId: number) => logWatering(db, plantId),
    onSuccess: (_result, plantId) => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
      queryClient.invalidateQueries({ queryKey: ['plants', plantId] });
    },
  });
}
