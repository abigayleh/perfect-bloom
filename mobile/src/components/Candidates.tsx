import { useRouter } from 'expo-router';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { IdentifyResponse } from '@/api/types';
import { colors, fonts, styles as t } from '@/theme';

/**
 * PlantNet's free tier requires its attribution wherever results are shown, so it
 * renders on the no-match path too. The fake dev provider sends none, because
 * nothing was called and crediting anyone would be a lie.
 */
function Attribution({ attribution }: Pick<IdentifyResponse, 'attribution'>) {
  if (!attribution) return null;
  return (
    <Pressable style={s.credit} onPress={() => Linking.openURL(attribution.url)}>
      <View style={s.creditMark}>
        <Text style={s.creditMarkText}>❋</Text>
      </View>
      <Text style={s.creditText}>{attribution.text}</Text>
    </Pressable>
  );
}

/** Ranked guesses. Confidence is a number and a bar, so the ordering is visible. */
export function Candidates({
  result,
  photoUri,
}: {
  result: IdentifyResponse;
  photoUri: string;
}) {
  const router = useRouter();
  const top = result.candidates[0]?.confidence_percent ?? 0;

  return (
    <View style={s.wrap}>
      <View>
        <Text style={t.title}>Best guesses</Text>
        <Text style={[t.bodyMuted, s.standfirst]}>
          Ranked by confidence. Pick the one that looks right — you can change it later.
        </Text>
      </View>

      {result.candidates.length === 0 ? (
        <View style={s.noMatch}>
          <View style={s.noMatchMark}>
            <Text style={s.noMatchMarkText}>?</Text>
          </View>
          <Text style={[t.titleSmall, s.noMatchTitle]}>No confident match.</Text>
          <Text style={t.bodyMuted}>
            That happens with unusual plants and photos that are hard to read. Try another
            angle, or a close-up of a single leaf.
          </Text>
        </View>
      ) : (
        result.candidates.map((candidate, index) => {
          const strong = candidate.confidence_percent >= 50;
          return (
            <Pressable
              key={candidate.scientific_name}
              style={[s.card, index === 0 && s.cardTop]}
              onPress={() =>
                router.push({
                  pathname: '/care',
                  params: { name: candidate.scientific_name, image_uri: photoUri },
                })
              }
            >
              <View style={s.cardRow}>
                <Image source={{ uri: photoUri }} style={s.thumb} />
                <View style={s.cardText}>
                  <Text style={s.latin} numberOfLines={2}>
                    {candidate.scientific_name}
                  </Text>
                  {candidate.common_names.length > 0 && (
                    <Text style={s.common} numberOfLines={1}>
                      {candidate.common_names.join(', ')}
                    </Text>
                  )}
                </View>
                <Text style={[s.pct, { color: strong ? colors.leaf : colors.mutedLight }]}>
                  {candidate.confidence_percent}%
                </Text>
              </View>
              <View style={s.track}>
                <View
                  style={[
                    s.fill,
                    {
                      width: `${Math.max(candidate.confidence_percent, 2)}%`,
                      backgroundColor: strong ? colors.leaf : '#A1B4A4',
                    },
                  ]}
                />
              </View>
            </Pressable>
          );
        })
      )}

      {result.candidates.length > 0 && top < 40 && (
        <Text style={[t.meta, s.lowNote]}>
          Nothing scored highly. Retake with one leaf filling the frame, or add it by name.
        </Text>
      )}

      <Attribution attribution={result.attribution} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  standfirst: { marginTop: 8 },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  cardTop: { borderColor: colors.leaf, borderWidth: 1.5 },
  cardRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#DBE1CB' },
  cardText: { flex: 1, minWidth: 0 },
  latin: {
    fontFamily: fonts.serifItalic,
    fontSize: 19,
    lineHeight: 23,
    color: colors.ink,
  },
  common: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedDeep, marginTop: 2 },
  pct: { fontFamily: fonts.monoMedium, fontSize: 17 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DFE3DB',
    marginTop: 14,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
  lowNote: { lineHeight: 16 },

  noMatch: { paddingVertical: 12, gap: 10 },
  noMatchMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECEDDE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMatchMarkText: { fontFamily: fonts.serif, fontSize: 30, color: colors.mutedDeep },
  noMatchTitle: { marginTop: 4 },

  credit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 18,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F0F1E8',
  },
  creditMark: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#CADDCD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditMarkText: { fontSize: 15, color: '#344F39' },
  creditText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.mutedDeep,
  },
});
