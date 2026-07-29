import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import * as api from '@/api/endpoints';
import { plantName, type Plant } from '@/api/types';
import { useAuth, useAuthToken } from '@/auth/AuthContext';
import { ErrorText } from '@/components/ErrorText';
import { colors, styles } from '@/theme';

function PlantRow({ plant, onPress }: { plant: Plant; onPress: () => void }) {
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
        <Text style={styles.muted}>
          {plant.interval_days ? `Every ${plant.interval_days} days` : 'No schedule yet'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function CollectionScreen() {
  const token = useAuthToken();
  const { signOut } = useAuth();
  const router = useRouter();

  const query = useQuery({ queryKey: ['plants'], queryFn: () => api.fetchPlants(token) });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Your plants' }} />

      <FlatList
        data={query.data ?? []}
        keyExtractor={(plant) => String(plant.id)}
        contentContainerStyle={styles.content}
        refreshing={query.isRefetching}
        onRefresh={query.refetch}
        renderItem={({ item }) => (
          <PlantRow
            plant={item}
            onPress={() => router.push({ pathname: '/plant/[id]', params: { id: item.id } })}
          />
        )}
        ListHeaderComponent={<ErrorText message={query.error?.message} />}
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
