import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { dueLabel, plantName, type Plant } from '@/api/types';
import { colors, fonts, styles as t } from '@/theme';

/**
 * The plant that needs water most, given the whole top of the screen.
 *
 * The design's signature shape: an arch — fully round at the top, barely rounded
 * at the base — so a photograph of a plant reads like something in a window.
 */
export function HeroPlant({
  plant,
  onWater,
  onOpen,
  watering,
}: {
  plant: Plant;
  onWater: () => void;
  onOpen: () => void;
  watering: boolean;
}) {
  const overdue = plant.is_due;

  return (
    <View style={s.frame}>
      {plant.image_uri ? (
        <Image source={{ uri: plant.image_uri }} style={s.photo} />
      ) : (
        <View style={[s.photo, s.photoEmpty]}>
          <Text style={s.photoEmptyMark}>❧</Text>
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(20,42,26,0.22)', 'rgba(20,42,26,0.86)']}
        locations={[0.32, 0.58, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.caption}>
        <Text style={[s.status, { color: overdue ? '#FFB880' : '#A4DFAF' }]}>
          {dueLabel(plant)}
        </Text>
        <Text style={s.nickname} numberOfLines={2}>
          {plantName(plant)}
        </Text>
        {plant.scientific_name ? (
          <Text style={s.latin} numberOfLines={1}>
            {plant.scientific_name}
          </Text>
        ) : null}

        <View style={s.actions}>
          <Pressable
            style={[t.pill, s.drink, watering && t.buttonDisabled]}
            disabled={watering}
            onPress={onWater}
            accessibilityRole="button"
          >
            <Text style={t.pillText}>{watering ? 'Watering…' : 'Give it a drink'}</Text>
          </Pressable>
          <Pressable style={s.open} onPress={onOpen} accessibilityLabel="Open this plant">
            <Text style={s.openMark}>→</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  frame: {
    borderTopLeftRadius: 200,
    borderTopRightRadius: 200,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#DBE1CB',
  },
  photo: { width: '100%', height: 380 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#CADDCD' },
  photoEmptyMark: { fontSize: 68, color: colors.leaf, opacity: 0.5 },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 22 },
  status: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  nickname: {
    fontFamily: fonts.serif,
    fontSize: 34,
    lineHeight: 37,
    color: '#FDFCF5',
    marginTop: 7,
  },
  latin: {
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    color: '#D5DACB',
    marginTop: 2,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  drink: { flex: 1 },
  open: {
    width: 54,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openMark: { fontSize: 17, color: '#FAF9F1' },
});