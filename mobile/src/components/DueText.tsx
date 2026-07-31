import { StyleSheet, Text } from 'react-native';

import { dueLabel, type Plant } from '@/api/types';
import { colors, fonts } from '@/theme';

/** Mono, uppercase — the design treats every machine-derived fact this way. */
export function DueText({ plant }: { plant: Plant }) {
  const neverWatered = plant.anchor === 'created' && plant.interval_days !== null;

  return (
    <Text style={[s.due, { color: plant.is_due ? colors.toxIcon : colors.mutedLight }]}>
      {dueLabel(plant)}
      {neverWatered ? ' · not watered yet' : ''}
    </Text>
  );
}

const s = StyleSheet.create({
  due: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
});
