import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import * as api from '@/api/endpoints';
import { useAuthToken } from '@/auth/AuthContext';
import { ErrorText } from '@/components/ErrorText';
import { Toxicity } from '@/components/Toxicity';
import { colors, styles } from '@/theme';

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>
  );
}

export default function CareScreen() {
  const token = useAuthToken();
  const router = useRouter();
  const { name, image_uri: imageUri } = useLocalSearchParams<{
    name: string;
    image_uri?: string;
  }>();

  const query = useQuery({
    queryKey: ['care', name],
    queryFn: () => api.fetchCare(token, name),
    enabled: Boolean(name),
  });

  const care = query.data;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Care' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.scientific}>{name}</Text>

        {query.isPending && (
          <View style={{ paddingVertical: 24, gap: 8, alignItems: 'center' }}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.muted}>Looking up care…</Text>
          </View>
        )}

        <ErrorText message={query.error?.message} />

        {care && care.match_kind === 'none' && (
          <View style={{ gap: 8 }}>
            <Text style={styles.body}>No published care data for this plant.</Text>
            <Text style={styles.muted}>
              You can still add it and set your own watering interval.
            </Text>
          </View>
        )}

        {care && (
          <Pressable
            style={styles.button}
            onPress={() =>
              router.push({
                pathname: '/add',
                params: {
                  name,
                  common_name: care.common_name ?? '',
                  ...(imageUri ? { image_uri: imageUri } : {}),
                },
              })
            }
          >
            <Text style={styles.buttonText}>Add to my plants</Text>
          </Pressable>
        )}

        {care && care.match_kind !== 'none' && (
          <View style={{ gap: 12 }}>
            {care.match_kind === 'genus' && (
              <Text style={styles.muted}>
                Showing care for the genus {care.matched_name}, not this exact species. Good
                enough for most houseplants, but treat it as general guidance.
              </Text>
            )}

            <View style={styles.card}>
              <Text style={styles.label}>{care.common_name ?? care.matched_name}</Text>
              <Fact label="Water" value={care.watering} />
              <Fact label="Light" value={care.sunlight.join(', ') || null} />
              <Fact label="Cycle" value={care.cycle} />
            </View>

            <Toxicity care={care} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
