import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as api from '@/api/endpoints';
import { dueLabel, plantName, type Plant } from '@/api/types';
import { ErrorText } from '@/components/ErrorText';
import { Toxicity } from '@/components/Toxicity';
import { WateredBurst } from '@/components/WateredBurst';
import { getPlant, softDeletePlant } from '@/db/plants';
import { wateringHistory } from '@/db/waterings';
import { useWaterPlant } from '@/hooks/useWaterPlant';
import { colors, fonts, styles as t } from '@/theme';

/** How full the interval is, 0–1. Drives the ring on the schedule card. */
function progress(plant: Plant): number {
  if (plant.interval_days === null || plant.days_until_due === null) return 0;
  const elapsed = plant.interval_days - plant.days_until_due;
  return Math.max(0, Math.min(1, elapsed / plant.interval_days));
}

function relative(iso: string, now: Date): string {
  const days = Math.round((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export default function PlantDetailScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const logQuery = useQuery({
    queryKey: ['waterings', plantId],
    queryFn: () => wateringHistory(db, plantId),
    enabled: Number.isFinite(plantId),
  });

  // Care is looked up by name, not stored on the plant, so there is one source of
  // truth per species and it stays cached server-side.
  const careQuery = useQuery({
    queryKey: ['care', plant?.scientific_name],
    queryFn: () => api.fetchCare(plant!.scientific_name),
    enabled: Boolean(plant?.scientific_name),
  });

  const remove = useMutation({
    mutationFn: () => softDeletePlant(db, plantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
      router.back();
    },
  });

  const onWater = () =>
    water.mutate(plantId, {
      onSuccess: () => {
        setCelebrating(true);
        queryClient.invalidateQueries({ queryKey: ['waterings', plantId] });
      },
    });

  const now = new Date();
  const care = careQuery.data;
  const toxic = care?.poisonous_to_pets;

  return (
    <View style={t.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View>
          {plant?.image_uri ? (
            <Image source={{ uri: plant.image_uri }} style={s.hero} />
          ) : (
            <View style={[s.hero, s.heroEmpty]}>
              <Text style={s.heroMark}>❧</Text>
            </View>
          )}
          <Pressable
            style={[s.back, { top: insets.top + 8 }]}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Text style={s.backMark}>←</Text>
          </Pressable>
        </View>

        {plantQuery.isPending && <ActivityIndicator color={colors.leaf} style={s.spinner} />}

        <View style={s.gutter}>
          <ErrorText
            message={plantQuery.error?.message ?? water.error?.message ?? remove.error?.message}
          />
        </View>

        {plant && (
          <>
            <View style={s.head}>
              <Text style={t.title}>{plantName(plant)}</Text>
              {plant.scientific_name ? (
                <Text style={[t.latin, s.latin]}>{plant.scientific_name}</Text>
              ) : (
                <Text style={[t.bodyMuted, s.latin]}>No species recorded.</Text>
              )}
              {toxic !== undefined && (
                <View style={s.chips}>
                  <View
                    style={[
                      s.chip,
                      toxic === true && s.chipAlarm,
                      toxic === null && s.chipUnknown,
                    ]}
                  >
                    <Text
                      style={[
                        s.chipText,
                        toxic === true && s.chipTextAlarm,
                        toxic === null && s.chipTextUnknown,
                      ]}
                    >
                      {toxic === true
                        ? 'Toxic to pets'
                        : toxic === null
                          ? 'Toxicity unknown'
                          : 'Not listed as toxic'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={s.schedule}>
              <View style={s.ring}>
                <View style={s.ringTrack} />
                <View
                  style={[
                    s.ringFill,
                    {
                      borderTopColor: plant.is_due ? colors.toxIcon : colors.leaf,
                      borderRightColor:
                        progress(plant) > 0.5
                          ? plant.is_due
                            ? colors.toxIcon
                            : colors.leaf
                          : 'transparent',
                    },
                  ]}
                />
                <Text style={s.ringNum}>
                  {plant.days_until_due === null ? '—' : Math.abs(plant.days_until_due)}
                </Text>
              </View>
              <View style={s.scheduleText}>
                <Text style={t.name}>{dueLabel(plant)}</Text>
                <Text style={[t.meta, s.scheduleMeta]}>
                  {plant.interval_days
                    ? `Every ${plant.interval_days} days`
                    : 'No interval set'}
                  {plant.anchor === 'created' ? ' · not watered yet' : ''}
                </Text>
              </View>
              <Pressable
                style={[s.waterButton, water.isPending && t.buttonDisabled]}
                disabled={water.isPending}
                onPress={onWater}
              >
                <Text style={s.waterText}>{water.isPending ? '…' : 'Water'}</Text>
              </Pressable>
            </View>

            {care && care.match_kind !== 'none' && (
              <View style={s.gutter}>
                <Toxicity care={care} />
              </View>
            )}

            <View style={s.gutter}>
              <View style={s.logHead}>
                <Text style={t.eyebrow}>Watering log</Text>
                <Text style={t.meta}>
                  {logQuery.data?.length ?? 0}{' '}
                  {logQuery.data?.length === 1 ? 'entry' : 'entries'}
                </Text>
              </View>

              {logQuery.data?.length === 0 && (
                <Text style={[t.bodyMuted, s.logEmpty]}>
                  Nothing logged yet. The first drink starts the schedule.
                </Text>
              )}

              {logQuery.data?.map((entry) => (
                <View key={entry.id} style={s.logRow}>
                  <View style={s.logDot} />
                  <Text style={s.logDate}>
                    {new Date(entry.watered_at).toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                  <Text style={t.meta}>{relative(entry.watered_at, now)}</Text>
                </View>
              ))}

              <Text style={[t.meta, s.logNote]}>
                The log is append-only. Entries are never edited or removed.
              </Text>
            </View>

            <View style={s.gutter}>
              <Pressable
                style={t.ghostButton}
                onPress={() => (confirmingDelete ? remove.mutate() : setConfirmingDelete(true))}
              >
                <Text style={[t.ghostButtonText, s.removeText]}>
                  {confirmingDelete ? 'Tap again to remove' : 'Remove this plant'}
                </Text>
              </Pressable>
              {confirmingDelete && (
                <Text style={[t.meta, s.logNote]}>
                  Its watering history is kept even after the plant is removed. The photo is
                  deleted.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {celebrating && <WateredBurst onDone={() => setCelebrating(false)} />}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { width: '100%', height: 268, backgroundColor: '#DBE1CB' },
  heroEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#CADDCD' },
  heroMark: { fontSize: 56, color: colors.leaf, opacity: 0.5 },
  back: {
    position: 'absolute',
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(11,20,13,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backMark: { fontSize: 17, color: '#FFFFFF' },
  spinner: { marginTop: 24 },
  gutter: { paddingHorizontal: 26, paddingTop: 24 },
  head: { paddingHorizontal: 26, paddingTop: 22 },
  latin: { marginTop: 4 },
  chips: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginTop: 14 },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: '#E8EDE3',
  },
  chipAlarm: { backgroundColor: colors.toxBg },
  chipUnknown: { backgroundColor: colors.unknownBg },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  chipTextAlarm: { color: colors.toxInk },
  chipTextUnknown: { color: colors.unknownInk },

  schedule: {
    marginHorizontal: 26,
    marginTop: 22,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#EDF2E8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  ring: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  ringTrack: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: '#DBE0D7',
  },
  ringFill: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  ringNum: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  scheduleText: { flex: 1 },
  scheduleMeta: { marginTop: 5 },
  waterButton: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.forest,
  },
  waterText: { fontFamily: fonts.sansBold, fontSize: 14, color: '#F9F9F2' },

  logHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  logEmpty: { paddingTop: 14 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  logDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.leaf },
  logDate: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  logNote: { marginTop: 14, lineHeight: 16 },
  removeText: { color: colors.toxIcon },
});
