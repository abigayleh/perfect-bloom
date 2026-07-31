import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { plantName, type Plant } from '@/api/types';
import { ErrorText } from '@/components/ErrorText';
import { HeroPlant } from '@/components/HeroPlant';
import { QueuePill } from '@/components/QueuePill';
import { listPlants } from '@/db/plants';
import { useReminders } from '@/hooks/useReminders';
import { useWaterPlant } from '@/hooks/useWaterPlant';
import { colors, fonts, styles as t } from '@/theme';

/** "Thu 30 July · noon" — the reminder hour is fixed, so it can be stated. */
function today(): string {
  const now = new Date();
  const day = now.toLocaleDateString(undefined, { weekday: 'short' });
  const date = now.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  return `${day} ${date} · noon`;
}

function greeting(due: number, total: number): string {
  if (total === 0) return 'Nothing planted yet.';
  if (due === 0) return "Everyone's had a drink.";
  return due === 1 ? 'One wants water.' : `${due} want water.`;
}

/**
 * The Garden: the plant that needs water most fills the top of the screen, and
 * everything else queues behind it. Answers "who needs water?" before you read.
 */
export default function GardenScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const query = useQuery({ queryKey: ['plants'], queryFn: () => listPlants(db) });
  const water = useWaterPlant();
  const reminders = useReminders(query.data);

  const plants = query.data ?? [];
  const rank = (p: Plant) => p.days_until_due ?? Number.POSITIVE_INFINITY;
  const thirsty = plants.filter((p) => p.is_due).sort((a, b) => rank(a) - rank(b));
  const [hero, ...queue] = thirsty;
  const resting = plants.filter((p) => !p.is_due).sort((a, b) => rank(a) - rank(b));

  const open = (id: number) => router.push({ pathname: '/plant/[id]', params: { id } });

  return (
    <View style={t.screenWarm}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />
        }
      >
        <View style={s.gutter}>
          <View style={s.topRow}>
            <Text style={[t.eyebrow, s.dateLabel]}>{today()}</Text>
            {plants.length > 0 && (
              <View style={s.chip}>
                <View style={s.chipDot} />
                <Text style={s.chipText}>
                  {thirsty.length > 0 ? `${thirsty.length} thirsty` : 'All watered'}
                </Text>
              </View>
            )}
          </View>

          <Text style={[t.display, s.greeting]}>
            {greeting(thirsty.length, plants.length)}
          </Text>

          <ErrorText message={query.error?.message ?? water.error?.message} />
        </View>

        {query.isPending && <ActivityIndicator color={colors.leaf} style={s.spinner} />}

        {hero && (
          <View style={s.heroGutter}>
            <HeroPlant
              plant={hero}
              watering={water.isPending}
              onWater={() => water.mutate(hero.id)}
              onOpen={() => open(hero.id)}
            />
          </View>
        )}

        {!query.isPending && plants.length > 0 && thirsty.length === 0 && (
          <View style={s.done}>
            <View style={s.doneMark}>
              <Text style={s.doneTick}>✓</Text>
            </View>
            <Text style={[t.title, s.centerText]}>Everyone&apos;s had a drink.</Text>
            {resting.length > 0 && (
              <Text style={[t.bodyMuted, s.centerText, s.doneNote]}>
                Next up is {plantName(resting[0])}
                {resting[0].days_until_due !== null
                  ? `, ${resting[0].days_until_due} days from now.`
                  : '.'}
              </Text>
            )}
          </View>
        )}

        {queue.length > 0 && (
          <View style={s.section}>
            <Text style={[t.eyebrow, s.sectionLabel]}>
              {queue.length === 1 ? 'Then this one' : `Then these ${queue.length}`}
            </Text>
            <View style={s.stack}>
              {queue.map((plant) => (
                <QueuePill key={plant.id} plant={plant} onPress={() => open(plant.id)} />
              ))}
            </View>
          </View>
        )}

        {resting.length > 0 && (
          <View style={s.section}>
            <Text style={[t.eyebrow, s.sectionLabel]}>Resting</Text>
            <View style={s.stack}>
              {resting.map((plant) => (
                <QueuePill key={plant.id} plant={plant} onPress={() => open(plant.id)} />
              ))}
            </View>
          </View>
        )}

        {!query.isPending && plants.length === 0 && (
          <View style={s.gutter}>
            <Text style={t.bodyMuted}>
              Photograph a plant to identify it, or add one by name if you already know it.
            </Text>
          </View>
        )}

        <View style={[s.section, s.stack]}>
          {reminders.granted === false && (
            <Pressable style={t.panel} onPress={reminders.enable}>
              <Text style={t.name}>Turn on watering reminders</Text>
              <Text style={[t.bodyMuted, s.hint]}>
                One notification at noon on the days something needs water.
              </Text>
            </Pressable>
          )}

          <Link href="/identify" asChild>
            <Pressable style={t.button}>
              <Text style={t.buttonText}>Identify a plant</Text>
            </Pressable>
          </Link>
          <Link href="/add" asChild>
            <Pressable style={t.dashedButton}>
              <Text style={t.ghostButtonText}>+  Add a plant manually</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  gutter: { paddingHorizontal: 24 },
  heroGutter: { paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateLabel: { color: '#6F7461' },
  greeting: { marginTop: 14, marginBottom: 20 },
  spinner: { marginTop: 24 },
  section: { paddingHorizontal: 24, paddingTop: 28 },
  sectionLabel: { marginBottom: 14, color: '#6F7461' },
  stack: { gap: 10 },
  hint: { marginTop: 4 },
  centerText: { textAlign: 'center' },
  doneNote: { marginTop: 9 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 11,
    borderRadius: 999,
    backgroundColor: colors.streakBg,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.streakDot },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.unknownInk,
  },

  done: {
    marginHorizontal: 20,
    paddingVertical: 46,
    paddingHorizontal: 26,
    borderRadius: 30,
    backgroundColor: colors.doneBg,
    alignItems: 'center',
  },
  doneMark: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.doneRing,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  doneTick: { fontSize: 38, color: '#F6F7E7' },
});
