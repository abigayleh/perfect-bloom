import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as api from '@/api/endpoints';
import type { Plant } from '@/api/types';
import { useAuthToken } from '@/auth/AuthContext';
import { localDateKey } from '@/lib/dates';

/**
 * Predict the server's re-anchored schedule so the tap feels instant.
 *
 * This mirrors compute_schedule on the server, which is duplication we accept
 * only because it is discarded: onSettled invalidates and the server's answer
 * always wins. Never persist anything derived here.
 */
function optimisticallyWatered(plant: Plant): Plant {
  const now = new Date();
  if (plant.interval_days === null) {
    return { ...plant, last_watered_at: now.toISOString(), anchor: 'watering' };
  }
  const due = new Date(now);
  due.setDate(due.getDate() + plant.interval_days);
  return {
    ...plant,
    last_watered_at: now.toISOString(),
    anchor: 'watering',
    next_due_on: localDateKey(due),
    days_until_due: plant.interval_days,
    is_due: false,
  };
}

type Context = {
  previousList?: Plant[];
  previousPlant?: Plant;
  plantId: number;
};

/**
 * Optimism and its rollback live here rather than in the screens, so both the
 * collection and the detail view get identical behaviour and there is exactly
 * one place that can leave state applied-but-unconfirmed.
 */
export function useWaterPlant() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  return useMutation<Plant, Error, number, Context>({
    mutationFn: (plantId) => api.waterPlant(token, plantId),

    onMutate: async (plantId) => {
      await queryClient.cancelQueries({ queryKey: ['plants'] });

      const previousList = queryClient.getQueryData<Plant[]>(['plants']);
      const previousPlant = queryClient.getQueryData<Plant>(['plants', plantId]);

      queryClient.setQueryData<Plant[]>(['plants'], (plants) =>
        plants?.map((plant) => (plant.id === plantId ? optimisticallyWatered(plant) : plant)),
      );
      queryClient.setQueryData<Plant>(['plants', plantId], (plant) =>
        plant ? optimisticallyWatered(plant) : plant,
      );

      return { previousList, previousPlant, plantId };
    },

    onError: (_error, _plantId, context) => {
      if (!context) return;
      queryClient.setQueryData(['plants'], context.previousList);
      queryClient.setQueryData(['plants', context.plantId], context.previousPlant);
    },

    onSettled: (_data, _error, plantId) => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
      queryClient.invalidateQueries({ queryKey: ['plants', plantId] });
    },
  });
}
