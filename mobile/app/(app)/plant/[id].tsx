import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';

import * as api from '@/api/endpoints';
import { plantName } from '@/api/types';
import { useAuthToken } from '@/auth/AuthContext';
import { getPlant, softDeletePlant } from '@/db/plants';
import { DueText } from '@/components/DueText';
import { ErrorText } from '@/components/ErrorText';
import { Toxicity } from '@/components/Toxicity';
import { WateredBurst } from '@/components/WateredBurst';
import { useWaterPlant } from '@/hooks/useWaterPlant';
import { colors, styles } from '@/theme';

export default function PlantDetailScreen() {
  const token = useAuthToken();
  const db = useSQLiteContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plantId = Number(id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const water = useWaterPlant();

  const plantQuery = useQuery({
    queryKey: ['plants', plantId],
    queryFn: () => getPlant(db, plantId),
    enabled: Number.isFinite(plantId),
  });

  const plant = plantQuery.data;

  // Care is looked up by name, not stored on the plant, so there is one source
  // of truth per species and it stays cached server-side.
  const careQuery = useQuery({
    queryKey: ['care', plant?.scientific_name],
    queryFn: () => api.fetchCare(token, plant!.scientific_name),
    enabled: Boolean(plant?.scientific_name),
  });

  const remove = useMutation({
    mutationFn: () => softDeletePlant(db, plantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
      router.back();
    },
  });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: plant ? plantName(plant) : 'Plant' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {plantQuery.isPending && <ActivityIndicator color={colors.green} />}
        <ErrorText
          message={plantQuery.error?.message ?? water.error?.message ?? remove.error?.message}
        />

        {plant && (
          <>
            {plant.image_uri && (
              <Image source={{ uri: plant.image_uri }} style={styles.photo} />
            )}

            <View style={styles.card}>
              <Text style={styles.label}>{plantName(plant)}</Text>
              {plant.scientific_name ? (
                <Text style={styles.scientific}>{plant.scientific_name}</Text>
              ) : (
                <Text style={styles.muted}>No species recorded.</Text>
              )}
              <Text style={styles.muted}>
                {plant.interval_days
                  ? `Water every ${plant.interval_days} days`
                  : 'No watering schedule set yet'}
              </Text>
              <DueText plant={plant} />
              <Text style={styles.muted}>
                {plant.last_watered_at
                  ? `Last watered ${new Date(plant.last_watered_at).toLocaleDateString()}`
                  : 'No watering logged yet'}
              </Text>
            </View>

            <Pressable
              style={[styles.button, water.isPending && styles.buttonDisabled]}
              disabled={water.isPending}
              onPress={() =>
                water.mutate(plantId, { onSuccess: () => setCelebrating(true) })
              }
            >
              <Text style={styles.buttonText}>
                {water.isPending ? 'Logging…' : 'Water now'}
              </Text>
            </Pressable>

            {careQuery.data && careQuery.data.match_kind !== 'none' && (
              <Toxicity care={careQuery.data} />
            )}

            <Pressable
              style={styles.secondaryButton}
              onPress={() => (confirmingDelete ? remove.mutate() : setConfirmingDelete(true))}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.error }]}>
                {confirmingDelete ? 'Tap again to remove' : 'Remove this plant'}
              </Text>
            </Pressable>
            {confirmingDelete && (
              <Text style={styles.muted}>
                Its watering history is kept even after the plant is removed.
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {celebrating && <WateredBurst onDone={() => setCelebrating(false)} />}
    </View>
  );
}
