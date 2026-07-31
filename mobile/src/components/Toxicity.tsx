import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CareInfo } from '@/api/types';
import { colors, fonts } from '@/theme';

const ASPCA_URL = 'https://www.aspca.org/pet-care/animal-poison-control';

/**
 * The only place toxicity is ever rendered.
 *
 * The design draws the toxic case as a warm alarm card. The other two states are
 * built in the same language but must never borrow an "all clear" green: `null`
 * means the source did not say and reads as unknown; `false` is phrased as
 * "not listed as toxic" rather than "safe", which would overclaim. The ASPCA link
 * lives inside this component so no caller can show a verdict without it.
 */
type Tone = {
  border: string;
  bg: string;
  icon: string;
  ink: string;
  body: string;
  mark: string;
};

const ALARM: Tone = {
  border: colors.toxBorder,
  bg: colors.toxBg,
  icon: colors.toxIcon,
  ink: colors.toxInk,
  body: '#654438',
  mark: '!',
};

const UNKNOWN: Tone = {
  border: colors.unknownBorder,
  bg: colors.unknownBg,
  icon: colors.streakDot,
  ink: colors.unknownInk,
  body: '#6D6659',
  mark: '?',
};

const CLEAR: Tone = {
  border: colors.line,
  bg: colors.card,
  icon: colors.mutedLight,
  ink: colors.inkSoft,
  body: colors.mutedDeep,
  mark: '·',
};

function headline(pets: boolean | null): string {
  if (pets === true) return 'Toxic to cats and dogs';
  if (pets === null) return 'Toxicity to pets is unknown';
  return 'Not listed as toxic to pets';
}

function detail(pets: boolean | null, humans: boolean | null): string {
  const human =
    humans === true
      ? 'Also listed as toxic to humans if eaten.'
      : humans === false
        ? 'Not listed as toxic to humans.'
        : 'Toxicity to humans is unknown.';
  if (pets === null) {
    return `No record was published for this species. Treat it as unknown, not as safe. ${human}`;
  }
  return human;
}

export function Toxicity({ care }: { care: CareInfo }) {
  const pets = care.poisonous_to_pets;
  const tone = pets === true ? ALARM : pets === null ? UNKNOWN : CLEAR;

  return (
    <View style={[s.card, { borderColor: tone.border, backgroundColor: tone.bg }]}>
      <View style={s.row}>
        <View style={[s.mark, { backgroundColor: tone.icon }]}>
          <Text style={s.markText}>{tone.mark}</Text>
        </View>
        <View style={s.text}>
          <Text style={[s.headline, { color: tone.ink }]}>{headline(pets)}</Text>
          <Text style={[s.detail, { color: tone.body }]}>
            {detail(pets, care.poisonous_to_humans)}
          </Text>
          <Text style={[s.source, { color: tone.body }]}>
            {care.toxicity_known ? 'Source · Perenual' : 'No source data · Perenual'}
          </Text>
          <Pressable onPress={() => Linking.openURL(ASPCA_URL)} accessibilityRole="link">
            <Text style={[s.link, { color: tone.ink }]}>ASPCA Animal Poison Control →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1.5, padding: 18 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#FFFFFF' },
  text: { flex: 1 },
  headline: { fontFamily: fonts.sansBold, fontSize: 15.5, lineHeight: 20 },
  detail: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, marginTop: 6 },
  source: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  link: { fontFamily: fonts.sansMedium, fontSize: 13, marginTop: 10 },
});
