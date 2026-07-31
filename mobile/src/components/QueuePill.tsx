import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { dueLabel, plantName, type Plant } from '@/api/types';
import { colors, fonts } from '@/theme';

/** A plant waiting its turn behind the hero. Thumb, name, and how long it has. */
export function QueuePill({ plant, onPress }: { plant: Plant; onPress: () => void }) {
  return (
    <Pressable style={s.pill} onPress={onPress} accessibilityRole="button">
      {plant.image_uri ? (
        <Image source={{ uri: plant.image_uri }} style={s.thumb} />
      ) : (
        <View style={[s.thumb, s.thumbEmpty]} />
      )}
      <View style={s.text}>
        <Text style={s.name} numberOfLines={1}>
          {plantName(plant)}
        </Text>
        <Text style={s.due} numberOfLines={1}>
          {dueLabel(plant)}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: colors.cardWarm,
  },
  thumb: { width: 46, height: 46, borderRadius: 23 },
  thumbEmpty: { backgroundColor: '#CADDCD' },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  due: { fontFamily: fonts.mono, fontSize: 10, color: colors.mutedLight, marginTop: 2 },
});