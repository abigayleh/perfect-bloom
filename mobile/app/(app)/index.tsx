import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import * as api from '@/api/endpoints';
import { plantName, type Plant } from '@/api/types';
import { useAuth, useAuthToken } from '@/auth/AuthContext';
import { DueText } from '@/components/DueText';
import { ErrorText } from '@/components/ErrorText';
import { useWaterPlant } from '@/hooks/useWaterPlant';
import { colors, styles } from '@/theme';

function PlantRow({
  plant,
  onPress,
  onWater,
}: {
  plant: Plant;
  onPress: () => void;
  onWater: () => void;
}) {
  return (
    <Pressable style={[styles.card, { flexDirection: 'row', gap: 12 }]} onPress={onPress}>
      {plant.image_url ? (
        <Image source={{ uri: mediaUrl(plant.image_url) }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, { backgroundColor: colors.line }]} />
      )}
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={styles.label}>{plantName(plant)}</Text>
        {plant.scientific_name ? (
          <Text style={[styles.muted, { fontStyle: 'italic' }]}>{plant.scientific_name}</Text>
        ) : null}
        <DueText plant={plant} />
      </View>
      {plant.is_due && (
        <Pressable style={styles.waterChip} onPress={onWater} hitSlop={8}>
          <Text style={styles.waterChipText}>Water</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export default function CollectionScreen() {
  const token = useAuthToken();
  const { signOut } = useAuth();
  const router = useRouter();

  const query = useQuery({ queryKey: ['plants'], queryFn: () => api.fetchPlants(token) });
  const water = useWaterPlant();

  // Due first, then by how soon. Plants with no schedule sink to the bottom.
  const plants = [...(query.data ?? [])].sort((a, b) => {
    const rank = (plant: Plant) => (plant.days_until_due ?? Number.POSITIVE_INFINITY);
    return rank(a) - rank(b);
  });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Your plants' }} />

      <FlatList
        data={plants}
        keyExtractor={(plant) => String(plant.id)}
        contentContainerStyle={styles.content}
        refreshing={query.isRefetching}
        onRefresh={query.refetch}
        renderItem={({ item }) => (
          <PlantRow
            plant={item}
            onPress={() => router.push({ pathname: '/plant/[id]', params: { id: item.id } })}
            onWater={() => water.mutate(item.id)}
          />
        )}
        ListHeaderComponent={<ErrorText message={query.error?.message ?? water.error?.message} />}
        ListEmptyComponent={
          query.isPending ? (
            <ActivityIndicator color={colors.green} />
          ) : (
            <Text style={styles.muted}>
              No plants yet. Identify one from a photo, or add it by name.
            </Text>
          )
        }
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 20 }}>
            <Link href="/identify" asChild>
              <Pressable style={styles.button}>
                <Text style={styles.buttonText}>Identify a plant</Text>
              </Pressable>
            </Link>
            <Link href="/add" asChild>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Add a plant by name</Text>
              </Pressable>
            </Link>
            <Pressable onPress={signOut}>
              <Text style={[styles.muted, { textAlign: 'center' }]}>Log out</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}
