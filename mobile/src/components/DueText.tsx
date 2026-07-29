import { Text } from 'react-native';

import { dueLabel, type Plant } from '@/api/types';
import { colors, styles } from '@/theme';

export function DueText({ plant }: { plant: Plant }) {
  const tone = plant.is_due ? colors.error : colors.muted;
  const neverWatered = plant.anchor === 'created' && plant.interval_days !== null;

  return (
    <Text style={[styles.muted, { color: tone }]}>
      {dueLabel(plant)}
      {neverWatered ? ' · not watered yet' : ''}
    </Text>
  );
}
