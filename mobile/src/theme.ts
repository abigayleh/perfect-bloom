import { StyleSheet } from 'react-native';

/**
 * Fernwise. Ported from the design's oklch values — converted once, here, so no
 * screen carries a raw colour.
 *
 * Warm paper and deep foliage: nothing is pure white or pure black, and every
 * neutral carries a green bias so the greens sit in the same family rather than
 * on top of a grey page.
 */
export const colors = {
  // Grounds
  paper: '#FCFAF1',
  paperWarm: '#FAF7EA',
  card: '#F0F1E8',
  cardWarm: '#F3F1E2',
  white: '#FFFFFF',

  // Ink
  ink: '#202C22',
  inkSoft: '#404B42',
  muted: '#6A756B',
  mutedDeep: '#5C675D',
  mutedLight: '#78847A',

  // Foliage
  forest: '#233F2B',
  forestDeep: '#14301C',
  leaf: '#317A45',
  leafDeep: '#196632',
  leafBright: '#429C5A',

  // Lines
  line: '#D4D9D0',
  lineSoft: '#E6E9E2',

  // Toxicity — a distinct warm family, so it can never read as "fine"
  toxBorder: '#D8714C',
  toxBg: '#FFEFE3',
  toxIcon: '#C55123',
  toxInk: '#7E2401',
  toxMuted: '#8C685C',
  toxLink: '#95330F',

  // Unknown toxicity: amber. Deliberately neither the red alarm nor a green all-clear.
  unknownBorder: '#D5DACB',
  unknownBg: '#F7F5EC',
  unknownInk: '#655406',

  // Streak chip
  streakBg: '#ECEAC8',
  streakDot: '#A78100',

  // Everything watered
  doneBg: '#D4F1D4',
  doneRing: '#1F6538',

  // Dark grounds (identifying)
  night: '#080D09',
  nightSoft: '#111512',
} as const;

/** Family names as registered with expo-font in app/_layout.tsx. */
export const fonts = {
  serif: 'Newsreader_400Regular',
  serifItalic: 'Newsreader_400Regular_Italic',
  serifMedium: 'Newsreader_500Medium',
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansBold: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  screenWarm: { flex: 1, backgroundColor: colors.paperWarm },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  content: { padding: 26, gap: 18 },

  // Type ---------------------------------------------------------------
  display: {
    fontFamily: fonts.serif,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: -0.9,
    color: colors.ink,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  titleSmall: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  /** Binomials are italic serif everywhere they appear. */
  latin: {
    fontFamily: fonts.serifItalic,
    fontSize: 16.5,
    lineHeight: 21,
    color: colors.mutedDeep,
  },
  latinLarge: {
    fontFamily: fonts.serifItalic,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.45,
    color: colors.ink,
  },
  body: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21, color: colors.ink },
  bodyMuted: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.mutedDeep,
  },
  name: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    letterSpacing: -0.1,
    color: colors.ink,
  },
  /** Uppercase mono eyebrow — the design's other signature. */
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  meta: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.mutedLight },

  // Controls -----------------------------------------------------------
  button: {
    paddingVertical: 17,
    borderRadius: 14,
    backgroundColor: colors.forest,
    alignItems: 'center',
  },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 15.5, color: '#F9F9F2' },
  buttonDisabled: { opacity: 0.45 },
  pill: {
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: '#F7F5EC',
    alignItems: 'center',
  },
  pillText: { fontFamily: fonts.sansBold, fontSize: 15.5, color: '#0E2B18' },
  ghostButton: {
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D7C9',
    alignItems: 'center',
  },
  ghostButtonText: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkSoft },
  dashedButton: {
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B9C0B3',
    alignItems: 'center',
  },

  input: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
  },

  // Surfaces -----------------------------------------------------------
  card: { borderRadius: 18, backgroundColor: '#EDF2E8', padding: 20 },
  panel: { borderRadius: 12, backgroundColor: colors.card, padding: 16 },

  error: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.toxInk,
    backgroundColor: colors.toxBg,
    borderRadius: 12,
    padding: 14,
  },
});