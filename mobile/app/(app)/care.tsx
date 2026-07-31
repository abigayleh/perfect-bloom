import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { ErrorText } from '@/components/ErrorText';
import { Toxicity } from '@/components/Toxicity';
import { colors, fonts, styles as t } from '@/theme';

/** A label/value pair on a hairline rule — the design's care table. */
function CareRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={s.row}>
      <Text style={s.rowKey}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

export default function CareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name, image_uri: imageUri } = useLocalSearchParams<{
    name: string;
    image_uri?: string;
  }>();

  const query = useQuery({
    queryKey: ['care', name],
    queryFn: () => api.fetchCare(name),
    enabled: Boolean(name),
  });

  const care = query.data;

  return (
    <View style={t.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={s.hero} />
          ) : (
            <View style={[s.hero, s.heroEmpty]} />
          )}
          <Pressable
            style={[s.back, { top: insets.top + 8 }]}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Text style={s.backMark}>←</Text>
          </Pressable>
        </View>

        <View style={s.head}>
          <Text style={t.latinLarge}>{name}</Text>
          {care && care.match_kind !== 'none' && (
            <Text style={[t.bodyMuted, s.subhead]}>
              {care.common_name ?? care.matched_name}
              {care.match_kind === 'genus' ? ' · genus-level match' : ''}
            </Text>
          )}
        </View>

        {query.isPending && (
          <View style={s.loading}>
            <ActivityIndicator color={colors.leaf} />
            <Text style={[t.eyebrow, s.loadingText]}>Consulting the herbarium…</Text>
          </View>
        )}

        <View style={s.gutter}>
          <ErrorText message={query.error?.message} />
        </View>

        {care && care.match_kind !== 'none' && (
          <View style={s.gutter}>
            <Toxicity care={care} />
          </View>
        )}

        {care && care.match_kind === 'genus' && (
          <View style={s.gutter}>
            <Text style={[t.bodyMuted, s.genusNote]}>
              Showing care for the genus {care.matched_name}, not this exact species. Good
              enough for most houseplants, but treat it as general guidance.
            </Text>
          </View>
        )}

        {care && care.match_kind !== 'none' && (
          <View style={s.gutter}>
            <Text style={[t.eyebrow, s.tableHead]}>Care</Text>
            <CareRow label="Water" value={care.watering} />
            <CareRow label="Light" value={care.sunlight.join(', ') || null} />
            <CareRow label="Cycle" value={care.cycle} />
            <Text style={[t.meta, s.provenance]}>
              Care data matched at {care.match_kind} level · Perenual
              {care.from_cache ? ' · cached' : ''}
            </Text>
          </View>
        )}

        {care && care.match_kind === 'none' && (
          <View style={[s.gutter, s.noData]}>
            <Text style={t.titleSmall}>No care data for this one.</Text>
            <Text style={t.bodyMuted}>
              Nothing was published for this species. You can still add it and set your own
              watering interval.
            </Text>
          </View>
        )}
      </ScrollView>

      {care && (
        <LinearGradient
          colors={['rgba(252,250,241,0)', colors.paper]}
          locations={[0, 0.42]}
          style={[s.dock, { paddingBottom: insets.bottom + 18 }]}
        >
          <Pressable
            style={t.button}
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
            <Text style={t.buttonText}>Add to my collection</Text>
          </Pressable>
        </LinearGradient>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { width: '100%', height: 300, backgroundColor: '#DBE1CB' },
  heroEmpty: { backgroundColor: '#CADDCD' },
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
  head: { paddingHorizontal: 26, paddingTop: 24 },
  subhead: { marginTop: 5 },
  gutter: { paddingHorizontal: 26, paddingTop: 22 },
  loading: { paddingVertical: 30, alignItems: 'center', gap: 12 },
  loadingText: { color: colors.muted },
  genusNote: { lineHeight: 19 },
  tableHead: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  rowKey: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedDeep },
  rowValue: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 14.5,
    color: colors.ink,
    textAlign: 'right',
  },
  provenance: { marginTop: 14, lineHeight: 16 },
  noData: { gap: 10 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 26, paddingTop: 26 },
});
