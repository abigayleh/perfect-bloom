import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorText } from '@/components/ErrorText';
import { createPlant, MAX_INTERVAL_DAYS } from '@/db/plants';
import { persistPhoto } from '@/lib/photos';
import { colors, fonts, styles as t } from '@/theme';

/**
 * One screen for both entry points: a blank form for a plant you already know, or
 * prefilled from an identification. Manual entry is a first-class path, not a
 * fallback, so nothing here depends on having identified anything.
 */
export default function AddPlantScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    name?: string;
    common_name?: string;
    image_uri?: string;
  }>();

  const identified = Boolean(params.name);
  const [scientificName, setScientificName] = useState(params.name ?? '');
  const [nickname, setNickname] = useState('');
  const [interval, setIntervalDays] = useState<number | null>(identified ? 7 : null);

  const mutation = useMutation({
    mutationFn: async () => {
      // Copied out of the picker's cache only now, so abandoning the flow leaves
      // nothing behind.
      const imageUri = params.image_uri ? await persistPhoto(params.image_uri) : null;
      return createPlant(db, {
        scientific_name: scientificName.trim(),
        nickname: nickname.trim() || null,
        common_name: params.common_name || null,
        image_uri: imageUri,
        interval_days: interval,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
      router.dismissAll();
    },
  });

  const canSubmit =
    Boolean(scientificName.trim() || nickname.trim()) && !mutation.isPending;
  const step = (by: number) => {
    const next = (interval ?? 7) + by;
    if (next >= 1 && next <= MAX_INTERVAL_DAYS) setIntervalDays(next);
  };

  return (
    <KeyboardAvoidingView
      style={t.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 26,
          paddingBottom: 44,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={s.back}>← Back</Text>
        </Pressable>

        <Text style={[t.title, s.title]}>Name your new friend</Text>

        {identified && (
          <View style={s.identified}>
            {params.image_uri ? (
              <Image source={{ uri: params.image_uri }} style={s.identifiedThumb} />
            ) : (
              <View style={[s.identifiedThumb, s.identifiedEmpty]} />
            )}
            <View style={s.identifiedText}>
              <Text style={s.identifiedLatin} numberOfLines={2}>
                {params.name}
              </Text>
              <Text style={[t.meta, s.identifiedMeta]}>Identified</Text>
            </View>
          </View>
        )}

        <ErrorText message={mutation.error?.message} />

        <View style={s.fields}>
          {!identified && (
            <View>
              <Text style={[t.eyebrow, s.fieldLabel]}>Species name</Text>
              <TextInput
                style={t.input}
                value={scientificName}
                onChangeText={setScientificName}
                autoCapitalize="words"
                placeholder="Monstera deliciosa"
                placeholderTextColor={colors.mutedLight}
              />
              <Text style={[t.meta, s.hint]}>Leave blank if you don&apos;t know it.</Text>
            </View>
          )}

          <View>
            <Text style={[t.eyebrow, s.fieldLabel]}>Nickname</Text>
            <TextInput
              style={t.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="Big Fella"
              placeholderTextColor={colors.mutedLight}
            />
          </View>

          <View>
            <View style={s.stepperHead}>
              <Text style={t.eyebrow}>Water every</Text>
              {interval === null && (
                <Text style={[t.meta, s.optional]}>optional</Text>
              )}
            </View>
            <View style={s.stepper}>
              <Pressable
                style={s.stepButton}
                onPress={() => step(-1)}
                accessibilityLabel="Fewer days"
              >
                <Text style={s.stepMark}>−</Text>
              </Pressable>
              <Pressable style={s.stepValue} onPress={() => setIntervalDays(interval ? null : 7)}>
                {interval === null ? (
                  <Text style={s.stepNone}>No schedule</Text>
                ) : (
                  <Text style={s.stepNumber}>
                    {interval}
                    <Text style={s.stepUnit}> days</Text>
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={s.stepButton}
                onPress={() => (interval === null ? setIntervalDays(7) : step(1))}
                accessibilityLabel="More days"
              >
                <Text style={s.stepMark}>+</Text>
              </Pressable>
            </View>
            <Text style={[t.bodyMuted, s.hint]}>
              Next watering is always counted from the last time you actually watered —
              never from a calendar. Tap the number to clear it.
            </Text>
          </View>

          <Pressable
            style={[t.button, !canSubmit && t.buttonDisabled]}
            disabled={!canSubmit}
            onPress={() => mutation.mutate()}
          >
            <Text style={t.buttonText}>
              {mutation.isPending
                ? 'Saving…'
                : nickname.trim()
                  ? `Add ${nickname.trim()}`
                  : 'Add to my collection'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  back: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  title: { marginTop: 16 },
  identified: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginTop: 22,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  identifiedThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#DBE1CB' },
  identifiedEmpty: { backgroundColor: '#CADDCD' },
  identifiedText: { flex: 1, minWidth: 0 },
  identifiedLatin: { fontFamily: fonts.serifItalic, fontSize: 17, color: colors.ink },
  identifiedMeta: { marginTop: 3, letterSpacing: 0.8, textTransform: 'uppercase' },
  fields: { marginTop: 24, gap: 20 },
  fieldLabel: { marginBottom: 9 },
  hint: { marginTop: 8, lineHeight: 17 },
  optional: { letterSpacing: 0.6 },

  stepperHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 9,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  stepButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepMark: { fontFamily: fonts.sans, fontSize: 19, color: colors.inkSoft },
  stepValue: { flex: 1, alignItems: 'center' },
  stepNumber: { fontFamily: fonts.serif, fontSize: 30, color: colors.ink },
  stepUnit: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedDeep },
  stepNone: { fontFamily: fonts.sans, fontSize: 15, color: colors.mutedDeep },
});
