import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import * as api from '@/api/endpoints';
import { useAuthToken } from '@/auth/AuthContext';
import { ErrorText } from '@/components/ErrorText';
import { styles } from '@/theme';

/**
 * One screen for both entry points: a blank form for a plant you already know,
 * or prefilled from an identification. Manual entry is a first-class path, not
 * a fallback, so nothing here depends on having identified anything.
 */
export default function AddPlantScreen() {
  const token = useAuthToken();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    name?: string;
    common_name?: string;
    image_key?: string;
  }>();

  const [scientificName, setScientificName] = useState(params.name ?? '');
  const [nickname, setNickname] = useState('');
  const [interval, setInterval] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.createPlant(token, {
        scientific_name: scientificName.trim(),
        nickname: nickname.trim() || null,
        common_name: params.common_name ?? null,
        image_key: params.image_key ?? null,
        interval_days: interval.trim() ? Number(interval.trim()) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
      router.dismissAll();
    },
  });

  const intervalIsValid =
    !interval.trim() || (/^\d+$/.test(interval.trim()) && Number(interval.trim()) >= 1);
  const canSubmit =
    (scientificName.trim() || nickname.trim()) && intervalIsValid && !mutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Add a plant' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorText message={mutation.error?.message} />

        <View>
          <Text style={styles.label}>Species name</Text>
          <TextInput
            style={styles.input}
            value={scientificName}
            onChangeText={setScientificName}
            autoCapitalize="words"
            placeholder="Monstera deliciosa"
          />
          <Text style={styles.muted}>Leave blank if you don&apos;t know it.</Text>
        </View>

        <View>
          <Text style={styles.label}>Nickname</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Big Monty"
          />
        </View>

        <View>
          <Text style={styles.label}>Water every</Text>
          <TextInput
            style={styles.input}
            value={interval}
            onChangeText={setInterval}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="days"
          />
          <Text style={styles.muted}>
            Optional — you can set this later once you know its habits.
          </Text>
          {!intervalIsValid && <Text style={styles.muted}>Enter a whole number of days.</Text>}
        </View>

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          disabled={!canSubmit}
          onPress={() => mutation.mutate()}
        >
          <Text style={styles.buttonText}>
            {mutation.isPending ? 'Saving…' : 'Add to my plants'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
