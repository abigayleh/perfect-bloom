import { Linking, Pressable, Text, View } from 'react-native';

import type { CareInfo } from '@/api/types';
import { colors, styles } from '@/theme';

const ASPCA_URL = 'https://www.aspca.org/pet-care/animal-poison-control';

/**
 * The only place toxicity is ever rendered.
 *
 * Three states, never two. `null` means the source did not say, and it must read
 * as "unknown" — never as safe. `false` is a positive statement from the source,
 * so it is phrased as "not listed as toxic" rather than "safe", which would
 * overclaim. The ASPCA link is inside this component on purpose: it cannot be
 * forgotten by a caller because there is no way to show a verdict without it.
 */
function verdict(value: boolean | null, subject: string): { text: string; tone: string } {
  if (value === true) return { text: `Toxic to ${subject}`, tone: colors.error };
  if (value === false) return { text: `Not listed as toxic to ${subject}`, tone: colors.ink };
  return { text: `Toxicity to ${subject} is unknown`, tone: colors.muted };
}

export function Toxicity({ care }: { care: CareInfo }) {
  const pets = verdict(care.poisonous_to_pets, 'pets');
  const humans = verdict(care.poisonous_to_humans, 'humans');

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Toxicity</Text>

      <Text style={[styles.body, { color: pets.tone }]}>{pets.text}</Text>
      <Text style={[styles.body, { color: humans.tone }]}>{humans.text}</Text>

      {!care.toxicity_known && (
        <Text style={styles.muted}>
          No toxicity data was published for this plant. Treat it as unknown, not as safe.
        </Text>
      )}

      <Pressable onPress={() => Linking.openURL(ASPCA_URL)}>
        <Text style={[styles.link, { marginTop: 8 }]}>ASPCA Animal Poison Control →</Text>
      </Pressable>
    </View>
  );
}
